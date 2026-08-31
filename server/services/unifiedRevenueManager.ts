/**
 * UNIFIED REVENUE MANAGER
 * Single authority for all revenue collection and commission distribution
 * Addresses commission conflicts identified in business logic audit
 */

import { UnifiedBusinessLogic, type TransactionRequest, type CommissionBreakdown } from './unifiedBusinessLogic';
import { db } from '../db';
import { transactions, users, globalAIAgents, aiMarketplaceCommissions } from '../../shared/schema';
import { eq, and, sum, gte, lte } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

export interface RevenueDistribution {
  transactionId: string;
  totalAmount: string;
  platformRevenue: string;
  agentCommissions: Array<{
    agentId: string;
    amount: string;
    type: 'primary' | 'referral_l1' | 'referral_l2' | 'referral_l3';
  }>;
  coinRailzWallet: {
    circleWalletId: string;
    amount: string; // Net platform revenue after all payouts
  };
  status: 'pending' | 'distributed' | 'failed';
  distributedAt?: Date;
}

export class UnifiedRevenueManager {
  private static readonly COIN_RAILZ_CIRCLE_WALLET_ID = process.env.COIN_RAILZ_CIRCLE_WALLET_ID || 'default-platform-wallet';
  
  /**
   * Process transaction revenue with unified business logic
   * SINGLE SOURCE OF TRUTH for all revenue collection
   */
  static async processTransactionRevenue(
    transactionId: string,
    request: TransactionRequest,
    agentId?: string,
    referralChain?: string[]
  ): Promise<RevenueDistribution> {
    
    // Get comprehensive transaction preview using unified business logic
    const preview = UnifiedBusinessLogic.getTransactionPreview(request);
    
    if (!preview.validation.valid) {
      throw new Error(`Transaction validation failed: ${preview.validation.errors.join(', ')}`);
    }

    const totalRevenue = new Decimal(preview.fees.totalFees);
    const platformRevenue = new Decimal(preview.commissions.platformRevenue);
    const agentCommission = new Decimal(preview.commissions.agentCommission);
    
    const agentCommissions: Array<{
      agentId: string;
      amount: string;
      type: 'primary' | 'referral_l1' | 'referral_l2' | 'referral_l3';
    }> = [];

    // Primary agent commission (85% of fees)
    if (agentId) {
      agentCommissions.push({
        agentId,
        amount: agentCommission.toString(),
        type: 'primary'
      });
    }

    // Referral commissions (limited to 5% of platform revenue)
    let referralPayouts = new Decimal('0');
    if (referralChain && referralChain.length > 0) {
      const referralRates = [
        new Decimal('0.003'), // Level 1: 0.3%
        new Decimal('0.002'), // Level 2: 0.2% 
        new Decimal('0.001')  // Level 3: 0.1%
      ];

      for (let i = 0; i < Math.min(referralChain.length, 3); i++) {
        const referralAmount = totalRevenue.mul(referralRates[i]);
        referralPayouts = referralPayouts.add(referralAmount);
        
        agentCommissions.push({
          agentId: referralChain[i],
          amount: referralAmount.toString(),
          type: `referral_l${i + 1}` as 'referral_l1' | 'referral_l2' | 'referral_l3'
        });
      }

      // Ensure referral payouts don't exceed 5% of platform revenue
      const maxReferralPayout = platformRevenue.mul(new Decimal('0.05'));
      if (referralPayouts.gt(maxReferralPayout)) {
        // Scale down referral commissions proportionally
        const scalingFactor = maxReferralPayout.div(referralPayouts);
        agentCommissions.forEach((commission, index) => {
          if (commission.type !== 'primary') {
            const scaledAmount = new Decimal(commission.amount).mul(scalingFactor);
            agentCommissions[index].amount = scaledAmount.toString();
          }
        });
        referralPayouts = maxReferralPayout;
      }
    }

    // Calculate net platform revenue (after all agent payouts)
    const totalAgentPayouts = agentCommissions.reduce((sum, commission) => 
      sum.add(new Decimal(commission.amount)), new Decimal('0')
    );
    const netPlatformRevenue = totalRevenue.sub(totalAgentPayouts);

    // Create revenue distribution record
    const revenueDistribution: RevenueDistribution = {
      transactionId,
      totalAmount: totalRevenue.toString(),
      platformRevenue: netPlatformRevenue.toString(),
      agentCommissions,
      coinRailzWallet: {
        circleWalletId: this.COIN_RAILZ_CIRCLE_WALLET_ID,
        amount: netPlatformRevenue.toString()
      },
      status: 'pending'
    };

    // Store commission records in database
    await this.recordCommissions(revenueDistribution);

    return revenueDistribution;
  }

