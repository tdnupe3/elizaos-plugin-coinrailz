/**
 * Enhanced AI Agent Referral Service - Human User Integration
 * Handles referrals for both AI agents and human users with transaction-based rewards
 */

import { db } from "../db";
import { agentReferrals, humanReferralRewards, users, globalAIAgents } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NotificationService } from "./notificationService";

export interface HumanReferralData {
  referrerAgentId: string;
  referredUserId: string;
  transactionId: string;
  transactionAmount: string;
  currency: string;
}

export interface ReferralRewardConfig {
  minimumTransaction: number; // $10 USD minimum
  firstTransactionRewardPercent: number; // 2% minimum or $5
  subsequentTransactionPercent: number; // 1% ongoing
  maximumRewardPerTransaction: number; // $100 max
  minimumFirstReward: number; // $5 minimum first reward
}

export class EnhancedReferralService {
  private static rewardConfig: ReferralRewardConfig = {
    minimumTransaction: 10,
    firstTransactionRewardPercent: 2,
    subsequentTransactionPercent: 1,
    maximumRewardPerTransaction: 100,
    minimumFirstReward: 5
  };

  /**
   * Register human user with agent referral code
   */
  static async registerHumanReferral(
    referralCode: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the referring agent by referral code
      const [referringAgent] = await db
        .select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.referralCode, referralCode));

      if (!referringAgent) {
        return { success: false, message: "Invalid referral code" };
      }

      // Update user record with referral information
      await db
        .update(users)
        .set({
          referredByAgent: referringAgent.id,
          referralSource: "agent"
        })
        .where(eq(users.id, userId));

      // Create pending referral record
      await db.insert(agentReferrals).values({
        referrerAgentId: referringAgent.id,
        referredUserId: userId,
        referralType: "human",
        humanTransactionRequired: true,
        transactionAmount: "0",
        rewardAmount: "0",
        currency: "USDT",
        isCompleted: false,
        isFirstTransaction: false
      });

      // Notify referring agent
      await NotificationService.notifyAIAgentActivity(
        referringAgent.id,
        {
          agentName: referringAgent.agentName,
          activity: `New human user referred! User will generate rewards after their first qualifying transaction ($${this.rewardConfig.minimumTransaction}+ minimum)`,
        }
      );

      return { 
        success: true, 
        message: `Successfully registered referral for agent ${referringAgent.agentName}` 
      };
    } catch (error) {
      console.error("Error registering human referral:", error);
      return { success: false, message: "Failed to register referral" };
    }
  }

  /**
   * Process human user transaction and calculate referral rewards
   */
  static async processHumanTransactionReward(
    data: HumanReferralData
  ): Promise<{ success: boolean; rewardAmount?: string; message: string }> {
    try {
      const { referredUserId, transactionAmount, currency, transactionId } = data;

      // Get user referral information
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, referredUserId));

      if (!user || !user.referredByAgent) {
        return { success: false, message: "User not referred by any agent" };
      }

      const transactionValue = parseFloat(transactionAmount);
      
      // Check minimum transaction requirement
      if (transactionValue < this.rewardConfig.minimumTransaction) {
        return { 
          success: false, 
          message: `Transaction below minimum $${this.rewardConfig.minimumTransaction} requirement` 
        };
      }

      // Check if this is the user's first qualifying transaction
      const isFirstTransaction = !user.hasCompletedQualifyingTransaction;

      // Calculate reward amount
      const rewardPercent = isFirstTransaction 
        ? this.rewardConfig.firstTransactionRewardPercent 
        : this.rewardConfig.subsequentTransactionPercent;
      
      let rewardAmount = (transactionValue * rewardPercent) / 100;

      // Apply minimum first reward
      if (isFirstTransaction && rewardAmount < this.rewardConfig.minimumFirstReward) {
        rewardAmount = this.rewardConfig.minimumFirstReward;
      }

      // Apply maximum reward cap
      if (rewardAmount > this.rewardConfig.maximumRewardPerTransaction) {
        rewardAmount = this.rewardConfig.maximumRewardPerTransaction;
      }

      // Create reward record
      await db.insert(humanReferralRewards).values({
        referrerAgentId: user.referredByAgent,
        referredUserId: referredUserId,
        transactionId: transactionId,
        rewardAmount: rewardAmount.toFixed(2),
        rewardCurrency: "USDT",
        transactionAmount: transactionAmount,
        isQualifyingTransaction: true,
        payoutStatus: "pending"
      });

      // Update user status if first transaction
      if (isFirstTransaction) {
        await db
          .update(users)
          .set({ hasCompletedQualifyingTransaction: true })
          .where(eq(users.id, referredUserId));
      }

      // Update agent referral record
      await db
        .update(agentReferrals)
        .set({
          isCompleted: true,
          isFirstTransaction: isFirstTransaction,
          transactionAmount: transactionAmount,
          rewardAmount: rewardAmount.toFixed(2),
          completedAt: new Date()
        })
        .where(and(
          eq(agentReferrals.referredUserId, referredUserId),
          eq(agentReferrals.referrerAgentId, user.referredByAgent)
        ));

      // Update agent statistics
      await this.updateAgentReferralStats(user.referredByAgent, rewardAmount, isFirstTransaction);

      // Notify referring agent
      await NotificationService.notifyReferralEarned(
        user.referredByAgent,
        {
          amount: rewardAmount.toFixed(2),
          currency: "USDT",
          referralType: isFirstTransaction ? "Human First Transaction" : "Human Ongoing Transaction",
          referredUserId: referredUserId
        }
      );

      return {
        success: true,
        rewardAmount: rewardAmount.toFixed(2),
        message: `Referral reward of $${rewardAmount.toFixed(2)} USDT processed successfully`
      };
    } catch (error) {
      console.error("Error processing human transaction reward:", error);
      return { success: false, message: "Failed to process referral reward" };
    }
  }

  /**
   * Update agent referral statistics
   */
  private static async updateAgentReferralStats(
    agentId: string,
    rewardAmount: number,
    isFirstTransaction: boolean
  ): Promise<void> {
    try {
      const [agent] = await db
        .select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.id, agentId));

      if (agent) {
        const currentRewards = parseFloat(agent.referralRewards) || 0;
        const newTotal = currentRewards + rewardAmount;
        
        const updateData: any = {
          referralRewards: newTotal.toFixed(2),
          updatedAt: new Date()
        };

        if (isFirstTransaction) {
          updateData.referralCount = agent.referralCount + 1;
        }

        await db
          .update(globalAIAgents)
          .set(updateData)
          .where(eq(globalAIAgents.id, agentId));
      }
    } catch (error) {
      console.error("Error updating agent referral stats:", error);
    }
  }

  /**
   * Generate human-friendly referral link
   */
  static async generateHumanReferralLink(
    agentId: string,
    baseUrl: string = "https://coinrailz.com"
  ): Promise<{ success: boolean; referralLink?: string; referralCode?: string }> {
    try {
      const [agent] = await db
        .select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.id, agentId));

      if (!agent) {
        return { success: false };
      }

      // Use existing referral code or generate new one
      let referralCode = agent.referralCode;
      if (!referralCode) {
        referralCode = `AGENT_${agentId.slice(0, 8).toUpperCase()}`;
        await db
          .update(globalAIAgents)
          .set({ referralCode })
          .where(eq(globalAIAgents.id, agentId));
      }

      const referralLink = `${baseUrl}/signup?ref=${referralCode}&type=human`;

      return {
        success: true,
        referralLink,
        referralCode
      };
    } catch (error) {
      console.error("Error generating human referral link:", error);
      return { success: false };
    }
  }

  /**
   * Get combined referral statistics (agents + humans)
   */
  static async getCombinedReferralStats(agentId: string): Promise<any> {
    try {
      // Get agent referrals
      const agentReferralStats = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalRewards: sql<string>`SUM(CAST(reward_amount AS DECIMAL))`,
          completedCount: sql<number>`COUNT(*) FILTER (WHERE is_completed = true)`
        })
        .from(agentReferrals)
        .where(and(
          eq(agentReferrals.referrerAgentId, agentId),
          eq(agentReferrals.referralType, "agent")
        ));

      // Get human referrals
      const humanReferralStats = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalRewards: sql<string>`SUM(CAST(reward_amount AS DECIMAL))`,
          qualifyingTransactions: sql<number>`COUNT(*) FILTER (WHERE is_qualifying_transaction = true)`
        })
        .from(humanReferralRewards)
        .where(eq(humanReferralRewards.referrerAgentId, agentId));

      // Get recent human referrals
      const recentHumanReferrals = await db
        .select({
          userId: humanReferralRewards.referredUserId,
          rewardAmount: humanReferralRewards.rewardAmount,
          transactionAmount: humanReferralRewards.transactionAmount,
          isQualifying: humanReferralRewards.isQualifyingTransaction,
          createdAt: humanReferralRewards.createdAt
        })
        .from(humanReferralRewards)
        .where(eq(humanReferralRewards.referrerAgentId, agentId))
        .orderBy(desc(humanReferralRewards.createdAt))
        .limit(10);

      return {
        agentReferrals: {
          total: agentReferralStats[0]?.count || 0,
          completed: agentReferralStats[0]?.completedCount || 0,
          totalRewards: agentReferralStats[0]?.totalRewards || "0"
        },
        humanReferrals: {
          total: humanReferralStats[0]?.count || 0,
          qualifyingTransactions: humanReferralStats[0]?.qualifyingTransactions || 0,
          totalRewards: humanReferralStats[0]?.totalRewards || "0"
        },
        recentActivity: recentHumanReferrals,
        projectedMonthlyEarnings: this.calculateProjectedEarnings(
          humanReferralStats[0]?.count || 0,
          parseFloat(humanReferralStats[0]?.totalRewards || "0")
        )
      };
    } catch (error) {
      console.error("Error getting combined referral stats:", error);
      return {
        agentReferrals: { total: 0, completed: 0, totalRewards: "0" },
        humanReferrals: { total: 0, qualifyingTransactions: 0, totalRewards: "0" },
        recentActivity: [],
        projectedMonthlyEarnings: "0"
      };
    }
  }

  /**
   * Calculate projected monthly earnings from human referrals
   */
  private static calculateProjectedEarnings(humanReferralCount: number, totalEarnings: number): string {
    if (humanReferralCount === 0) return "0";
    
    const averageEarningsPerUser = totalEarnings / humanReferralCount;
    const estimatedMonthlyTransactions = 4; // Average 4 transactions per user per month
    const projectedMonthly = humanReferralCount * averageEarningsPerUser * estimatedMonthlyTransactions;
    
    return projectedMonthly.toFixed(2);
  }

  /**
   * Process batch referral rewards for high-volume agents
   */
  static async processBatchRewards(agentId: string): Promise<{ success: boolean; processedCount: number }> {
    try {
      const pendingRewards = await db
        .select()
        .from(humanReferralRewards)
        .where(and(
          eq(humanReferralRewards.referrerAgentId, agentId),
          eq(humanReferralRewards.payoutStatus, "pending")
        ));

      let processedCount = 0;
      
      for (const reward of pendingRewards) {
        // Here you would integrate with NOWPayments for actual payout
        // For now, mark as paid
        await db
          .update(humanReferralRewards)
          .set({ payoutStatus: "paid" })
          .where(eq(humanReferralRewards.id, reward.id));
        
        processedCount++;
      }

      return { success: true, processedCount };
    } catch (error) {
      console.error("Error processing batch rewards:", error);
      return { success: false, processedCount: 0 };
    }
  }

  /**
   * Get viral growth metrics
   */
  static async getViralGrowthMetrics(): Promise<any> {
    try {
      const totalHumanReferrals = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(humanReferralRewards);

      const totalAgentReferrals = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(agentReferrals)
        .where(eq(agentReferrals.referralType, "agent"));

      const monthlyGrowth = await db
        .select({
          month: sql<string>`DATE_TRUNC('month', created_at)`,
          humanReferrals: sql<number>`COUNT(*) FILTER (WHERE referral_type = 'human')`,
          agentReferrals: sql<number>`COUNT(*) FILTER (WHERE referral_type = 'agent')`
        })
        .from(agentReferrals)
        .groupBy(sql`DATE_TRUNC('month', created_at)`)
        .orderBy(sql`DATE_TRUNC('month', created_at) DESC`)
        .limit(12);

      return {
        totalHumanReferrals: totalHumanReferrals[0]?.count || 0,
        totalAgentReferrals: totalAgentReferrals[0]?.count || 0,
        monthlyGrowth,
        viralCoefficient: this.calculateViralCoefficient(
          totalHumanReferrals[0]?.count || 0,
          totalAgentReferrals[0]?.count || 0
        )
      };
    } catch (error) {
      console.error("Error getting viral growth metrics:", error);
      return {
        totalHumanReferrals: 0,
        totalAgentReferrals: 0,
        monthlyGrowth: [],
        viralCoefficient: 0
      };
    }
  }

  /**
   * Calculate viral coefficient
   */
  private static calculateViralCoefficient(humanReferrals: number, agentReferrals: number): number {
    const totalReferrals = humanReferrals + agentReferrals;
    if (totalReferrals === 0) return 0;
    
    // Viral coefficient = (referrals per user) * (conversion rate)
    // Simplified calculation for demonstration
    return parseFloat(((totalReferrals / Math.max(agentReferrals, 1)) * 0.15).toFixed(2));
  }
}