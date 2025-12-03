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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
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
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['risk-assessment', 'wallet-analysis', 'fraud-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'token-analysis',
        name: 'Deep Token Analysis',
        description: 'Full token fundamentals, security analysis, and holder distribution',
        endpoint: '/x402/token-analysis',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['whale-tracking', 'large-transactions', 'alerts'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'mempool-scanner',
        name: 'Mempool Transaction Scanner',
        description: 'Monitor pending transactions for arbitrage and MEV opportunities',
        endpoint: '/x402/mempool-scanner',
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['mempool', 'pending-txs', 'mev-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'social-sentiment',
        name: 'Social Sentiment Analysis',
        description: 'AI-powered sentiment analysis from Twitter, Reddit, Discord',
        endpoint: '/x402/social-sentiment',
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
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['liquidity', 'dex-routing', 'slippage-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'contract-audit',
        name: 'Smart Contract Security Audit',
        description: 'AI-powered smart contract vulnerability detection',
        endpoint: '/x402/contract-audit',
        priceUSD: '$5.00',
        priceUSDC: '5.00 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['security-audit', 'vulnerability-scan', 'ai-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'yield-optimizer',
        name: 'DeFi Yield Optimizer',
        description: 'Find best yield farming opportunities across protocols',
        endpoint: '/x402/yield-optimizer',
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['defi-yields', 'farm-optimization', 'apy-comparison'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'nft-valuation',
        name: 'NFT Valuation Engine',
        description: 'AI-powered NFT pricing and rarity analysis',
        endpoint: '/x402/nft-valuation',
        priceUSD: '$0.75',
        priceUSDC: '0.75 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['nft-pricing', 'rarity-score', 'collection-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'portfolio-optimizer',
        name: 'Portfolio Optimization',
        description: 'AI-powered portfolio rebalancing recommendations',
        endpoint: '/x402/portfolio-optimizer',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['portfolio-analysis', 'rebalancing', 'risk-management'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'market-depth',
        name: 'Market Depth Analysis',
        description: 'Order book analysis and support/resistance levels',
        endpoint: '/x402/market-depth',
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['order-book', 'support-resistance', 'market-structure'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'cross-chain-arb',
        name: 'Cross-Chain Arbitrage Scanner',
        description: 'Identify arbitrage opportunities across 7 blockchains',
        endpoint: '/x402/cross-chain-arb',
        priceUSD: '$1.50',
        priceUSDC: '1.50 USDC',
        network: 'base',
        category: 'trading-intelligence',
        capabilities: ['arbitrage', 'cross-chain', 'opportunity-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Execution & Infrastructure (4)
      {
        id: 'gas-oracle',
        name: 'Multi-Chain Gas Oracle',
        description: 'Real-time gas prices across all supported networks',
        endpoint: '/x402/gas-oracle',
        priceUSD: '$0.10',
        priceUSDC: '0.10 USDC',
        network: 'base',
        category: 'execution',
        capabilities: ['gas-prices', 'multi-chain', 'fee-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'tx-simulator',
        name: 'Transaction Simulator',
        description: 'Simulate transactions before execution to catch errors',
        endpoint: '/x402/tx-simulator',
        priceUSD: '$0.25',
        priceUSDC: '0.25 USDC',
        network: 'base',
        category: 'execution',
        capabilities: ['simulation', 'error-detection', 'gas-estimation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'bundle-builder',
        name: 'MEV Bundle Builder',
        description: 'Create protected transaction bundles for MEV protection',
        endpoint: '/x402/bundle-builder',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
        category: 'execution',
        capabilities: ['mev-protection', 'bundle-creation', 'flashbots'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'bridge-router',
        name: 'Cross-Chain Bridge Router',
        description: 'Find optimal bridge routes across chains',
        endpoint: '/x402/bridge-router',
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'execution',
        capabilities: ['bridging', 'cross-chain', 'route-optimization'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Premium Enterprise (3)
      {
        id: 'institutional-api',
        name: 'Institutional Trading API',
        description: 'High-frequency trading API with dedicated infrastructure',
        endpoint: '/x402/institutional-api',
        priceUSD: '$100.00',
        priceUSDC: '100.00 USDC',
        network: 'base',
        category: 'premium',
        capabilities: ['hft', 'dedicated-infra', 'low-latency'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'custom-strategy',
        name: 'Custom Strategy Builder',
        description: 'AI-assisted trading strategy development',
        endpoint: '/x402/custom-strategy',
        priceUSD: '$50.00',
        priceUSDC: '50.00 USDC',
        network: 'base',
        category: 'premium',
        capabilities: ['strategy-builder', 'backtesting', 'ai-optimization'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'white-label',
        name: 'White Label Integration',
        description: 'Full white-label x402 payment infrastructure',
        endpoint: '/x402/white-label',
        priceUSD: '$500.00',
        priceUSDC: '500.00 USDC',
        network: 'base',
        category: 'premium',
        capabilities: ['white-label', 'full-integration', 'custom-branding'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Real Estate (3)
      {
        id: 'property-valuation',
        name: 'AI Property Valuation',
        description: 'AI-powered real estate valuation with tokenization analysis',
        endpoint: '/x402/property-valuation',
        priceUSD: '$10.00',
        priceUSDC: '10.00 USDC',
        network: 'base',
        category: 'real-estate',
        capabilities: ['property-value', 'tokenization', 'market-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'rent-optimizer',
        name: 'Rental Income Optimizer',
        description: 'Optimize rental pricing and occupancy rates',
        endpoint: '/x402/rent-optimizer',
        priceUSD: '$5.00',
        priceUSDC: '5.00 USDC',
        network: 'base',
        category: 'real-estate',
        capabilities: ['rental-analysis', 'pricing-optimization', 'yield-projection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'market-trends',
        name: 'Real Estate Market Trends',
        description: 'AI analysis of real estate market trends by location',
        endpoint: '/x402/market-trends',
        priceUSD: '$3.00',
        priceUSDC: '3.00 USDC',
        network: 'base',
        category: 'real-estate',
        capabilities: ['market-trends', 'location-analysis', 'price-forecasting'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Banking & Finance (3)
      {
        id: 'credit-score',
        name: 'DeFi Credit Score',
        description: 'On-chain credit scoring for DeFi lending protocols',
        endpoint: '/x402/credit-score',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
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
        priceUSD: '$5.00',
        priceUSDC: '5.00 USDC',
        network: 'base',
        category: 'banking',
        capabilities: ['aml-screening', 'kyc-check', 'sanctions-list'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'treasury-analytics',
        name: 'Treasury Analytics',
        description: 'DAO treasury analysis and optimization recommendations',
        endpoint: '/x402/treasury-analytics',
        priceUSD: '$10.00',
        priceUSDC: '10.00 USDC',
        network: 'base',
        category: 'banking',
        capabilities: ['treasury-analysis', 'dao-optimization', 'fund-allocation'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Trading & Investment (3)
      {
        id: 'alpha-signals',
        name: 'Alpha Signal Generator',
        description: 'Proprietary alpha signals from on-chain data',
        endpoint: '/x402/alpha-signals',
        priceUSD: '$5.00',
        priceUSDC: '5.00 USDC',
        network: 'base',
        category: 'trading',
        capabilities: ['alpha-generation', 'on-chain-analysis', 'signal-quality'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'copy-trading',
        name: 'Copy Trading Analyzer',
        description: 'Identify and analyze top performing wallets to copy',
        endpoint: '/x402/copy-trading',
        priceUSD: '$3.00',
        priceUSDC: '3.00 USDC',
        network: 'base',
        category: 'trading',
        capabilities: ['copy-trading', 'wallet-tracking', 'performance-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'entry-exit',
        name: 'Entry/Exit Optimizer',
        description: 'AI-powered optimal entry and exit point detection',
        endpoint: '/x402/entry-exit',
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
        category: 'trading',
        capabilities: ['entry-points', 'exit-timing', 'profit-optimization'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Market Intelligence (3)
      {
        id: 'news-sentiment',
        name: 'Crypto News Sentiment',
        description: 'Real-time news sentiment analysis for crypto assets',
        endpoint: '/x402/news-sentiment',
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'market-intelligence',
        capabilities: ['news-analysis', 'sentiment-scoring', 'event-detection'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'on-chain-metrics',
        name: 'On-Chain Metrics Dashboard',
        description: 'Comprehensive on-chain metrics for any token',
        endpoint: '/x402/on-chain-metrics',
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
        category: 'market-intelligence',
        capabilities: ['on-chain-data', 'metrics-dashboard', 'holder-analysis'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'correlation-matrix',
        name: 'Asset Correlation Matrix',
        description: 'Cross-asset correlation analysis for portfolio diversification',
        endpoint: '/x402/correlation-matrix',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
        category: 'market-intelligence',
        capabilities: ['correlation-analysis', 'diversification', 'risk-metrics'],
        x402Compatible: true,
        stripeCompatible: true
      },
      // Prediction Markets (3)
      {
        id: 'market-odds',
        name: 'Prediction Market Odds',
        description: 'Aggregated odds from major prediction markets',
        endpoint: '/x402/market-odds',
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'odds-aggregation', 'polymarket'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'event-probability',
        name: 'Event Probability Calculator',
        description: 'AI-calculated probabilities for crypto events',
        endpoint: '/x402/event-probability',
        priceUSD: '$1.00',
        priceUSDC: '1.00 USDC',
        network: 'base',
        category: 'prediction-markets',
        capabilities: ['probability-calculation', 'event-forecasting', 'ai-prediction'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'arb-finder',
        name: 'Prediction Market Arbitrage',
        description: 'Find arbitrage opportunities across prediction platforms',
        endpoint: '/x402/arb-finder',
        priceUSD: '$2.00',
        priceUSDC: '2.00 USDC',
        network: 'base',
        category: 'prediction-markets',
        capabilities: ['arbitrage', 'cross-platform', 'profit-opportunities'],
        x402Compatible: true,
        stripeCompatible: true
      },
      {
        id: 'prediction-market-odds',
        name: 'Prediction Market Odds Lookup',
        description: 'Get current odds and probability for any prediction market event including Polymarket',
        endpoint: '/x402/prediction-market-odds',
        priceUSD: '$0.50',
        priceUSDC: '0.50 USDC',
        network: 'base',
        category: 'prediction-markets',
        capabilities: ['prediction-markets', 'odds-lookup', 'polymarket', 'probability'],
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
