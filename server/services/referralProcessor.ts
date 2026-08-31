/**
 * Automated Referral Reward Processing System
 * Handles perpetual referral payments through NOWPayments API
 */

import { db } from "../db";
import { agentReferrals, globalAIAgents, agentTransactions, walletBalances } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface ReferralReward {
  referrerAgentId: string;
  refereeAgentId: string;
  transactionId: string;
  rewardAmount: string;
  rewardCurrency: string;
  tier: number;
}

export class ReferralProcessor {
  // Profit-optimized referral commission rates (1% total, platform retains 1%)
  private static readonly COMMISSION_RATES = {
    1: 0.005,   // 0.5% first tier 
    2: 0.0025,  // 0.25% second tier
    3: 0.00125, // 0.125% third tier
    4: 0.000625,// 0.0625% fourth tier
    5: 0.000625 // 0.0625% fifth tier
  };

  /**
   * Process referral rewards for a completed transaction
   */
  static async processTransactionReferrals(transactionId: string): Promise<void> {
    try {
      // Get transaction details
      const [transaction] = await db
        .select()
        .from(agentTransactions)
        .where(eq(agentTransactions.transactionId, transactionId));

      if (!transaction || transaction.status !== 'completed') {
        return;
      }

      const transactionAmount = parseFloat(transaction.amount);
      const platformFee = parseFloat(transaction.platformFee);
      
      // Calculate referral rewards from platform fee
      const availableForReferrals = platformFee * 0.4; // 40% of platform fee goes to referrals

      // Get referral chain for the initiator agent
      const referralChain = await this.getReferralChain(transaction.initiatorAgentId);

      const rewards: ReferralReward[] = [];

      // Process up to 5 tiers of referrals
      for (let tier = 1; tier <= 5 && tier <= referralChain.length; tier++) {
        const referrerAgent = referralChain[tier - 1];
        const commissionRate = this.COMMISSION_RATES[tier as keyof typeof this.COMMISSION_RATES];
        const rewardAmount = availableForReferrals * commissionRate;

        if (rewardAmount > 0.01) { // Only process if reward is above minimum threshold
          rewards.push({
            referrerAgentId: referrerAgent.id,
            refereeAgentId: transaction.initiatorAgentId,
            transactionId: transaction.transactionId,
            rewardAmount: rewardAmount.toFixed(8),
            rewardCurrency: transaction.currency,
            tier,
          });
        }
      }

      // Process all rewards
      for (const reward of rewards) {
        await this.processReferralReward(reward);
      }

    } catch (error) {
      console.error('Error processing transaction referrals:', error);
    }
  }

  /**
   * Get the complete referral chain for an agent
   */
  private static async getReferralChain(agentId: string): Promise<any[]> {
    const chain: any[] = [];
    let currentAgentId = agentId;

    // Traverse up the referral chain
    for (let i = 0; i < 5; i++) { // Maximum 5 tiers
      const [referral] = await db
        .select({
          referrerAgent: globalAIAgents,
        })
        .from(agentReferrals)
        .innerJoin(
          globalAIAgents,
          eq(agentReferrals.referrerAgentId, globalAIAgents.id)
        )
        .where(eq(agentReferrals.refereeAgentId, currentAgentId));

      if (!referral) break;

      chain.push(referral.referrerAgent);
      currentAgentId = referral.referrerAgent.id;
    }

    return chain;
  }

  /**
   * Process individual referral reward payment
   */
  private static async processReferralReward(reward: ReferralReward): Promise<void> {
    try {
      // Get referrer agent wallet information
      const [referrerAgent] = await db
        .select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.id, reward.referrerAgentId));

      if (!referrerAgent || referrerAgent.status !== 'active') {
        return;
      }

      // Create NOWPayments payout
      const payoutResult = await this.createCryptoPayout({
        walletAddress: referrerAgent.primaryWalletAddress,
        currency: reward.rewardCurrency,
        amount: parseFloat(reward.rewardAmount),
        description: `Referral reward - Tier ${reward.tier} - Transaction ${reward.transactionId}`,
      });

