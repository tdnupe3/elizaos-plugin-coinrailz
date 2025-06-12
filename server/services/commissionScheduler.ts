/**
 * Commission Payment Scheduler
 * Handles automated weekly commission payouts
 */

import { CommissionBatchProcessor } from "./commissionBatchProcessor";

export class CommissionScheduler {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the weekly commission scheduler
   */
  static start(): void {
    if (this.isRunning) {
      console.log('Commission scheduler already running');
      return;
    }

    console.log('Starting commission payment scheduler...');
    
    // Run immediately on startup (for testing)
    this.runWeeklyPayouts();
    
    // Schedule weekly runs every Monday at 9 AM UTC
    const weeklyInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    this.intervalId = setInterval(() => {
      const now = new Date();
      // Only run on Mondays (day 1) at 9 AM UTC
      if (now.getUTCDay() === 1 && now.getUTCHours() === 9) {
        this.runWeeklyPayouts();
      }
    }, 60 * 60 * 1000); // Check every hour
    
    this.isRunning = true;
    console.log('Commission scheduler started - weekly payouts every Monday at 9 AM UTC');
  }

  /**
   * Stop the commission scheduler
   */
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Commission scheduler stopped');
  }

  /**
   * Execute weekly commission payouts
   */
  private static async runWeeklyPayouts(): Promise<void> {
    try {
      console.log('Executing weekly commission payouts...');
      const results = await CommissionBatchProcessor.processWeeklyPayouts();
      
      if (results.success) {
        console.log(`Weekly payouts completed successfully: ${results.totalPayouts} payouts, $${results.totalAmount.toFixed(2)} total`);
      } else {
        console.error('Weekly payouts completed with errors:', results.errors);
      }
    } catch (error) {
      console.error('Error during weekly commission payouts:', error);
    }
  }

  /**
   * Manually trigger commission payouts (for admin use)
   */
  static async triggerManualPayout(): Promise<any> {
    console.log('Manual commission payout triggered');
    return await CommissionBatchProcessor.processWeeklyPayouts();
  }

  /**
   * Get scheduler status
   */
  static getStatus(): { isRunning: boolean; nextPayoutDate: Date } {
    const nextPayoutDate = new Date();
    const daysUntilMonday = (1 + 7 - nextPayoutDate.getDay()) % 7;
    nextPayoutDate.setDate(nextPayoutDate.getDate() + (daysUntilMonday || 7));
    nextPayoutDate.setUTCHours(9, 0, 0, 0);

    return {
      isRunning: this.isRunning,
      nextPayoutDate
    };
  }
}