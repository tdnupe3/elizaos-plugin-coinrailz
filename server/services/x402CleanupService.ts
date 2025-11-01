/**
 * x402 Cleanup Service
 * Auto-deletes expired payments with analytics aggregation
 * 
 * Runs daily to:
 * 1. Aggregate expired payment data into daily metrics
 * 2. Delete expired payments older than 24 hours
 */

import * as cron from 'node-cron';
import { db } from '../db';
import { x402Payments, x402DiscoveryMetrics } from '@shared/schema';
import { sql, and, lt, eq } from 'drizzle-orm';

export class X402CleanupService {
  private static instance: X402CleanupService;
  private cronJob: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): X402CleanupService {
    if (!this.instance) {
      this.instance = new X402CleanupService();
    }
    return this.instance;
  }

  /**
   * Start automated cleanup scheduler
   * Runs every hour to mark expired payments as failed and delete old failed records
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️ x402 cleanup scheduler already running');
      return;
    }

    // Run every hour: 0 * * * *
    this.cronJob = cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Skipping x402 cleanup - previous run still in progress');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🧹 Starting daily x402 cleanup...');
        
        const result = await this.aggregateAndCleanup();
        
        console.log(`✅ Cleanup complete: ${result.deleted} expired payments deleted, metrics updated`);
      } catch (error: any) {
        console.error('❌ x402 cleanup failed:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ x402 cleanup scheduler started (runs hourly)');
    
    // Run cleanup immediately on start
    setTimeout(() => {
      this.aggregateAndCleanup().catch(err => 
        console.error('❌ Initial cleanup failed:', err)
      );
    }, 5000); // 5 second delay to allow server to fully start
  }

  /**
   * Aggregate expired payments and delete them
   */
  async aggregateAndCleanup(): Promise<{
    deleted: number;
    metricsUpdated: boolean;
  }> {
    try {
      // Step 1: Mark all expired pending payments as failed
      const expiredUpdateResult = await db
        .update(x402Payments)
        .set({ 
          status: 'failed',
          errorMessage: 'Payment expired - no proof provided'
        })
        .where(
          and(
            lt(x402Payments.expiresAt, sql`NOW()`),
            eq(x402Payments.status, 'pending')
          )
        );

      if (expiredUpdateResult) {
        console.log(`⏰ Marked expired pending payments as failed`);
      }

      // Step 2: Get failed payments older than 24 hours for deletion
      const oldFailedPayments = await db
        .select({
          agentId: x402Payments.agentId,
          status: x402Payments.status,
          walletAddress: x402Payments.walletAddress,
          amount: x402Payments.amount,
        })
        .from(x402Payments)
        .where(
          and(
            lt(x402Payments.createdAt, sql`NOW() - INTERVAL '24 hours'`),
            eq(x402Payments.status, 'failed')
          )
        );

      if (oldFailedPayments.length === 0) {
        console.log('📭 No old failed payments to clean up');
        return { deleted: 0, metricsUpdated: false };
      }

      // Calculate metrics
      const uniqueWallets = new Set(
        oldFailedPayments
          .map(p => p.walletAddress)
          .filter(w => w !== null && w !== undefined)
      ).size;

      const byService: Record<string, number> = {};
      oldFailedPayments.forEach(payment => {
        byService[payment.agentId] = (byService[payment.agentId] || 0) + 1;
      });

      // Get yesterday's date for aggregation
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Upsert metrics for yesterday
      await db
        .insert(x402DiscoveryMetrics)
        .values({
          date: dateStr,
          totalPaymentRequests: oldFailedPayments.length,
          uniqueWallets,
          completedPayments: 0,
          expiredPayments: oldFailedPayments.length,
          totalRevenue: '0',
          byService,
        })
        .onConflictDoUpdate({
          target: x402DiscoveryMetrics.date,
          set: {
            totalPaymentRequests: sql`${x402DiscoveryMetrics.totalPaymentRequests} + ${oldFailedPayments.length}`,
            expiredPayments: sql`${x402DiscoveryMetrics.expiredPayments} + ${oldFailedPayments.length}`,
            updatedAt: sql`NOW()`,
          },
        });

      console.log(`📊 Aggregated metrics: ${oldFailedPayments.length} requests, ${uniqueWallets} unique wallets`);

      // Delete old failed payments
      const deleteResult = await db
        .delete(x402Payments)
        .where(
          and(
            lt(x402Payments.createdAt, sql`NOW() - INTERVAL '24 hours'`),
            eq(x402Payments.status, 'failed')
          )
        );

      return {
        deleted: oldFailedPayments.length,
        metricsUpdated: true,
      };
    } catch (error: any) {
      console.error('Error during x402 cleanup:', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for testing or emergency cleanup)
   */
  async runManualCleanup(): Promise<{
    deleted: number;
    metricsUpdated: boolean;
  }> {
    console.log('🧹 Manual x402 cleanup triggered...');
    return await this.aggregateAndCleanup();
  }

  /**
   * Get discovery analytics for a date range
   */
  async getDiscoveryAnalytics(startDate: string, endDate?: string): Promise<any[]> {
    const query = endDate
      ? db
          .select()
          .from(x402DiscoveryMetrics)
          .where(
            and(
              sql`${x402DiscoveryMetrics.date} >= ${startDate}`,
              sql`${x402DiscoveryMetrics.date} <= ${endDate}`
            )
          )
          .orderBy(x402DiscoveryMetrics.date)
      : db
          .select()
          .from(x402DiscoveryMetrics)
          .where(sql`${x402DiscoveryMetrics.date} = ${startDate}`);

    return await query;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 x402 cleanup scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      active: !!this.cronJob,
      running: this.isRunning,
      schedule: 'Daily at 3:00 AM',
    };
  }
}

// Export singleton instance
export const x402CleanupService = X402CleanupService.getInstance();
