/**
 * WELL-KNOWN ENDPOINTS - x402 Protocol Discovery
 * 
 * These endpoints enable autonomous discovery by AI agents and x402 indexers
 * Required for Coinbase x402 indexing and organic traffic
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Get base URL for the platform
const getBaseUrl = (req?: any) => {
  // Use PUBLIC_BASE_URL if set (preferred)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  
  // Use request hostname if available (production)
  if (req && req.get('host')) {
    const host = req.get('host');
    const protocol = req.protocol || 'https';
    // Only use http for localhost/127.0.0.1, otherwise use https
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}`;
    }
    return `${protocol}://${host}`;
  }
  
  // Fallback based on deployment flag
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  
  return 'http://localhost:5000';
};

/**
 * GET /.well-known/agent-card.json
 * 
 * Main platform agent card - describes Coin Railz as a service provider
 * Discoverable by ChatGPT, Google AI, x402scan, and other A2A platforms
 */
router.get('/.well-known/agent-card.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const agentCard = {
    name: "Coin Railz x402 Payment Infrastructure",
    description: "Multi-Chain Payment Infrastructure for Crypto Communities. 18 x402 micropayment services: DEX aggregator, trading signals, wallet risk analysis, security audits, and blockchain intelligence. Pay per request with USDC on Base.",
    version: "2.0.0",
    
    // ChatGPT & Google AI Discovery
    integration_guides: {
      chatgpt: `${baseUrl}/developers#integration-guides`,
      google_ai: `${baseUrl}/developers`,
      eliza_os: `${baseUrl}/developers#integration-guides`,
      generic_agents: `${baseUrl}/developers#quickstart`
    },
    
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
      price_range: "$0.10 - $5.00 per request",
      base_rate: 0.25,
      currency: "USD",
      minimum_transaction: 0.10,
      services_url: `${baseUrl}/.well-known/pricing.json`,
      no_registration: true,
      no_api_keys: true,
      pay_per_request: true
    },
    
    payment: {
      methods: ["x402", "stripe", "usdc", "usdt"],
      wallet_address: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      supported_currencies: ["USDC", "USDT", "ETH", "DAI"],
      payment_networks: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
      stablecoins: ["USDC", "USDT", "DAI"],
      payment_methods_url: `${baseUrl}/.well-known/payment-methods.json`,
      x402_compliant: true,
      instant_settlement: true,
      base_finality_seconds: 12
    },
    
    endpoints: {
      openapi_schema: `${baseUrl}/.well-known/openapi.json`,
      service_manifest: `${baseUrl}/.well-known/service-manifest.json`,
      pricing: `${baseUrl}/.well-known/pricing.json`,
      payment_methods: `${baseUrl}/.well-known/payment-methods.json`,
      marketplace: `${baseUrl}/marketplace`,
      api_docs: `${baseUrl}/developers`,
      x402_docs: `${baseUrl}/x402`,
      health_check: `${baseUrl}/api/health`,
      agent_directory: `${baseUrl}/api/agents/directory`
    },
    
    platform: {
      name: "Coin Railz",
      url: baseUrl,
      type: "payment_infrastructure",
      chains_supported: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      total_services: 18,
      positioning: "Multi-Chain Payment Infrastructure for Crypto Communities"
    },
    
    protocol_info: {
      a2a_version: "2.0.0",
      payment_protocol: "x402",
      discovery_enabled: true,
      x402_compliant: true,
      chatgpt_compatible: true,
      google_ai_compatible: true
    },
    
    quickstart: {
      title: "Start in 3 steps",
      steps: [
        "Send USDC payment on Base mainnet to platform wallet",
        "Wait ~12 seconds for Base finality",
        "Call API with txHash in X-PAYMENT header"
      ],
      documentation_url: `${baseUrl}/developers#quickstart`,
      code_examples: `${baseUrl}/developers#integration-guides`
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
  const baseUrl = getBaseUrl(req);
  
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
 * GET /.well-known/x402.json
 * 
 * x402 protocol discovery endpoint for Coinbase Bazaar and other x402 indexers
 * Lists all available x402 micropayment services with correct endpoint paths
 */
router.get('/.well-known/x402.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const x402Manifest = {
    name: "Coin Railz",
    homepage: "https://coinrailz.com",
    contact: "support@coinrailz.com",
    description: "AI agent marketplace with x402 autonomous payment endpoints, A2A 2.0 discovery, and multi-chain support across 7 EVM networks.",
    version: "x402-2.0",
    endpoints: [
      // Trader-Focused Services (10 services)
      {
        path: "/x402/multi-chain-balance",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Query wallet balances across 7+ EVM chains in a single API call",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to check" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
            includeTokens: { type: "boolean", description: "Include token balances (optional)" }
          },
          required: ["walletAddress"]
        }
      },
      {
        path: "/x402/gas-price-oracle",
        methods: ["POST"],
        price_usd: 0.10,
        auth: "x402",
        description: "Real-time gas prices for multiple chains with USD cost estimates",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
          }
        }
      },
      {
        path: "/x402/token-price",
        methods: ["POST"],
        price_usd: 0.25,
        auth: "x402",
        description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      {
        path: "/x402/contract-scan",
        methods: ["POST"],
        price_usd: 1.0,
        auth: "x402",
        description: "Basic smart contract security scan with safety score and vulnerability checks",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["contractAddress", "chain"]
        }
      },
      {
        path: "/x402/wallet-risk",
        methods: ["POST"],
        price_usd: 0.5,
        auth: "x402",
        description: "Wallet risk analysis with compliance flags and transaction pattern detection",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to analyze" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["walletAddress", "chain"]
        }
      },
      {
        path: "/x402/trade-signals",
        methods: ["POST"],
        price_usd: 0.75,
        auth: "x402",
        description: "AI-powered crypto trading signals with entry/exit points and risk analysis",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            token: { type: "string", description: "Token pair (default: BTC/USDT)" },
            timeframe: { type: "string", description: "Timeframe (default: 15m)" },
            riskLevel: { type: "string", description: "Risk level (default: medium)" }
          }
        }
      },
      {
        path: "/x402/token-sentiment",
        methods: ["POST"],
        price_usd: 0.25,
        auth: "x402",
        description: "Social sentiment analysis for tokens with momentum indicators",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenSymbol: { type: "string", description: "Token symbol" },
            chain: { type: "string", description: "Blockchain network (optional)" }
          },
          required: ["tokenSymbol"]
        }
      },
      {
        path: "/x402/trending-tokens",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Top gaining and losing tokens across DEXs with real-time market data",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            timeframe: { type: "string", description: "Timeframe (default: 24h)" },
            chain: { type: "string", description: "Blockchain network (optional)" }
          }
        }
      },
      {
        path: "/x402/whale-alerts",
        methods: ["POST"],
        price_usd: 0.35,
        auth: "x402",
        description: "Track large wallet movements with on-chain transaction monitoring",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
            minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
            tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to track (optional)" }
          }
        }
      },
      {
        path: "/x402/dex-liquidity",
        methods: ["POST"],
        price_usd: 0.20,
        auth: "x402",
        description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      // B2B2C Infrastructure Services (5 services)
      {
        path: "/x402/transaction-builder",
        methods: ["POST"],
        price_usd: 0.30,
        auth: "x402",
        description: "Pre-validated transaction encoding for agent-to-agent transfers",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender address" },
            to: { type: "string", description: "Recipient address" },
            value: { type: "string", description: "Transaction value" },
            data: { type: "string", description: "Transaction data (optional)" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["from", "to", "value", "chain"]
        }
      },
      {
        path: "/x402/token-metadata",
        methods: ["POST"],
        price_usd: 0.10,
        auth: "x402",
        description: "Unified token info across all chains - essential for trading agent UIs",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      {
        path: "/x402/approval-manager",
        methods: ["POST"],
        price_usd: 0.20,
        auth: "x402",
        description: "Token approval transaction generator - required for DeFi agents",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            spender: { type: "string", description: "Spender address" },
            amount: { type: "string", description: "Approval amount" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "spender", "amount", "chain"]
        }
      },
      {
        path: "/x402/batch-quote",
        methods: ["POST"],
        price_usd: 0.40,
        auth: "x402",
        description: "Multi-DEX price quotes in single call - critical for trading bot price discovery",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            pairs: { type: "array", items: { type: "string" }, description: "Array of trading pairs to quote" }
          },
          required: ["pairs"]
        }
      },
      {
        path: "/x402/portfolio-tracker",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to track" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to track (optional)" }
          },
          required: ["walletAddress"]
        }
      },
      // Premium B2B2C Infrastructure (3 services)
      {
        path: "/x402/instant-agent-wallet",
        methods: ["POST"],
        price_usd: 1.00,
        auth: "x402",
        description: "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            description: { type: "string", description: "Wallet description/label (optional)" },
            initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
          },
          required: ["agentId"]
        }
      },
      {
        path: "/x402/verified-agent-identity",
        methods: ["POST"],
        price_usd: 5.00,
        auth: "x402",
        description: "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            walletAddress: { type: "string", description: "Agent's wallet address" },
            signature: { type: "string", description: "Signature proof (optional)" },
            metadata: { type: "object", description: "Additional agent metadata (optional)" }
          },
          required: ["agentId", "walletAddress"]
        }
      },
      {
        path: "/x402/seamless-chain-bridge",
        methods: ["POST"],
        price_usd: 2.00,
        auth: "x402",
        description: "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            fromChain: { type: "string", description: "Source blockchain" },
            toChain: { type: "string", description: "Destination blockchain" },
            amount: { type: "string", description: "Amount to bridge" },
            fromAddress: { type: "string", description: "Sender address" },
            toAddress: { type: "string", description: "Recipient address" },
            currency: { type: "string", description: "Currency (default: USDC)" }
          },
          required: ["fromChain", "toChain", "amount", "fromAddress", "toAddress"]
        }
      }
    ],
    x402: {
      protocol_version: "1.0.0",
      facilitator: "https://facilitator.cdp.coinbase.co",
      payment_network: "base",
      payment_token: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6
      },
      platform_wallet: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
    },
    a2a: {
      protocol_version: "2.0.0",
      agent_directory: `${baseUrl}/api/agents/directory`,
      discovery_enabled: true
    },
    commerce: {
      total_services: 18,
      categories: ["trader-focused", "security", "infrastructure", "premium-infrastructure"],
      platform_commission: 15,
      minimum_payment: 0.10,
      maximum_payment: 10000
    },
    blockchain: {
      supported_chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      supported_tokens: ["USDC", "USDT", "ETH", "DAI"],
      primary_chain: "base"
    }
  };
  
  res.status(200).json(x402Manifest);
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
