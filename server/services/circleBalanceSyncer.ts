/**
 * Circle Balance Syncer Service
 * Automatically syncs Circle wallet balances with database
 * Prevents balance discrepancies like the $50 USDC sync delay
 */

import { circleService } from './circleService.js';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

class CircleBalanceSyncer {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  
  constructor() {
    console.log('🔄 Circle Balance Syncer initialized');
  }

  /**
   * Start automatic balance syncing
   */
  async startSyncing(): Promise<void> {
    if (this.syncInterval) {
      console.log('⚠️ Balance syncer already running');
      return;
    }

    console.log('🚀 Starting Circle balance sync (30-second intervals)');
    
    // Initial sync
    await this.syncAllBalances();
    
    // Schedule regular syncing
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllBalances();
      } catch (error) {
        console.error('❌ Scheduled balance sync failed:', error);
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop automatic balance syncing
   */
  stopSyncing(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Circle balance syncing stopped');
    }
  }

  /**
   * Sync all user balances
   */
  async syncAllBalances(): Promise<{ updated: number; errors: number; total: number }> {
    try {
      const usersWithWallets = await db
        .select()
        .from(users)
        .where(sql`circle_wallet_id IS NOT NULL AND circle_wallet_address IS NOT NULL`);

      if (usersWithWallets.length === 0) {
        return { updated: 0, errors: 0, total: 0 };
      }

      console.log(`🔍 Syncing ${usersWithWallets.length} Circle wallet balances...`);

      let updated = 0;
      let errors = 0;

      for (const user of usersWithWallets) {
        try {
          const wasUpdated = await this.syncUserBalance(user.id, user.circleWalletId!, user.usdcBalance);
          if (wasUpdated) {
            updated++;
            console.log(`✅ Updated balance for ${user.email}`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ Failed to sync balance for ${user.email}:`, error);
        }
      }

      if (updated > 0 || errors > 0) {
        console.log(`📊 Balance sync complete: ${updated} updated, ${errors} errors, ${usersWithWallets.length} total`);
      }

      return { updated, errors, total: usersWithWallets.length };

    } catch (error) {
      console.error('❌ Balance sync failed:', error);
      return { updated: 0, errors: 1, total: 0 };
    }
  }

  /**
   * Sync balance for specific user
   */
  async syncUserBalance(userId: string, walletId: string, currentBalance?: string): Promise<boolean> {
    let retries = 0;
    
    while (retries < this.MAX_RETRIES) {
      try {
        // Get live balance from Circle
        const balances = await circleService.getWalletBalance(walletId);
        
        // Find USDC balance - handle both "USDC" and token ID formats
        let usdcBalance = '0.00000000';
        
        // First try to find by symbol "USDC"
        const usdcBySymbol = balances.find(b => b.tokenId === 'USDC');
        if (usdcBySymbol) {
          usdcBalance = usdcBySymbol.amount || '0.00000000';
        } else {
          // If no "USDC" symbol found, use the first balance (likely USDC with different token ID)
          if (balances.length > 0 && balances[0].amount) {
            usdcBalance = balances[0].amount;
          }
        }

        // Check if update is needed
        const currentBalanceNum = parseFloat(currentBalance || '0.00000000');
        const liveBalanceNum = parseFloat(usdcBalance);

        if (Math.abs(liveBalanceNum - currentBalanceNum) > 0.000001) {
          // Update database
          await db
            .update(users)
            .set({ 
              usdcBalance: usdcBalance,
              lastBalanceUpdate: new Date().toISOString()
            })
            .where(eq(users.id, userId));

          console.log(`💰 Balance updated: ${currentBalanceNum} → ${liveBalanceNum} USDC`);
          return true;
        }

        return false;

      } catch (error) {
        retries++;
        if (retries >= this.MAX_RETRIES) {
          throw error;
        }
        console.log(`⚠️ Retry ${retries}/${this.MAX_RETRIES} for wallet ${walletId}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }

    return false;
  }

  /**
   * Force sync specific user by email
   */
  async forceSyncUser(email: string): Promise<{ success: boolean; oldBalance?: string; newBalance?: string; error?: string }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.circleWalletId) {
        return { success: false, error: 'User has no Circle wallet' };
      }

      const oldBalance = user.usdcBalance || '0.00000000';
      const wasUpdated = await this.syncUserBalance(user.id, user.circleWalletId, oldBalance);

      if (wasUpdated) {
        // Get updated balance
        const [updatedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        return {
          success: true,
          oldBalance: oldBalance,
          newBalance: updatedUser?.usdcBalance || '0.00000000'
        };
      }

      return {
        success: true,
        oldBalance: oldBalance,
        newBalance: oldBalance
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync status
   */
  getStatus(): { running: boolean; interval: number; lastSync?: string } {
    return {
      running: this.syncInterval !== null,
      interval: this.SYNC_INTERVAL_MS / 1000,
      lastSync: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const circleBalanceSyncer = new CircleBalanceSyncer();