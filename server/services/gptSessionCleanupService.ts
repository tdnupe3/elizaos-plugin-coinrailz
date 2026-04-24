/**
 * GPT Session Cleanup Service
 * Auto-deletes expired GPT auth sessions with analytics aggregation
 * 
 * Runs daily to:
 * 1. Delete expired sessions (past expiresAt date)
 * 2. Clean up orphaned provisional sessions (>7 days old, never linked)
 * 3. Log cleanup metrics for monitoring
 */

import * as cron from 'node-cron';
import { db } from '../db';
import { gptAuthSessions } from '@shared/schema';
import { lt, eq, and, isNull } from 'drizzle-orm';

export class GptSessionCleanupService {
  private static instance: GptSessionCleanupService;
  private cronJob: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): GptSessionCleanupService {
    if (!this.instance) {
      this.instance = new GptSessionCleanupService();
    }
    return this.instance;
  }

  /**
   * Start automated cleanup scheduler
   * Runs daily at 4:00 AM to clean up expired sessions
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️ GPT session cleanup scheduler already running');
      return;
    }

    // Run daily at 4:05 AM — offset 5 min to avoid hourly cleanup cron event-loop contention at :00
    this.cronJob = cron.schedule('5 4 * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Skipping GPT session cleanup - previous run still in progress');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🧹 Starting daily GPT session cleanup...');
        
        const result = await this.cleanup();
        
        console.log(`✅ GPT session cleanup complete: ${result.expiredDeleted} expired, ${result.orphanedDeleted} orphaned sessions deleted`);
      } catch (error: any) {
        console.error('❌ GPT session cleanup failed:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ GPT session cleanup scheduler started (runs daily at 4:00 AM)');
  }

  /**
   * Cleanup expired and orphaned sessions
   */
  async cleanup(): Promise<{
    expiredDeleted: number;
    orphanedDeleted: number;
  }> {
    const now = new Date();
    
    // 1. Delete expired sessions (past expiresAt date)
    const expiredResult = await db.delete(gptAuthSessions)
      .where(lt(gptAuthSessions.expiresAt, now))
      .returning({ id: gptAuthSessions.id });
    
    const expiredDeleted = expiredResult.length;
    
    // 2. Delete orphaned provisional sessions (>7 days old, never linked to a user)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const orphanedResult = await db.delete(gptAuthSessions)
      .where(and(
        eq(gptAuthSessions.status, 'pending_link'),
        isNull(gptAuthSessions.userId),
        lt(gptAuthSessions.createdAt, sevenDaysAgo)
      ))
      .returning({ id: gptAuthSessions.id });
    
    const orphanedDeleted = orphanedResult.length;
    
    // Log metrics
    if (expiredDeleted > 0 || orphanedDeleted > 0) {
      console.log(`📊 GPT session cleanup metrics:`, {
        timestamp: now.toISOString(),
        expiredDeleted,
        orphanedDeleted,
        totalDeleted: expiredDeleted + orphanedDeleted
      });
    }
    
    return { expiredDeleted, orphanedDeleted };
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('⏹️ GPT session cleanup scheduler stopped');
    }
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async runNow(): Promise<{ expiredDeleted: number; orphanedDeleted: number }> {
    if (this.isRunning) {
      throw new Error('Cleanup already in progress');
    }
    
    this.isRunning = true;
    try {
      return await this.cleanup();
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton instance
export const gptSessionCleanupService = GptSessionCleanupService.getInstance();
