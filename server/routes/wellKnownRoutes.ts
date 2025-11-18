/**
 * WELL-KNOWN ENDPOINTS - x402 Protocol Discovery
 * 
 * These endpoints enable autonomous discovery by AI agents and x402 indexers
 * Required for Coinbase x402 indexing and organic traffic
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Get base URL for the platform
const getBaseUrl = () => {
  return process.env.REPLIT_DEPLOYMENT === '1' 
    ? 'https://coinrailz.com' 
    : 'http://localhost:5000';
};

/**
 * GET /.well-known/agent-card.json
 * 
 * Main platform agent card - describes Coin Railz as a service provider
 * This is what x402scan and other indexers will discover
 */
router.get('/.well-known/agent-card.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl();
  
  const agentCard = {
    name: "Coin Railz",
    description: "Multi-Chain Payment Infrastructure for Crypto Communities. DEX aggregator with fiat off-ramps across 7 blockchains.",
    version: "2.0.0",
    
    capabilities: [
      "smart_contract_scanning",
      "whale_tracking",
      "trade_signals",
      "contract_auditing",
      "gas_price_oracle",
      "token_analytics",
      "dex_aggregation",
      "liquidity_scanning",
      "nft_floor_tracking",
      "portfolio_analytics",
      "risk_assessment",
      "bridge_monitoring",
      "staking_calculator",
      "defi_scanning",
      "holder_analytics",
      "transaction_pattern_detection",
      "market_sentiment",
      "agent_identity_verification"
    ],
    
    pricing: {
      model: "per_service",
      base_rate: 0.25,
      currency: "USD",
      minimum_transaction: 0.10,
      services_url: `${baseUrl}/.well-known/pricing.json`
    },
    
    payment: {
      methods: ["x402", "stripe", "usdc", "usdt"],
      wallet_address: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      supported_currencies: ["USDC", "USDT", "ETH", "DAI"],
      payment_networks: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
      stablecoins: ["USDC", "USDT", "DAI"],
      payment_methods_url: `${baseUrl}/.well-known/payment-methods.json`
    },
    
    endpoints: {
      service_manifest: `${baseUrl}/.well-known/service-manifest.json`,
      pricing: `${baseUrl}/.well-known/pricing.json`,
      payment_methods: `${baseUrl}/.well-known/payment-methods.json`,
      marketplace: `${baseUrl}/marketplace`,
      api_docs: `${baseUrl}/x402`,
      health_check: `${baseUrl}/api/health`
    },
    
    platform: {
      name: "Coin Railz",
      url: baseUrl,
      type: "payment_infrastructure",
      chains_supported: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      total_services: 18
    },
    
    protocol_info: {
      a2a_version: "2.0.0",
      payment_protocol: "x402",
      discovery_enabled: true,
      x402_compliant: true
    }
  };
  
  res.status(200).json(agentCard);
});

/**
 * GET /.well-known/service-manifest.json
 * 
 * Complete list of all x402 services offered by Coin Railz
 */
