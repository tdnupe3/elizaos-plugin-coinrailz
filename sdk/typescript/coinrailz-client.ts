/**
 * Coin Railz TypeScript SDK
 * Official client library for Coin Railz micropayment services
 * 
 * @package @coinrailz/sdk
 * @version 1.0.0
 */

export interface CoinRailzConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ServiceCallOptions {
  serviceId: string;
  payload: Record<string, any>;
}

export interface CreditBalance {
  balance: number;
  autoTopUpEnabled: boolean;
  autoTopUpThreshold: number;
  preferredPaymentMethod: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  paymentMethod: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface APIKey {
  id: string;
  keyPrefix: string;
  name: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
  rateLimit: number;
}

export class CoinRailzError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'CoinRailzError';
  }
}

export class CoinRailzClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: CoinRailzConfig) {
    if (!config.apiKey) {
      throw new CoinRailzError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://coinrailz.com';
  }

  /**
   * Make authenticated request to Coin Railz API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new CoinRailzError(
        error.error || 'Request failed',
        response.status,
        error.code
      );
    }

    return response.json();
  }

  /**
   * Get current credit balance
   */
  async getBalance(): Promise<CreditBalance> {
    return this.request<CreditBalance>('/api/credits/balance');
  }

  /**
   * Get transaction history
   */
  async getTransactions(limit = 50): Promise<Transaction[]> {
    const data = await this.request<{ transactions: Transaction[] }>(
      `/api/credits/transactions?limit=${limit}`
    );
    return data.transactions;
  }

  /**
   * Call a micropayment service
   */
  async callService<T = any>(options: ServiceCallOptions): Promise<T> {
    return this.request<T>(`/api/x402/${options.serviceId}`, {
      method: 'POST',
      body: JSON.stringify(options.payload),
    });
  }

  /**
   * Multi-chain balance check
   */
  async getMultiChainBalance(
    address: string,
    chains: string[] = ['ethereum', 'base', 'polygon']
  ) {
    return this.callService({
      serviceId: 'multi-chain-balance',
      payload: { address, chains },
    });
  }

  /**
   * Get gas prices across chains
   */
  async getGasPrices(chains: string[] = ['ethereum', 'base']) {
    return this.callService({
      serviceId: 'gas-price-oracle',
      payload: { chains },
    });
  }

  /**
   * Get token price
   */
  async getTokenPrice(tokenAddress: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'token-price',
      payload: { tokenAddress, chain },
    });
  }

  /**
   * Check wallet risk score
   */
  async getWalletRisk(walletAddress: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'wallet-risk',
      payload: { walletAddress, chain },
    });
  }

  /**
   * Scan smart contract
   */
  async scanContract(contractAddress: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'contract-scan',
      payload: { contractAddress, chain },
    });
  }

  /**
   * Get AI-powered trade signals
   */
  async getTradeSignals(
    token: string,
    timeframe = '1h',
    riskLevel = 'medium'
  ) {
    return this.callService({
      serviceId: 'trade-signals',
      payload: { token, timeframe, riskLevel },
    });
  }

  /**
   * Get token social sentiment
   */
  async getTokenSentiment(tokenSymbol: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'token-sentiment',
      payload: { tokenSymbol, chain },
    });
  }

  /**
   * Get trending tokens
   */
  async getTrendingTokens(timeframe = '24h', chain = 'ethereum') {
    return this.callService({
      serviceId: 'trending-tokens',
      payload: { timeframe, chain },
    });
  }

  /**
   * Get whale wallet alerts
   */
  async getWhaleAlerts(chain = 'ethereum', minValue = 1000000) {
    return this.callService({
      serviceId: 'whale-alerts',
      payload: { chain, minValue },
    });
  }

  /**
   * Get DEX liquidity data
   */
  async getDexLiquidity(tokenAddress: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'dex-liquidity',
      payload: { tokenAddress, chain },
    });
  }

  /**
   * Get NFT floor price
   */
  async getNftFloorPrice(collectionAddress: string, chain = 'ethereum') {
    return this.callService({
      serviceId: 'nft-floor-price',
      payload: { collectionAddress, chain },
    });
  }

  /**
   * Verify ENS domain
   */
  async verifyEnsDomain(domain: string) {
    return this.callService({
      serviceId: 'ens-verification',
      payload: { domain },
    });
  }

  /**
   * Get smart contract events
   */
  async getContractEvents(
    contractAddress: string,
    eventName: string,
    fromBlock: number,
    chain = 'ethereum'
  ) {
    return this.callService({
      serviceId: 'contract-events',
      payload: { contractAddress, eventName, fromBlock, chain },
    });
  }
}

/**
 * Create a Coin Railz client instance
 */
export function createClient(config: CoinRailzConfig): CoinRailzClient {
  return new CoinRailzClient(config);
}

// Export types
export type { CoinRailzConfig, ServiceCallOptions };
