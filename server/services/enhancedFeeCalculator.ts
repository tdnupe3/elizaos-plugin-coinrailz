/**
 * Enhanced Fee Calculator Service
 * Implements comprehensive fee structure for operational sustainability
 */

export interface EnhancedFeeCalculation {
  originalAmount: number;
  percentageFee: number;
  serviceFee: number;
  platformUsageFee: number;
  paymentSurcharge: number;
  totalFees: number;
  totalAmount: number;
  netPlatformRevenue: number;
  paymentMethod: string;
  surchargeDescription: string;
  feeBreakdown: Record<string, string>;
}

export interface ReferralCommissionStructure {
  tier1: number; // 0.5%
  tier2: number; // 0.25%
  tier3: number; // 0.125%
  tier4: number; // 0.0625%
  tier5: number; // 0.0625%
  totalCommissionRate: number; // 1%
}

export class EnhancedFeeCalculator {
  // Enhanced fee structure constants
  private static readonly PERCENTAGE_FEE_RATE = 0.025; // 2.5%
  private static readonly SERVICE_FEE = 2.50; // Fixed service fee
  private static readonly PLATFORM_USAGE_FEE = 1.00; // Platform usage fee
  
  // Payment method surcharge rates
  private static readonly PAYMENT_SURCHARGES = {
    credit_card: { rate: 0.01, fixed: 0.30 }, // 1% + $0.30
    debit_card: { rate: 0.005, fixed: 0.30 }, // 0.5% + $0.30
    paypal: { rate: 0.015, fixed: 0.49 }, // 1.5% + $0.49
    xrp: { rate: 0, fixed: 0 },
    crypto: { rate: 0, fixed: 0 },
    bank_transfer: { rate: 0, fixed: 0 }
  };

  // Referral commission structure (sustainable 1% total)
  private static readonly REFERRAL_COMMISSION: ReferralCommissionStructure = {
    tier1: 0.005,   // 0.5%
    tier2: 0.0025,  // 0.25%
    tier3: 0.00125, // 0.125%
    tier4: 0.000625, // 0.0625%
    tier5: 0.000625, // 0.0625%
    totalCommissionRate: 0.01 // 1% total
  };

