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
   * Platform base fee: 4.5% + fixed fees for sustainable profitability
   */
  private static readonly PLATFORM_BASE_FEE = 0.045;
  
  /**
   * XRP fee structure: Ultra-low network fees (~$0.0002) + competitive tiered platform fees
   * Designed to be 40-60% cheaper than traditional methods while ensuring strong profitability
   */
  private static readonly XRP_NETWORK_FEE = 0.0002; // ~$0.0002 per transaction
  
  /**
   * XRP tiered service fees for competitive yet profitable pricing
   */
  private static readonly XRP_TIER_FEES = {
    under100: { serviceFee: 2.50, platformRate: 0.015 },    // $2.50 + 1.5%
    tier100to500: { serviceFee: 3.50, platformRate: 0.0125 }, // $3.50 + 1.25%
    tier500to2000: { serviceFee: 5.00, platformRate: 0.01 },   // $5.00 + 1.0%
    over2000: { serviceFee: 7.50, platformRate: 0.0075 }      // $7.50 + 0.75%
  };
  
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
   * Calculate fees for Stripe credit card transactions with tiered service fees
   */
  static calculateStripeFees(amount: number): FeeCalculation {
    const processingFee = Math.round((amount * this.STRIPE_PERCENTAGE + this.STRIPE_FIXED) * 100) / 100;
    
    // Tiered fee structure to ensure profitability
    let convenienceFee = 0;
    let serviceFee = 0;
    
    if (amount < 25) {
      // Very small transactions: Higher service fee to ensure profitability
      convenienceFee = Math.round((amount * 0.035 + 0.50) * 100) / 100; // 3.5% + $0.50
      serviceFee = 1.50; // $1.50 service fee for transactions under $25
    } else if (amount < 50) {
      // Small transactions: Moderate service fee
      convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
      serviceFee = 0.75; // $0.75 service fee for transactions $25-$49
    } else {
      // Standard transactions: Normal fee structure
      convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
      serviceFee = 0; // No additional service fee for $50+
    }
    
    // Platform fee on original amount
    const platformFee = Math.round(amount * this.PLATFORM_BASE_FEE * 100) / 100;
    
    const totalFee = convenienceFee + serviceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee: convenienceFee + serviceFee, // Combined for display
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'stripe'
    };
  }
  
  /**
   * Calculate fees for PayPal transactions with tiered service fees
   */
  static calculatePayPalFees(amount: number): FeeCalculation {
    const processingFee = Math.round((amount * this.PAYPAL_PERCENTAGE + this.PAYPAL_FIXED) * 100) / 100;
    
    // Tiered fee structure matching Stripe for consistency
    let convenienceFee = 0;
    let serviceFee = 0;
    
    if (amount < 25) {
      // Very small transactions: Higher service fee to ensure profitability
      convenienceFee = Math.round((amount * 0.035 + 0.50) * 100) / 100; // 3.5% + $0.50
      serviceFee = 1.50; // $1.50 service fee for transactions under $25
    } else if (amount < 50) {
      // Small transactions: Moderate service fee
      convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
      serviceFee = 0.75; // $0.75 service fee for transactions $25-$49
    } else {
      // Standard transactions: Normal fee structure
      convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
      serviceFee = 0; // No additional service fee for $50+
    }
    
    // Platform fee on original amount
    const platformFee = Math.round(amount * this.PLATFORM_BASE_FEE * 100) / 100;
    
    const totalFee = convenienceFee + serviceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee: convenienceFee + serviceFee, // Combined for display
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'paypal'
    };
  }
  
  /**
   * Calculate fees for XRP transactions with enhanced tiered structure
   */
  static calculateXRPFees(amount: number): FeeCalculation {
    const processingFee = this.XRP_NETWORK_FEE; // Ultra-low network fee (~$0.0002)
    
    let serviceFee = 0;
    let platformFee = 0;
    let tierName = '';
    
    // Enhanced tiered fee structure for competitive yet profitable pricing
    if (amount < 100) {
      // Under $100: $2.50 service fee + 1.5% platform fee
      serviceFee = this.XRP_TIER_FEES.under100.serviceFee;
      platformFee = Math.round(amount * this.XRP_TIER_FEES.under100.platformRate * 100) / 100;
      tierName = 'Small Transaction Tier';
    } else if (amount < 500) {
      // $100-$500: $3.50 service fee + 1.25% platform fee  
      serviceFee = this.XRP_TIER_FEES.tier100to500.serviceFee;
      platformFee = Math.round(amount * this.XRP_TIER_FEES.tier100to500.platformRate * 100) / 100;
      tierName = 'Medium Transaction Tier';
    } else if (amount < 2000) {
      // $500-$2000: $5.00 service fee + 1.0% platform fee
      serviceFee = this.XRP_TIER_FEES.tier500to2000.serviceFee;
      platformFee = Math.round(amount * this.XRP_TIER_FEES.tier500to2000.platformRate * 100) / 100;
      tierName = 'Large Transaction Tier';
    } else {
      // Over $2000: $7.50 service fee + 0.75% platform fee
      serviceFee = this.XRP_TIER_FEES.over2000.serviceFee;
      platformFee = Math.round(amount * this.XRP_TIER_FEES.over2000.platformRate * 100) / 100;
      tierName = 'Enterprise Transaction Tier';
    }
    
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
   * Get XRP fee description based on transaction amount
   */
  static getXRPFeeDescription(amount: number): string {
    if (amount < 100) {
      return `Under $100: $3 service fee + 1% platform fee. Ensures profitability while covering referral payouts and operational costs.`;
    } else {
      return `$100+: $5 service fee + 0.75% platform fee. Higher service fee generates solid revenue after referral commissions.`;
    }
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
  
  /**
   * Calculate fees for P2P transfers (reduced fees for platform loyalty)
   */
  static calculateP2PFees(amount: number, paymentMethod: string): FeeCalculation {
    switch (paymentMethod) {
      case 'stripe':
        return this.calculateStripeFees(amount);
      case 'paypal':
        return this.calculatePayPalFees(amount);
      case 'xrp':
        return this.calculateXRPFees(amount);
      case 'crypto':
        return this.calculateCryptoFees(amount);
      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  }
  
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