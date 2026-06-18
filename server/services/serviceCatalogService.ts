/**
 * SERVICE CATALOG SERVICE
 * 
 * Provides a structured catalog of x402 services for discovery by AI agents.
 * Used in:
 * 1. /x402/catalog endpoint for browsing all services
 * 2. 402 response enrichment with recommendedServices
 * 3. Agent discovery to understand our capabilities
 * 
 * CRITICAL: Prices are derived from shared/pricing.ts to prevent drift
 * between SEO pages and actual x402 payment verification
 */

import { SERVICE_PRICING_USD, formatUSD, ServiceName, isServiceName } from "../../shared/pricing";

interface ServiceCatalogEntry {
  id: string;
  slug?: string;
  name: string;
  description: string;
  endpoint: string;
  priceUSD: string;
  priceUSDC: string;
  network: string;
  category: string;
  capabilities: string[];
  x402Compatible: boolean;
  stripeCompatible: boolean;
}

// Helper to get price from canonical source, with fallback for non-standard services
function getCanonicalPrice(serviceId: string): { priceUSD: string; priceUSDC: string } {
  if (isServiceName(serviceId)) {
    const price = SERVICE_PRICING_USD[serviceId as ServiceName];
    return {
      priceUSD: formatUSD(price),
      priceUSDC: `${price.toFixed(2)} USDC`
    };
  }
  // Non-standard services (SDK payments with percentage-based pricing)
  return { priceUSD: 'Variable', priceUSDC: 'Variable' };
}

interface ServiceCatalog {
  version: string;
  updated: string;
  baseUrl: string;
  payTo: string;
  services: ServiceCatalogEntry[];
  categories: string[];
  totalServices: number;
}

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
const PAY_TO = process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

const CATEGORY_ORDER = [
  'discovery',
  'trading-intelligence',
  'execution',
  'premium',
  'real-estate',
  'banking',
  'trading',
  'market-intelligence',
  'prediction-markets',
  'traditional-markets',
  'solana-defi',
  'sdk-payments',
  'satellite-data',
  'iot-depin'
];

export class ServiceCatalogService {
  private static instance: ServiceCatalogService;
  private catalog: ServiceCatalogEntry[] = [];

  public static getInstance(): ServiceCatalogService {
    if (!ServiceCatalogService.instance) {
      ServiceCatalogService.instance = new ServiceCatalogService();
      ServiceCatalogService.instance.buildCatalog();
    }
    return ServiceCatalogService.instance;
  }

