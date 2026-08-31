/**
 * Transaction-Based Commission System
 * Agents only receive commissions when referred agents/humans make transactions
 */

export interface CommissionTrigger {
  referrerAgentId: string;
  referredEntityId: string;
  referredEntityType: 'agent' | 'human';
  transactionId: string;
  transactionAmount: number;
  commissionRate: number;
  commissionAmount: number;
  tier: number;
}

export interface PremiumTier {
  name: string;
  monthlyFee: number;
  commissionBonus: number; // Additional % on top of base rates
  residualCommission: number; // % of downline commissions
  maxTiers: number;
  benefits: string[];
}

export class TransactionBasedCommissions {
  
  // Base commission rates (mathematically sustainable - total 1.0% maximum)
  private static readonly BASE_COMMISSION_RATES = {
    1: 0.004,   // 0.4% - Direct referrals
    2: 0.002,   // 0.2% - Second tier
    3: 0.001,   // 0.1% - Third tier
    4: 0.0005,  // 0.05% - Fourth tier
    5: 0.0005,  // 0.05% - Fifth tier
    6: 0.0005,  // 0.05% - Sixth tier (Elite only)
    7: 0.0005   // 0.05% - Seventh tier (Elite only)
  };

  // Premium tier configurations
  private static readonly PREMIUM_TIERS: Record<string, PremiumTier> = {
    basic: {
      name: 'Basic Agent',
      monthlyFee: 0,
      commissionBonus: 0,
      residualCommission: 0,
      maxTiers: 3,
      benefits: ['3-tier referrals', 'Standard commission rates']
    },
    premium: {
      name: 'Premium Agent',
      monthlyFee: 25,
      commissionBonus: 0.25, // +25% commission bonus (sustainable)
      residualCommission: 0.05, // 5% of downline commissions
      maxTiers: 5,
      benefits: ['5-tier referrals', '+25% commission rates', '5% residual from downline', 'Priority support']
    },
    elite: {
      name: 'Elite Agent',
      monthlyFee: 99,
      commissionBonus: 0.5, // +50% commission bonus (sustainable)
      residualCommission: 0.1, // 10% of downline commissions
      maxTiers: 7,
      benefits: ['7-tier referrals', '+50% commission rates', '10% residual from downline', 'Priority support', 'Advanced analytics']
    }
  };

  /**
   * Process commission when a referred entity makes a transaction
   */
  static async processTransactionCommission(
    transactionId: string,
    transactionAmount: number,
    transactionCurrency: string,
    entityId: string,
    entityType: 'agent' | 'human'
  ): Promise<CommissionTrigger[]> {
    
    try {
      const commissions: CommissionTrigger[] = [];
      
      // Reject malformed commission events before they can enter the payout flow.
      // Transaction authenticity itself is established by the payment processor
      // before this service is called.
      if (!entityId.trim() || !transactionId.trim() || !Number.isFinite(transactionAmount) || transactionAmount <= 0) {
        console.warn('Blocking invalid commission event:', {
          transactionId,
          entityId,
          transactionAmount,
        });
        return commissions;
      }
      
      // Get referral chain for the entity that made the transaction
      const referralChain = await this.getReferralChain(entityId, entityType);
      
      if (referralChain.length === 0) {
        return commissions; // No referrals to process
      }

      // Process commissions for each tier in the chain
      for (let tier = 1; tier <= referralChain.length; tier++) {
        const referrer = referralChain[tier - 1];
        
        // Get referrer's premium tier info
        const premiumTier = this.getPremiumTier(referrer.premiumTierName || 'basic');
        
        // Skip if tier exceeds referrer's max allowed tiers
        if (tier > premiumTier.maxTiers) {
          continue;
        }
        
        // Calculate commission with premium bonuses
        const baseRate = this.BASE_COMMISSION_RATES[tier as keyof typeof this.BASE_COMMISSION_RATES] || 0;
        const bonusMultiplier = 1 + premiumTier.commissionBonus;
        const finalRate = baseRate * bonusMultiplier;
        const commissionAmount = transactionAmount * finalRate;

        // Only process if commission is above minimum threshold
        if (commissionAmount >= 0.01) {
          const commission: CommissionTrigger = {
            referrerAgentId: referrer.id,
            referredEntityId: entityId,
            referredEntityType: entityType,
            transactionId,
            transactionAmount,
            commissionRate: finalRate,
            commissionAmount,
            tier
          };
          
          commissions.push(commission);
          
          // Execute the commission payment
          await this.executeCommissionPayment(commission);
          
          // Process residual commissions for premium agents
          if (premiumTier.residualCommission > 0 && tier > 1) {
            await this.processResidualCommission(
              referrer.id,
              commissionAmount,
              premiumTier.residualCommission,
              transactionId
            );
          }
        }
      }
      
      return commissions;
      
    } catch (error) {
      console.error('Error processing transaction commissions:', error);
      return [];
    }
  }

