import { UNIFIED_PRICING } from '../../shared/pricing';

/**
 * SERVICE CATALOG SERVICE
 * 
 * Provides a structured catalog of x402 services for discovery by AI agents.
 * Used in:
 * 1. /x402/catalog endpoint for browsing all services
 * 2. 402 response enrichment with recommendedServices
 * 3. Agent discovery to understand our capabilities
 */

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
  'prediction-markets'
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
    this.catalog = [
      // Discovery & Testing (1)
      // NOTE: Endpoints use /x402/{service} format (not /x402/service/{service})
      {
        id: 'ping',
        name: 'x402 Discovery Ping',
        description: 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
        endpoint: '/x402/ping',
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
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
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
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
        priceUSD: '$0.35',
        priceUSDC: '0.35 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$0.20',
        priceUSDC: '0.20 USDC',
        network: 'base',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
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
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
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
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$1.25',
        priceUSDC: '1.25 USDC',
        network: 'base',
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
        priceUSD: '$0.10',
        priceUSDC: '0.10 USDC',
        network: 'base',
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
        priceUSD: '$0.30',
        priceUSDC: '0.30 USDC',
        network: 'base',
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
        priceUSD: '$0.40',
        priceUSDC: '0.40 USDC',
        network: 'base',
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
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
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
        priceUSD: '$10.00',
        priceUSDC: '10.00 USDC',
        network: 'base',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'premium',
        capabilities: ['payments', 'settlement', 'multi-currency'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Real Estate (3)
      {
        id: 'property-valuation',
        name: 'AI Property Valuation',
        description: 'AI-powered real estate valuation with tokenization analysis',
        endpoint: '/x402/property-valuation',
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
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
        priceUSD: '$1.50',
        priceUSDC: '1.50 USDC',
        network: 'base',
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
        priceUSD: '$1.25',
        priceUSDC: '1.25 USDC',
        network: 'base',
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
        priceUSD: '$1.75',
        priceUSDC: '1.75 USDC',
        network: 'base',
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
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
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
        priceUSD: '$0.10',
        priceUSDC: '0.10 USDC',
        network: 'base',
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
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
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
        priceUSD: '$0.20',
        priceUSDC: '0.20 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
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
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
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
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'odds', 'polymarket', 'probability'],
        x402Compatible: true,
        stripeCompatible: true
      }
    ];

    console.log(`📚 ServiceCatalogService: Built catalog with ${this.catalog.length} services`);
  }

  /**
   * Get the full service catalog
   */
  getCatalog(): ServiceCatalog {
    return {
      version: '1.0.0',
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
      'execution': ['trading-intelligence', 'trading'],
      'premium': ['trading-intelligence', 'execution'],
      'real-estate': ['banking', 'market-intelligence'],
      'banking': ['real-estate', 'trading-intelligence'],
      'trading': ['trading-intelligence', 'execution', 'market-intelligence'],
      'market-intelligence': ['trading-intelligence', 'trading', 'prediction-markets'],
      'prediction-markets': ['market-intelligence', 'trading'],
      'discovery': ['trading-intelligence', 'execution']
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