      // Record the referral reward transaction
      await db.insert(agentTransactions).values({
        transactionId: `ref_${reward.transactionId}_${reward.tier}_${Date.now()}`,
        initiatorAgentId: 'platform',
        recipientAgentId: reward.referrerAgentId,
        transactionType: 'referral_reward',
        amount: reward.rewardAmount,
        currency: reward.rewardCurrency,
        status: 'completed',
        platformFee: '0',
        gasFee: '0',
        agentCommission: '0',
        networkFee: '0',
        totalFees: '0',
        description: `Tier ${reward.tier} referral reward`,
        metadata: {
          originalTransactionId: reward.transactionId,
          referralTier: reward.tier,
          payoutId: payoutResult?.id,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update referrer agent's referral rewards
      await db
        .update(globalAIAgents)
        .set({
          referralRewards: sql`CAST(referral_rewards AS DECIMAL) + ${reward.rewardAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(globalAIAgents.id, reward.referrerAgentId));

      console.log(`Processed referral reward: ${reward.rewardAmount} ${reward.rewardCurrency} to ${reward.referrerAgentId}`);

    } catch (error) {
      console.error('Error processing referral reward:', error);
    }
  }

  /**
   * Create cryptocurrency payout via NOWPayments
   */
  private static async createCryptoPayout(params: {
    walletAddress: string;
    currency: string;
    amount: number;
    description: string;
  }): Promise<any> {
    try {
      // NOWPayments payout API call
      const response = await fetch('https://api.nowpayments.io/v1/payout', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawals: [{
            address: params.walletAddress,
            currency: params.currency.toLowerCase(),
            amount: params.amount,
            extra_id: null,
          }],
        }),
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.text();
        throw new Error(`NOWPayments payout error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Error creating crypto payout:', error);
      throw error;
    }
  }

  /**
   * Process pending referral rewards in batch
   */
  static async processPendingRewards(): Promise<void> {
    try {
      // Get completed transactions from the last hour that haven't been processed
      const recentTransactions = await db.execute(sql`
        SELECT DISTINCT at.transaction_id
        FROM agent_transactions at
        WHERE at.status = 'completed'
          AND at.created_at >= NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM agent_transactions ref
            WHERE ref.metadata->>'originalTransactionId' = at.transaction_id
              AND ref.transaction_type = 'referral_reward'
          )
      `);

      // Process each transaction
      for (const transaction of recentTransactions.rows) {
        await this.processTransactionReferrals(transaction.transaction_id as string);
      }

    } catch (error) {
      console.error('Error processing pending rewards:', error);
    }
  }

  /**
   * Calculate potential earnings for an agent's referral network
   */
  static async calculateReferralEarnings(agentId: string): Promise<any> {
    try {
      const earnings = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT r.referee_agent_id) as total_referrals,
          COALESCE(SUM(CAST(at.amount AS DECIMAL)), 0) as total_referral_rewards,
          COUNT(CASE WHEN r.is_first_transaction THEN 1 END) as active_referrals
        FROM agent_referrals r
        LEFT JOIN agent_transactions at ON at.recipient_agent_id = ${agentId}
          AND at.transaction_type = 'referral_reward'
        WHERE r.referrer_agent_id = ${agentId}
      `);

      const projectedEarnings = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CAST(at.amount AS DECIMAL)) * 0.05, 0) as monthly_projection
        FROM agent_transactions at
        INNER JOIN agent_referrals r ON r.referee_agent_id = at.initiator_agent_id
        WHERE r.referrer_agent_id = ${agentId}
          AND at.created_at >= NOW() - INTERVAL '30 days'
          AND at.status = 'completed'
      `);

      return {
        totalReferrals: earnings.rows[0]?.total_referrals || 0,
        totalEarnings: earnings.rows[0]?.total_referral_rewards || '0',
        activeReferrals: earnings.rows[0]?.active_referrals || 0,
        monthlyProjection: projectedEarnings.rows[0]?.monthly_projection || '0',
      };
    } catch (error) {
      console.error('Error calculating referral earnings:', error);
      return {
        totalReferrals: 0,
        totalEarnings: '0',
        activeReferrals: 0,
        monthlyProjection: '0',
      };
    }
  }

  /**
   * Get referral dashboard data for an agent
   */
  static async getReferralDashboard(agentId: string): Promise<any> {
    try {
      const [earnings, recentRewards, referralTree] = await Promise.all([
        this.calculateReferralEarnings(agentId),
        this.getRecentReferralRewards(agentId),
        this.getReferralTree(agentId),
      ]);

      return {
        earnings,
        recentRewards,
        referralTree,
      };
    } catch (error) {
      console.error('Error getting referral dashboard:', error);
      throw error;
    }
  }

  /**
   * Get recent referral rewards for an agent
   */
  private static async getRecentReferralRewards(agentId: string, limit: number = 10): Promise<any[]> {
    const rewards = await db.execute(sql`
      SELECT 
        at.*,
        ga.agent_name as referee_name
      FROM agent_transactions at
      LEFT JOIN global_ai_agents ga ON at.metadata->>'originalTransactionId' IN (
        SELECT transaction_id FROM agent_transactions WHERE initiator_agent_id = ga.id
      )
      WHERE at.recipient_agent_id = ${agentId}
        AND at.transaction_type = 'referral_reward'
      ORDER BY at.created_at DESC
      LIMIT ${limit}
    `);

    return rewards.rows;
  }

  /**
   * Get referral tree structure for an agent
   */
  private static async getReferralTree(agentId: string): Promise<any[]> {
    const tree = await db.execute(sql`
      SELECT 
        ga.id,
        ga.agent_name,
        ga.reputation,
        r.is_first_transaction,
        r.created_at as referral_date,
        COALESCE(COUNT(at.id), 0) as transaction_count,
        COALESCE(SUM(CAST(at.amount AS DECIMAL)), 0) as total_volume
      FROM agent_referrals r
      INNER JOIN global_ai_agents ga ON r.referee_agent_id = ga.id
      LEFT JOIN agent_transactions at ON at.initiator_agent_id = ga.id
        AND at.status = 'completed'
      WHERE r.referrer_agent_id = ${agentId}
      GROUP BY ga.id, ga.agent_name, ga.reputation, r.is_first_transaction, r.created_at
      ORDER BY total_volume DESC
    `);

    return tree.rows;
  }
}