router.get('/.well-known/service-manifest.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl();
  
  const manifest = {
    platform: "Coin Railz",
    version: "2.0.0",
    total_services: 18,
    services: [
      {
        id: "contract-scanner",
        name: "Smart Contract Scanner",
        description: "Deep analysis of smart contract code, security vulnerabilities, and on-chain behavior",
        endpoint: `${baseUrl}/x402/contract-scanner`,
        price_usd: 0.50,
        category: "security"
      },
      {
        id: "whale-tracker",
        name: "Whale Tracker & Alerts",
        description: "Real-time monitoring of large wallet movements and whale activity",
        endpoint: `${baseUrl}/x402/whale-tracker`,
        price_usd: 0.30,
        category: "analytics"
      },
      {
        id: "trade-signals",
        name: "Trade Signal Generator",
        description: "AI-powered trading signals based on technical analysis and on-chain data",
        endpoint: `${baseUrl}/x402/trade-signals`,
        price_usd: 0.20,
        category: "trading"
      },
      {
        id: "contract-audit",
        name: "Smart Contract Audit",
        description: "Comprehensive security audit with vulnerability detection",
        endpoint: `${baseUrl}/x402/contract-audit`,
        price_usd: 1.00,
        category: "security"
      },
      {
        id: "gas-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas price predictions across multiple chains",
        endpoint: `${baseUrl}/x402/gas-oracle`,
        price_usd: 0.10,
        category: "utilities"
      },
      {
        id: "token-analytics",
        name: "Token Analytics",
        description: "Deep dive into token metrics, holder distribution, and price action",
        endpoint: `${baseUrl}/x402/token-analytics`,
        price_usd: 0.40,
        category: "analytics"
      },
      {
        id: "dex-aggregator",
        name: "DEX Price Aggregator",
        description: "Best price discovery across all major DEXs",
        endpoint: `${baseUrl}/x402/dex-aggregator`,
        price_usd: 0.25,
        category: "trading"
      },
      {
        id: "liquidity-scanner",
        name: "Liquidity Pool Scanner",
        description: "Analyze liquidity pools, APYs, and impermanent loss risk",
        endpoint: `${baseUrl}/x402/liquidity-scanner`,
        price_usd: 0.35,
        category: "defi"
      },
      {
        id: "nft-floor-tracker",
        name: "NFT Floor Price Tracker",
        description: "Real-time NFT floor prices and collection analytics",
        endpoint: `${baseUrl}/x402/nft-floor-tracker`,
        price_usd: 0.15,
        category: "nft"
      },
      {
        id: "portfolio-analytics",
        name: "Wallet Portfolio Analytics",
        description: "Complete portfolio breakdown with P&L and allocation insights",
        endpoint: `${baseUrl}/x402/portfolio-analytics`,
        price_usd: 0.50,
        category: "analytics"
      },
      {
        id: "on-chain-query",
        name: "On-chain Data Query",
        description: "Query blockchain data with natural language",
        endpoint: `${baseUrl}/x402/on-chain-query`,
        price_usd: 0.20,
        category: "utilities"
      },
      {
        id: "risk-assessment",
        name: "Risk Assessment Engine",
        description: "Evaluate smart contract and protocol risk levels",
        endpoint: `${baseUrl}/x402/risk-assessment`,
        price_usd: 0.75,
        category: "security"
      },
      {
        id: "bridge-monitor",
        name: "Cross-chain Bridge Monitor",
        description: "Track bridge transactions and security status",
        endpoint: `${baseUrl}/x402/bridge-monitor`,
        price_usd: 0.30,
        category: "utilities"
      },
      {
        id: "staking-calculator",
        name: "Staking Rewards Calculator",
        description: "Calculate staking yields across protocols",
        endpoint: `${baseUrl}/x402/staking-calculator`,
        price_usd: 0.15,
        category: "defi"
      },
      {
        id: "defi-scanner",
        name: "DeFi Protocol Scanner",
        description: "Analyze DeFi protocols for yields and risks",
        endpoint: `${baseUrl}/x402/defi-scanner`,
        price_usd: 0.40,
        category: "defi"
      },
      {
        id: "holder-analytics",
        name: "Token Holder Analytics",
        description: "Analyze token holder behavior and distribution",
        endpoint: `${baseUrl}/x402/holder-analytics`,
        price_usd: 0.35,
        category: "analytics"
      },
      {
        id: "pattern-detector",
        name: "Transaction Pattern Detector",
        description: "Detect suspicious transaction patterns and wash trading",
        endpoint: `${baseUrl}/x402/pattern-detector`,
        price_usd: 0.45,
        category: "security"
      },
      {
        id: "sentiment-analyzer",
        name: "Market Sentiment Analyzer",
        description: "AI-powered sentiment analysis from social media and on-chain data",
        endpoint: `${baseUrl}/x402/sentiment-analyzer`,
        price_usd: 0.30,
        category: "analytics"
      }
    ]
  };
  
  res.status(200).json(manifest);
});

/**
 * GET /.well-known/payment-methods.json
 * 
 * Detailed payment methods and wallet information
 */