  private buildCatalog(): void {
    // Build catalog with canonical pricing from shared/pricing.ts
    // This prevents price drift between SEO pages and x402 payment verification
    const rawCatalog: (Omit<ServiceCatalogEntry, 'priceUSD' | 'priceUSDC'> & { slug?: string })[] = [
      // Discovery & Testing (1)
      // NOTE: Endpoints use /x402/{service} format (not /x402/service/{service})
      {
        id: 'ping',
        name: 'x402 Discovery Ping',
        description: 'x402 payment infrastructure health check. Returns 402 challenge with valid EIP-712 payment requirements — use to verify your x402 client can parse and sign challenges before live payments.',
        endpoint: '/x402/ping',
        network: 'eip155:8453',
        category: 'discovery',
        capabilities: ['ping', 'health-check', 'x402-test'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'first-call',
        name: 'x402 Golden Path — First Paid Call',
        description: 'START HERE. The canonical first payment endpoint for any AI agent integrating with Coin Railz. Pay $0.05 USDC on Base or Solana and receive a verified onboarding receipt, payment confirmation, and executable templates for the next 3 services. Lowest entry price. Both EVM and Solana accepted.',
        endpoint: '/x402/first-call',
        network: 'eip155:8453',
        category: 'onboarding',
        capabilities: ['onboarding', 'first-payment', 'x402-verify', 'golden-path', 'solana-compatible'],
        x402Compatible: true,
        stripeCompatible: false
      },
      // Trading Intelligence (14)
      {
        id: 'trade-signals',
        name: 'AI Trade Signals',
        description: 'AI-generated BUY/SELL/HOLD signal for any token with confidence score (0–100), price targets, stop-loss level, and multi-timeframe technical summary. GPT-4o powered. Pass { symbol } or { address }.',
        endpoint: '/x402/trade-signals',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['signals', 'ai-analysis', 'entry-exit'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'wallet-risk',
        name: 'Wallet Risk Analysis',
        description: 'On-chain risk score (0–100) for any EVM wallet. Flags mixer exposure, blacklisted counterparties, rug-pull history, concentration risk, and anomalous transfer patterns. Pass { address, chain? }.',
        endpoint: '/x402/wallet-risk',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['risk-assessment', 'wallet-analysis', 'fraud-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'token-sentiment',
        name: 'Deep Token Analysis',
        description: 'Full token dossier: contract audit findings, top-10 holder distribution, liquidity depth across DEXs, and 7-day social sentiment score. Pass any EVM token address or symbol.',
        endpoint: '/x402/token-sentiment',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['token-audit', 'holder-analysis', 'liquidity-check'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'whale-alerts',
        name: 'Whale Movement Alerts',
        description: 'Track wallets moving >$100K for any EVM chain. Returns recent large transactions with counterparties, USD value, and direction (accumulation vs. distribution). Covers Base, Ethereum, Arbitrum, Polygon.',
        endpoint: '/x402/whale-alerts',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['whale-tracking', 'large-transactions', 'alerts'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'trending-tokens',
        name: 'Trending Tokens Scanner',
        description: 'Top trending tokens by volume momentum across Base, Ethereum, Arbitrum, and Polygon. Returns price change %, volume spike ratio, social velocity score, and DEX trade count in the last 1h/24h.',
        endpoint: '/x402/trending-tokens',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['trending', 'momentum', 'market-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'sentiment-analysis',
        name: 'Social Sentiment Analysis',
        description: 'Aggregate bullish sentiment score (0–100) for any token or topic. Sourced from Twitter/X mentions, Reddit posts, and on-chain activity signals. Returns score breakdown by channel with trend direction.',
        endpoint: '/x402/sentiment-analysis',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['sentiment', 'social-media', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'dex-liquidity',
        name: 'DEX Liquidity Analysis',
        description: 'Liquidity depth at ±2% and ±5% slippage bands across Uniswap v3, Curve, Balancer, and Aerodrome. Returns best execution venue, estimated price impact, and available liquidity in USD per pool.',
        endpoint: '/x402/dex-liquidity',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['liquidity', 'dex-routing', 'slippage-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'contract-scan',
        name: 'Smart Contract Security Audit',
        description: 'AI-powered Solidity audit flagging reentrancy, integer overflow, access control gaps, and known CVE patterns. Returns risk rating (Critical/High/Medium/Low) with line-level code findings.',
        endpoint: '/x402/contract-scan',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['security-audit', 'vulnerability-scan', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'portfolio-optimization',
        name: 'Portfolio Optimization',
        description: 'Modern Portfolio Theory rebalancing for any EVM wallet. Returns optimal target weights, projected Sharpe ratio improvement, and estimated rebalance cost. Pass { address } or { holdings: [{token, amount}] }.',
        endpoint: '/x402/portfolio-optimization',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['defi-yields', 'farm-optimization', 'apy-comparison'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'token-price',
        name: 'Token Price Oracle',
        description: 'Token price aggregated from Uniswap v3, CoinGecko, and direct DEX pool queries. Returns current price in USD, 24h change %, 24h volume, and market cap. Pass { symbol } or { address, chain? }.',
        endpoint: '/x402/token-price',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['pricing', 'dex-prices', 'exchange-rates'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'portfolio-tracker',
        name: 'Portfolio Tracker',
        description: 'Holdings and P&L for any EVM wallet across Base, Ethereum, Arbitrum, and Polygon. Returns current USD value, cost basis, unrealized gains/losses, and 30-day performance. Pass { address }.',
        endpoint: '/x402/portfolio-tracker',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['portfolio-analysis', 'holdings', 'performance'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'multi-chain-balance',
        name: 'Multi-Chain Balance',
        description: 'USDC, ETH, and top-token balances for any wallet across 7 EVM chains + Solana. Returns USD-denominated totals aggregated in one call. Pass { address } — no chain parameter needed.',
        endpoint: '/x402/multi-chain-balance',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['balances', 'multi-chain', 'wallet-info'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'arbitrage-scanner',
        name: 'Cross-Chain Arbitrage Scanner',
        description: 'Identify arbitrage opportunities across 7 blockchains',
        endpoint: '/x402/arbitrage-scanner',
        network: 'eip155:8453',
        category: 'trading-intelligence',
        capabilities: ['arbitrage', 'cross-chain', 'opportunity-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Execution & Infrastructure (4)
      {
        id: 'gas-price-oracle',
        name: 'Multi-Chain Gas Oracle',
        description: 'Real-time gas prices across all supported networks',
        endpoint: '/x402/gas-price-oracle',
        network: 'eip155:8453',
        category: 'execution',
        capabilities: ['gas-prices', 'multi-chain', 'fee-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'transaction-builder',
        name: 'Transaction Builder',
        description: 'Build and simulate transactions before execution',
        endpoint: '/x402/transaction-builder',
        network: 'eip155:8453',
        category: 'execution',
        capabilities: ['simulation', 'tx-building', 'gas-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'batch-quote',
        name: 'Batch Quote',
        description: 'Get quotes for multiple token swaps in a single call',
        endpoint: '/x402/batch-quote',
        network: 'eip155:8453',
        category: 'execution',
        capabilities: ['mev-protection', 'bundle-creation', 'flashbots'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'seamless-chain-bridge',
        name: 'Cross-Chain Bridge',
        description: 'Bridge quotes from Across, Stargate, and Hop for any EVM-to-EVM token transfer. Returns best route ranked by cost+speed, estimated output amount, bridge fee, and expected confirmation time.',
        endpoint: '/x402/seamless-chain-bridge',
        network: 'eip155:8453',
        category: 'execution',
        capabilities: ['bridging', 'cross-chain', 'route-optimization'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Premium Enterprise (3)
      {
        id: 'smart-contract-audit',
        name: 'Smart Contract Audit',
        description: 'Comprehensive Solidity security audit with severity-classified findings (Critical/High/Medium/Low). Checks reentrancy, access control, oracle manipulation, MEV exposure, and upgrade safety. Returns actionable findings report.',
        endpoint: '/x402/smart-contract-audit',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['security-audit', 'vulnerability-detection', 'best-practices'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'trading-signal',
        name: 'Trading Signal',
        description: 'Professional trading signal for any token: trend direction, RSI/MACD summary, key support/resistance levels, and risk/reward ratio. $0.10 USDC. Pass { symbol } or { address }.',
        endpoint: '/x402/trading-signal',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['signals', 'entry-exit', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'payment-processing',
        name: 'Payment Processing',
        description: 'Route any USDC or stablecoin payment across 7 EVM chains + Solana. Returns optimal network for lowest fees, estimated on-chain confirmation time, and payment receipt with txHash.',
        endpoint: '/x402/payment-processing',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['payments', 'settlement', 'multi-currency'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'verified-agent-identity',
        name: 'Verified Agent Identity (KYA)',
        description: 'Know-Your-Agent identity verification with on-chain reputation and ERC-8004 compliance scoring',
        endpoint: '/x402/verified-agent-identity',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['kya', 'identity-verification', 'erc-8004', 'reputation', 'compliance'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'compliance-consultation',
        name: 'Compliance Consultation',
        description: 'Expert compliance consultation for crypto operations and regulatory requirements',
        endpoint: '/x402/compliance-consultation',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['compliance', 'regulatory', 'consultation', 'aml', 'kyc'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'agent-create-wallet',
        name: 'Agent Wallet Provisioning',
        description: 'Create CDP-managed wallets for AI agents with instant USDC support on Base',
        endpoint: '/x402/agent-create-wallet',
        network: 'eip155:8453',
        category: 'execution',
        capabilities: ['wallet-creation', 'cdp-wallet', 'agent-provisioning', 'usdc-ready'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Real Estate (3)
      {
        id: 'property-valuation',
        name: 'AI Property Valuation',
        description: 'AI-powered real estate valuation with tokenization analysis',
        endpoint: '/x402/property-valuation',
        network: 'eip155:8453',
        category: 'real-estate',
        capabilities: ['property-value', 'tokenization', 'market-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'lease-analysis',
        name: 'Lease Analysis',
        description: 'AI-powered lease terms analysis and optimization',
        endpoint: '/x402/lease-analysis',
        network: 'eip155:8453',
        category: 'real-estate',
        capabilities: ['lease-review', 'term-analysis', 'optimization'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'construction-progress',
        name: 'Construction Progress Tracking',
        description: 'Track and verify construction project progress',
        endpoint: '/x402/construction-progress',
        network: 'eip155:8453',
        category: 'real-estate',
        capabilities: ['progress-tracking', 'milestone-verification', 'reporting'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Banking & Finance (3)
      {
        id: 'credit-risk-score',
        name: 'DeFi Credit Score',
        description: 'On-chain credit scoring for DeFi lending protocols',
        endpoint: '/x402/credit-risk-score',
        network: 'eip155:8453',
        category: 'banking',
        capabilities: ['credit-score', 'defi-lending', 'risk-assessment'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'compliance-check',
        name: 'AML/KYC Compliance Check',
        description: 'Wallet compliance screening for regulated entities',
        endpoint: '/x402/compliance-check',
        network: 'eip155:8453',
        category: 'banking',
        capabilities: ['aml-screening', 'kyc-check', 'sanctions-list'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'fraud-detection',
        name: 'Fraud Detection',
        description: 'AI-powered fraud and suspicious activity detection',
        endpoint: '/x402/fraud-detection',
        network: 'eip155:8453',
        category: 'banking',
        capabilities: ['fraud-detection', 'risk-assessment', 'anomaly-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Trading & Investment (3)
      {
        id: 'risk-metrics',
        name: 'Risk Metrics Dashboard',
        description: 'Comprehensive risk metrics and analytics',
        endpoint: '/x402/risk-metrics',
        network: 'eip155:8453',
        category: 'trading',
        capabilities: ['risk-metrics', 'analytics', 'dashboards'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'instant-agent-wallet',
        name: 'Instant Agent Wallet',
        description: 'Provision a CDP-managed EVM wallet for any AI agent in one call. Returns address, private-key shard (non-custodial), and USDC-ready status on Base. Idempotent — safe to call multiple times.',
        endpoint: '/x402/instant-agent-wallet',
        network: 'eip155:8453',
        category: 'trading',
        capabilities: ['wallet-creation', 'cdp-wallet', 'agent-onboarding'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'token-metadata',
        name: 'Token Metadata',
        description: 'Get comprehensive token metadata and information',
        endpoint: '/x402/token-metadata',
        network: 'eip155:8453',
        category: 'trading',
        capabilities: ['metadata', 'token-info', 'contract-details'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Market Intelligence (3)
      {
        id: 'correlation-matrix',
        name: 'Asset Correlation Matrix',
        description: 'Cross-asset correlation analysis for portfolio diversification',
        endpoint: '/x402/correlation-matrix',
        network: 'eip155:8453',
        category: 'market-intelligence',
        capabilities: ['correlation-analysis', 'diversification', 'risk-metrics'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'approval-manager',
        name: 'Token Approval Manager',
        description: 'Manage and revoke token approvals for security',
        endpoint: '/x402/approval-manager',
        network: 'eip155:8453',
        category: 'market-intelligence',
        capabilities: ['approvals', 'security', 'wallet-safety'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Prediction Markets (4)
      {
        id: 'polymarket-odds',
        name: 'Polymarket Odds',
        description: 'Get current odds from Polymarket prediction markets',
        endpoint: '/x402/polymarket-odds',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'odds', 'polymarket'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'polymarket-events',
        name: 'Polymarket Events',
        description: 'Get trending events from Polymarket',
        endpoint: '/x402/polymarket-events',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['events', 'trending', 'polymarket'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'polymarket-search',
        name: 'Polymarket Search',
        description: 'Search Polymarket prediction markets',
        endpoint: '/x402/polymarket-search',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['search', 'discovery', 'polymarket'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'prediction-market-odds',
        name: 'Prediction Market Odds',
        description: 'Get current odds and probability for any prediction market event',
        endpoint: '/x402/prediction-market-odds',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'odds', 'polymarket', 'probability'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Kalshi Prediction Markets (3) - CFTC-regulated
      {
        id: 'kalshi-markets',
        name: 'Kalshi Markets',
        description: 'Get active markets from Kalshi (CFTC-regulated prediction exchange)',
        endpoint: '/x402/kalshi-markets',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'kalshi', 'regulated', 'cftc'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'kalshi-odds',
        name: 'Kalshi Odds',
        description: 'Get current odds and orderbook for specific Kalshi markets',
        endpoint: '/x402/kalshi-odds',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['odds', 'orderbook', 'kalshi', 'regulated'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'kalshi-search',
        name: 'Kalshi Search',
        description: 'Search Kalshi prediction markets by keyword',
        endpoint: '/x402/kalshi-search',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['search', 'discovery', 'kalshi', 'regulated'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'prediction-market-spread',
        name: 'Prediction Market Cross-Platform Spread',
        description: 'Live cross-platform spread analysis: finds identical events on Polymarket and Kalshi simultaneously, computes YES probability divergence, and ranks arbitrage opportunities by spread magnitude',
        endpoint: '/x402/prediction-market-spread',
        network: 'eip155:8453',
        category: 'prediction-markets',
        capabilities: ['arbitrage', 'spread-analysis', 'polymarket', 'kalshi', 'cross-platform', 'featured'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Traditional Markets (2) - Stock & Forex Sentiment
      {
        id: 'stock-sentiment',
        name: 'Stock Sentiment Analysis',
        description: 'AI-powered stock market sentiment analysis with news, technicals, and institutional activity',
        endpoint: '/x402/stock-sentiment',
        network: 'eip155:8453',
        category: 'traditional-markets',
        capabilities: ['stock-analysis', 'equity-sentiment', 'market-intelligence', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'forex-sentiment',
        name: 'Forex Sentiment Analysis',
        description: 'AI-powered forex currency pair sentiment analysis with economic and central bank insights',
        endpoint: '/x402/forex-sentiment',
        network: 'eip155:8453',
        category: 'traditional-markets',
        capabilities: ['forex-analysis', 'currency-sentiment', 'economic-analysis', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Solana DeFi Services (Dialect Integration)
      {
        id: 'solana-yield-finder',
        name: 'Solana Yield Finder',
        description: 'Real-time Solana lending and yield rates from top DeFi protocols (Kamino, Jupiter Lend, Lulo, Marginfi). Get APY data, TVL, reward incentives, and deposit blinks. Powered by Dialect Markets API.',
        endpoint: '/x402/solana-yield-finder',
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        category: 'solana-defi',
        capabilities: ['yield-farming', 'lending-rates', 'apy-data', 'solana', 'defi', 'kamino', 'jupiter', 'lulo', 'marginfi'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // SDK Payment Services (2) - NEW
      {
        id: 'sdk-payments-evm',
        name: 'SDK Payment Processing (EVM)',
        description: 'Non-custodial USDC payment processing for AI agents via @coinrailz/agent-payments NPM or coinrailz PyPI. Processing fee: 1.5% + $0.01 per transaction. Supports Base, Ethereum, Polygon, Arbitrum, BSC, Optimism.',
        endpoint: '/api/sdk/payments/send',
        network: 'eip155:8453',
        category: 'sdk-payments',
        capabilities: ['payments', 'usdc-transfer', 'agent-payments', 'non-custodial', 'cdp-wallets', 'multi-chain'],
        x402Compatible: false,
        stripeCompatible: false
      },
      {
        id: 'sdk-payments-solana',
        name: 'SDK Payment Processing (Solana)',
        description: 'Non-custodial SOL/USDC payment processing for AI agents via @coinrailz/agent-payments-solana NPM or coinrailz-solana PyPI. Processing fee: 1.5% + $0.01 per transaction.',
        endpoint: '/api/sdk/solana/payments/send',
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        category: 'sdk-payments',
        capabilities: ['payments', 'sol-transfer', 'usdc-transfer', 'agent-payments', 'non-custodial', 'solana'],
        x402Compatible: false,
        stripeCompatible: false
      },
      // SATELLITE DATA SERVICES (NASA Earthdata + ESA Copernicus) - 6 services
      {
        id: 'fire-alerts',
        name: 'Fire Alert Detection',
        description: 'Real-time active fire and thermal anomaly detection from NASA FIRMS (MODIS + VIIRS satellites). Returns fire hotspot coordinates, FRP (fire radiative power in MW), confidence levels, and detection timestamp. Use cases: wildfire insurance risk scoring, evacuation routing, reinsurance event triggers, carbon credit verification.',
        endpoint: '/api/satellite/fire-alerts',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['fire-detection', 'nasa-firms', 'satellite-imagery', 'emergency-response', 'wildfire-risk', 'insurance'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'weather-imagery',
        name: 'Satellite Weather Imagery',
        description: 'Georeferenced weather satellite imagery tiles from NASA GIBS. Returns tiled image URLs for cloud cover, precipitation patterns, and atmospheric phenomena at up to 250m resolution. Use cases: logistics and shipping route planning, event and outdoor operations, agricultural field scouting, aviation weather briefing.',
        endpoint: '/api/satellite/weather-imagery',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['weather', 'nasa-gibs', 'satellite-imagery', 'precipitation', 'cloud-cover', 'logistics'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'vegetation',
        name: 'Vegetation Health Analysis',
        description: 'NDVI and vegetation health indices from NASA MODIS Terra/Aqua and ESA Sentinel-2 multispectral imagery. Tracks crop stress, drought impact, deforestation, and phenology at 10–500m resolution. Use cases: precision agriculture yield forecasting, carbon offset project verification, land degradation monitoring, growing-season anomaly detection.',
        endpoint: '/api/satellite/vegetation',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['ndvi', 'vegetation', 'agriculture', 'sentinel-2', 'modis', 'carbon-offset', 'drought'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'flood-detection',
        name: 'Flood Detection',
        description: 'SAR-based flood inundation extent mapping from ESA Sentinel-1 C-band radar. Penetrates cloud cover and works day/night — detects active flooding within 12–24h of event onset. Use cases: insurance damage assessment and claims triage, emergency response routing, infrastructure flood risk scoring, parametric flood reinsurance triggers.',
        endpoint: '/api/satellite/flood-detection',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['flood-detection', 'sar', 'sentinel-1', 'disaster-response', 'insurance', 'parametric', 'inundation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'air-quality',
        name: 'Air Quality Monitoring',
        description: 'Tropospheric pollutant column densities from ESA Sentinel-5P TROPOMI spectrometer. NO2, SO2, CO, CH4, aerosol index, and UV at 3.5–7km resolution, daily global coverage. Use cases: ESG and supply-chain environmental compliance, industrial emissions monitoring, public health exposure modeling, regulatory reporting and permitting support.',
        endpoint: '/api/satellite/air-quality',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['air-quality', 'pollution', 'tropomi', 'sentinel-5p', 'no2', 'co2', 'esg', 'emissions-monitoring'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'land-use',
        name: 'Land Use Classification',
        description: 'Multi-class land cover classification from NASA Landsat-8/9 and ESA Sentinel-2 at 10–30m resolution. Classifies urban, forest, cropland, wetland, water body, and bare soil. Use cases: real estate and development site screening, carbon sequestration and REDD+ accounting, municipal and infrastructure planning, agricultural land-change detection.',
        endpoint: '/api/satellite/land-use',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['land-use', 'classification', 'landsat', 'sentinel-2', 'urban-planning', 'carbon', 'redd', 'agriculture'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // NASA EARTHDATA INTELLIGENCE SERVICES - 5 services at $0.25/call
      // Authenticated NASA EOSDIS endpoints — OPeNDAP point queries + CMR granule search
      {
        id: 'earthdata-granules',
        slug: 'earthdata-granules',
        name: 'CMR Granule Search',
        description: 'Search 1B+ NASA satellite granules by bounding box, date range, platform, and cloud cover. Returns granule metadata and direct download URLs for Landsat, Sentinel, MODIS, VIIRS, and ASTER imagery.',
        endpoint: '/x402/earthdata-granules',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['granule-search', 'nasa-cmr', 'landsat', 'sentinel', 'modis', 'imagery-discovery'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'earthdata-precipitation',
        slug: 'earthdata-precipitation',
        name: 'GPM Precipitation Oracle',
        description: 'Real-time observed rain rate at any global coordinate. NASA GPM IMERG via OPeNDAP point query. 0.1° resolution, near-realtime (30min lag). Returns mm/hr precipitation.',
        endpoint: '/x402/earthdata-precipitation',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['precipitation', 'gpm-imerg', 'weather', 'rain-rate', 'flood-risk'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'earthdata-sst',
        slug: 'earthdata-sst',
        name: 'Maritime SST Oracle',
        description: 'Sea surface temperature at any ocean coordinate. NASA MUR-JPL-L4 product via OPeNDAP point query. 1km resolution, daily updates. Returns temperature in °C.',
        endpoint: '/x402/earthdata-sst',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['sea-surface-temperature', 'mur-sst', 'oceanography', 'maritime', 'climate'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'earthdata-soil-moisture',
        slug: 'earthdata-soil-moisture',
        name: 'SMAP Soil Moisture',
        description: 'Soil moisture granule discovery from NASA SMAP SPL3SMP. 36km EASE-Grid, daily composites. Returns granule metadata and direct download URL for volumetric water content data.',
        endpoint: '/x402/earthdata-soil-moisture',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['soil-moisture', 'smap', 'agriculture', 'drought-monitoring', 'hydrology'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'earthdata-ocean-color',
        slug: 'earthdata-ocean-color',
        name: 'Ocean Color (Chlorophyll)',
        description: 'MODIS Aqua ocean chlorophyll-a concentration via NASA CMR. 4km resolution, daily composites. Returns granule metadata and download URL for mg/m³ chlorophyll measurements.',
        endpoint: '/x402/earthdata-ocean-color',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['ocean-color', 'chlorophyll', 'modis-aqua', 'fisheries', 'algae-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'satellite-earthdata',
        slug: 'satellite-earthdata',
        name: 'NASA Earthdata Intelligence Gateway',
        description: 'Unified NASA Earthdata gateway. Single /x402/satellite-earthdata endpoint for all 5 products: precipitation (GPM IMERG), granule search, SST (MUR), soil moisture (SMAP), and ocean color (MODIS). Pass product= field to select. $0.25/call.',
        endpoint: '/x402/satellite-earthdata',
        network: 'eip155:8453',
        category: 'satellite-data',
        capabilities: ['precipitation', 'granules', 'sst', 'soil-moisture', 'ocean-color', 'nasa-earthdata', 'bundled'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // IoT/DePIN SERVICES - Device Data Monetization - 5 services
      {
        id: 'fleet-telematics',
        name: 'Fleet Telematics Data',
        description: 'Real-time fleet data: GPS location, fuel consumption, driver behavior, engine diagnostics. For logistics and fleet management.',
        endpoint: '/x402/fleet-telematics',
        network: 'eip155:8453',
        category: 'iot-depin',
        capabilities: ['fleet-management', 'gps-tracking', 'telematics', 'logistics', 'driver-behavior'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'weather-station-data',
        name: 'Weather Station Data',
        description: 'Hyperlocal weather data from IoT weather stations. Temperature, humidity, pressure, wind, precipitation readings.',
        endpoint: '/x402/weather-station-data',
        network: 'eip155:8453',
        category: 'iot-depin',
        capabilities: ['weather', 'iot-sensors', 'hyperlocal', 'meteorology'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'iot-sensor-reading',
        name: 'IoT Sensor Reading',
        description: 'Single sensor reading from registered IoT devices. Temperature, humidity, motion, air quality, or custom sensors.',
        endpoint: '/x402/iot-sensor-reading',
        network: 'eip155:8453',
        category: 'iot-depin',
        capabilities: ['iot-sensors', 'sensor-data', 'real-time', 'device-data'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'iot-device-stream',
        name: 'IoT Device Stream',
        description: 'Real-time data stream from IoT devices. Continuous sensor readings for monitoring and analytics. Per-minute pricing.',
        endpoint: '/x402/iot-device-stream',
        network: 'eip155:8453',
        category: 'iot-depin',
        capabilities: ['streaming', 'real-time', 'continuous-monitoring', 'iot-analytics'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'iot-bulk-data',
        name: 'IoT Bulk Data Export',
        description: 'Historical data export from IoT devices. Bulk download of sensor readings for analysis and machine learning.',
        endpoint: '/x402/iot-bulk-data',
        network: 'eip155:8453',
        category: 'iot-depin',
        capabilities: ['bulk-data', 'historical-data', 'data-export', 'ml-datasets'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // AI Inference Gateway
      {
        id: 'ai-inference',
        slug: 'ai-inference',
        name: 'AI Inference Gateway',
        description: 'Pay-per-call GPT-4o-mini inference via x402 micropayment. No API keys, no subscriptions, no rate limits. USDC on Base.',
        endpoint: '/x402/ai-inference',
        network: 'eip155:8453',
        category: 'ai-inference',
        capabilities: ['llm', 'text-generation', 'gpt-4o-mini', 'x402-native'],
        x402Compatible: true,
        stripeCompatible: false
      }
    ];

    // CRITICAL: Apply canonical pricing from shared/pricing.ts
    // This prevents price drift between SEO pages and x402 payment verification
    // SDK payment services use percentage-based pricing, handled by getCanonicalPrice fallback
    this.catalog = rawCatalog.map(entry => {
      const pricing = getCanonicalPrice(entry.id);
      return {
        ...entry,
        priceUSD: pricing.priceUSD,
        priceUSDC: pricing.priceUSDC
      };
    });

    console.log(`📚 ServiceCatalogService: Built catalog with ${this.catalog.length} services (prices derived from shared/pricing.ts)`);
  }

  /**
   * Get the full service catalog
   */
  getCatalog(): ServiceCatalog {
    return {
      version: '1.1.0',
      updated: new Date().toISOString(),
      baseUrl: BASE_URL,
      payTo: PAY_TO,
      services: this.catalog,
      categories: CATEGORY_ORDER,
      totalServices: this.catalog.length
    };
  }

  /**
   * Get services by category
   */
  getServicesByCategory(category: string): ServiceCatalogEntry[] {
    return this.catalog.filter(s => s.category === category);
  }

  /**
   * Get recommended services based on current service
   * Returns 3-5 related services for cross-sell in 402 responses
   */
  getRecommendedServices(currentServiceId: string): ServiceCatalogEntry[] {
    const currentService = this.catalog.find(s => s.id === currentServiceId);
    if (!currentService) {
      return this.catalog.slice(0, 5);
    }

    const recommendations: ServiceCatalogEntry[] = [];

    const sameCategory = this.catalog.filter(
      s => s.category === currentService.category && s.id !== currentServiceId
    );
    recommendations.push(...sameCategory.slice(0, 2));

    const relatedCategories: Record<string, string[]> = {
      'trading-intelligence': ['execution', 'trading', 'market-intelligence'],
      'execution': ['trading-intelligence', 'trading', 'sdk-payments'],
      'premium': ['trading-intelligence', 'execution'],
      'real-estate': ['banking', 'market-intelligence'],
      'banking': ['real-estate', 'trading-intelligence'],
      'trading': ['trading-intelligence', 'execution', 'market-intelligence'],
      'market-intelligence': ['trading-intelligence', 'trading', 'prediction-markets', 'traditional-markets'],
      'prediction-markets': ['market-intelligence', 'trading', 'traditional-markets'],
      'traditional-markets': ['market-intelligence', 'trading', 'prediction-markets'],
      'discovery': ['trading-intelligence', 'execution', 'sdk-payments'],
      'sdk-payments': ['execution', 'trading-intelligence', 'discovery']
    };

    const related = relatedCategories[currentService.category] || [];
    for (const cat of related) {
      const catServices = this.catalog.filter(
        s => s.category === cat && !recommendations.find(r => r.id === s.id)
      );
      if (catServices.length > 0 && recommendations.length < 5) {
        recommendations.push(catServices[0]);
      }
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Get a specific service by ID
   */
  getService(serviceId: string): ServiceCatalogEntry | undefined {
    return this.catalog.find(s => s.id === serviceId);
  }

  /**
   * Get catalog summary for 402 response enrichment
   */
  getCatalogSummary(): {
    catalogUrl: string;
    totalServices: number;
    categories: string[];
    priceRange: { min: string; max: string };
  } {
    // Filter out non-numeric prices (e.g., "Variable" for SDK services)
    const prices = this.catalog
      .map(s => parseFloat(s.priceUSD.replace('$', '')))
      .filter(p => !isNaN(p) && isFinite(p));
    
    // Fallback to $0.10-$10.00 if no valid prices (shouldn't happen)
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0.10;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 10.00;
    
    return {
      catalogUrl: `${BASE_URL}/x402/catalog`,
      totalServices: this.catalog.length,
      categories: CATEGORY_ORDER,
      priceRange: {
        min: `$${minPrice.toFixed(2)}`,
        max: `$${maxPrice.toFixed(2)}`
      }
    };
  }
}

export const serviceCatalogService = ServiceCatalogService.getInstance();
