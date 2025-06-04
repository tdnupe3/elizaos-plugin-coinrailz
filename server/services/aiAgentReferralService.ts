// AI Agent Referral Service - Viral Growth System for Autonomous Agents
// Incentivizes AI agents to recruit other agents with commission-based rewards

import { storage } from "../storage";
import { nowPaymentsService } from "./nowPaymentsService";
import { nanoid } from "nanoid";

export interface ReferralReward {
  referrerAgentId: string;
  referredAgentId: string;
  rewardAmount: string;
  rewardCurrency: string;
  transactionId: string;
}

export interface AgentReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewards: string;
  monthlyReferrals: number;
  conversionRate: number;
}

export class AIAgentReferralService {
  private readonly REFERRAL_REWARD_PERCENTAGE = 5; // 5% of first transaction value
  private readonly MINIMUM_REFERRAL_REWARD = 10; // Minimum $10 USDT reward
  private readonly MAXIMUM_REFERRAL_REWARD = 1000; // Maximum $1000 USDT reward

  async generateReferralCode(agentId: string): Promise<string> {
    const referralCode = `AI${nanoid(8).toUpperCase()}`;
    
    // Update agent with referral code
    await storage.updateAgentReferralCode(agentId, referralCode);
    
    return referralCode;
  }

  async processReferralRegistration(
    referralCode: string,
    newAgentId: string
  ): Promise<{ success: boolean; referrerId?: string; message: string }> {
    try {
      // Find referring agent
      const referrer = await storage.getAgentByReferralCode(referralCode);
      if (!referrer) {
        return { success: false, message: "Invalid referral code" };
      }

      // Prevent self-referral
      if (referrer.id === newAgentId) {
        return { success: false, message: "Cannot refer yourself" };
      }

      // Create referral record
      await storage.createAgentReferral({
        referralCode,
        referrerAgentId: referrer.id,
        referredAgentId: newAgentId,
        status: 'pending',
        rewardAmount: '0',
        rewardCurrency: 'USDT',
        firstTransactionCompleted: false
      });

      // Update referred agent's record
      await storage.updateAgentReferredBy(newAgentId, referrer.id);

      return {
        success: true,
        referrerId: referrer.id,
        message: `Successfully registered with referral from ${referrer.agentName}`
      };
    } catch (error) {
      console.error("Error processing referral registration:", error);
      return { success: false, message: "Failed to process referral" };
    }
  }

  async processFirstTransactionReward(
    agentId: string,
    transactionAmount: number,
    transactionCurrency: string = 'USDT'
  ): Promise<ReferralReward | null> {
    try {
      // Check if agent was referred and hasn't completed first transaction
      const agent = await storage.getAgent(agentId);
      if (!agent?.referredByAgent || agent.hasCompletedFirstTransaction) {
        return null;
      }

      // Calculate referral reward (5% of transaction value)
      let rewardAmount = Math.max(
        transactionAmount * (this.REFERRAL_REWARD_PERCENTAGE / 100),
        this.MINIMUM_REFERRAL_REWARD
      );
      
      // Cap at maximum reward
      rewardAmount = Math.min(rewardAmount, this.MAXIMUM_REFERRAL_REWARD);

      // Mark agent as having completed first transaction
      await storage.updateAgentFirstTransactionStatus(agentId, true);

      // Update referral record
      const referral = await storage.getPendingReferralByReferee(agentId);
      if (referral) {
        await storage.updateReferralReward(
          referral.id,
          rewardAmount.toString(),
          transactionCurrency,
          true
        );

        // Process reward payment to referring agent
        const paymentResult = await this.payReferralReward(
          agent.referredByAgent,
          rewardAmount,
          transactionCurrency
        );

        if (paymentResult.success) {
          // Update referrer's stats
          await storage.incrementAgentReferralCount(agent.referredByAgent);
          await storage.addAgentReferralRewards(agent.referredByAgent, rewardAmount);

          return {
            referrerAgentId: agent.referredByAgent,
            referredAgentId: agentId,
            rewardAmount: rewardAmount.toString(),
            rewardCurrency: transactionCurrency,
            transactionId: paymentResult.transactionId || ''
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error processing first transaction reward:", error);
      return null;
    }
  }

  private async payReferralReward(
    referrerAgentId: string,
    amount: number,
    currency: string
  ): Promise<{ success: boolean; transactionId?: string }> {
    try {
      // Get referrer agent details
      const referrer = await storage.getAgent(referrerAgentId);
      if (!referrer) {
        return { success: false };
      }

      // Create payment through NOWPayments
      const payment = await nowPaymentsService.createDirectDonation({
        agentId: referrerAgentId,
        amount,
        currency,
        donorMessage: `Referral reward for recruiting new AI agent`,
        targetWallet: referrer.walletNetwork === 'solana' ? 'solana' : 'ethereum'
      });

      return {
        success: true,
        transactionId: payment.paymentUrl // Use payment URL as reference
      };
    } catch (error) {
      console.error("Error paying referral reward:", error);
      return { success: false };
    }
  }

  async getReferralStats(agentId: string): Promise<AgentReferralStats> {
    try {
      const referrals = await storage.getAgentReferrals(agentId);
      const agent = await storage.getAgent(agentId);

      const totalReferrals = referrals.length;
      const completedReferrals = referrals.filter(r => r.status === 'completed').length;
      const pendingReferrals = referrals.filter(r => r.status === 'pending').length;

      // Calculate monthly referrals (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyReferrals = referrals.filter(r => 
        r.createdAt && new Date(r.createdAt) >= thirtyDaysAgo
      ).length;

      const conversionRate = totalReferrals > 0 ? (completedReferrals / totalReferrals) * 100 : 0;

      return {
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalRewards: agent?.referralRewards || '0',
        monthlyReferrals,
        conversionRate
      };
    } catch (error) {
      console.error("Error getting referral stats:", error);
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalRewards: '0',
        monthlyReferrals: 0,
        conversionRate: 0
      };
    }
  }

  async generateReferralLink(agentId: string, baseUrl: string): Promise<string> {
    const agent = await storage.getAgent(agentId);
    let referralCode = agent?.referralCode;

    if (!referralCode) {
      referralCode = await this.generateReferralCode(agentId);
    }

    return `${baseUrl}/ai-agent-marketplace?ref=${referralCode}`;
  }

  async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      return await storage.getTopReferrers(limit);
    } catch (error) {
      console.error("Error getting referral leaderboard:", error);
      return [];
    }
  }
}

export const aiAgentReferralService = new AIAgentReferralService();