  /**
   * Record commission distributions in database
   */
  private static async recordCommissions(distribution: RevenueDistribution): Promise<void> {
    try {
      // Record each agent commission using correct schema fields
      for (const commission of distribution.agentCommissions) {
        await db.insert(aiMarketplaceCommissions).values({
          agentId: commission.agentId,
          commissionRate: commission.type === 'primary' ? '0.85' : '0.003',
          commissionAmount: commission.amount,
          agentTier: 'basic',
          serviceAmount: commission.amount,
          platformFeeRate: commission.type === 'primary' ? '0.15' : '0.997',
          platformFeeAmount: commission.type === 'primary' ? (parseFloat(commission.amount) * 0.15).toString() : '0',
          orderId: distribution.transactionId,
          payoutStatus: 'pending',
          calculatedAt: new Date()
        });
      }

      console.log(`✅ Recorded ${distribution.agentCommissions.length} commission distributions for transaction ${distribution.transactionId}`);
      
    } catch (error) {
      console.error(`❌ Failed to record commissions for transaction ${distribution.transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Execute commission payouts to agents
   */
  static async executeCommissionPayouts(transactionId: string): Promise<{
    success: boolean;
    payouts: number;
    errors: string[];
  }> {
    try {
      // Get all pending commissions for this transaction
      const pendingCommissions = await db
        .select()
        .from(aiMarketplaceCommissions)
        .where(eq(aiMarketplaceCommissions.orderId, transactionId));

      if (pendingCommissions.length === 0) {
        return { success: true, payouts: 0, errors: [] };
      }

      let successfulPayouts = 0;
      const errors: string[] = [];

      for (const commission of pendingCommissions) {
        try {
          // In a real implementation, this would:
          // 1. Transfer USDC from platform wallet to agent's Circle wallet
          // 2. Update agent's balance in their account
          // 3. Record the payout transaction
          
          // For now, we'll mark as paid and log
          await db
            .update(aiMarketplaceCommissions)
            .set({
              paidAt: new Date()
            })
            .where(eq(aiMarketplaceCommissions.id, commission.id));

          console.log(`💰 Commission payout: $${commission.commissionAmount} to agent ${commission.agentId}`);
          successfulPayouts++;

        } catch (error) {
          const errorMsg = `Failed to payout commission ${commission.id}: ${error}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        payouts: successfulPayouts,
        errors
      };

    } catch (error) {
      console.error(`❌ Failed to execute commission payouts for transaction ${transactionId}:`, error);
      return {
        success: false,
        payouts: 0,
        errors: [`System error: ${error}`]
      };
    }
  }

  /**
   * Get revenue analytics for platform monitoring
   */
  static async getRevenueAnalytics(dateFrom: Date, dateTo: Date): Promise<{
    totalRevenue: string;
    platformRevenue: string;
    agentCommissions: string;
    referralPayouts: string;
    transactionCount: number;
    topAgents: Array<{ agentId: string; totalCommissions: string; transactionCount: number }>;
  }> {
    try {
      // Get total commissions in date range
      const commissionSummary = await db
        .select({
          totalCommissions: sum(aiMarketplaceCommissions.commissionAmount)
        })
        .from(aiMarketplaceCommissions)
        .where(and(
          gte(aiMarketplaceCommissions.calculatedAt, dateFrom),
          lte(aiMarketplaceCommissions.calculatedAt, dateTo)
        ));

      const agentCommissions = commissionSummary[0]?.totalCommissions || '0';
      const transactionCount = 0; // Would need separate count query
      
      // Calculate platform revenue (assuming 15% platform commission rate)
      const totalRevenue = new Decimal(agentCommissions).div(new Decimal('0.85'));
      const platformRevenue = totalRevenue.sub(new Decimal(agentCommissions));

      // Calculate referral payouts - simplified for now
      const referralPayouts = '0'; // Would implement proper referral tracking

      // referralPayouts already defined above

      return {
        totalRevenue: totalRevenue.toString(),
        platformRevenue: platformRevenue.toString(),
        agentCommissions,
        referralPayouts,
        transactionCount,
        topAgents: [] // Would implement agent ranking query
      };

    } catch (error) {
      console.error('❌ Failed to get revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Validate commission sustainability
   * Ensures total commissions don't exceed 100% of revenue
   */
  static validateCommissionSustainability(
    totalRevenue: string,
    proposedCommissions: Array<{ amount: string; type: string }>
  ): {
    valid: boolean;
    totalCommissionRate: string;
    warnings: string[];
    maxSustainableCommissions: string;
  } {
    const revenue = new Decimal(totalRevenue);
    const totalCommissions = proposedCommissions.reduce(
      (sum, commission) => sum.add(new Decimal(commission.amount)),
      new Decimal('0')
    );

    const commissionRate = totalCommissions.div(revenue);
    const warnings: string[] = [];

    // Warn if commissions exceed 90%
    if (commissionRate.gt(new Decimal('0.90'))) {
      warnings.push('High commission rate detected - sustainability risk');
    }

    // Error if commissions exceed 100%
    const valid = commissionRate.lte(new Decimal('1.00'));
    const maxSustainableCommissions = revenue.mul(new Decimal('0.90')); // 90% max

    return {
      valid,
      totalCommissionRate: commissionRate.mul(new Decimal('100')).toFixed(2),
      warnings,
      maxSustainableCommissions: maxSustainableCommissions.toString()
    };
  }
}

export default UnifiedRevenueManager;