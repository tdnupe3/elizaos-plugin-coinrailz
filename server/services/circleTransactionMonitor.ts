/**
 * Circle Transaction Monitor Service
 * Monitors incoming USDC transactions and syncs wallet balances
 */

import { CircleService } from './circleService';
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
  private readonly circleService = new CircleService();

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

      console.log(`🔍 Syncing ${usersWithWallets.length} Circle wallet balances...`);

      let updatedCount = 0;
      for (const user of usersWithWallets) {
        if (user.circleWalletId) {
          const result = await this.syncWalletBalance(user.id, user.circleWalletId, user.email ?? undefined);
          if (result.updated) {
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        console.log(`💰 Balance sync complete: ${updatedCount} wallets updated`);
      }
    } catch (error) {
      console.error('❌ Error checking wallet balances:', error);
    }
  }

  /**
   * Sync specific wallet balance with Circle API
   */
  private async syncWalletBalance(userId: string, walletId: string, userEmail?: string): Promise<{ updated: boolean; error?: string }> {
    try {
      // Get current balance from Circle API
      const balances = await this.circleService.getWalletBalance(walletId);
      
      if (!balances || !Array.isArray(balances)) {
        console.log(`⚠️ No balance data returned for wallet ${walletId}`);
        return { updated: false, error: 'No balance data from Circle API' };
      }

      // Find USDC balance
      const usdcBalance = balances.find(b => b.tokenId === 'USDC' || b.tokenId.includes('usdc'))?.amount || '0.00000000';
      
      // Get current stored balance
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (user.length === 0) {
        return { updated: false, error: 'User not found in database' };
      }

      const currentBalance = user[0].usdcBalance || '0.00000000';
      
      // Compare balances with precision handling
      const currentFloat = parseFloat(currentBalance);
      const newFloat = parseFloat(usdcBalance);
      
      // Only update if balance changed (with small tolerance for floating point precision)
      if (Math.abs(newFloat - currentFloat) > 0.000001) {
        await db.update(users)
          .set({ 
            usdcBalance: usdcBalance,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        const displayEmail = userEmail || userId;
        console.log(`💰 Balance updated for ${displayEmail}: ${currentBalance} → ${usdcBalance} USDC`);
        
        // Log transaction detection
        if (newFloat > currentFloat) {
          const difference = (newFloat - currentFloat).toFixed(6);
          console.log(`📥 Incoming USDC detected: +${difference} USDC for ${displayEmail} (wallet: ${walletId})`);
          
          // Notify about balance update
          await this.notifyBalanceUpdate(userId, walletId, difference, 'INCOMING');
        } else if (newFloat < currentFloat) {
          const difference = (currentFloat - newFloat).toFixed(6);
          console.log(`📤 Outgoing USDC detected: -${difference} USDC for ${displayEmail} (wallet: ${walletId})`);
          
          await this.notifyBalanceUpdate(userId, walletId, difference, 'OUTGOING');
        }
        
        return { updated: true };
      }
      
      return { updated: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error syncing wallet ${walletId}:`, errorMsg);
      return { updated: false, error: errorMsg };
    }
  }

  /**
   * Get recent transactions for a specific wallet
   */
  public async getWalletTransactions(walletId: string, limit: number = 10) {
    try {
      const transactions = await this.circleService.listTransactions({ walletId });
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

      await this.syncWalletBalance(userId, user[0].circleWalletId, user[0].email ?? undefined);
      
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