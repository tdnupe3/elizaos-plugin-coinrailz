/**
 * Transaction Persistence Service
 * Ensures all transactions are properly recorded in database
 */

import { storage } from '../storage';
import type { InsertTransaction, InsertCryptoTransfer } from '@shared/schema';

export interface P2PTransactionData {
  userId: string;
  recipientEmail: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  fee: number;
  total: number;
  memo?: string;
  transactionType: 'p2p_fiat' | 'p2p_crypto';
  requiresKYC: boolean;
}

export interface CryptoTransferData {
  userId: string;
  recipientAddress: string;
  amount: number;
  currency: string;
  fee: number;
  total: number;
  blockchainNetwork: string;
  memo?: string;
  transactionHash?: string;
}

export class TransactionPersistence {
  /**
   * Record P2P fiat transaction in database
   */
  static async recordP2PTransaction(data: P2PTransactionData): Promise<{ success: boolean; transactionId?: number; error?: string }> {
    try {
      const transactionData: InsertTransaction = {
        fromUserId: data.userId,
        amount: data.amount.toString(),
        currency: data.currency,
        status: data.requiresKYC ? 'pending_kyc' : 'completed',
        transactionType: data.transactionType,
        toEmail: data.recipientEmail,
        platformFee: data.fee.toString(),
        message: data.memo ?? null,
        metadata: {
          requiresKYC: data.requiresKYC,
          paymentMethod: data.paymentMethod,
          total: data.total
        }
      };

      const transaction = await storage.createTransaction(transactionData);
      
      // If KYC required, flag for manual review
      if (data.requiresKYC) {
        await this.flagForKYCReview(transaction.id, data.amount, data.currency);
      }

      return {
        success: true,
        transactionId: transaction.id
      };
    } catch (error) {
      console.error('Failed to record P2P transaction:', error);
      return {
        success: false,
        error: 'Failed to record transaction in database'
      };
    }
  }

  /**
   * Record crypto P2P transfer in database
   */
  static async recordCryptoTransfer(data: CryptoTransferData): Promise<{ success: boolean; transferId?: number; error?: string }> {
    try {
      const transferData: InsertCryptoTransfer = {
        fromUserId: data.userId,
        toWalletAddress: data.recipientAddress,
        amount: data.amount.toString(),
        cryptoSymbol: data.currency,
        status: 'pending',
        commissionAmount: data.fee.toString(),
        netAmount: (data.amount - data.fee).toString(),
        blockchainNetwork: data.blockchainNetwork,
        message: data.memo ?? null,
        transactionHash: data.transactionHash ?? null
      };

      const transfer = await storage.createCryptoTransfer(transferData);

      return {
        success: true,
        transferId: transfer.id
      };
    } catch (error) {
      console.error('Failed to record crypto transfer:', error);
      return {
        success: false,
        error: 'Failed to record crypto transfer in database'
      };
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(transactionId: number, status: string, transactionHash?: string): Promise<void> {
    try {
      await storage.updateTransactionStatus(transactionId, status);
      
      if (transactionHash) {
        // Update with transaction hash if provided
        const transaction = await storage.getTransactionById(transactionId);
        if (transaction) {
          // The transactions table has no blockchain hash column, so retain the
          // provider reference in the application log for this legacy record.
          console.log(`Transaction ${transactionId} hash: ${transactionHash}`);
        }
      }
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  }

  /**
   * Update crypto transfer status
   */
  static async updateCryptoTransferStatus(transferId: number, status: string, transactionHash?: string): Promise<void> {
    try {
      await storage.updateCryptoTransferStatus(transferId, status, transactionHash);
    } catch (error) {
      console.error('Failed to update crypto transfer status:', error);
    }
  }

  /**
   * Flag transaction for KYC review
   */
  private static async flagForKYCReview(transactionId: number, amount: number, currency: string): Promise<void> {
    try {
      // Create compliance report for manual review
      await storage.createComplianceReport({
        transactionId,
        reportType: 'kyc_required',
        details: JSON.stringify({
          amount,
          currency,
          reason: amount >= 10000 ? 'CTR_REQUIRED' : 'KYC_THRESHOLD',
          timestamp: new Date().toISOString()
        }),
        status: 'pending_review',
        createdAt: new Date()
      });

      console.log(`Transaction ${transactionId} flagged for KYC review: ${currency} ${amount}`);
    } catch (error) {
      console.error('Failed to flag transaction for KYC:', error);
    }
  }

  /**
   * Get transaction history with proper formatting
   */
  static async getTransactionHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const [transactions, cryptoTransfers] = await Promise.all([
        storage.getUserTransactions(userId, limit),
        storage.getUserCryptoTransfers(userId, limit)
      ]);

      // Format and combine transactions
      const formattedTransactions = transactions.map(tx => ({
        id: tx.id,
        type: 'fiat',
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        status: tx.status,
        recipient: tx.toEmail ? { email: tx.toEmail } : tx.toUserId ? { userId: tx.toUserId } : null,
        fee: tx.platformFee ? parseFloat(tx.platformFee) : 0,
        memo: tx.message,
        createdAt: tx.createdAt,
        paymentMethod: typeof tx.metadata === 'object' && tx.metadata !== null &&
          'paymentMethod' in tx.metadata && typeof tx.metadata.paymentMethod === 'string'
          ? tx.metadata.paymentMethod
          : undefined
      }));

      const formattedCryptoTransfers = cryptoTransfers.map(transfer => ({
        id: transfer.id,
        type: 'crypto',
        amount: parseFloat(transfer.amount),
        currency: transfer.cryptoSymbol,
        status: transfer.status,
        recipient: { address: transfer.toWalletAddress },
        fee: parseFloat(transfer.commissionAmount),
        memo: transfer.message,
        createdAt: transfer.createdAt,
        transactionHash: transfer.transactionHash
      }));

      // Combine and sort by date
      const allTransactions = [...formattedTransactions, ...formattedCryptoTransfers];
      return allTransactions.sort((a, b) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      );
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }
}