router.get('/.well-known/payment-methods.json', async (req: Request, res: Response) => {
  const paymentMethods = {
    platform: "Coin Railz",
    version: "2.0.0",
    
    crypto: {
      enabled: true,
      wallet_address: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      
      networks: [
        {
          chain: "base",
          chain_id: 8453,
          tokens: ["USDC", "USDT", "ETH", "DAI"],
          preferred: true
        },
        {
          chain: "ethereum",
          chain_id: 1,
          tokens: ["USDC", "USDT", "ETH", "DAI", "WBTC"]
        },
        {
          chain: "polygon",
          chain_id: 137,
          tokens: ["USDC", "USDT", "MATIC", "DAI"]
        },
        {
          chain: "arbitrum",
          chain_id: 42161,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        },
        {
          chain: "optimism",
          chain_id: 10,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        }
      ],
      
      stablecoins: ["USDC", "USDT", "DAI"],
      preferred_token: "USDC"
    },
    
    x402: {
      enabled: true,
      protocol_version: "1.0.0",
      facilitator: "coinbase_cdp",
      settlement_network: "base",
      minimum_payment: 0.10
    },
    
    fiat: {
      stripe: {
        enabled: true,
        methods: ["card", "bank_transfer"],
        currencies: ["USD"]
      },
      prepaid_credits: {
        enabled: true,
        minimum_purchase: 10.00,
        bonus_tiers: []
      }
    }
  };
  
  res.status(200).json(paymentMethods);
});

/**
 * GET /.well-known/pricing.json
 * 
 * Detailed pricing information for all services
 */
router.get('/.well-known/pricing.json', async (req: Request, res: Response) => {
  const pricing = {
    platform: "Coin Railz",
    version: "2.0.0",
    currency: "USD",
    
    subscription_plans: [
      {
        id: "ai_agent_bundle_launch",
        name: "AI Agent Pro Bundle - Launch Price",
        price_monthly: 49.00,
        description: "All 18 x402 services included. Launch price locked in forever.",
        features: [
          "Unlimited contract scans",
          "Real-time whale alerts",
          "Trade signal generation",
          "Smart contract auditing",
          "All 18 AI services",
          "API access",
          "Priority support"
        ],
        available: true
      },
      {
        id: "ai_agent_bundle",
        name: "AI Agent Pro Bundle",
        price_monthly: 99.00,
        description: "All 18 x402 services included",
        features: [
          "Unlimited contract scans",
          "Real-time whale alerts",
          "Trade signal generation",
          "Smart contract auditing",
          "All 18 AI services",
          "API access",
          "Priority support"
        ],
        available: true
      }
    ],
    
    pay_per_use: [
      { service: "Smart Contract Scanner", price: 0.50 },
      { service: "Whale Tracker & Alerts", price: 0.30 },
      { service: "Trade Signal Generator", price: 0.20 },
      { service: "Smart Contract Audit", price: 1.00 },
      { service: "Gas Price Oracle", price: 0.10 },
      { service: "Token Analytics", price: 0.40 },
      { service: "DEX Price Aggregator", price: 0.25 },
      { service: "Liquidity Pool Scanner", price: 0.35 },
      { service: "NFT Floor Price Tracker", price: 0.15 },
      { service: "Wallet Portfolio Analytics", price: 0.50 },
      { service: "On-chain Data Query", price: 0.20 },
      { service: "Risk Assessment Engine", price: 0.75 },
      { service: "Cross-chain Bridge Monitor", price: 0.30 },
      { service: "Staking Rewards Calculator", price: 0.15 },
      { service: "DeFi Protocol Scanner", price: 0.40 },
      { service: "Token Holder Analytics", price: 0.35 },
      { service: "Transaction Pattern Detector", price: 0.45 },
      { service: "Market Sentiment Analyzer", price: 0.30 }
    ],
    
    platform_fees: {
      dex_swap: 0.75,
      p2p_routing: 1.00,
      description: "DEX aggregator: 0.75% per swap. P2P routing: 1% per transaction"
    }
  };
  
  res.status(200).json(pricing);
});

export default router;
