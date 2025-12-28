export interface CoinRailzConfig {
  platformWallet: `0x${string}`;
  network: 'base' | 'base-sepolia';
  facilitatorUrl?: string;
  enableAnalytics?: boolean;
}

export interface CoinRailzService {
  id: string;
  name: string;
  description: string;
  price: string;
  endpoint: string;
  network: 'base' | 'base-sepolia';
}

export interface PaymentRequest {
  serviceId: string;
  amount: string;
  walletAddress?: string;
  payload?: any;
}

export interface PaymentResponse {
  success: boolean;
  transactionHash?: string;
  serviceResponse?: any;
  error?: string;
}

export const COIN_RAILZ_SERVICES: CoinRailzService[] = [
  {
    id: 'multi-chain-balance',
    name: 'Multi-Chain Balance Query',
    description: 'Query wallet balances across 7+ EVM chains in a single API call',
    price: '0.50',
    endpoint: '/x402/multi-chain-balance',
    network: 'base'
  },
  {
    id: 'gas-price-oracle',
    name: 'Gas Price Oracle',
    description: 'Real-time gas prices across multiple chains',
    price: '0.10',
    endpoint: '/x402/gas-price-oracle',
    network: 'base'
  },
  {
    id: 'token-price',
    name: 'Token Price Feed',
    description: 'Real-time token prices from DEX aggregators',
    price: '0.15',
    endpoint: '/x402/token-price',
    network: 'base'
  },
  {
    id: 'contract-scan',
    name: 'Contract Security Scanner',
    description: 'Smart contract vulnerability and risk analysis',
    price: '2.00',
    endpoint: '/x402/contract-scan',
    network: 'base'
  },
  {
    id: 'wallet-risk',
    name: 'Wallet Risk Scoring',
    description: 'Evaluate wallet risk and transaction history',
    price: '1.00',
    endpoint: '/x402/wallet-risk',
    network: 'base'
  },
  {
    id: 'trade-signals',
    name: 'Trade Signals',
    description: 'AI-powered trading signals and market analysis',
    price: '0.75',
    endpoint: '/x402/trade-signals',
    network: 'base'
  },
  {
    id: 'token-sentiment',
    name: 'Token Sentiment Analysis',
    description: 'Social sentiment analysis for crypto tokens',
    price: '0.25',
    endpoint: '/x402/token-sentiment',
    network: 'base'
  },
  {
    id: 'trending-tokens',
    name: 'Trending Tokens',
    description: 'Discover trending tokens across DEXs',
    price: '0.50',
    endpoint: '/x402/trending-tokens',
    network: 'base'
  },
  {
    id: 'whale-alerts',
    name: 'Whale Wallet Alerts',
    description: 'Track large wallet movements and whale activity',
    price: '0.35',
    endpoint: '/x402/whale-alerts',
    network: 'base'
  },
  {
    id: 'dex-liquidity',
    name: 'DEX Liquidity Monitor',
    description: 'Real-time DEX liquidity pool analytics',
    price: '0.20',
    endpoint: '/x402/dex-liquidity',
    network: 'base'
  },
  {
    id: 'transaction-builder',
    name: 'Transaction Builder',
    description: 'Build and simulate blockchain transactions',
    price: '0.30',
    endpoint: '/x402/transaction-builder',
    network: 'base'
  },
  {
    id: 'token-metadata',
    name: 'Token Metadata',
    description: 'Comprehensive token information and metadata',
    price: '0.10',
    endpoint: '/x402/token-metadata',
    network: 'base'
  },
  {
    id: 'approval-manager',
    name: 'Token Approval Manager',
    description: 'Manage and revoke token approvals',
    price: '0.20',
    endpoint: '/x402/approval-manager',
    network: 'base'
  },
  {
    id: 'batch-quote',
    name: 'Batch Quote Service',
    description: 'Get batch quotes for multiple token swaps',
    price: '0.40',
    endpoint: '/x402/batch-quote',
    network: 'base'
  },
  {
    id: 'portfolio-tracker',
    name: 'Portfolio Tracker',
    description: 'Track and analyze crypto portfolio performance',
    price: '0.50',
    endpoint: '/x402/portfolio-tracker',
    network: 'base'
  },
  {
    id: 'instant-agent-wallet',
    name: 'Instant Agent Wallet',
    description: 'Create Circle MPC wallet for AI agents',
    price: '1.00',
    endpoint: '/x402/instant-agent-wallet',
    network: 'base'
  },
  {
    id: 'verified-agent-identity',
    name: 'Verified Agent Identity',
    description: 'KYA with ERC-8004 on-chain identity',
    price: '5.00',
    endpoint: '/x402/verified-agent-identity',
    network: 'base'
  },
  {
    id: 'seamless-chain-bridge',
    name: 'Seamless Chain Bridge',
    description: 'Circle CCTP cross-chain routing',
    price: '2.00',
    endpoint: '/x402/seamless-chain-bridge',
    network: 'base'
  },
  {
    id: 'ping',
    name: 'x402 Discovery Ping',
    description: 'x402 discovery and testing endpoint - returns 402 Payment Required challenge',
    price: '0.25',
    endpoint: '/x402/ping',
    network: 'base'
  },
  {
    id: 'sentiment-analysis',
    name: 'Social Sentiment Analysis',
    description: 'AI-powered sentiment analysis from Twitter, Reddit, Discord',
    price: '0.50',
    endpoint: '/x402/sentiment-analysis',
    network: 'base'
  },
  {
    id: 'arbitrage-scanner',
    name: 'Cross-Chain Arbitrage Scanner',
    description: 'Identify arbitrage opportunities across 7 blockchains',
    price: '1.25',
    endpoint: '/x402/arbitrage-scanner',
    network: 'base'
  },
  {
    id: 'portfolio-optimization',
    name: 'Portfolio Optimization',
    description: 'AI-powered portfolio rebalancing and yield optimization',
    price: '2.00',
    endpoint: '/x402/portfolio-optimization',
    network: 'base'
  },
  {
    id: 'compliance-consultation',
    name: 'Compliance Consultation',
    description: 'Expert compliance consultation for crypto operations and regulatory requirements',
    price: '5.00',
    endpoint: '/x402/compliance-consultation',
    network: 'base'
  },
  {
    id: 'agent-create-wallet',
    name: 'Agent Wallet Provisioning',
    description: 'Create CDP-managed wallets for AI agents with instant USDC support on Base',
    price: '2.00',
    endpoint: '/x402/agent-create-wallet',
    network: 'base'
  },
  {
    id: 'payment-processing',
    name: 'Payment Processing',
    description: 'Cross-chain payment processing and settlement',
    price: '0.50',
    endpoint: '/x402/service/payment-processing',
    network: 'base'
  },
  {
    id: 'smart-contract-audit',
    name: 'Smart Contract Audit',
    description: 'Comprehensive smart contract security audit',
    price: '10.00',
    endpoint: '/x402/service/smart-contract-audit',
    network: 'base'
  },
  {
    id: 'trading-signal',
    name: 'Trading Signal',
    description: 'AI-powered trading signals with entry/exit points',
    price: '1.00',
    endpoint: '/x402/trading-signal',
    network: 'base'
  },
  {
    id: 'correlation-matrix',
    name: 'Asset Correlation Matrix',
    description: 'Cross-asset correlation analysis for portfolio diversification',
    price: '0.75',
    endpoint: '/x402/correlation-matrix',
    network: 'base'
  },
  {
    id: 'property-valuation',
    name: 'AI Property Valuation',
    description: 'AI-powered real estate valuation with tokenization analysis',
    price: '0.75',
    endpoint: '/x402/property-valuation',
    network: 'base'
  },
  {
    id: 'lease-analysis',
    name: 'Lease Analysis',
    description: 'AI-powered lease terms analysis and optimization',
    price: '1.00',
    endpoint: '/x402/lease-analysis',
    network: 'base'
  },
  {
    id: 'construction-progress',
    name: 'Construction Progress Tracking',
    description: 'Track and verify construction project progress',
    price: '1.50',
    endpoint: '/x402/construction-progress',
    network: 'base'
  },
  {
    id: 'credit-risk-score',
    name: 'DeFi Credit Score',
    description: 'On-chain credit scoring for DeFi lending protocols',
    price: '1.25',
    endpoint: '/x402/credit-risk-score',
    network: 'base'
  },
  {
    id: 'compliance-check',
    name: 'AML/KYC Compliance Check',
    description: 'Wallet compliance screening for regulated entities',
    price: '1.75',
    endpoint: '/x402/compliance-check',
    network: 'base'
  },
  {
    id: 'fraud-detection',
    name: 'Fraud Detection',
    description: 'AI-powered fraud and suspicious activity detection',
    price: '1.50',
    endpoint: '/x402/fraud-detection',
    network: 'base'
  },
  {
    id: 'risk-metrics',
    name: 'Risk Metrics Dashboard',
    description: 'Comprehensive risk metrics and analytics',
    price: '1.00',
    endpoint: '/x402/risk-metrics',
    network: 'base'
  },
  {
    id: 'polymarket-odds',
    name: 'Polymarket Odds',
    description: 'Get current odds from Polymarket prediction markets',
    price: '0.50',
    endpoint: '/x402/polymarket-odds',
    network: 'base'
  },
  {
    id: 'polymarket-events',
    name: 'Polymarket Events',
    description: 'Get trending events from Polymarket',
    price: '0.25',
    endpoint: '/x402/polymarket-events',
    network: 'base'
  },
  {
    id: 'polymarket-search',
    name: 'Polymarket Search',
    description: 'Search Polymarket prediction markets',
    price: '0.25',
    endpoint: '/x402/polymarket-search',
    network: 'base'
  },
  {
    id: 'prediction-market-odds',
    name: 'Prediction Market Odds',
    description: 'Get current odds and probability for any prediction market event',
    price: '0.50',
    endpoint: '/x402/prediction-market-odds',
    network: 'base'
  },
  {
    id: 'stock-sentiment',
    name: 'Stock Sentiment Analysis',
    description: 'AI-powered stock market sentiment analysis with news, technicals, and institutional activity',
    price: '0.40',
    endpoint: '/x402/stock-sentiment',
    network: 'base'
  },
  {
    id: 'forex-sentiment',
    name: 'Forex Sentiment Analysis',
    description: 'AI-powered forex currency pair sentiment analysis with economic and central bank insights',
    price: '0.40',
    endpoint: '/x402/forex-sentiment',
    network: 'base'
  }
];
