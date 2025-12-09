/**
 * Coin Railz SDK
 * Official JavaScript/TypeScript SDK for Coin Railz
 * x402 micropayment-enabled crypto microservices for AI agents
 * 
 * @packageDocumentation
 */

export { CoinRailzClient } from './client.js';
export { CoinRailzClient as default } from './client.js';

export type {
  CoinRailzConfig,
  ServiceResponse,
  GasPriceResponse,
  TokenMetadataResponse,
  TokenPriceResponse,
  TradeSignalResponse,
  WhaleAlertResponse,
  SentimentResponse,
  DexLiquidityResponse,
  ArbitrageScannerResponse,
  PredictionMarketResponse,
  AgentWalletResponse,
  ContractScanResponse,
  PortfolioOptimizationResponse,
  ServiceCatalog,
  ServiceCatalogEntry,
} from './types.js';
