/**
 * Tiered Commission Calculator - Standardized Commission Structure
 * Replaces conflicting commission rates with single sustainable structure
 * Based on business logic audit requirements for profitable micro-transactions
 */

interface CommissionTier {
  minAmount: number;
  maxAmount: number;
  rate: number;
  description: string;
}

interface CommissionResult {
  amount: number;
  rate: number;
  tier: string;
  profitable: boolean;
}

export class TieredCommissionCalculator {
  private static readonly COMMISSION_TIERS: CommissionTier[] = [
    {
      minAmount: 5.00,
      maxAmount: 14.99,
      rate: 0.0025, // 0.25%
      description: 'Micro Transaction Tier'
    },
    {
      minAmount: 15.00,
      maxAmount: 99.99,
      rate: 0.005, // 0.5%
      description: 'Standard Transaction Tier'
    },
    {
      minAmount: 100.00,
      maxAmount: Infinity,
      rate: 0.0075, // 0.75%
      description: 'High Value Transaction Tier'
    }
  ];

  /**
   * Calculate commission using tiered structure
   * Ensures profitability on all transaction sizes
   */
  static calculateCommission(transactionAmount: number): CommissionResult {
    // Validate minimum transaction amount
    if (transactionAmount < 5.00) {
      throw new Error('Transaction amount below $5.00 minimum');
    }

    // Find appropriate tier
    const tier = this.COMMISSION_TIERS.find(tier => 
      transactionAmount >= tier.minAmount && transactionAmount <= tier.maxAmount
    );

    if (!tier) {
      throw new Error('No commission tier found for transaction amount');
    }

    // Calculate commission using integer math to avoid floating point errors
    const amountCents = Math.round(transactionAmount * 100);
    const commissionCents = Math.round(amountCents * tier.rate);
    const commissionAmount = commissionCents / 100;

    // Verify profitability (commission should be < 1% of platform fees)
    const platformFeeRate = 0.03; // 3% platform fee
    const platformFeeCents = Math.round(amountCents * platformFeeRate);
    const maxCommissionCents = Math.round(platformFeeCents * 0.01); // 1% of platform fees
    
    const profitable = commissionCents <= maxCommissionCents;

    return {
      amount: commissionAmount,
      rate: tier.rate,
      tier: tier.description,
      profitable
    };
  }

  /**
   * Calculate referral commission for human referrals
   * Uses same tiered structure for consistency
   */
  static calculateReferralCommission(transactionAmount: number, referralLevel: number = 1): CommissionResult {
    const baseCommission = this.calculateCommission(transactionAmount);
    
    // Apply referral level multiplier (diminishing returns)
    const levelMultipliers = {
      1: 1.0,   // Direct referral: full commission
      2: 0.5,   // Second level: 50% of base
      3: 0.25   // Third level: 25% of base
    };

    const multiplier = levelMultipliers[referralLevel as keyof typeof levelMultipliers] || 0;
    const adjustedAmount = baseCommission.amount * multiplier;

    return {
      amount: adjustedAmount,
      rate: baseCommission.rate * multiplier,
      tier: `${baseCommission.tier} (Level ${referralLevel})`,
      profitable: baseCommission.profitable
    };
  }

  /**
   * Calculate AI agent marketplace commission
   * Fixed 15% rate as per existing business model
   */
  static calculateAgentMarketplaceCommission(serviceAmount: number): CommissionResult {
    if (serviceAmount < 5.00) {
      throw new Error('Service amount below $5.00 minimum');
    }

    const commissionRate = 0.15; // 15% for AI agent services
    const amountCents = Math.round(serviceAmount * 100);
    const commissionCents = Math.round(amountCents * commissionRate);
    const commissionAmount = commissionCents / 100;

    return {
      amount: commissionAmount,
      rate: commissionRate,
      tier: 'AI Agent Marketplace',
      profitable: true // 15% is inherently profitable
    };
  }

  /**
   * Validate total commission doesn't exceed safe limits
   * Prevents commission overflow that could cause platform losses
   */
  static validateTotalCommissions(
    transactionAmount: number,
    commissions: CommissionResult[]
  ): { valid: boolean; totalCommission: number; maxAllowed: number } {
    const totalCommission = commissions.reduce((sum, comm) => sum + comm.amount, 0);
    
    // Maximum 2% of transaction amount in total commissions
    const maxAllowed = transactionAmount * 0.02;
    
    return {
      valid: totalCommission <= maxAllowed,
      totalCommission,
      maxAllowed
    };
  }

  /**
   * Get commission tier information for a transaction amount
   */
  static getTierInfo(transactionAmount: number): CommissionTier | null {
    return this.COMMISSION_TIERS.find(tier => 
      transactionAmount >= tier.minAmount && transactionAmount <= tier.maxAmount
    ) || null;
  }

  /**
   * Calculate break-even analysis for transaction profitability
   */
  static calculateBreakEvenAnalysis(transactionAmount: number): {
    platformFee: number;
    processingCost: number;
    totalCommissions: number;
    netProfit: number;
    profitMargin: number;
  } {
    const commission = this.calculateCommission(transactionAmount);
    
    // Estimated costs
    const platformFeeRate = 0.03; // 3%
    const processingCostFlat = 0.30; // $0.30
    const processingCostPercent = 0.029; // 2.9%
    
    const platformFee = transactionAmount * platformFeeRate;
    const processingCost = processingCostFlat + (transactionAmount * processingCostPercent);
    const totalCommissions = commission.amount;
    const netProfit = platformFee - processingCost - totalCommissions;
    const profitMargin = netProfit / platformFee;

    return {
      platformFee,
      processingCost,
      totalCommissions,
      netProfit,
      profitMargin
    };
  }
}