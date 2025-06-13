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
   * XRP fee structure: Ultra-low network fees (~$0.0002) + tiered platform fees
   */
  private static readonly XRP_NETWORK_FEE = 0.0002; // ~$0.0002 per transaction
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
    
    // Corrected fee structure for proper profitability
    if (amount < 100) {
      // Under $100: $3 service fee + 1% platform fee
      serviceFee = 3.00;
      platformFee = Math.round(amount * 0.01 * 100) / 100; // 1% platform fee
    } else {
      // $100 and above: $5 service fee + 0.75% platform fee
      serviceFee = 5.00;
      platformFee = Math.round(amount * 0.0075 * 100) / 100; // 0.75% platform fee
    }
    
    const totalFee = processingFee + serviceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    // Calculate savings vs traditional wire transfer (typically $25-50 + 3-5%)
    const wireTransferFee = Math.max(25, amount * 0.03); // $25 minimum or 3%
    const savings = wireTransferFee - totalFee;
    const percentageSaved = Math.round((savings / wireTransferFee) * 100);
    
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
        description: FeeCalculator.getXRPFeeDescription(amount)
      },
      savings: {
        vsWireTransfer: savings,
        vsCompetitor: wireTransferFee,
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
  static compareAllMethods(amount: number): {
    xrp: FeeCalculation;
    stripe: FeeCalculation;
    paypal: FeeCalculation;
    crypto: FeeCalculation;
    recommended: string;
  } {
    const xrp = this.calculateXRPFees(amount);
    const stripe = this.calculateStripeFees(amount);
    const paypal = this.calculatePayPalFees(amount);
    const crypto = this.calculateCryptoFees(amount);
    
    // Determine recommended method (lowest total fee)
    const methods = [
      { name: 'xrp', fee: xrp.totalFee },
      { name: 'stripe', fee: stripe.totalFee },
      { name: 'paypal', fee: paypal.totalFee },
      { name: 'crypto', fee: crypto.totalFee }
    ];
    
    const recommended = methods.sort((a, b) => a.fee - b.fee)[0].name;
    
    return { xrp, stripe, paypal, crypto, recommended };
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