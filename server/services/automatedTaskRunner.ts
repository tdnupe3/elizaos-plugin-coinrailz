/**
 * Automated Task Runner for Production Optimization
 * Handles scheduled tasks like referral processing and performance monitoring
 */

import { ReferralProcessor } from './referralProcessor';
import { PerformanceOptimizer } from './performanceOptimizer';

export class AutomatedTaskRunner {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start all automated background tasks
   */
  static async startAllTasks(): Promise<void> {
    console.log('Starting automated task runner...');

    // Process referral rewards every 5 minutes
    this.scheduleTask('referral-processing', () => {
      this.processReferralRewards();
    }, 5 * 60 * 1000);

    // Optimize network stats caching every 2 minutes
    this.scheduleTask('network-stats-refresh', () => {
      this.refreshNetworkStats();
    }, 2 * 60 * 1000);

    // Clean expired cache entries every 10 minutes
    this.scheduleTask('cache-cleanup', () => {
      PerformanceOptimizer.clearAllCache();
    }, 10 * 60 * 1000);

    // Initialize database indexes on startup
    await this.initializeDatabaseOptimizations();

    console.log('All automated tasks started successfully');
  }

  /**
   * Stop all automated tasks
   */
  static stopAllTasks(): void {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`Stopped task: ${name}`);
    }
    this.intervals.clear();
  }

  /**
   * Schedule a recurring task
   */
  private static scheduleTask(name: string, task: () => void, intervalMs: number): void {
    const interval = setInterval(async () => {
      try {
        await task();
      } catch (error) {
        console.error(`Error in automated task ${name}:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    console.log(`Scheduled task: ${name} (every ${intervalMs / 1000}s)`);
  }

  /**
   * Process pending referral rewards automatically
   */
  private static async processReferralRewards(): Promise<void> {
    try {
      await ReferralProcessor.processPendingRewards();
      console.log('Automated referral processing completed');
    } catch (error) {
      console.error('Error in automated referral processing:', error);
    }
  }

  /**
   * Refresh network statistics cache
   */
  private static async refreshNetworkStats(): Promise<void> {
    try {
      // Invalidate existing cache
      PerformanceOptimizer.invalidateCache('network_stats');
      
      // Warm up the cache with fresh data
      await PerformanceOptimizer.getOptimizedNetworkStats();
      
      console.log('Network stats cache refreshed');
    } catch (error) {
      console.error('Error refreshing network stats:', error);
    }
  }

  /**
   * Initialize database optimizations on startup
   */
  private static async initializeDatabaseOptimizations(): Promise<void> {
    try {
      await PerformanceOptimizer.createProductionIndexes();
      console.log('Database indexes initialized for production performance');
    } catch (error) {
      console.error('Error initializing database optimizations:', error);
    }
  }

  /**
   * Get status of all running tasks
   */
  static getTaskStatus(): any {
    return {
      activeTasks: Array.from(this.intervals.keys()),
      totalTasks: this.intervals.size,
      uptime: process.uptime(),
    };
  }
}