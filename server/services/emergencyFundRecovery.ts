// Emergency fund recovery using available Circle integration

/**
 * EMERGENCY FUND RECOVERY SERVICE
 * Critical service to locate and recover missing $50 USDC for a1digitalllc@gmail.com
 */

export class EmergencyFundRecovery {
  constructor() {
    // Using existing Circle integration from the platform
  }

  /**
   * Locate missing $50 USDC for a1digital account
   */
  async locateMissingFunds(userId: string, walletId: string) {
    try {
      console.log(`🔍 EMERGENCY: Searching for missing $50 USDC for user ${userId}`);
      
      // 1. Check Circle wallet balance directly
      const walletBalance = await this.checkCircleWalletBalance(walletId);
      
      // 2. Check wallet transaction history
      const transactions = await this.getWalletTransactions(walletId);
      
      // 3. Look for $50 transactions
      const fiftyDollarTransactions = transactions.filter((tx: { amount: string }) =>
        parseFloat(tx.amount) === 50.0 || tx.amount.includes('50')
      );
      
      return {
        walletBalance,
        transactions: fiftyDollarTransactions,
        totalTransactions: transactions.length
      };
      
    } catch (error) {
      console.error('🚨 Emergency fund recovery failed:', error);
      throw error;
    }
  }

  /**
   * Check Circle wallet balance directly via API
   */
  async checkCircleWalletBalance(walletId: string) {
    try {
      // Use fetch with Circle API directly
      const response = await fetch(`https://api.circle.com/v1/wallets/${walletId}/balances`, {
        headers: {
          'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data?.balances?.[0]?.amount || '0';
      }
      return null;
    } catch (error) {
      console.error('Failed to get Circle wallet balance:', error);
      return null;
    }
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(walletId: string): Promise<Array<{ amount: string }>> {
    try {
      const response = await fetch(`https://api.circle.com/v1/wallets/${walletId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.data) ? data.data.filter(
          (transaction: unknown): transaction is { amount: string } =>
            typeof transaction === 'object' &&
            transaction !== null &&
            'amount' in transaction &&
            typeof transaction.amount === 'string',
        ) : [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get wallet transactions:', error);
      return [];
    }
  }

  /**
   * Force sync wallet balance to database
   */
  async forceSyncBalance(userId: string, walletId: string, realBalance: string) {
    try {
      // Update database with real Circle balance
      const db = require('../db').db;
      const { users } = require('../../shared/schema');
      const { eq } = require('drizzle-orm');

      await db
        .update(users)
        .set({ 
          usdc_balance: realBalance,
          last_balance_update: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`✅ Force synced balance for ${userId}: $${realBalance} USDC`);
      return true;
    } catch (error) {
      console.error('Failed to force sync balance:', error);
      return false;
    }
  }

  /**
   * Emergency credit missing funds (if confirmed missing)
   */
  async emergencyCredit(userId: string, amount: string, reason: string) {
    try {
      const db = require('../db').db;
      const { users, transactions } = require('../../shared/schema');
      const { eq } = require('drizzle-orm');

      // Create emergency credit transaction
      await db.insert(transactions).values({
        id: `emergency_credit_${Date.now()}`,
        to_user_id: userId,
        amount: parseFloat(amount),
        currency: 'USD',
        status: 'completed',
        transaction_type: 'emergency_credit',
        message: `Emergency credit: ${reason}`,
        created_at: new Date(),
        completed_at: new Date(),
        metadata: { emergency: true, reason }
      });

      // Update user balance
      await db
        .update(users)
        .set({ 
          usdc_balance: amount,
          last_balance_update: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`🚨 EMERGENCY CREDIT APPLIED: $${amount} to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Emergency credit failed:', error);
      return false;
    }
  }
}

export const emergencyFundRecovery = new EmergencyFundRecovery();