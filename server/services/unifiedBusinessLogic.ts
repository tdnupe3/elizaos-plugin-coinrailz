/**
 * UNIFIED BUSINESS LOGIC SERVICE
 * Single source of truth for all platform business rules
 * Addresses critical gaps found in comprehensive audit
 */

import { Decimal } from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
  maxE: 9e15,
  minE: -9e15,
  modulo: Decimal.ROUND_DOWN
});

export interface TransactionRequest {
  type: 'p2p' | 'marketplace' | 'xrp' | 'crypto' | 'onramp' | 'offramp';
  amount: string; // Always string to prevent float precision issues
  currency: string;
  fromUserId?: string;
  toUserId?: string;
  agentId?: string;
  isReferral?: boolean;
  referralLevel?: number;
  expedited?: boolean;
}

export interface FeeBreakdown {
  originalAmount: string;
  platformFee: string;
  networkFee: string;
  expeditedFee: string;
  totalFees: string;
  netAmount: string;
  feePercentage: string;
}

export interface CommissionBreakdown {
  totalAmount: string;
  platformRevenue: string; // Always 15%
  agentCommission: string; // Always 85%
  referralCommissions: string; // Up to 5% of platform revenue
  netPlatformRevenue: string; // Platform revenue minus referral costs
}

/**
 * UNIFIED BUSINESS LOGIC SERVICE
 * Single authority for all platform business rules
 */
export class UnifiedBusinessLogic {
  // MASTER FEE STRUCTURE - Single source of truth
  private static readonly FEE_STRUCTURE = {
    // Platform commission rate (applied to ALL services)
    PLATFORM_COMMISSION_RATE: new Decimal('0.15'), // 15%
    AGENT_COMMISSION_RATE: new Decimal('0.85'), // 85%
    
    // Service-specific fees (in addition to platform commission)
    SERVICE_FEES: {
      p2p: {
        tier1: new Decimal('0.035'), // 3.5% for amounts < $1000
        tier2: new Decimal('0.045'), // 4.5% for amounts $1000-$10000
        tier3: new Decimal('0.065'), // 6.5% for amounts > $10000
        fixed: new Decimal('2.50')   // Fixed $2.50 fee
      },
      marketplace: {
        base: new Decimal('0.15'), // 15% total (platform commission only)
        expedited: new Decimal('1.00') // +$1 for expedited processing
      },
      xrp: {
        platform: new Decimal('0.005'), // 0.5% platform fee
        network: new Decimal('0.0002')  // $0.0002 network fee
      },
      crypto: {
        base: new Decimal('0.025'), // 2.5% base fee
        network_eth: new Decimal('0.003'), // 0.3% ETH network
        network_polygon: new Decimal('0.001'), // 0.1% Polygon
        network_base: new Decimal('0.0005') // 0.05% Base
      },
      onramp: {
        stripe: new Decimal('0.029'), // 2.9% Stripe fee
        plaid_ach: new Decimal('0.008'), // 0.8% ACH fee
        instant: new Decimal('0.015') // 1.5% instant transfer
      }
    },

    // Minimum transaction amounts (prevents losses)
    MINIMUM_AMOUNTS: {
      p2p: new Decimal('25.00'),
      marketplace: new Decimal('50.00'),
      xrp: new Decimal('10.00'),
      crypto: new Decimal('15.00'),
      onramp: new Decimal('20.00')
    },

    // Maximum transaction amounts (AML compliance)
    MAXIMUM_AMOUNTS: {
      unverified: new Decimal('1000.00'),
      basic_kyc: new Decimal('10000.00'),
      full_kyc: new Decimal('50000.00'),
      institutional: new Decimal('1000000.00')
    },

    // Referral commission limits
    REFERRAL: {
      MAX_COMMISSION_RATE: new Decimal('0.05'), // 5% of platform revenue
      LEVEL_1_RATE: new Decimal('0.003'), // 0.3% of transaction
      LEVEL_2_RATE: new Decimal('0.002'), // 0.2% of transaction
      LEVEL_3_RATE: new Decimal('0.001')  // 0.1% of transaction
    }
  };