  /**
   * Calculate comprehensive fees for any transaction
   */
  static calculateTransactionFees(
    amount: number, 
    paymentMethod: string = 'xrp'
  ): EnhancedFeeCalculation {
    const originalAmount = parseFloat(amount.toString());
    
    if (isNaN(originalAmount) || originalAmount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    // Base fees
    const percentageFee = originalAmount * this.PERCENTAGE_FEE_RATE;
    const serviceFee = this.SERVICE_FEE;
    const platformUsageFee = this.PLATFORM_USAGE_FEE;

    // Payment method surcharge
    const normalizedPaymentMethod = paymentMethod.toLowerCase().replace(/[^a-z_]/g, '');
    const surchargeConfig = this.PAYMENT_SURCHARGES[normalizedPaymentMethod as keyof typeof this.PAYMENT_SURCHARGES] 
      || this.PAYMENT_SURCHARGES.xrp;
    
    const paymentSurcharge = (originalAmount * surchargeConfig.rate) + surchargeConfig.fixed;
    
    // Surcharge description
    const surchargeDescription = this.getSurchargeDescription(normalizedPaymentMethod);
    
    // Total calculations
    const totalFees = percentageFee + serviceFee + platformUsageFee + paymentSurcharge;
    const totalAmount = originalAmount + totalFees;
    
    // Net platform revenue after referral commissions
    const totalCommissions = originalAmount * this.REFERRAL_COMMISSION.totalCommissionRate;
    const netPlatformRevenue = totalFees - totalCommissions;

    // Fee breakdown for display
    const feeBreakdown = {
      'Transaction Fee (2.5%)': `$${percentageFee.toFixed(2)}`,
      'Service Fee': `$${serviceFee.toFixed(2)}`,
      'Platform Usage Fee': `$${platformUsageFee.toFixed(2)}`,
      [surchargeDescription]: paymentSurcharge > 0 ? `$${paymentSurcharge.toFixed(2)}` : 'FREE'
    };

    return {
      originalAmount: parseFloat(originalAmount.toFixed(2)),
      percentageFee: parseFloat(percentageFee.toFixed(2)),
      serviceFee: parseFloat(serviceFee.toFixed(2)),
      platformUsageFee: parseFloat(platformUsageFee.toFixed(2)),
      paymentSurcharge: parseFloat(paymentSurcharge.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      netPlatformRevenue: parseFloat(netPlatformRevenue.toFixed(2)),
      paymentMethod: normalizedPaymentMethod,
      surchargeDescription,
      feeBreakdown
    };
  }

  /**
   * Calculate referral commissions for a transaction
   */
  static calculateReferralCommissions(transactionAmount: number): {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
    totalCommissions: number;
  } {
    const amount = parseFloat(transactionAmount.toString());
    
    return {
      tier1: parseFloat((amount * this.REFERRAL_COMMISSION.tier1).toFixed(2)),
      tier2: parseFloat((amount * this.REFERRAL_COMMISSION.tier2).toFixed(2)),
      tier3: parseFloat((amount * this.REFERRAL_COMMISSION.tier3).toFixed(2)),
      tier4: parseFloat((amount * this.REFERRAL_COMMISSION.tier4).toFixed(2)),
      tier5: parseFloat((amount * this.REFERRAL_COMMISSION.tier5).toFixed(2)),
      totalCommissions: parseFloat((amount * this.REFERRAL_COMMISSION.totalCommissionRate).toFixed(2))
    };
  }

  /**
   * Calculate break-even volume for operational sustainability
   */
  static calculateBreakEvenAnalysis(monthlyOperatingCosts: number = 15000): {
    breakEvenVolume: number;
    breakEvenTransactions: number;
    averageTransactionSize: number;
    targetVolume: number;
    targetProfit: number;
  } {
    const averageTransactionSize = 1000; // $1,000 average
    const fees = this.calculateTransactionFees(averageTransactionSize);
    const profitPerTransaction = fees.netPlatformRevenue;
    
    const breakEvenTransactions = Math.ceil(monthlyOperatingCosts / profitPerTransaction);
    const breakEvenVolume = breakEvenTransactions * averageTransactionSize;
    
    // Target 100% profit margin on operating costs
    const targetVolume = breakEvenVolume * 2;
    const targetProfit = monthlyOperatingCosts;

    return {
      breakEvenVolume: parseFloat(breakEvenVolume.toFixed(2)),
      breakEvenTransactions,
      averageTransactionSize,
      targetVolume: parseFloat(targetVolume.toFixed(2)),
      targetProfit
    };
  }

  /**
   * Get competitive analysis vs industry rates
   */
  static getCompetitiveAnalysis(amount: number, paymentMethod: string): {
    coinRailzTotal: number;
    coinRailzRate: string;
    competitors: Array<{
      name: string;
      total: number;
      rate: string;
      description: string;
    }>;
  } {
    const ourFees = this.calculateTransactionFees(amount, paymentMethod);
    const rate = ((ourFees.totalFees / amount) * 100).toFixed(1);

    return {
      coinRailzTotal: ourFees.totalFees,
      coinRailzRate: `${rate}% + $${(ourFees.serviceFee + ourFees.platformUsageFee).toFixed(2)}`,
      competitors: [
        {
          name: 'PayPal',
          total: parseFloat(((amount * 0.035) + 0.49).toFixed(2)),
          rate: '3.5% + $0.49',
          description: 'Standard PayPal fees'
        },
        {
          name: 'Stripe',
          total: parseFloat(((amount * 0.029) + 0.30).toFixed(2)),
          rate: '2.9% + $0.30',
          description: 'Credit card processing'
        },
        {
          name: 'Western Union',
          total: parseFloat(((amount * 0.065) + 12.50).toFixed(2)),
          rate: '6.5% + $12.50',
          description: 'International money transfer'
        },
        {
          name: 'Wise (TransferWise)',
          total: parseFloat(((amount * 0.02) + 3.00).toFixed(2)),
          rate: '2.0% + $3.00',
          description: 'International bank transfer'
        }
      ]
    };
  }

  /**
   * Get surcharge description for payment method
   */
  private static getSurchargeDescription(paymentMethod: string): string {
    switch (paymentMethod) {
      case 'credit_card':
      case 'card':
        return 'Credit Card Processing Fee';
      case 'debit_card':
        return 'Debit Card Processing Fee';
      case 'paypal':
        return 'PayPal Processing Fee';
      case 'xrp':
      case 'crypto':
      case 'bank_transfer':
      default:
        return 'No additional payment fees';
    }
  }

  /**
   * Validate payment method
   */
  static validatePaymentMethod(paymentMethod: string): boolean {
    const normalized = paymentMethod.toLowerCase().replace(/[^a-z_]/g, '');
    return Object.keys(this.PAYMENT_SURCHARGES).includes(normalized);
  }
}

export const enhancedFeeCalculator = EnhancedFeeCalculator;