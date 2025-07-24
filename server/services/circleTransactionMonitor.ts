/**
 * Circle Transaction Monitor Service
 * Monitors incoming USDC transactions and syncs wallet balances
 */

import { circleService } from './circleService';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface TransactionUpdate {
  walletId: string;
  address: string;
  txHash: string;
  amount: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

class CircleTransactionMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  /**
   * Start monitoring all Circle wallets for transaction updates
   */
  public async startMonitoring() {
    if (this.isMonitoring) {
      console.log('🔄 Circle transaction monitoring already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting Circle transaction monitoring...');
    
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllWalletBalances();
    }, 30000);

    // Initial check
    await this.checkAllWalletBalances();
  }

  /**
   * Stop monitoring transactions
   */
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Circle transaction monitoring stopped');
  }

  /**
   * Check all user Circle wallets for balance updates
   */
  private async checkAllWalletBalances() {
    try {
      // Get all users with Circle wallets
      const usersWithWallets = await db
        .select()
        .from(users)
        .where(sql`circle_wallet_id IS NOT NULL AND circle_wallet_address IS NOT NULL`);

      console.log(`🔍 Checking ${usersWithWallets.length} Circle wallets for updates...`);

      for (const user of usersWithWallets) {
        if (user.circleWalletId) {
          await this.syncWalletBalance(user.id, user.circleWalletId);
        }
      }
    } catch (error) {
      console.error('❌ Error checking wallet balances:', error);
    }
  }

  /**
   * Sync specific wallet balance with Circle API
   */
  private async syncWalletBalance(userId: string, walletId: string) {
    try {
      // Get current balance from Circle
      const balances = await circleService.getWalletBalance(walletId);
      
      if (!balances || !Array.isArray(balances)) {
        return;
      }

      // Find USDC balance
      const usdcBalance = balances.find(b => b.tokenId === 'USDC')?.amount || '0.00000000';
      
      // Get current stored balance
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (user.length === 0) {
        return;
      }

      const currentBalance = user[0].usdcBalance || '0.00000000';
      
      // Only update if balance changed
      if (parseFloat(usdcBalance) !== parseFloat(currentBalance)) {
        await db.update(users)
          .set({ 
            usdcBalance: usdcBalance,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        console.log(`💰 Balance updated for user ${userId}: ${currentBalance} → ${usdcBalance} USDC`);
        
        // Log the transaction detection
        if (parseFloat(usdcBalance) > parseFloat(currentBalance)) {
          const difference = (parseFloat(usdcBalance) - parseFloat(currentBalance)).toFixed(6);
          console.log(`📥 Incoming USDC detected: +${difference} USDC for wallet ${walletId}`);
          
          // You could add webhook notifications here
          await this.notifyBalanceUpdate(userId, walletId, difference, 'INCOMING');
        }
      }
    } catch (error) {
      console.error(`❌ Error syncing wallet ${walletId}:`, error);
    }
  }

  /**
   * Get recent transactions for a specific wallet
   */
  public async getWalletTransactions(walletId: string, limit: number = 10) {
    try {
      const transactions = await circleService.listTransactions(walletId, limit);
      return {
        success: true,
        transactions: transactions || []
      };
    } catch (error) {
      console.error(`❌ Error getting transactions for wallet ${walletId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Force sync a specific user's wallet balance
   */
  public async forceSyncUserBalance(userId: string) {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (user.length === 0 || !user[0].circleWalletId) {
        return {
          success: false,
          error: 'User or Circle wallet not found'
        };
      }

      await this.syncWalletBalance(userId, user[0].circleWalletId);
      
      // Get updated balance
      const updatedUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      return {
        success: true,
        balance: updatedUser[0].usdcBalance || '0.00000000',
        walletId: user[0].circleWalletId,
        address: user[0].circleWalletAddress
      };
    } catch (error) {
      console.error(`❌ Error force syncing user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a specific transaction hash affects any of our wallets
   */
  public async checkTransactionHash(txHash: string) {
    try {
      console.log(`🔍 Checking transaction hash: ${txHash}`);
      
      // Get all users with Circle wallets
      const usersWithWallets = await db
        .select()
        .from(users)
        .where(sql`circle_wallet_id IS NOT NULL`);

      const results = [];

      for (const user of usersWithWallets) {
        if (user.circleWalletId) {
          const transactions = await this.getWalletTransactions(user.circleWalletId, 50);
          
          if (transactions.success && transactions.transactions) {
            const matchingTx = transactions.transactions.find((tx: any) => tx.txHash === txHash);
            
            if (matchingTx) {
              results.push({
                userId: user.id,
                walletId: user.circleWalletId,
                address: user.circleWalletAddress,
                transaction: matchingTx
              });
            }
          }
        }
      }

      return {
        success: true,
        matches: results,
        txHash: txHash
      };
    } catch (error) {
      console.error(`❌ Error checking transaction hash ${txHash}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Notify about balance updates (placeholder for webhook integration)
   */
  private async notifyBalanceUpdate(userId: string, walletId: string, amount: string, type: 'INCOMING' | 'OUTGOING') {
    // This could be enhanced with:
    // - Email notifications
    // - Push notifications
    // - Webhook calls
    // - Database event logging
    console.log(`📧 Balance notification: User ${userId}, ${type} ${amount} USDC`);
  }

  /**
   * Get monitoring status
   */
  public getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      hasInterval: this.monitoringInterval !== null
    };
  }
}

export const circleTransactionMonitor = new CircleTransactionMonitor();