  /**
   * Calculate comprehensive fee breakdown for any transaction
   */
  static calculateFees(request: TransactionRequest): FeeBreakdown {
    const amount = new Decimal(request.amount);
    const feeStructure = this.FEE_STRUCTURE.SERVICE_FEES[request.type];
    
    let platformFee = new Decimal('0');
    let networkFee = new Decimal('0');
    let expeditedFee = new Decimal('0');

    // Calculate service-specific fees
    switch (request.type) {
      case 'p2p':
        // Tiered P2P fees
        if (amount.lt(1000)) {
          platformFee = amount.mul(feeStructure.tier1);
        } else if (amount.lt(10000)) {
          platformFee = amount.mul(feeStructure.tier2);
        } else {
          platformFee = amount.mul(feeStructure.tier3);
        }
        platformFee = platformFee.add(feeStructure.fixed);
        break;

      case 'marketplace':
        // Marketplace uses platform commission only
        platformFee = amount.mul(feeStructure.base);
        if (request.expedited) {
          expeditedFee = feeStructure.expedited;
        }
        break;

      case 'xrp':
        platformFee = amount.mul(feeStructure.platform);
        networkFee = feeStructure.network;
        break;

      case 'crypto':
        platformFee = amount.mul(feeStructure.base);
        // Add network-specific fees based on blockchain
        if (request.currency === 'ETH') {
          networkFee = amount.mul(feeStructure.network_eth);
        } else if (request.currency === 'MATIC') {
          networkFee = amount.mul(feeStructure.network_polygon);
        } else if (request.currency === 'BASE') {
          networkFee = amount.mul(feeStructure.network_base);
        }
        break;

      case 'onramp':
      case 'offramp':
        // Different rates based on funding source
        platformFee = amount.mul(feeStructure.stripe); // Default to Stripe
        break;
    }

    const totalFees = platformFee.add(networkFee).add(expeditedFee);
    const netAmount = amount.sub(totalFees);
    const feePercentage = totalFees.div(amount).mul(100);

    return {
      originalAmount: amount.toString(),
      platformFee: platformFee.toString(),
      networkFee: networkFee.toString(),
      expeditedFee: expeditedFee.toString(),
      totalFees: totalFees.toString(),
      netAmount: netAmount.toString(),
      feePercentage: feePercentage.toFixed(2)
    };
  }

  /**
   * Calculate commission distribution (SINGLE SOURCE OF TRUTH)
   */
  static calculateCommissions(totalAmount: string, agentId?: string, referralLevel?: number): CommissionBreakdown {
    const amount = new Decimal(totalAmount);
    
    // Platform takes 15%, Agent gets 85% - ALWAYS
    const platformRevenue = amount.mul(this.FEE_STRUCTURE.PLATFORM_COMMISSION_RATE);
    const agentCommission = amount.mul(this.FEE_STRUCTURE.AGENT_COMMISSION_RATE);
    
    let referralCommissions = new Decimal('0');
    
    // Calculate referral commissions (limited to 5% of platform revenue)
    if (referralLevel && referralLevel <= 3) {
      const referralRates = [
        this.FEE_STRUCTURE.REFERRAL.LEVEL_1_RATE,
        this.FEE_STRUCTURE.REFERRAL.LEVEL_2_RATE,
        this.FEE_STRUCTURE.REFERRAL.LEVEL_3_RATE
      ];
      
      const referralRate = referralRates[referralLevel - 1];
      referralCommissions = amount.mul(referralRate);
      
      // Cap referrals at 5% of platform revenue
      const maxReferralCommission = platformRevenue.mul(this.FEE_STRUCTURE.REFERRAL.MAX_COMMISSION_RATE);
      if (referralCommissions.gt(maxReferralCommission)) {
        referralCommissions = maxReferralCommission;
      }
    }
    
    const netPlatformRevenue = platformRevenue.sub(referralCommissions);

    return {
      totalAmount: amount.toString(),
      platformRevenue: platformRevenue.toString(),
      agentCommission: agentCommission.toString(),
      referralCommissions: referralCommissions.toString(),
      netPlatformRevenue: netPlatformRevenue.toString()
    };
  }

  /**
   * Validate transaction against business rules
   */
  static validateTransaction(request: TransactionRequest): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const amount = new Decimal(request.amount);

    // Check minimum amount
    const minAmount = this.FEE_STRUCTURE.MINIMUM_AMOUNTS[request.type];
    if (minAmount && amount.lt(minAmount)) {
      errors.push(`Minimum ${request.type} transaction is $${minAmount.toString()}`);
    }

    // Check for negative amounts
    if (amount.lte(0)) {
      errors.push('Transaction amount must be positive');
    }

    // Check currency support
    const supportedCurrencies = ['USD', 'USDC', 'USDT', 'XRP', 'ETH', 'BTC'];
    if (!supportedCurrencies.includes(request.currency)) {
      errors.push(`Currency ${request.currency} not supported`);
    }

    // Warn about high fees for small amounts
    const feeBreakdown = this.calculateFees(request);
    const feePercentage = new Decimal(feeBreakdown.feePercentage);
    if (feePercentage.gt(10)) {
      warnings.push(`High fee percentage (${feePercentage.toFixed(2)}%) for this transaction size`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get comprehensive transaction preview
   */
  static getTransactionPreview(request: TransactionRequest): {
    fees: FeeBreakdown;
    commissions: CommissionBreakdown;
    validation: { valid: boolean; errors: string[]; warnings: string[] };
    estimatedSettlementTime: string;
  } {
    const fees = this.calculateFees(request);
    const commissions = this.calculateCommissions(fees.netAmount, request.agentId, request.referralLevel);
    const validation = this.validateTransaction(request);

    // Estimate settlement time based on transaction type
    let estimatedSettlementTime = 'Instant';
    switch (request.type) {
      case 'p2p':
        estimatedSettlementTime = 'Instant';
        break;
      case 'xrp':
        estimatedSettlementTime = '3-5 seconds';
        break;
      case 'crypto':
        estimatedSettlementTime = '1-15 minutes';
        break;
      case 'onramp':
        estimatedSettlementTime = request.expedited ? 'Instant' : '1-3 business days';
        break;
    }

    return {
      fees,
      commissions,
      validation,
      estimatedSettlementTime
    };
  }
}

export default UnifiedBusinessLogic;