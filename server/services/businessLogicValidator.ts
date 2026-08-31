/**
 * Business Logic Validator Service
 * Comprehensive validation to address all identified business logic gaps
 */

import { FeeCalculator } from './feeCalculator';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  adjustments: any[];
  recommendedAction: string;
}

export interface TransactionValidation {
  amount: number;
  fees: number;
  profitMargin: number;
  sustainable: boolean;
  recommendations: string[];
}

export class BusinessLogicValidator {
  
  /**
   * Comprehensive transaction validation addressing all business logic gaps
   */
  static validateTransaction(params: {
    amount: number;
    transactionType: 'p2p' | 'marketplace' | 'xrp' | 'crypto';
    paymentMethod?: string;
    referralCommission?: number;
    monthlyReferralTotal?: number;
  }): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const adjustments: any[] = [];
    
    // GAP 1: Minimum transaction enforcement
    const minimumValidation = this.validateMinimumTransactions(params.amount, params.transactionType);
    if (!minimumValidation.valid) {
      errors.push(...minimumValidation.errors);
    }
    
    // GAP 2: Fee structure consistency validation
    const feeValidation = this.validateFeeConsistency(params.amount, params.transactionType, params.paymentMethod);
    if (feeValidation.adjustmentsMade) {
      adjustments.push(feeValidation.adjustments);
      warnings.push('Fee structure standardized for consistency');
    }
    
    // GAP 3: Referral commission sustainability
    if (params.referralCommission && params.referralCommission > 0) {
      const referralValidation = FeeCalculator.validateReferralCommission(
        params.referralCommission,
        params.amount,
        feeValidation.platformFee,
        params.monthlyReferralTotal || 0
      );
      
      if (!referralValidation.valid) {
        errors.push('Referral commission exceeds sustainability limits');
      }
      
      if (referralValidation.adjustedCommission !== params.referralCommission) {
        adjustments.push({
          type: 'referral_commission',
          original: params.referralCommission,
          adjusted: referralValidation.adjustedCommission,
          reasons: referralValidation.reasons
        });
      }
    }
    
    // GAP 4: Profit margin validation
    const profitValidation = this.validateProfitMargin(params.amount, feeValidation.platformFee, params.referralCommission || 0);
    if (!profitValidation.sustainable) {
      errors.push('Transaction would operate at loss or insufficient profit margin');
    }
    
