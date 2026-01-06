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
  'sdk-payments'
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
    const rawCatalog: Omit<ServiceCatalogEntry, 'priceUSD' | 'priceUSDC'>[] = [
      // Discovery & Testing (1)
      // NOTE: Endpoints use /x402/{service} format (not /x402/service/{service})
      {
        id: 'ping',
        name: 'x402 Discovery Ping',
        description: 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
        endpoint: '/x402/ping',
        network: 'eip155:8453',
        category: 'discovery',
        capabilities: ['ping', 'health-check', 'x402-test'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Trading Intelligence (14)
      {
        id: 'trade-signals',
        name: 'AI Trade Signals',
        description: 'Real-time AI-powered trading signals with entry/exit points',
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
        description: 'Comprehensive risk scoring for any blockchain wallet',
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
        description: 'Full token fundamentals, security analysis, and holder distribution',
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
        description: 'Real-time whale transaction monitoring and alerts',
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
        description: 'Track trending tokens and market momentum across chains',
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
        description: 'AI-powered sentiment analysis from Twitter, Reddit, Discord',
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
        description: 'Cross-DEX liquidity depth and best execution routing',
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
        description: 'AI-powered smart contract vulnerability detection',
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
        description: 'AI-powered portfolio rebalancing and yield optimization',
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
        description: 'Real-time token pricing across DEXs and exchanges',
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
        description: 'Track portfolio performance and holdings across chains',
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
        description: 'Get wallet balances across all supported chains',
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
        description: 'Seamless cross-chain token bridging',
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
        description: 'Comprehensive smart contract security audit',
        endpoint: '/x402/service/smart-contract-audit',
        network: 'eip155:8453',
        category: 'premium',
        capabilities: ['security-audit', 'vulnerability-detection', 'best-practices'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'trading-signal',
        name: 'Trading Signal',
        description: 'AI-powered trading signals with entry/exit points',
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
        description: 'Cross-chain payment processing and settlement',
        endpoint: '/x402/service/payment-processing',
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
        description: 'Create CDP wallet for AI agents instantly',
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
        network: 'solana:101',
        category: 'sdk-payments',
        capabilities: ['payments', 'sol-transfer', 'usdc-transfer', 'agent-payments', 'non-custodial', 'solana'],
        x402Compatible: false,
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
    const prices = this.catalog.map(s => parseFloat(s.priceUSD.replace('$', '')));
    return {
      catalogUrl: `${BASE_URL}/x402/catalog`,
      totalServices: this.catalog.length,
      categories: CATEGORY_ORDER,
      priceRange: {
        min: `$${Math.min(...prices).toFixed(2)}`,
        max: `$${Math.max(...prices).toFixed(2)}`
      }
    };
  }
}

export const serviceCatalogService = ServiceCatalogService.getInstance();
