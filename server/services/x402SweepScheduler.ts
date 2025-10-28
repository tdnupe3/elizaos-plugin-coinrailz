/**
 * x402 Funds Sweep Scheduler
 * Automatically runs funds sweep every 30 minutes
 */

import * as cron from 'node-cron';
import { x402FundsSweepService } from './x402FundsSweepService';

export class X402SweepScheduler {
  private static instance: X402SweepScheduler;
  private cronJob: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): X402SweepScheduler {
    if (!this.instance) {
      this.instance = new X402SweepScheduler();
    }
    return this.instance;
  }

  /**
   * Start automated sweep scheduler
   * Runs every 30 minutes
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️ x402 sweep scheduler already running');
      return;
    }

    // Run every 30 minutes: 0 */30 * * * *
    this.cronJob = cron.schedule('*/30 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Skipping x402 sweep - previous run still in progress');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🔄 Automated x402 funds sweep starting...');
        
        const result = await x402FundsSweepService.sweepCompletedPayments();
        
        if (result.swept > 0) {
          console.log(`✅ Automated sweep: ${result.swept} payments, $${result.totalAmount.toFixed(2)}`);
        } else {
          console.log('📭 No payments to sweep');
        }
      } catch (error: any) {
        // Expected error until USDC transfer is implemented
        if (error.message?.includes('USDC transfer not implemented')) {
          console.log('⏸️ Sweep skipped: USDC transfer implementation pending');
        } else {
          console.error('❌ Automated sweep failed:', error.message);
        }
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ x402 funds sweep scheduler started (runs every 30 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 x402 sweep scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      active: !!this.cronJob,
      running: this.isRunning,
      schedule: 'Every 30 minutes',
    };
  }
}

// Export singleton instance
export const x402SweepScheduler = X402SweepScheduler.getInstance();
