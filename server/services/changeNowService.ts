// ChangeNOW Service - Enhanced cross-chain swap and exchange functionality
// Supporting 900+ cryptocurrencies with instant exchanges

import { storage } from "../storage";

export interface ChangeNowExchange {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  payinAddress: string;
  payoutAddress: string;
  status: string;
  payinHash?: string;
  payoutHash?: string;
  refundAddress?: string;
  validUntil?: string;
}

export interface CreateExchangeRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAddress: string;
  fromAddress?: string;
  refundAddress?: string;
  userId?: string;
  flow?: 'standard' | 'fixed-rate';
}

export interface CurrencyInfo {
  ticker: string;
  name: string;
  image: string;
  hasExternalId: boolean;
  isFiat: boolean;
  featured: boolean;
  isStable: boolean;
  supportsFixedRate: boolean;
}

export interface ExchangeRange {
  minAmount: number;
  maxAmount: number;
}

export interface EstimateRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmount?: number;
  toAmount?: number;
  flow?: 'standard' | 'fixed-rate';
}

export class ChangeNowService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.changenow.io/v2';
  private readonly partnerId = 'coinrailz'; // Your platform identifier

  constructor() {
    if (!process.env.CHANGENOW_API_KEY) {
      throw new Error('CHANGENOW_API_KEY environment variable is required');
    }
    this.apiKey = process.env.CHANGENOW_API_KEY;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-changenow-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChangeNOW API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get all available currencies
  async getAvailableCurrencies(active: boolean = true): Promise<CurrencyInfo[]> {
    const params = new URLSearchParams({
      active: active.toString(),
      fixedRate: 'true'
    });
    return this.makeRequest(`/exchange/currencies?${params}`);
  }

  // Get exchange estimation
  async getExchangeEstimate(request: EstimateRequest): Promise<any> {
    const params = new URLSearchParams({
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      flow: request.flow || 'standard'
    });

    if (request.fromAmount) {
      params.append('fromAmount', request.fromAmount.toString());
    }
    if (request.toAmount) {
      params.append('toAmount', request.toAmount.toString());
    }

    return this.makeRequest(`/exchange/estimated-amount?${params}`);
  }

  // Get exchange range for a currency pair
  async getExchangeRange(fromCurrency: string, toCurrency: string, flow: 'standard' | 'fixed-rate' = 'standard'): Promise<ExchangeRange> {
    const params = new URLSearchParams({
      fromCurrency,
      toCurrency,
      flow
    });
    return this.makeRequest(`/exchange/range?${params}`);
  }

  // Create exchange transaction
  async createExchange(request: CreateExchangeRequest): Promise<ChangeNowExchange> {
    const body = {
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      fromAmount: request.fromAmount,
      toAddress: request.toAddress,
      flow: request.flow || 'standard',
      ...(request.fromAddress && { fromAddress: request.fromAddress }),
      ...(request.refundAddress && { refundAddress: request.refundAddress }),
      partnerId: this.partnerId
    };

    const exchange = await this.makeRequest('/exchange', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Log transaction for compliance
    if (request.userId) {
      await this.logExchangeTransaction(request.userId, exchange, request);
    }

    return exchange;
  }

  // Get exchange status
  async getExchangeStatus(exchangeId: string): Promise<ChangeNowExchange> {
    return this.makeRequest(`/exchange/by-id?id=${exchangeId}`);
  }

  // Get exchange history for user
  async getUserExchangeHistory(userId: string, limit: number = 50): Promise<ChangeNowExchange[]> {
    // This would typically be stored in your database
    // For now, return empty array - implement database lookup
    return [];
  }

  // Cross-chain portfolio rebalancing
  async rebalancePortfolio(userId: string, targetAllocations: Record<string, number>): Promise<any> {
    try {
      const currentHoldings = await storage.getUserCryptoHoldings(userId);
      const rebalanceTransactions: ChangeNowExchange[] = [];

      for (const [targetCurrency, targetPercentage] of Object.entries(targetAllocations)) {
        const currentHolding = currentHoldings.find(h => h.coinSymbol === targetCurrency);
        const currentValue = currentHolding
          ? parseFloat(currentHolding.amount) * parseFloat(currentHolding.averageBuyPrice ?? '0')
          : 0;
        
        // Calculate needed adjustments (simplified logic)
        // In production, you'd implement sophisticated rebalancing algorithms
        if (currentValue > 0) {
          // Create exchange transactions as needed
          // This is a placeholder for the rebalancing logic
        }
      }

      return { success: true, transactions: rebalanceTransactions };
    } catch (error) {
      console.error('Portfolio rebalancing error:', error);
      throw error;
    }
  }

  // Enhanced DEX aggregation with ChangeNOW
  async getBestSwapRate(fromCurrency: string, toCurrency: string, amount: number): Promise<any> {
    try {
      const estimate = await this.getExchangeEstimate({
        fromCurrency,
        toCurrency,
        fromAmount: amount
      });

      return {
        provider: 'changenow',
        fromAmount: amount,
        toAmount: estimate.toAmount,
        rate: estimate.toAmount / amount,
        networkFee: estimate.networkFee || 0,
        serviceFee: estimate.serviceFee || 0,
        flow: 'standard'
      };
    } catch (error) {
      console.error('ChangeNOW rate fetch error:', error);
      throw error;
    }
  }

  // AI Agent cross-chain transaction support
  async createAgentCrossChainTransaction(agentId: string, request: CreateExchangeRequest): Promise<any> {
    try {
      const exchange = await this.createExchange({
        ...request,
        userId: `agent_${agentId}`
      });

      // Apply 2% marketplace fee
      const feeAmount = request.fromAmount * 0.02;
      
      return {
        exchangeId: exchange.id,
        payinAddress: exchange.payinAddress,
        expectedAmount: exchange.toAmount,
        platformFee: feeAmount,
        status: 'created'
      };
    } catch (error) {
      console.error('Agent cross-chain transaction error:', error);
      throw error;
    }
  }

  // Multi-currency referral rewards
  async processReferralReward(userId: string, rewardAmount: number, preferredCurrency: string = 'USDT'): Promise<any> {
    try {
      // Convert USD reward to preferred cryptocurrency
      const estimate = await this.getExchangeEstimate({
        fromCurrency: 'USD',
        toCurrency: preferredCurrency,
        fromAmount: rewardAmount
      });

      // In production, you'd execute the actual conversion
      return {
        originalAmount: rewardAmount,
        convertedAmount: estimate.toAmount,
        currency: preferredCurrency,
        conversionRate: estimate.toAmount / rewardAmount
      };
    } catch (error) {
      console.error('Referral reward conversion error:', error);
      throw error;
    }
  }

  private async logExchangeTransaction(userId: string, exchange: any, request: CreateExchangeRequest): Promise<void> {
    try {
      // Store the exchange as a normalized crypto transaction record.
      await storage.createCryptoTransaction({
        userId,
        transactionType: 'exchange',
        coinSymbol: `${request.fromCurrency}/${request.toCurrency}`,
        amount: request.fromAmount.toString(),
        totalValue: request.fromAmount.toString(),
        status: 'pending',
        blockchainHash: exchange.id,
        blockchainAddress: request.toAddress,
        networkFee: '0', // ChangeNOW fee is built into exchange rate
      });
    } catch (error) {
      console.error('Exchange transaction logging error:', error);
    }
  }
}

export const changeNowService = new ChangeNowService();