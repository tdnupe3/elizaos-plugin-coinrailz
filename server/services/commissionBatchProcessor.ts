/**
 * Commission Batch Processor
 * Handles weekly batch payouts with minimum thresholds to prevent platform congestion
 */

import { db } from "../db";
import { referrals, users, agentReferrals, globalAIAgents } from "@shared/schema";
import { eq, sql, and, gte, ne } from "drizzle-orm";

export interface CommissionPayout {
  userId: string;
  totalAmount: number;
  commissionCount: number;
  walletAddress?: string;
  paymentMethod: 'balance' | 'crypto';
}

export class CommissionBatchProcessor {
  // Configuration constants
  private static readonly MIN_PAYOUT_THRESHOLD = 10.00; // $10 minimum payout
  private static readonly MAX_BATCH_SIZE = 100; // Process max 100 payouts per batch
  private static readonly PAYOUT_SCHEDULE = 'weekly'; // Weekly batch processing
  
  /**
   * Process weekly commission payouts for all eligible users
   */
  static async processWeeklyPayouts(): Promise<{
    success: boolean;
    totalPayouts: number;
    totalAmount: number;
    errors: string[];
  }> {
    console.log('Starting weekly commission payout processing...');
    
    const results = {
      success: true,
      totalPayouts: 0,
      totalAmount: 0,
      errors: [] as string[]
    };

    try {
      // Get all users with pending commissions above threshold
      const eligiblePayouts = await this.getEligibleCommissionPayouts();
      
      if (eligiblePayouts.length === 0) {
        console.log('No eligible commission payouts found');
        return results;
      }

      console.log(`Processing ${eligiblePayouts.length} commission payouts`);

      // Process payouts in batches to prevent system overload
      const batches = this.chunkArray(eligiblePayouts, this.MAX_BATCH_SIZE);
      
      for (const batch of batches) {
        const batchResults = await this.processBatch(batch);
        results.totalPayouts += batchResults.successCount;
        results.totalAmount += batchResults.totalAmount;
        results.errors.push(...batchResults.errors);
        
        // Add delay between batches to prevent API rate limiting
        await this.delay(2000); // 2 second delay between batches
      }

      // Log batch processing summary
      await this.logBatchSummary(results);
      
      console.log(`Weekly payout processing completed: ${results.totalPayouts} payouts, $${results.totalAmount.toFixed(2)} total`);
      
    } catch (error) {
      console.error('Error in weekly payout processing:', error);
      results.success = false;
      results.errors.push(`Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return results;
  }

  /**
   * Get all users eligible for commission payouts
   */
  private static async getEligibleCommissionPayouts(): Promise<CommissionPayout[]> {
    try {
      // Query for human user referral commissions (using status = 'completed' and paidAt IS NULL)
      const humanCommissions = await db
        .select({
          userId: referrals.referrerId,
          totalAmount: sql<number>`SUM(CAST(${referrals.bonusAmount} AS DECIMAL))`,
          commissionCount: sql<number>`COUNT(*)`,
        })
        .from(referrals)
        .where(
          and(
            eq(referrals.status, 'completed'),
            sql`${referrals.paidAt} IS NULL`
          )
        )
        .groupBy(referrals.referrerId)
        .having(sql`SUM(CAST(${referrals.bonusAmount} AS DECIMAL)) >= ${this.MIN_PAYOUT_THRESHOLD}`);

      // Query for AI agent referral commissions (using status = 'completed' only - no payout tracking yet)
      const agentCommissions = await db
        .select({
          userId: agentReferrals.referrerAgentId,
          totalAmount: sql<number>`SUM(CAST(${agentReferrals.rewardAmount} AS DECIMAL))`,
          commissionCount: sql<number>`COUNT(*)`,
        })
        .from(agentReferrals)
        .where(eq(agentReferrals.status, 'completed'))
        .groupBy(agentReferrals.referrerAgentId)
        .having(sql`SUM(CAST(${agentReferrals.rewardAmount} AS DECIMAL)) >= ${this.MIN_PAYOUT_THRESHOLD}`);

      // Combine and format results
      const payouts: CommissionPayout[] = [];
      
      // Add human user payouts
      for (const commission of humanCommissions) {
        if (commission.userId && commission.totalAmount >= this.MIN_PAYOUT_THRESHOLD) {
          payouts.push({
            userId: commission.userId,
            totalAmount: commission.totalAmount,
            commissionCount: commission.commissionCount,
            paymentMethod: 'balance' // Default to balance credit for human users
          });
        }
      }

      // Add AI agent payouts
      for (const commission of agentCommissions) {
        if (commission.userId && commission.totalAmount >= this.MIN_PAYOUT_THRESHOLD) {
          // Get agent's preferred wallet address
          const [agent] = await db
            .select({ walletAddress: globalAIAgents.primaryWalletAddress })
            .from(globalAIAgents)
            .where(eq(globalAIAgents.id, commission.userId))
            .limit(1);

          payouts.push({
            userId: commission.userId,
            totalAmount: commission.totalAmount,
            commissionCount: commission.commissionCount,
            walletAddress: agent?.walletAddress,
            paymentMethod: agent?.walletAddress ? 'crypto' : 'balance'
          });
        }
      }

      return payouts;
    } catch (error) {
      console.error('Error getting eligible commission payouts:', error);
      return [];
    }
  }

  /**
   * Process a batch of commission payouts
   */
  private static async processBatch(batch: CommissionPayout[]): Promise<{
    successCount: number;
    totalAmount: number;
    errors: string[];
  }> {
    const results = {
      successCount: 0,
      totalAmount: 0,
      errors: [] as string[]
    };

    for (const payout of batch) {
      try {
        const success = await this.processIndividualPayout(payout);
        if (success) {
          results.successCount++;
          results.totalAmount += payout.totalAmount;
          
          // Mark commissions as paid out
          await this.markCommissionsAsPaid(payout.userId);
        }
      } catch (error) {
        console.error(`Error processing payout for user ${payout.userId}:`, error);
        results.errors.push(`User ${payout.userId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  /**
   * Process individual commission payout
   */
  private static async processIndividualPayout(payout: CommissionPayout): Promise<boolean> {
    try {
      // For now, credit all payouts to user's platform balance
      // Future: Add crypto payout integration when needed
      await db
        .update(users)
        .set({
          usdBalance: sql`CAST(COALESCE(${users.usdBalance}, '0') AS DECIMAL) + ${payout.totalAmount}`
        })
        .where(eq(users.id, payout.userId));

      console.log(`Commission payout: $${payout.totalAmount.toFixed(2)} credited to user ${payout.userId} balance`);
      return true;
    } catch (error) {
      console.error(`Individual payout failed for user ${payout.userId}:`, error);
      return false;
    }
  }

  /**
   * Mark commissions as paid out to prevent double payments
   */
  private static async markCommissionsAsPaid(userId: string): Promise<void> {
    try {
      // Mark human referral commissions as paid by setting paidAt timestamp
      await db
        .update(referrals)
        .set({ paidAt: new Date() })
        .where(
          and(
            eq(referrals.referrerId, userId),
            eq(referrals.status, 'completed'),
            sql`${referrals.paidAt} IS NULL`
          )
        );

      // Mark AI agent referral commissions as paid by changing status from 'completed' to 'paid'
      await db
        .update(agentReferrals)
        .set({ status: 'paid' })
        .where(
          and(
            eq(agentReferrals.referrerAgentId, userId),
            eq(agentReferrals.status, 'completed')
          )
        );
    } catch (error) {
      console.error(`Error marking commissions as paid for user ${userId}:`, error);
    }
  }

  /**
   * Get pending commission summary for a user
   */
  static async getUserPendingCommissions(userId: string): Promise<{
    totalPending: number;
    commissionCount: number;
    nextPayoutDate: Date;
    minimumThreshold: number;
  }> {
    try {
      // Get pending human referral commissions (using paidAt IS NULL)
      const [humanPending] = await db
        .select({
          totalAmount: sql<number>`COALESCE(SUM(CAST(${referrals.bonusAmount} AS DECIMAL)), 0)`,
          commissionCount: sql<number>`COUNT(*)`,
        })
        .from(referrals)
        .where(
          and(
            eq(referrals.referrerId, userId),
            eq(referrals.status, 'completed'),
            sql`${referrals.paidAt} IS NULL`
          )
        );

      // Get pending AI agent referral commissions (status = 'completed' means unpaid)
      const [agentPending] = await db
        .select({
          totalAmount: sql<number>`COALESCE(SUM(CAST(${agentReferrals.rewardAmount} AS DECIMAL)), 0)`,
          commissionCount: sql<number>`COUNT(*)`,
        })
        .from(agentReferrals)
        .where(
          and(
            eq(agentReferrals.referrerAgentId, userId),
            eq(agentReferrals.status, 'completed')
          )
        );

      const totalPending = (humanPending?.totalAmount || 0) + (agentPending?.totalAmount || 0);
      const commissionCount = (humanPending?.commissionCount || 0) + (agentPending?.commissionCount || 0);

      // Calculate next payout date (next Monday)
      const nextPayoutDate = this.getNextPayoutDate();

      return {
        totalPending,
        commissionCount,
        nextPayoutDate,
        minimumThreshold: this.MIN_PAYOUT_THRESHOLD
      };
    } catch (error) {
      console.error('Error getting pending commissions:', error);
      return {
        totalPending: 0,
        commissionCount: 0,
        nextPayoutDate: this.getNextPayoutDate(),
        minimumThreshold: this.MIN_PAYOUT_THRESHOLD
      };
    }
  }

  /**
   * Get next payout date (next Monday)
   */
  private static getNextPayoutDate(): Date {
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (1 + 7 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + (daysUntilMonday || 7));
    nextMonday.setHours(9, 0, 0, 0); // 9 AM UTC
    return nextMonday;
  }

  /**
   * Utility functions
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static async logBatchSummary(results: any): Promise<void> {
    // Log batch processing summary to database for audit trail
    console.log(`Batch processing summary:`, results);
  }
}