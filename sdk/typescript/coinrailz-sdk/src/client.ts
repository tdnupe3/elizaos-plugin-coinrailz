/**
 * Coin Railz Client v1.0.3
 * Lightweight x402 micropayment SDK for AI agents and bots
 * 
 * Features:
 * - Zero-config start: Works without API key for free-tier services
 * - Auto demo key: Fetches trial credits on first 402 response
 * - Telemetry: Anonymous usage tracking to improve SDK experience
 * - Smart retries: Auto-retries with demo key on payment required
 */

import type {
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
} from './types.js';

export const SDK_VERSION = '1.3.1';

const FREE_TIER_SERVICES = new Set(['gas-price-oracle', 'token-metadata']);

let globalInstallId: string | null = null;
let telemetrySent = false;
let cachedDemoKey: string | null = null;

function getInstallId(): string {
  if (globalInstallId) return globalInstallId;
  
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__coinrailz_install_id) {
    globalInstallId = (globalThis as Record<string, unknown>).__coinrailz_install_id as string;
    return globalInstallId;
  }
  
  globalInstallId = `ts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>).__coinrailz_install_id = globalInstallId;
  }
  
  return globalInstallId;
}

export class CoinRailzClient {
  private apiKey: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly disableTelemetry: boolean;

  constructor(config: CoinRailzConfig = {}) {
    if (typeof fetch === 'undefined') {
      throw new Error(
        'CoinRailzClient requires global fetch. Node.js 18+ has built-in fetch. ' +
        'For older Node versions, use node-fetch or upgrade to Node 18+.'
      );
    }
    
    this.apiKey = config.apiKey ?? null;
    this.baseUrl = config.baseUrl ?? 'https://coinrailz.com';
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.disableTelemetry = config.disableTelemetry ?? false;
    
    if (!this.disableTelemetry) {
      this.sendTelemetry('install').catch(() => {});
    }
  }

  private async sendTelemetry(event: string = 'usage'): Promise<void> {
    if (this.disableTelemetry) return;
    if (telemetrySent && event === 'install') return;
    
    try {
      const installId = getInstallId();
      await fetch(`${this.baseUrl}/api/sdk/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `CoinRailz-SDK/${SDK_VERSION}`,
        },
        body: JSON.stringify({
          installId,
          sdkType: 'typescript',
          sdkVersion: SDK_VERSION,
          event,
          environment: {
            hasApiKey: !!this.apiKey,
            runtime: typeof process !== 'undefined' ? 'node' : 'browser',
          },
        }),
      });
      telemetrySent = true;
    } catch {
    }
  }

  private async fetchDemoKey(): Promise<string | null> {
    if (cachedDemoKey) return cachedDemoKey;
    
    try {
      const installId = getInstallId();
      const res = await fetch(`${this.baseUrl}/api/sdk/demo-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `CoinRailz-SDK/${SDK_VERSION}`,
        },
        body: JSON.stringify({
          installId,
          sdkType: 'typescript',
        }),
      });
      
      if (res.ok) {
        const data = await res.json() as { api_key?: string };
        if (data.api_key) {
          cachedDemoKey = data.api_key;
          return data.api_key;
        }
      }
    } catch {
    }
    return null;
  }

  private async request<T = unknown>(
    service: string,
    payload?: unknown,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<ServiceResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    this.sendTelemetry('usage').catch(() => {});

    try {
      const url = `${this.baseUrl}/x402/${service}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': `CoinRailz-SDK/${SDK_VERSION}`,
      };

      if (this.apiKey) {
        headers['X-API-KEY'] = this.apiKey;
      }

      const options: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (method === 'POST') {
        options.body = payload ? JSON.stringify(payload) : '{}';
      }

      const res = await fetch(url, options);
      const status = res.status;

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
      }

      if (status === 402) {
        const parsedJson = json as { accepts?: Array<{ maxAmountRequiredUSD?: string }> } | null;
        const price = parsedJson?.accepts?.[0]?.maxAmountRequiredUSD ?? 'Unknown';
        
        if (!this.apiKey) {
          const demoKey = await this.fetchDemoKey();
          if (demoKey) {
            headers['X-API-KEY'] = demoKey;
            const retryOptions: RequestInit = {
              method,
              headers,
              signal: controller.signal,
            };
            if (method === 'POST') {
              retryOptions.body = payload ? JSON.stringify(payload) : '{}';
            }
            
            const retryRes = await fetch(url, retryOptions);
            if (retryRes.ok) {
              const retryJson = await retryRes.json() as T;
              return {
                success: true,
                status: retryRes.status,
                data: retryJson,
                raw: retryJson,
              };
            }
          }
        }
        
        return {
          success: false,
          status: 402,
          error: `Payment required: $${price}`,
          raw: json,
          data: {
            error: 'Payment required',
            service,
            price_usd: price,
            message: `This service costs $${price}. You need an API key with credits.`,
            quick_fix: {
              step_1: 'Try free services first: gas-price-oracle, token-metadata',
              step_2: 'Get demo key: POST /api/sdk/demo-key',
              step_3: 'Or buy credits: https://coinrailz.com/credits',
            },
            free_services: Array.from(FREE_TIER_SERVICES),
          } as unknown as T,
        };
      }

      if (!res.ok) {
        return {
          success: false,
          status,
          error: typeof json === 'object' && json !== null && 'error' in json 
            ? String((json as Record<string, unknown>).error) 
            : res.statusText,
          raw: json,
        };
      }

      return {
        success: true,
        status,
        data: json as T,
        raw: json,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          status: 0,
          error: 'Request timed out',
        };
      }
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Set or update the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if client has an API key configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the current install ID (for debugging)
   */
  getInstallId(): string {
    return getInstallId();
  }

  /**
   * Call any x402 service by name
   */
  async call<T = unknown>(service: string, payload?: unknown): Promise<ServiceResponse<T>> {
    return this.request<T>(service, payload);
  }

  /**
   * Get the full service catalog
   */
  async getCatalog(): Promise<ServiceResponse<ServiceCatalog>> {
    return this.request<ServiceCatalog>('catalog', undefined, 'GET');
  }

  // ==================== Discovery ====================

  /**
   * Ping endpoint - verify API connectivity
   */
  async ping(): Promise<ServiceResponse<{ message: string; timestamp: string }>> {
    return this.request('ping', { message: 'ping' });
  }

  // ==================== Trading Intelligence ====================

  /**
   * Get real-time gas prices across chains (FREE)
   */
  async gasPriceOracle(params?: { chain?: string }): Promise<ServiceResponse<GasPriceResponse>> {
    return this.request<GasPriceResponse>('gas-price-oracle', params);
  }

  /**
   * Get token metadata (FREE)
   */
  async tokenMetadata(params: { chain: string; address: string }): Promise<ServiceResponse<TokenMetadataResponse>> {
    return this.request<TokenMetadataResponse>('token-metadata', params);
  }

  /**
   * Get token price in USD
   */
  async tokenPrice(params: { chain: string; address: string }): Promise<ServiceResponse<TokenPriceResponse>> {
    return this.request<TokenPriceResponse>('token-price', params);
  }

  /**
   * Get AI-powered trade signals
   */
  async tradeSignals(params: { token: string; chain?: string }): Promise<ServiceResponse<TradeSignalResponse>> {
    return this.request<TradeSignalResponse>('trade-signals', params);
  }

  /**
   * Get whale movement alerts
   */
  async whaleAlerts(params?: { chain?: string; minValueUsd?: number }): Promise<ServiceResponse<WhaleAlertResponse>> {
    return this.request<WhaleAlertResponse>('whale-alerts', params);
  }

  /**
   * Get social sentiment analysis
   */
  async sentimentAnalysis(params: { token: string }): Promise<ServiceResponse<SentimentResponse>> {
    return this.request<SentimentResponse>('sentiment-analysis', params);
  }

  /**
   * Get DEX liquidity analysis
   */
  async dexLiquidity(params: { chain: string; token: string }): Promise<ServiceResponse<DexLiquidityResponse>> {
    return this.request<DexLiquidityResponse>('dex-liquidity', params);
  }

  /**
   * Scan for cross-chain arbitrage opportunities
   */
  async arbitrageScanner(params?: { minSpreadPercent?: number }): Promise<ServiceResponse<ArbitrageScannerResponse>> {
    return this.request<ArbitrageScannerResponse>('arbitrage-scanner', params);
  }

  /**
   * Scan smart contract for vulnerabilities
   */
  async contractScan(params: { chain: string; address: string }): Promise<ServiceResponse<ContractScanResponse>> {
    return this.request<ContractScanResponse>('contract-scan', params);
  }

  /**
   * Get portfolio optimization recommendations
   */
  async portfolioOptimization(params: { 
    holdings: Array<{ token: string; amount: number }>;
    riskTolerance?: 'low' | 'medium' | 'high';
  }): Promise<ServiceResponse<PortfolioOptimizationResponse>> {
    return this.request<PortfolioOptimizationResponse>('portfolio-optimization', params);
  }

  /**
   * Get trending tokens
   */
  async trendingTokens(params?: { chain?: string; limit?: number }): Promise<ServiceResponse<unknown>> {
    return this.request('trending-tokens', params);
  }

  /**
   * Get token correlation matrix
   */
  async correlationMatrix(params: { tokens: string[] }): Promise<ServiceResponse<unknown>> {
    return this.request('correlation-matrix', params);
  }

  // ==================== Prediction Markets ====================

  /**
   * Get prediction market odds
   */
  async predictionMarketOdds(params: { marketSlug?: string; query?: string }): Promise<ServiceResponse<PredictionMarketResponse>> {
    return this.request<PredictionMarketResponse>('prediction-market-odds', params);
  }

  /**
   * Get Polymarket events
   */
  async polymarketEvents(params?: { category?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('polymarket-events', params);
  }

  /**
   * Prediction market spread — cross-platform arbitrage between Polymarket and Kalshi
   * $0.25 per request
   */
  async predictionMarketSpread(params?: { market?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('prediction-market-spread', params);
  }

  // ==================== Robinhood Chain ====================

  /**
   * Robinhood Chain token price — live price + pool data
   * $0.60 per request (day-1 exclusivity premium)
   */
  async robinhoodTokenPrice(params: { token: string }): Promise<ServiceResponse<unknown>> {
    return this.request('robinhood-token-price', params);
  }

  /**
   * Robinhood Chain DEX pools — top liquidity pools for trading/routing
   * $1.25 per request
   */
  async robinhoodDexPools(params?: { limit?: number }): Promise<ServiceResponse<unknown>> {
    return this.request('robinhood-dex-pools', params);
  }

  /**
   * Robinhood Chain stats — block, gas, total DEX volume, active pools
   * $0.75 per request
   */
  async robinhoodChainStats(): Promise<ServiceResponse<unknown>> {
    return this.request('robinhood-chain-stats');
  }

  /**
   * RH stock price — live Chainlink price feed for RH stock tokens (AAPL, NVDA, SPY, etc)
   * $0.05 per request
   */
  async rhStockPrice(params: { symbol: string }): Promise<ServiceResponse<unknown>> {
    return this.request('rh-stock-price', params);
  }

  /**
   * RH USDC bridge — bridge USDC (Base) to USDG (Robinhood Chain) via Across Protocol
   * $0.75 per request
   */
  async rhBridgeUsdc(params: { amount: number; recipient?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('rh-bridge-usdc', params);
  }

  // ==================== B20 Token Compliance ====================

  /**
   * B20 token info — ERC-20 metadata + compliance mode/freeze state
   * $0.05 per request
   */
  async b20TokenInfo(params: { address: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('b20-token-info', params);
  }

  /**
   * B20 transfer check — simulate transfer against live freeze/blocklist/allowlist
   * $0.10 per request
   */
  async b20TransferCheck(params: { token: string; from: string; to: string; amount: string }): Promise<ServiceResponse<unknown>> {
    return this.request('b20-transfer-check', params);
  }

  /**
   * B20 compliance scan — multi-issuer compliance scan for a wallet address
   * $0.25 per request
   */
  async b20ComplianceScan(params: { address: string }): Promise<ServiceResponse<unknown>> {
    return this.request('b20-compliance-scan', params);
  }

  // ==================== RWA & Tokenized Assets ====================

  /**
   * RWA NAV oracle — synthetic market-based NAV estimate + EIP-712 attestation
   * $0.50 per request
   */
  async rwaNavOracle(params: { asset: string }): Promise<ServiceResponse<unknown>> {
    return this.request('rwa-nav-oracle', params);
  }

  /**
   * Tokenized yield compare — live yield comparison: Ondo/Backed/Superstate/Mountain/OpenEden
   * $0.25 per request
   */
  async tokenizedYieldCompare(params?: { minApy?: number }): Promise<ServiceResponse<unknown>> {
    return this.request('tokenized-yield-compare', params);
  }

  // ==================== Agent Infrastructure ====================

  /**
   * Create an agent wallet (standard method)
   */
  async createAgentWallet(params?: { label?: string; metadata?: Record<string, unknown> }): Promise<ServiceResponse<AgentWalletResponse>> {
    return this.request<AgentWalletResponse>('agent-create-wallet', params);
  }

  /**
   * Build a transaction
   */
  async transactionBuilder(params: {
    chain: string;
    from: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<ServiceResponse<unknown>> {
    return this.request('transaction-builder', params);
  }

  /**
   * Get batch quote for multiple swaps
   */
  async batchQuote(params: { swaps: Array<{ tokenIn: string; tokenOut: string; amount: string }> }): Promise<ServiceResponse<unknown>> {
    return this.request('batch-quote', params);
  }

  /**
   * Cross-chain bridge routing
   */
  async chainBridge(params: { 
    fromChain: string; 
    toChain: string; 
    token: string; 
    amount: string 
  }): Promise<ServiceResponse<unknown>> {
    return this.request('seamless-chain-bridge', params);
  }

  // ==================== Risk & Compliance ====================

  /**
   * Get wallet risk analysis
   */
  async walletRisk(params: { address: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('wallet-risk', params);
  }

  /**
   * Get risk metrics
   */
  async riskMetrics(params: { token: string }): Promise<ServiceResponse<unknown>> {
    return this.request('risk-metrics', params);
  }

  /**
   * Credit risk score
   */
  async creditRiskScore(params: { address: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('credit-risk-score', params);
  }

  /**
   * Fraud detection analysis
   */
  async fraudDetection(params: { address: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('fraud-detection', params);
  }

  /**
   * Compliance check for address
   */
  async complianceCheck(params: { address: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('compliance-check', params);
  }

  /**
   * Compliance consultation
   */
  async complianceConsultation(params: { query: string }): Promise<ServiceResponse<unknown>> {
    return this.request('compliance-consultation', params);
  }

  // ==================== Real Estate ====================

  /**
   * Property valuation analysis
   */
  async propertyValuation(params: { address?: string; propertyId?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('property-valuation', params);
  }

  /**
   * Lease analysis
   */
  async leaseAnalysis(params: { propertyId: string }): Promise<ServiceResponse<unknown>> {
    return this.request('lease-analysis', params);
  }

  /**
   * Construction progress monitoring
   */
  async constructionProgress(params: { projectId: string }): Promise<ServiceResponse<unknown>> {
    return this.request('construction-progress', params);
  }

  // ==================== Additional Trading ====================

  /**
   * Token sentiment analysis (alternative endpoint)
   */
  async tokenSentiment(params: { tokenSymbol: string }): Promise<ServiceResponse<unknown>> {
    return this.request('token-sentiment', params);
  }

  /**
   * Trading signal (alternative endpoint)
   */
  async tradingSignal(params: { token: string; chain?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('trading-signal', params);
  }

  /**
   * Portfolio tracker
   */
  async portfolioTracker(params: { address: string; chains?: string[] }): Promise<ServiceResponse<unknown>> {
    return this.request('portfolio-tracker', params);
  }

  /**
   * Token approval manager
   */
  async approvalManager(params: { 
    tokenAddress: string; 
    spenderAddress: string; 
    ownerAddress: string; 
    chain: string;
    amount?: string;
  }): Promise<ServiceResponse<unknown>> {
    return this.request('approval-manager', params);
  }

  /**
   * Multi-chain balance lookup
   */
  async multiChainBalance(params: { address: string; chains?: string[] }): Promise<ServiceResponse<unknown>> {
    return this.request('multi-chain-balance', params);
  }

  /**
   * Smart contract security audit
   */
  async smartContractAudit(params: { address: string; chain: string }): Promise<ServiceResponse<unknown>> {
    return this.request('smart-contract-audit', params);
  }

  // ==================== Traditional Markets ====================

  /**
   * Stock market sentiment analysis
   * AI-powered stock sentiment with news, technicals, and institutional activity
   * $0.40 per request
   */
  async stockSentiment(params: { symbol: string }): Promise<ServiceResponse<unknown>> {
    return this.request('stock-sentiment', params);
  }

  /**
   * Forex sentiment analysis
   * AI-powered forex sentiment with central bank policy and economic indicators
   * $0.40 per request
   */
  async forexSentiment(params: { pair: string }): Promise<ServiceResponse<unknown>> {
    return this.request('forex-sentiment', params);
  }

  // ==================== Polymarket Extended ====================

  /**
   * Polymarket odds lookup
   */
  async polymarketOdds(params: { marketId?: string; slug?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('polymarket-odds', params);
  }

  /**
   * Polymarket search
   */
  async polymarketSearch(params: { query: string; category?: string }): Promise<ServiceResponse<unknown>> {
    return this.request('polymarket-search', params);
  }

  // ==================== Agent Identity ====================

  /**
   * Create instant agent wallet
   */
  async instantAgentWallet(params?: { label?: string }): Promise<ServiceResponse<AgentWalletResponse>> {
    return this.request('instant-agent-wallet', params);
  }

  /**
   * Verified agent identity (ERC-8004)
   */
  async verifiedAgentIdentity(params: { agentAddress: string }): Promise<ServiceResponse<unknown>> {
    return this.request('verified-agent-identity', params);
  }

  // ==================== Bankroll Network / VLT Vault ====================

  /**
   * vltUSDC plain withdrawal calldata (1-transaction flow)
   * FREE — returns one unsigned Ethereum vault.redeem(shares, recipient) transaction.
   * Burns vltUSDC shares and delivers VLT + USDC pro-rata at current pool composition.
   * No swaps or additional approvals required.
   * Use vltUsdcZapWithdraw() instead for a USDC-only exit (3-tx flow, automatic VLT→USDC swap).
   */
  async vltUsdcWithdraw(params: {
    /** Raw 18-decimal vltUSDC share amount to redeem (e.g. "1790439768343002") */
    shares: string;
    /** Ethereum address to receive the redeemed VLT + USDC output */
    recipient: string;
  }): Promise<ServiceResponse<unknown>> {
    return this.request('vlt-usdc-withdraw', params);
  }

  /**
   * vltUSDC USDC-only exit calldata builder (3-transaction flow)
   * FREE — returns three unsigned Ethereum transactions to exit the Bankroll Network vltUSDC vault as USDC only.
   * Tx 1: vault.redeem(shares, recipient) — burns shares, delivers VLT + USDC pro-rata.
   * Tx 2: VLT.approve(uniswapV2Router, vltAmount) — grants V2 Router permission to spend VLT.
   * Tx 3: v2Router.swapExactTokensForTokens([VLT, WETH, USDC], recipient) — two-hop V2 swap.
   * minAmountOut in Tx 3 is computed on-chain from live V2 reserves with 2% slippage.
   */
  async vltUsdcZapWithdraw(params: {
    /** Raw 18-decimal vltUSDC share amount to redeem (e.g. "1790439768343002") */
    shares: string;
    /** Ethereum address to receive all USDC output */
    recipient: string;
  }): Promise<ServiceResponse<unknown>> {
    return this.request('vlt-usdc-zap-withdraw', params);
  }
}

export default CoinRailzClient;
