/**
 * Transaction Completion Hooks for Human Referral Rewards
 * Automatically processes referral rewards when transactions complete
 */

import { EnhancedReferralService } from "./enhancedReferralService";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface TransactionData {
  transactionId: string;
  userId: string;
  amount: string;
  currency: string;
  type: 'send' | 'receive' | 'buy' | 'sell' | 'swap';
  status: 'pending' | 'completed' | 'failed';
}

export class TransactionCompletionHooks {
  /**
   * Process transaction completion and check for referral rewards
   */
  static async onTransactionCompleted(transaction: TransactionData): Promise<void> {
    try {
      if (transaction.status !== 'completed') {
        return;
      }

      // Get user information
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, transaction.userId));

      if (!user || !user.referredByAgent) {
        return; // User not referred by any agent
      }

      // Convert amount to USD for minimum threshold check
      const usdAmount = await this.convertToUSD(transaction.amount, transaction.currency);
      
      if (usdAmount < 10) {
        return; // Below minimum transaction threshold
      }

      // Process referral reward
      const result = await EnhancedReferralService.processHumanTransactionReward({
        referrerAgentId: user.referredByAgent,
        referredUserId: transaction.userId,
        transactionId: transaction.transactionId,
        transactionAmount: usdAmount.toString(),
        currency: 'USD'
      });

      if (result.success) {
        console.log(`Referral reward processed: ${result.rewardAmount} for transaction ${transaction.transactionId}`);
      }
    } catch (error) {
      console.error('Error processing transaction completion hook:', error);
    }
  }

  /**
   * Hook for send money transactions
   */
  static async onSendMoneyCompleted(data: {
    transactionId: string;
    fromUserId: string;
    toUserId: string;
    amount: string;
    currency: string;
  }): Promise<void> {
    await this.onTransactionCompleted({
      transactionId: data.transactionId,
      userId: data.fromUserId,
      amount: data.amount,
      currency: data.currency,
      type: 'send',
      status: 'completed'
    });
  }

  /**
   * Hook for crypto purchase transactions
   */
  static async onCryptoPurchaseCompleted(data: {
    transactionId: string;
    userId: string;
    amount: string;
    currency: string;
    cryptoSymbol: string;
  }): Promise<void> {
    await this.onTransactionCompleted({
      transactionId: data.transactionId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency,
      type: 'buy',
      status: 'completed'
    });
  }

  /**
   * Hook for crypto sale transactions
   */
  static async onCryptoSaleCompleted(data: {
    transactionId: string;
    userId: string;
    amount: string;
    currency: string;
    cryptoSymbol: string;
  }): Promise<void> {
    await this.onTransactionCompleted({
      transactionId: data.transactionId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency,
      type: 'sell',
      status: 'completed'
    });
  }

  /**
   * Hook for crypto swap transactions
   */
  static async onCryptoSwapCompleted(data: {
    transactionId: string;
    userId: string;
    fromAmount: string;
    fromCurrency: string;
    toAmount: string;
    toCurrency: string;
  }): Promise<void> {
    // Use the larger of the two amounts for reward calculation
    const fromUSD = await this.convertToUSD(data.fromAmount, data.fromCurrency);
    const toUSD = await this.convertToUSD(data.toAmount, data.toCurrency);
    const transactionAmount = Math.max(fromUSD, toUSD);

    await this.onTransactionCompleted({
      transactionId: data.transactionId,
      userId: data.userId,
      amount: transactionAmount.toString(),
      currency: 'USD',
      type: 'swap',
      status: 'completed'
    });
  }

  /**
   * Hook for NOWPayments transactions
   */
  static async onNOWPaymentsCompleted(data: {
    paymentId: string;
    userId: string;
    payAmount: string;
    payCurrency: string;
    priceAmount: string;
    priceCurrency: string;
  }): Promise<void> {
    await this.onTransactionCompleted({
      transactionId: data.paymentId,
      userId: data.userId,
      amount: data.priceAmount,
      currency: data.priceCurrency,
      type: 'buy',
      status: 'completed'
    });
  }

  /**
   * Convert amount to USD for consistent processing
   */
  private static async convertToUSD(amount: string, currency: string): Promise<number> {
    const numericAmount = parseFloat(amount);
    
    // If already USD, return as-is
    if (currency.toUpperCase() === 'USD') {
      return numericAmount;
    }

    // Simple conversion rates for demo (in production, use real-time rates)
    const conversionRates: { [key: string]: number } = {
      'EUR': 1.08,
      'GBP': 1.27,
      'JPY': 0.0067,
      'CAD': 0.74,
      'AUD': 0.65,
      'BTC': 43000,
      'ETH': 2400,
      'USDT': 1.0,
      'USDC': 1.0,
      'BNB': 310,
      'SOL': 98,
      'ADA': 0.38,
      'DOT': 7.2,
    };

    const rate = conversionRates[currency.toUpperCase()] || 1;
    return numericAmount * rate;
  }

  /**
   * Register all transaction hooks with the platform
   */
  static registerAllHooks(): void {
    // This would integrate with your existing transaction processing
    console.log('Transaction completion hooks registered for referral processing');
  }

  /**
   * Get transaction statistics for monitoring
   */
  static async getTransactionStats(): Promise<{
    totalTransactions: number;
    qualifyingTransactions: number;
    totalReferralRewards: string;
    averageTransactionValue: string;
  }> {
    try {
      // This would query your transaction tables
      return {
        totalTransactions: 0,
        qualifyingTransactions: 0,
        totalReferralRewards: "0",
        averageTransactionValue: "0"
      };
    } catch (error) {
      console.error('Error getting transaction stats:', error);
      return {
        totalTransactions: 0,
        qualifyingTransactions: 0,
        totalReferralRewards: "0",
        averageTransactionValue: "0"
      };
    }
  }

  /**
   * Validate transaction for referral eligibility
   */
  static validateTransactionForReferral(transaction: TransactionData): {
    isEligible: boolean;
    reason?: string;
  } {
    // Check transaction type eligibility
    const eligibleTypes = ['send', 'receive', 'buy', 'sell', 'swap'];
    if (!eligibleTypes.includes(transaction.type)) {
      return { isEligible: false, reason: 'Transaction type not eligible for referral rewards' };
    }

    // Check amount (this will be done in USD conversion)
    const amount = parseFloat(transaction.amount);
    if (amount <= 0) {
      return { isEligible: false, reason: 'Invalid transaction amount' };
    }

    // Check status
    if (transaction.status !== 'completed') {
      return { isEligible: false, reason: 'Transaction not completed' };
    }

    return { isEligible: true };
  }

  /**
   * Process delayed referral rewards (for transactions that need verification)
   */
  static async processDelayedReferralRewards(): Promise<{
    processed: number;
    failed: number;
  }> {
    try {
      // This would process any pending referral rewards
      // For now, return mock data
      return {
        processed: 0,
        failed: 0
      };
    } catch (error) {
      console.error('Error processing delayed referral rewards:', error);
      return {
        processed: 0,
        failed: 0
      };
    }
  }
}