/**
 * CoinFlip On/Off Ramp Service Integration
 * Handles fiat <-> USDC conversions via CoinFlip API
 */

interface CoinFlipConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
}

interface CoinFlipQuote {
  quoteId: string;
  amount: number;
  exchangeRate: number;
  fees: {
    coinflipFee: number;
    networkFee: number;
    total: number;
  };
  estimatedDelivery: string;
  validUntil: string;
}

interface CoinFlipTransaction {
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  direction: 'buy' | 'sell'; // buy = USD -> USDC, sell = USDC -> USD
  bankAccount?: string;
  walletAddress?: string;
  estimatedCompletion: string;
}

export class CoinFlipService {
  private config: CoinFlipConfig;

  constructor() {
    this.config = {
      apiKey: process.env.COINFLIP_API_KEY || '',
      environment: (process.env.COINFLIP_ENV as 'sandbox' | 'production') || 'sandbox',
      baseUrl: process.env.COINFLIP_ENV === 'production' 
        ? 'https://api.coinflip.tech' 
        : 'https://sandbox-api.coinflip.tech'
    };
  }

  /**
   * Get quote for USD to USDC conversion
   */
  async getUSDCBuyQuote(usdAmount: number): Promise<CoinFlipQuote> {
    if (!this.config.apiKey) {
      throw new Error('CoinFlip API key not configured');
    }

    // For now, return a realistic quote structure
    // Will be replaced with actual CoinFlip API call
    const exchangeRate = 0.998; // Slightly under $1 due to fees
    const coinflipFee = usdAmount * 0.015; // 1.5% CoinFlip fee
    const networkFee = 2.50; // Fixed network fee
    const totalFees = coinflipFee + networkFee;
    const usdcAmount = (usdAmount - totalFees) * exchangeRate;

    return {
      quoteId: `cf_buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: parseFloat(usdcAmount.toFixed(6)),
      exchangeRate,
      fees: {
        coinflipFee: parseFloat(coinflipFee.toFixed(2)),
        networkFee: networkFee,
        total: parseFloat(totalFees.toFixed(2))
      },
      estimatedDelivery: '5-10 minutes',
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
    };
  }

  /**
   * Get quote for USDC to USD conversion
   */
  async getUSDCSellQuote(usdcAmount: number): Promise<CoinFlipQuote> {
    if (!this.config.apiKey) {
      throw new Error('CoinFlip API key not configured');
    }

    const exchangeRate = 0.995; // Slightly under $1 due to spread
    const coinflipFee = usdcAmount * 0.012; // 1.2% CoinFlip fee for selling
    const networkFee = 1.50; // Lower network fee for selling
    const totalFees = coinflipFee + networkFee;
    const usdAmount = (usdcAmount * exchangeRate) - totalFees;

    return {
      quoteId: `cf_sell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: parseFloat(usdAmount.toFixed(2)),
      exchangeRate,
      fees: {
        coinflipFee: parseFloat(coinflipFee.toFixed(2)),
        networkFee: networkFee,
        total: parseFloat(totalFees.toFixed(2))
      },
      estimatedDelivery: '1-3 business days',
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  /**
   * Execute USD to USDC purchase
   */
  async executeBuyOrder(quoteId: string, bankAccountId: string, walletAddress: string): Promise<CoinFlipTransaction> {
    if (!this.config.apiKey) {
      throw new Error('CoinFlip API key not configured');
    }

    // Will implement actual CoinFlip API call here
    return {
      transactionId: `cf_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      amount: 0, // Will be filled from quote
      currency: 'USDC',
      direction: 'buy',
      bankAccount: bankAccountId,
      walletAddress,
      estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
  }

  /**
   * Execute USDC to USD sale
   */
  async executeSellOrder(quoteId: string, walletAddress: string, bankAccountId: string): Promise<CoinFlipTransaction> {
    if (!this.config.apiKey) {
      throw new Error('CoinFlip API key not configured');
    }

    return {
      transactionId: `cf_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      amount: 0,
      currency: 'USD',
      direction: 'sell',
      bankAccount: bankAccountId,
      walletAddress,
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day
    };
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<CoinFlipTransaction> {
    if (!this.config.apiKey) {
      throw new Error('CoinFlip API key not configured');
    }

    // Mock response for now
    return {
      transactionId,
      status: 'processing',
      amount: 0,
      currency: 'USDC',
      direction: 'buy',
      estimatedCompletion: new Date().toISOString()
    };
  }

  /**
   * Get supported payment methods
   */
  async getSupportedPaymentMethods(): Promise<string[]> {
    return [
      'ach_transfer',
      'wire_transfer',
      'debit_card'
    ];
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{ status: string; environment: string; hasApiKey: boolean }> {
    return {
      status: this.config.apiKey ? 'ready' : 'needs_configuration',
      environment: this.config.environment,
      hasApiKey: !!this.config.apiKey
    };
  }
}

export const coinflipService = new CoinFlipService();