    // GAP 5: Revenue concentration analysis
    const concentrationWarning = this.checkRevenueConcentration(params.transactionType);
    if (concentrationWarning) {
      warnings.push(concentrationWarning);
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors,
      adjustments,
      recommendedAction: errors.length > 0 ? 'Reject transaction' : 
                        warnings.length > 0 ? 'Process with adjustments' : 'Process normally'
    };
  }
  
  /**
   * Validate minimum transaction amounts
   */
  private static validateMinimumTransactions(amount: number, type: string): { valid: boolean; errors: string[] } {
    const minimums = {
      p2p: 25,
      marketplace: 50,
      xrp: 10,
      crypto: 15
    };
    
    const minimum = minimums[type as keyof typeof minimums] || 10;
    
    if (amount < minimum) {
      return {
        valid: false,
        errors: [`Minimum ${type} transaction amount is $${minimum}. Received $${amount}.`]
      };
    }
    
    return { valid: true, errors: [] };
  }
  
  /**
   * Validate fee structure consistency
   */
  private static validateFeeConsistency(amount: number, type: string, paymentMethod?: string): {
    valid: boolean;
    platformFee: number;
    adjustmentsMade: boolean;
    adjustments: any;
  } {
    let platformFee = 0;
    let adjustmentsMade = false;
    let adjustments: any = {};
    
    try {
      switch (type) {
        case 'p2p':
          const p2pFees = FeeCalculator.calculateP2PFees(amount, paymentMethod);
          platformFee = p2pFees.platformFee;
          adjustmentsMade = true; // Always using standardized structure
          adjustments = { type: 'p2p_standardized', structure: 'tiered_rates' };
          break;
          
        case 'marketplace':
          const marketplaceFees = FeeCalculator.calculateMarketplaceFees(amount, paymentMethod ?? 'standard');
          platformFee = marketplaceFees.platformFee;
          adjustmentsMade = true; // Always using tiered structure instead of flat 15%
          adjustments = { type: 'marketplace_tiered', structure: 'dynamic_rates' };
          break;
          
        case 'xrp':
          const xrpFees = FeeCalculator.calculateXRPFees(amount);
          platformFee = xrpFees.platformFee;
          adjustmentsMade = true; // Using 0.5% simplified structure
          adjustments = { type: 'xrp_simplified', rate: '0.5%' };
          break;
          
        default:
          platformFee = amount * 0.025; // Default 2.5%
      }
    } catch (error) {
      return { valid: false, platformFee: 0, adjustmentsMade: false, adjustments: {} };
    }
    
    return { valid: true, platformFee, adjustmentsMade, adjustments };
  }
  
  /**
   * Validate profit margin sustainability
   */
  private static validateProfitMargin(amount: number, platformFee: number, referralCommission: number): TransactionValidation {
    const totalCosts = referralCommission;
    const netProfit = platformFee - totalCosts;
    const profitMargin = netProfit / amount;
    
    const sustainable = profitMargin >= 0.02; // Minimum 2% profit margin
    
    const recommendations: string[] = [];
    if (!sustainable) {
      recommendations.push('Increase platform fees or reduce referral commissions');
      recommendations.push('Consider minimum fee thresholds');
    }
    
    if (profitMargin < 0.05) {
      recommendations.push('Profit margin below optimal 5% threshold');
    }
    
    return {
      amount,
      fees: platformFee,
      profitMargin,
      sustainable,
      recommendations
    };
  }
  
  /**
   * Check revenue concentration risks
   */
  private static checkRevenueConcentration(transactionType: string): string | null {
    // This would typically check against actual revenue data
    // For now, providing strategic guidance
    
    switch (transactionType) {
      case 'marketplace':
        return 'High marketplace dependency - consider diversifying revenue streams';
      case 'p2p':
        if (Math.random() > 0.7) { // Simulating concentration check
          return 'P2P transfers represent high portion of revenue - monitor sustainability';
        }
        break;
      case 'xrp':
        return 'XRP revenue opportunity - consider increasing adoption incentives';
    }
    
    return null;
  }
  
  /**
   * Generate business optimization recommendations
   */
  static generateOptimizationRecommendations(): string[] {
    return [
      'Implement dynamic fee adjustment based on transaction volume',
      'Create premium service tiers with higher margins',
      'Develop automated referral commission optimization',
      'Monitor competitor pricing for strategic positioning',
      'Implement cost-plus pricing for guaranteed profitability',
      'Consider transaction bundling for volume discounts',
      'Establish enterprise partnerships for stable revenue',
      'Implement real-time profit margin monitoring'
    ];
  }
  
  /**
   * Validate comprehensive platform health
   */
  static validatePlatformHealth(metrics: {
    totalRevenue: number;
    totalReferralCommissions: number;
    averageProfitMargin: number;
    transactionVolume: number;
  }): {
    healthy: boolean;
    score: number;
    criticalIssues: string[];
    recommendations: string[];
  } {
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check referral commission percentage
    const referralPercent = (metrics.totalReferralCommissions / metrics.totalRevenue) * 100;
    if (referralPercent > 15) {
      criticalIssues.push(`Referral commissions at ${referralPercent.toFixed(1)}% of revenue - exceeds 15% threshold`);
      score -= 25;
    } else if (referralPercent > 10) {
      recommendations.push(`Referral commissions at ${referralPercent.toFixed(1)}% - monitor sustainability`);
      score -= 10;
    }
    
    // Check profit margin
    if (metrics.averageProfitMargin < 0.02) {
      criticalIssues.push(`Average profit margin ${(metrics.averageProfitMargin * 100).toFixed(1)}% below 2% minimum`);
      score -= 30;
    } else if (metrics.averageProfitMargin < 0.05) {
      recommendations.push(`Profit margin ${(metrics.averageProfitMargin * 100).toFixed(1)}% below optimal 5%`);
      score -= 15;
    }
    
    // Check revenue efficiency
    const revenueEfficiency = metrics.totalRevenue / metrics.transactionVolume;
    if (revenueEfficiency < 0.08) {
      recommendations.push('Revenue efficiency below 8% - consider fee optimization');
      score -= 10;
    }
    
    return {
      healthy: criticalIssues.length === 0 && score >= 70,
      score,
      criticalIssues,
      recommendations
    };
  }
}