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
   * Platform base fee: 1% (can be adjusted per transaction type)
   */
  private static readonly PLATFORM_BASE_FEE = 0.01;
  
  /**
   * Calculate fees for Stripe credit card transactions
   */
  static calculateStripeFees(amount: number): FeeCalculation {
    const processingFee = Math.round((amount * this.STRIPE_PERCENTAGE + this.STRIPE_FIXED) * 100) / 100;
    
    // Convenience fee covers processing costs + small buffer
    const convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
    
    // Platform fee on original amount
    const platformFee = Math.round(amount * this.PLATFORM_BASE_FEE * 100) / 100;
    
    const totalFee = convenienceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee,
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'stripe'
    };
  }
  
  /**
   * Calculate fees for PayPal transactions
   */
  static calculatePayPalFees(amount: number): FeeCalculation {
    const processingFee = Math.round((amount * this.PAYPAL_PERCENTAGE + this.PAYPAL_FIXED) * 100) / 100;
    
    // Convenience fee covers processing costs + small buffer
    const convenienceFee = Math.round((amount * 0.032 + 0.35) * 100) / 100; // 3.2% + $0.35
    
    // Platform fee on original amount
    const platformFee = Math.round(amount * this.PLATFORM_BASE_FEE * 100) / 100;
    
    const totalFee = convenienceFee + platformFee;
    const totalAmount = amount + totalFee;
    const netAmount = totalAmount - processingFee;
    
    return {
      originalAmount: amount,
      processingFee,
      convenienceFee,
      platformFee,
      totalFee,
      totalAmount,
      netAmount,
      paymentMethod: 'paypal'
    };
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