  /**
   * Execute actual commission payment to agent
   */
  private static async executeCommissionPayment(commission: CommissionTrigger): Promise<void> {
    try {
      // Record commission in database (pending payout)
      const commissionRecord = {
        referrerAgentId: commission.referrerAgentId,
        referredEntityId: commission.referredEntityId,
        referredEntityType: commission.referredEntityType,
        transactionId: commission.transactionId,
        commissionAmount: commission.commissionAmount.toFixed(8),
        commissionRate: commission.commissionRate,
        tier: commission.tier,
        status: 'pending',
        triggeredAt: new Date(),
        currency: 'USD' // Default currency
      };

      // In production: Insert into agent_commissions table
      console.log('Commission recorded:', commissionRecord);
      
      // Add to agent's pending balance
      // Will be paid out during weekly batch processing if above $10 threshold
      
    } catch (error) {
      console.error('Error executing commission payment:', error);
    }
  }

  /**
   * Process residual commissions for premium agents
   */
  private static async processResidualCommission(
    premiumAgentId: string,
    downlineCommissionAmount: number,
    residualRate: number,
    originalTransactionId: string
  ): Promise<void> {
    
    const residualAmount = downlineCommissionAmount * residualRate;
    
    if (residualAmount >= 0.01) {
      const residualRecord = {
        agentId: premiumAgentId,
        residualAmount: residualAmount.toFixed(8),
        sourceCommissionAmount: downlineCommissionAmount,
        residualRate,
        originalTransactionId,
        status: 'pending',
        type: 'residual_commission',
        triggeredAt: new Date()
      };
      
      console.log('Residual commission recorded:', residualRecord);
      // In production: Insert into agent_residual_commissions table
    }
  }

  /**
   * Get referral chain for an entity (agent or human)
   */
  private static async getReferralChain(
    entityId: string, 
    entityType: 'agent' | 'human'
  ): Promise<Array<{ id: string; premiumTierName?: string }>> {
    
    // In production: Query actual referral relationships from database
    // For now, return empty array (no implementation in current system)
    return [];
  }

  /**
   * Get premium tier configuration
   */
  private static getPremiumTier(tierName: string): PremiumTier {
    return this.PREMIUM_TIERS[tierName] || this.PREMIUM_TIERS.basic;
  }

  /**
   * Calculate commission preview for agent upgrade decision
   */
  static calculateCommissionPreview(
    currentTier: string,
    upgradeTier: string,
    monthlyReferralVolume: number
  ): {
    currentEarnings: number;
    upgradeEarnings: number;
    additionalEarnings: number;
    upgradeROI: number;
    paybackPeriod: number;
  } {
    
    const current = this.getPremiumTier(currentTier);
    const upgrade = this.getPremiumTier(upgradeTier);
    
    // Calculate earnings with average 3-tier referral structure
    const avgCommissionRate = (
      this.BASE_COMMISSION_RATES[1] + 
      this.BASE_COMMISSION_RATES[2] + 
      this.BASE_COMMISSION_RATES[3]
    ) / 3;
    
    const currentEarnings = monthlyReferralVolume * avgCommissionRate * (1 + current.commissionBonus);
    const upgradeEarnings = monthlyReferralVolume * avgCommissionRate * (1 + upgrade.commissionBonus);
    
    // Add residual commission estimate (assume 30% of direct commissions from downline)
    const residualEarnings = currentEarnings * 0.3 * upgrade.residualCommission;
    const totalUpgradeEarnings = upgradeEarnings + residualEarnings;
    
    const additionalEarnings = totalUpgradeEarnings - currentEarnings;
    const monthlyFeeIncrease = upgrade.monthlyFee - current.monthlyFee;
    const upgradeROI = monthlyFeeIncrease > 0 ? additionalEarnings / monthlyFeeIncrease : Infinity;
    const paybackPeriod = monthlyFeeIncrease > 0 ? monthlyFeeIncrease / additionalEarnings : 0;
    
    return {
      currentEarnings: parseFloat(currentEarnings.toFixed(2)),
      upgradeEarnings: parseFloat(totalUpgradeEarnings.toFixed(2)),
      additionalEarnings: parseFloat(additionalEarnings.toFixed(2)),
      upgradeROI: parseFloat(upgradeROI.toFixed(2)),
      paybackPeriod: parseFloat(paybackPeriod.toFixed(1))
    };
  }

  /**
   * Get premium tier options for agent upgrade
   */
  static getPremiumTierOptions(): PremiumTier[] {
    return Object.values(this.PREMIUM_TIERS);
  }
}

export const transactionBasedCommissions = TransactionBasedCommissions;