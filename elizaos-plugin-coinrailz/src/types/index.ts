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
  }
];
