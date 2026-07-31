/**
 * Fee Calculator Service
 * Calculates processing fees and convenience fees to ensure profitability
 */

export interface FeeCalculation {
  originalAmount: number;
  processingFee: number;
  convenienceFee: number;
  platformFee: number;
  totalFee: number;
  totalAmount: number;
  netAmount: number; // Amount after all fees
  paymentMethod: string;
  // Legacy compatibility properties for existing code
  fee: number;
  total: number;
  feePercentage: number;
  feeBreakdown?: {
    networkFee: number;
    serviceFee: number;
    platformFee: number;
    description: string;
  };
  savings?: {
    vsWireTransfer: number;
    vsCompetitor: number;
    percentageSaved: number;
  };
}

export class FeeCalculator {
  
  /**
   * Stripe fee structure: 2.9% + $0.30 per transaction
   */
  private static readonly STRIPE_PERCENTAGE = 0.029;
  private static readonly STRIPE_FIXED = 0.30;
  
  /**
   * PayPal fee structure: 2.9% + $0.30 per transaction
   */
  private static readonly PAYPAL_PERCENTAGE = 0.029;
  private static readonly PAYPAL_FIXED = 0.30;
  
  /**
   * Platform base fee structure: Standardized tiered rates for consistent profitability
   */
  private static readonly PLATFORM_BASE_FEE = 0.045;
  
  /**
   * Standardized P2P transfer fee structure to address inconsistent pricing
   */
  private static readonly P2P_FEE_STRUCTURE = {
    small: { threshold: 50, rate: 0.065, minFee: 25 },     // Under $50: 6.5% (min $25)
    medium: { threshold: 200, rate: 0.055, minFee: 15 },   // $50-$200: 5.5% (min $15)  
    large: { threshold: 1000, rate: 0.045, minFee: 10 },   // $200-$1000: 4.5% (min $10)
    enterprise: { threshold: Infinity, rate: 0.035, minFee: 25 } // $1000+: 3.5% (min $25)
  };
  
  /**
   * Transaction minimums to ensure profitability
   */
  private static readonly MINIMUM_TRANSACTIONS = {
    p2p: 25,           // $25 minimum for P2P transfers
    marketplace: 50,   // $50 minimum for AI marketplace orders  
    xrp: 10,          // $10 minimum for XRP transfers
    crypto: 15        // $15 minimum for other crypto
  };
  
  /**
   * Referral commission limits to ensure sustainability
   */
  private static readonly REFERRAL_LIMITS = {
    maxCommissionPercent: 0.05,  // Maximum 5% of total platform revenue for referrals
    maxIndividualRate: 0.006,    // Maximum 0.6% commission per transaction
    monthlyCapPerUser: 500,      // $500 monthly cap per referrer
    minimumProfit: 0.02          // Minimum 2% profit margin after all costs
  };
  
  /**
   * AI Marketplace fee structure to address 15% flat rate inconsistency
   */
  private static readonly MARKETPLACE_FEE_STRUCTURE = {
    basic: { threshold: 100, rate: 0.20, agentRate: 0.80 },      // Under $100: 20% platform, 80% agent
    standard: { threshold: 300, rate: 0.175, agentRate: 0.825 }, // $100-$300: 17.5% platform, 82.5% agent
    premium: { threshold: 1000, rate: 0.15, agentRate: 0.85 },   // $300-$1000: 15% platform, 85% agent
    enterprise: { threshold: Infinity, rate: 0.125, agentRate: 0.875 } // $1000+: 12.5% platform, 87.5% agent
  };
  
  /**
   * XRP fee structure: Ultra-low network fees (~$0.0002) + competitive tiered platform fees
   * Designed to be 40-60% cheaper than traditional methods while ensuring strong profitability
   */
  private static readonly XRP_NETWORK_FEE = 0.0002; // ~$0.0002 per transaction
  
