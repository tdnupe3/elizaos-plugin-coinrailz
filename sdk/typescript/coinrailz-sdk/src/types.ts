/**
 * Coin Railz SDK Type Definitions
 * x402 micropayment-enabled crypto microservices for AI agents
 */

export interface CoinRailzConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  disableTelemetry?: boolean;
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  status: number;
  error?: string;
  raw?: unknown;
}

export interface GasPriceResponse {
  chain: string;
  gasPrice: {
    slow: number;
    standard: number;
    fast: number;
  };
  estimatedFeeUsd?: number;
  timestamp: string;
}

export interface TokenMetadataResponse {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: string;
  [key: string]: unknown;
}

export interface TokenPriceResponse {
  chain: string;
  address: string;
  symbol: string;
  priceUsd: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  timestamp: string;
}

export interface TradeSignalResponse {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  analysis: string;
  timestamp: string;
}

export interface WhaleAlertResponse {
  alerts: Array<{
    txHash: string;
    chain: string;
    token: string;
    amount: number;
    amountUsd: number;
    from: string;
    to: string;
    timestamp: string;
  }>;
}

export interface SentimentResponse {
  token: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  sources: Array<{
    platform: string;
    sentiment: string;
    mentions: number;
  }>;
  timestamp: string;
}

export interface DexLiquidityResponse {
  chain: string;
  token: string;
  pools: Array<{
    dex: string;
    pair: string;
    liquidity: number;
    volume24h: number;
  }>;
  totalLiquidity: number;
}

export interface ArbitrageScannerResponse {
  opportunities: Array<{
    token: string;
    buyChain: string;
    sellChain: string;
    buyPrice: number;
    sellPrice: number;
    spreadPercent: number;
    estimatedProfit: number;
  }>;
  timestamp: string;
}

export interface PredictionMarketResponse {
  marketId: string;
  marketTitle: string;
  source: string;
  outcomes: Array<{
    name: string;
    odds: number;
    impliedProbability: number;
  }>;
  volume?: number;
  endDate?: string;
}

export interface AgentWalletResponse {
  walletId: string;
  address: string;
  chain: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ContractScanResponse {
  address: string;
  chain: string;
  isVerified: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  auditScore: number;
}

export interface PortfolioOptimizationResponse {
  recommendations: Array<{
    action: 'buy' | 'sell' | 'hold';
    token: string;
    currentAllocation: number;
    recommendedAllocation: number;
    reasoning: string;
  }>;
  riskScore: number;
  expectedReturn: number;
}

export interface ServiceCatalogEntry {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  priceUSD: string;
  category: string;
  capabilities: string[];
}

export interface ServiceCatalog {
  version: string;
  updated: string;
  baseUrl: string;
  services: ServiceCatalogEntry[];
  totalServices: number;
}