  /**
   * XRP simplified fee structure: 0.5% platform fee on all transactions
   * Competitive and profitable while maintaining simplicity
   */
  private static readonly XRP_PLATFORM_FEE_RATE = 0.005; // 0.5% on all XRP transactions
  private static readonly XRP_MINIMUM_FEE = 0.25; // $0.25 minimum fee
  
  /**
   * Ethereum fee structure: Dynamic gas fees + competitive platform rates
   */
  private static readonly ETH_BASE_GAS = 21000; // Base gas for ETH transfer
  private static readonly ETH_TOKEN_GAS = 65000; // Gas for ERC-20 token transfer
  private static readonly ETH_PLATFORM_FEE = 0.0175; // 1.75% - competitive for DeFi
  
  /**
   * Stablecoin fee structure: Enterprise-grade rates for USDC/USDT/DAI
   */
  private static readonly STABLECOIN_PLATFORM_FEE = 0.015; // 1.5% - enterprise competitive
  private static readonly STABLECOIN_MIN_FEE = 0.50; // $0.50 minimum for small transactions
  private static readonly XRP_PLATFORM_FEE = 0.005; // 0.5% platform fee for large transactions
  
  /**
   * Calculate standardized P2P transfer fees with consistent structure
   */
  static calculateP2PFees(amount: number, paymentMethod: string = 'standard'): FeeCalculation {
    // Enforce minimum transaction amounts
    if (amount < this.MINIMUM_TRANSACTIONS.p2p) {
      throw new Error(`Minimum P2P transfer amount is $${this.MINIMUM_TRANSACTIONS.p2p}`);
    }
    
    // Determine fee tier based on amount
    let feeStructure = this.P2P_FEE_STRUCTURE.small;
    if (amount >= this.P2P_FEE_STRUCTURE.enterprise.threshold) {
      feeStructure = this.P2P_FEE_STRUCTURE.enterprise;
    } else if (amount >= this.P2P_FEE_STRUCTURE.large.threshold) {
      feeStructure = this.P2P_FEE_STRUCTURE.large;
    } else if (amount >= this.P2P_FEE_STRUCTURE.medium.threshold) {
      feeStructure = this.P2P_FEE_STRUCTURE.medium;
    }
    
    // Calculate platform fee (standardized across all tiers)
    const platformFee = Math.max(
      Math.round(amount * feeStructure.rate * 100) / 100,
      feeStructure.minFee
    );
    
    // Processing fees vary by payment method
    let processingFee = 0;
    if (paymentMethod === 'stripe' || paymentMethod === 'credit_card') {
      processingFee = Math.round((amount * this.STRIPE_PERCENTAGE + this.STRIPE_FIXED) * 100) / 100;
    } else if (paymentMethod === 'paypal') {
      processingFee = Math.round((amount * this.PAYPAL_PERCENTAGE + this.PAYPAL_FIXED) * 100) / 100;
    }
    
    const totalFee = platformFee + processingFee;
    const totalAmount = amount + totalFee;
    const netAmount = amount; // Net amount received by recipient
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee: 0,
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'p2p_transfer',
      fee: totalFee,
      total: totalAmount,
      feePercentage: (totalFee / amount) * 100,
      feeBreakdown: {
        networkFee: processingFee,
        serviceFee: 0,
        platformFee,
        description: `${this.getP2PFeeDescription(amount, feeStructure.rate)}`
      },
      savings: {
        vsWireTransfer: Math.max(0, 25 - platformFee),
        vsCompetitor: Math.max(0, (amount * 0.05) - platformFee),
        percentageSaved: Math.max(0, ((amount * 0.05 - platformFee) / (amount * 0.05)) * 100)
      }
    };
  }
  
  /**
   * Legacy Stripe fee calculator for backward compatibility
   */
  static calculateStripeFees(amount: number): FeeCalculation {
    return this.calculateP2PFees(amount, 'stripe');
  }
  
  /**
   * Get P2P fee description for transparency
   */
  static getP2PFeeDescription(amount: number, rate: number): string {
    const feePercent = (rate * 100).toFixed(1);
    if (amount < 50) {
      return `Small transfer: ${feePercent}% fee ensures profitability on smaller amounts while maintaining competitive rates.`;
    } else if (amount < 200) {
      return `Standard transfer: ${feePercent}% fee with optimal balance of competitiveness and revenue generation.`;
    } else if (amount < 1000) {
      return `Large transfer: ${feePercent}% fee providing excellent value for higher-value transactions.`;
    } else {
      return `Enterprise transfer: ${feePercent}% fee with premium service levels and priority processing.`;
    }
  }
  
  /**
   * Calculate fees for PayPal transactions with standardized P2P structure
   */
  static calculatePayPalFees(amount: number): FeeCalculation {
    return this.calculateP2PFees(amount, 'paypal');
  }
  
  /**
   * Calculate AI Marketplace fees with tiered structure (LEGACY - use calculateMarketplaceFees with paymentMethod)
   */
  static calculateMarketplaceFeesLegacy(amount: number): FeeCalculation {
    // Enforce minimum transaction amounts
    if (amount < this.MINIMUM_TRANSACTIONS.marketplace) {
      throw new Error(`Minimum marketplace order amount is $${this.MINIMUM_TRANSACTIONS.marketplace}`);
    }
    
    // Determine fee tier based on amount
    let feeStructure = this.MARKETPLACE_FEE_STRUCTURE.basic;
    if (amount >= this.MARKETPLACE_FEE_STRUCTURE.enterprise.threshold) {
      feeStructure = this.MARKETPLACE_FEE_STRUCTURE.enterprise;
    } else if (amount >= this.MARKETPLACE_FEE_STRUCTURE.premium.threshold) {
      feeStructure = this.MARKETPLACE_FEE_STRUCTURE.premium;
    } else if (amount >= this.MARKETPLACE_FEE_STRUCTURE.standard.threshold) {
      feeStructure = this.MARKETPLACE_FEE_STRUCTURE.standard;
    }
    
    const platformFee = Math.round(amount * feeStructure.rate * 100) / 100;
    const agentPayout = Math.round(amount * feeStructure.agentRate * 100) / 100;
    
    return {
      originalAmount: amount,
      processingFee: 0, // No external processing fees for marketplace
      convenienceFee: 0,
      platformFee,
      totalFee: platformFee,
      totalAmount: amount,
      netAmount: agentPayout,
      paymentMethod: 'marketplace',
      feeBreakdown: {
        networkFee: 0,
        serviceFee: 0,
        platformFee,
        description: `Marketplace tier: ${(feeStructure.rate * 100).toFixed(1)}% platform fee, ${(feeStructure.agentRate * 100).toFixed(1)}% agent payout`
      },
      savings: {
        vsWireTransfer: 0,
        vsCompetitor: 0,
        percentageSaved: 0
      }
    };
  }
  
  /**
   * Validate referral commission sustainability
   */
  static validateReferralCommission(
    commissionAmount: number, 
    transactionAmount: number, 
    platformFee: number,
    monthlyReferralTotal: number
  ): { valid: boolean; adjustedCommission: number; reasons: string[] } {
    const reasons: string[] = [];
    let adjustedCommission = commissionAmount;
    
    // Check individual transaction commission rate
    const commissionRate = commissionAmount / transactionAmount;
    if (commissionRate > this.REFERRAL_LIMITS.maxIndividualRate) {
      adjustedCommission = Math.round(transactionAmount * this.REFERRAL_LIMITS.maxIndividualRate * 100) / 100;
      reasons.push(`Commission rate capped at ${(this.REFERRAL_LIMITS.maxIndividualRate * 100).toFixed(1)}%`);
    }
    
    // Check minimum profit margin
    const profitAfterReferral = platformFee - adjustedCommission;
    const minimumProfitRequired = transactionAmount * this.REFERRAL_LIMITS.minimumProfit;
    if (profitAfterReferral < minimumProfitRequired) {
      adjustedCommission = Math.max(0, platformFee - minimumProfitRequired);
      reasons.push('Adjusted to maintain minimum 2% profit margin');
    }
    
    // Check monthly cap
    if (monthlyReferralTotal + adjustedCommission > this.REFERRAL_LIMITS.monthlyCapPerUser) {
      const remainingCap = Math.max(0, this.REFERRAL_LIMITS.monthlyCapPerUser - monthlyReferralTotal);
      adjustedCommission = Math.min(adjustedCommission, remainingCap);
      reasons.push(`Monthly referral cap of $${this.REFERRAL_LIMITS.monthlyCapPerUser} enforced`);
    }
    
    return {
      valid: adjustedCommission > 0,
      adjustedCommission,
      reasons
    };
  }
  

  
  /**
   * Calculate fees for XRP transactions with enhanced tiered structure
   */
  static calculateXRPFees(amount: number): FeeCalculation {
    const processingFee = this.XRP_NETWORK_FEE; // Ultra-low network fee (~$0.0002)
    
    // Simplified 0.5% platform fee on all XRP transactions
    const platformFee = Math.max(
      Math.round(amount * this.XRP_PLATFORM_FEE_RATE * 100) / 100,
      this.XRP_MINIMUM_FEE
    );
    
    const serviceFee = 0; // No additional service fees - just the 0.5% platform fee
    const tierName = 'XRP Instant Transfer';
    
    const totalFee = processingFee + serviceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    // Calculate savings vs traditional payment methods
    const wireTransferFee = Math.max(25, amount * 0.03); // Wire transfer: $25 minimum or 3%
    const stripeFee = amount * 0.029 + 0.30; // Stripe: 2.9% + $0.30
    const competitorFee = Math.max(stripeFee, wireTransferFee);
    const savings = competitorFee - totalFee;
    const percentageSaved = Math.round((savings / competitorFee) * 100);
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee: serviceFee, // Service fee displayed as convenience fee
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'xrp',
      feeBreakdown: {
        networkFee: processingFee,
        serviceFee: serviceFee,
        platformFee: platformFee,
        description: `${tierName}: ${this.getXRPFeeDescription(amount)}`
      },
      savings: {
        vsWireTransfer: savings,
        vsCompetitor: competitorFee,
        percentageSaved: percentageSaved
      }
    };
  }

  /**
   * Get XRP fee description - simplified structure
   */
  static getXRPFeeDescription(amount: number): string {
    const fee = Math.max(amount * this.XRP_PLATFORM_FEE_RATE, this.XRP_MINIMUM_FEE);
    return `Simple 0.5% platform fee ($${fee.toFixed(2)}) + ultra-low network fee (~$0.0002). Instant settlement in 3-5 seconds vs 3-5 days for traditional transfers.`;
  }

  /**
   * Calculate fees for Ethereum transactions
   */
  static calculateEthereumFees(amount: number, gasPrice?: number): FeeCalculation {
    const currentGasPrice = gasPrice || 20; // 20 gwei default
    const gasCostUSD = (this.ETH_BASE_GAS * currentGasPrice * 2555) / 1e18; // Using current ETH price
    
    const platformFee = amount * this.ETH_PLATFORM_FEE;
    const totalFee = gasCostUSD + platformFee;
    
    return {
      originalAmount: amount,
      processingFee: gasCostUSD,
      convenienceFee: 0,
      platformFee,
      totalFee,
      totalAmount: amount + totalFee,
      netAmount: amount,
      paymentMethod: 'ethereum',
      feeBreakdown: {
        networkFee: gasCostUSD,
        serviceFee: 0,
        platformFee,
        description: `Gas: ${currentGasPrice} gwei + 1.75% platform fee`
      },
      savings: {
        vsWireTransfer: Math.max(0, 25 - totalFee),
        vsCompetitor: Math.max(0, (amount * 0.025) - totalFee),
        percentageSaved: Math.max(0, ((amount * 0.025 - totalFee) / (amount * 0.025)) * 100)
      }
    };
  }

  /**
   * Calculate fees for stablecoin transactions (USDC/USDT/DAI)
   */
  static calculateStablecoinFees(amount: number, gasPrice?: number): FeeCalculation {
    const currentGasPrice = gasPrice || 20; // 20 gwei default
    const gasCostUSD = (this.ETH_TOKEN_GAS * currentGasPrice * 2555) / 1e18; // Token transfer gas
    
    const platformFee = Math.max(amount * this.STABLECOIN_PLATFORM_FEE, this.STABLECOIN_MIN_FEE);
    const totalFee = gasCostUSD + platformFee;
    
    return {
      originalAmount: amount,
      processingFee: gasCostUSD,
      convenienceFee: 0,
      platformFee,
      totalFee,
      totalAmount: amount + totalFee,
      netAmount: amount,
      paymentMethod: 'stablecoin',
      feeBreakdown: {
        networkFee: gasCostUSD,
        serviceFee: 0,
        platformFee,
        description: `Gas: ${currentGasPrice} gwei + 1.5% platform fee (min $0.50)`
      },
      savings: {
        vsWireTransfer: Math.max(0, 25 - totalFee),
        vsCompetitor: Math.max(0, (amount * 0.029) - totalFee), // vs Stripe
        percentageSaved: Math.max(0, ((amount * 0.029 - totalFee) / (amount * 0.029)) * 100)
      }
    };
  }

  /**
   * Universal transaction fee calculator
   */
  static calculateTransactionFee(params: {
    amount: number;
    currency: string;
    paymentMethod: string;
    userTier?: string;
    transactionType?: string;
    gasPrice?: number;
  }): { fee: number; total: number; feePercentage: number } {
    const { amount, paymentMethod, gasPrice } = params;
    
    if (amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    let feeCalculation: FeeCalculation;
    
    switch (paymentMethod.toLowerCase()) {
      case 'xrp':
        feeCalculation = this.calculateXRPFees(amount);
        break;
      case 'ethereum':
      case 'eth':
        feeCalculation = this.calculateEthereumFees(amount, gasPrice);
        break;
      case 'usdc':
      case 'usdt':
      case 'dai':
      case 'stablecoin':
        feeCalculation = this.calculateStablecoinFees(amount, gasPrice);
        break;
      case 'stripe':
        feeCalculation = this.calculateStripeFees(amount);
        break;
      case 'paypal':
        feeCalculation = this.calculatePayPalFees(amount);
        break;
      default:
        feeCalculation = this.calculateStripeFees(amount); // Default to Stripe
    }

    const feePercentage = Math.round((feeCalculation.totalFee / amount) * 100);
    
    return {
      fee: feeCalculation.totalFee,
      total: feeCalculation.totalAmount,
      feePercentage
    };
  }

  /**
   * Calculate optimal transaction amount to minimize fee percentage
   */
  static calculateOptimalAmount(targetAmount: number): {
    suggested: number;
    currentFeePercentage: number;
    suggestedFeePercentage: number;
    savings: number;
  } {
    const currentFees = this.calculateXRPFees(targetAmount);
    const currentPercentage = (currentFees.totalFee / targetAmount) * 100;
    
    // With the new fee structure, suggest moving to $100+ tier if close
    let suggestedAmount = targetAmount;
    
    if (targetAmount >= 80 && targetAmount < 100) {
      // Close to $100 threshold - check if it's beneficial to round up
      suggestedAmount = 100;
    }
    
    const suggestedFees = this.calculateXRPFees(suggestedAmount);
    const suggestedPercentage = (suggestedFees.totalFee / suggestedAmount) * 100;
    const savings = currentFees.totalFee - suggestedFees.totalFee;
    
    return {
      suggested: suggestedAmount,
      currentFeePercentage: Math.round(currentPercentage * 100) / 100,
      suggestedFeePercentage: Math.round(suggestedPercentage * 100) / 100,
      savings: Math.round(savings * 100) / 100
    };
  }

  /**
   * Compare all payment methods for a given amount
   */
  static compareAllMethods(amount: number, gasPrice?: number): {
    xrp: FeeCalculation;
    ethereum: FeeCalculation;
    stablecoin: FeeCalculation;
    stripe: FeeCalculation;
    paypal: FeeCalculation;
    crypto: FeeCalculation;
    recommended: string;
  } {
    const xrp = this.calculateXRPFees(amount);
    const ethereum = this.calculateEthereumFees(amount, gasPrice);
    const stablecoin = this.calculateStablecoinFees(amount, gasPrice);
    const stripe = this.calculateStripeFees(amount);
    const paypal = this.calculatePayPalFees(amount);
    const crypto = this.calculateCryptoFees(amount);
    
    // Determine recommended method (lowest total fee)
    const methods = [
      { name: 'xrp', fee: xrp.totalFee },
      { name: 'ethereum', fee: ethereum.totalFee },
      { name: 'stablecoin', fee: stablecoin.totalFee },
      { name: 'stripe', fee: stripe.totalFee },
      { name: 'paypal', fee: paypal.totalFee },
      { name: 'crypto', fee: crypto.totalFee }
    ];
    
    const recommended = methods.sort((a, b) => a.fee - b.fee)[0].name;
    
    return { xrp, ethereum, stablecoin, stripe, paypal, crypto, recommended };
  }

  /**
   * Calculate fees for cryptocurrency transactions (no processing fees)
   */
  static calculateCryptoFees(amount: number): FeeCalculation {
    const processingFee = 0; // No processing fees for crypto
    const convenienceFee = 0; // No convenience fee for crypto
    
    // Reduced platform fee for crypto to encourage adoption
    const platformFee = Math.round(amount * 0.005 * 100) / 100; // 0.5% for crypto
    
    const totalFee = platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount;
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee,
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'crypto'
    };
  }
  
  // Removed duplicate - using main implementation above
  
  /**
   * Calculate fees for agent marketplace transactions
   */
  static calculateMarketplaceFees(amount: number, paymentMethod: string): FeeCalculation {
    const baseFees = this.calculateP2PFees(amount, paymentMethod);
    
    // Add marketplace commission (2% additional)
    const marketplaceCommission = Math.round(amount * 0.02 * 100) / 100;
    
    return {
      ...baseFees,
      platformFee: baseFees.platformFee + marketplaceCommission,
      totalFee: baseFees.totalFee + marketplaceCommission,
      totalAmount: baseFees.originalAmount + baseFees.totalFee + marketplaceCommission,
      netAmount: baseFees.netAmount - marketplaceCommission
    };
  }
  
  /**
   * Get fee breakdown for display to users
   */
  static getFeeBreakdown(amount: number, paymentMethod: string, transactionType: 'p2p' | 'marketplace' = 'p2p'): {
    subtotal: number;
    fees: Array<{ name: string; amount: number; description: string }>;
    total: number;
  } {
    const calculation = transactionType === 'marketplace' 
      ? this.calculateMarketplaceFees(amount, paymentMethod)
      : this.calculateP2PFees(amount, paymentMethod);
    
    const fees: Array<{ name: string; amount: number; description: string }> = [];
    
    if (calculation.convenienceFee > 0) {
      fees.push({
        name: 'Convenience Fee',
        amount: calculation.convenienceFee,
        description: 'Credit card processing fee'
      });
    }
    
    if (calculation.platformFee > 0) {
      fees.push({
        name: 'Platform Fee',
        amount: calculation.platformFee,
        description: transactionType === 'marketplace' ? 'Platform + marketplace fee' : 'Platform service fee'
      });
    }
    
    return {
      subtotal: calculation.originalAmount,
      fees,
      total: calculation.totalAmount
    };
  }
  
  /**
   * Calculate minimum profitable amount for credit card transactions
   */
  static getMinimumAmount(paymentMethod: string): number {
    switch (paymentMethod) {
      case 'stripe':
      case 'paypal':
        // Minimum amount where fees don't exceed 10% of transaction
        return 10.00;
      case 'crypto':
        return 1.00;
      default:
        return 5.00;
    }
  }
  
  /**
   * Validate transaction amount against minimum requirements
   */
  static validateAmount(amount: number, paymentMethod: string): { valid: boolean; message?: string } {
    const minimum = this.getMinimumAmount(paymentMethod);
    
    if (amount < minimum) {
      return {
        valid: false,
        message: `Minimum transaction amount for ${paymentMethod} is $${minimum.toFixed(2)}`
      };
    }
    
    return { valid: true };
  }

  // Missing methods required by routes
  static calculateSendMoneyFee(amount: number, paymentMethod: string = 'stripe'): FeeCalculation {
    return this.calculateP2PFees(amount, paymentMethod);
  }

  static calculateCryptoFee(amount: number): FeeCalculation {
    return this.calculateCryptoFees(amount);
  }

  static calculateSwapFee(amount: number, paymentMethod: string = 'crypto'): FeeCalculation {
    const baseFees = this.calculateCryptoFees(amount);
    // Add small swap processing fee
    const swapFee = Math.round(amount * 0.002 * 100) / 100; // 0.2% swap fee
    
    return {
      ...baseFees,
      platformFee: baseFees.platformFee + swapFee,
      totalFee: baseFees.totalFee + swapFee,
      totalAmount: baseFees.originalAmount + baseFees.totalFee + swapFee,
      netAmount: baseFees.netAmount - swapFee
    };
  }

  static calculateDepositFee(amount: number, paymentMethod: string = 'stripe'): FeeCalculation {
    // Reduced fees for deposits to encourage funding
    const baseFees = this.calculateP2PFees(amount, paymentMethod);
    return {
      ...baseFees,
      platformFee: baseFees.platformFee * 0.5, // 50% discount on platform fees for deposits
      totalFee: baseFees.convenienceFee + (baseFees.platformFee * 0.5),
      totalAmount: baseFees.originalAmount + baseFees.convenienceFee + (baseFees.platformFee * 0.5),
      netAmount: baseFees.netAmount + (baseFees.platformFee * 0.5)
    };
  }

  static calculateWithdrawFee(amount: number, paymentMethod: string = 'crypto'): FeeCalculation {
    if (paymentMethod === 'crypto') {
      return this.calculateCryptoFees(amount);
    }
    return this.calculateP2PFees(amount, paymentMethod);
  }

  static calculateAIAgentFee(amount: number, paymentMethod: string = 'crypto'): FeeCalculation {
    return this.calculateMarketplaceFees(amount, paymentMethod);
  }

  static getFeeWalletAddress(network: string): string {
    switch (network.toLowerCase()) {
      case 'ethereum':
      case 'eth':
        return '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F';
      case 'solana':
      case 'sol':
        return 'CoinRailzPlatformWallet11111111111111111111';
      case 'bitcoin':
      case 'btc':
        return 'bc1qcoinrailzplatformwallet123456789';
      default:
        return '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F';
    }
  }

  // Wallet constants for backward compatibility
  static readonly ETHEREUM_FEE_WALLET = '0x742d35Cc6634C0532925a3b8D4C9db96F426A01F';
  static readonly SOLANA_FEE_WALLET = 'CoinRailzPlatformWallet11111111111111111111';
}