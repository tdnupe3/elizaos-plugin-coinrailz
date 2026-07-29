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
  category: string;
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
  // ─── Discovery / Testing ───────────────────────────────────────────────────
  {
    id: 'ping',
    name: 'x402 Discovery Ping',
    description: 'x402 discovery and connectivity test — returns a 402 Payment Required challenge',
    price: '0.25',
    endpoint: '/x402/ping',
    network: 'base',
    category: 'discovery'
  },
  {
    id: 'first-call',
    name: 'First Call (Agent Onboarding)',
    description: 'Golden-path $0.05 onboarding endpoint — the canonical first paid call for new AI agents',
    price: '0.05',
    endpoint: '/x402/first-call',
    network: 'base',
    category: 'discovery'
  },

  // ─── Trading Intelligence ───────────────────────────────────────────────────
  {
    id: 'gas-price-oracle',
    name: 'Gas Price Oracle',
    description: 'Real-time gas prices across multiple chains',
    price: '0.10',
    endpoint: '/x402/gas-price-oracle',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'token-metadata',
    name: 'Token Metadata',
    description: 'Comprehensive token information and metadata',
    price: '0.10',
    endpoint: '/x402/token-metadata',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'dex-liquidity',
    name: 'DEX Liquidity Monitor',
    description: 'Real-time DEX liquidity pool analytics',
    price: '0.20',
    endpoint: '/x402/dex-liquidity',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'approval-manager',
    name: 'Token Approval Manager',
    description: 'Manage and revoke token approvals',
    price: '0.20',
    endpoint: '/x402/approval-manager',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'token-price',
    name: 'Token Price Feed',
    description: 'Real-time token prices from DEX aggregators',
    price: '0.25',
    endpoint: '/x402/token-price',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'token-sentiment',
    name: 'Token Sentiment Analysis',
    description: 'Social sentiment analysis for crypto tokens',
    price: '0.25',
    endpoint: '/x402/token-sentiment',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'transaction-builder',
    name: 'Transaction Builder',
    description: 'Build and simulate blockchain transactions',
    price: '0.30',
    endpoint: '/x402/transaction-builder',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'whale-alerts',
    name: 'Whale Wallet Alerts',
    description: 'Track large wallet movements and whale activity',
    price: '0.35',
    endpoint: '/x402/whale-alerts',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'batch-quote',
    name: 'Batch Quote Service',
    description: 'Get batch quotes for multiple token swaps',
    price: '0.40',
    endpoint: '/x402/batch-quote',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'multi-chain-balance',
    name: 'Multi-Chain Balance Query',
    description: 'Query wallet balances across 7+ EVM chains in a single API call',
    price: '0.50',
    endpoint: '/x402/multi-chain-balance',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'trending-tokens',
    name: 'Trending Tokens',
    description: 'Discover trending tokens across DEXs',
    price: '0.50',
    endpoint: '/x402/trending-tokens',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'portfolio-tracker',
    name: 'Portfolio Tracker',
    description: 'Track and analyze crypto portfolio performance',
    price: '0.50',
    endpoint: '/x402/portfolio-tracker',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'wallet-risk',
    name: 'Wallet Risk Scoring',
    description: 'Evaluate wallet risk and transaction history',
    price: '0.50',
    endpoint: '/x402/wallet-risk',
    network: 'base',
    category: 'trading'
  },
  {
    id: 'trade-signals',
    name: 'Trade Signals',
    description: 'AI-powered trading signals and market analysis',
    price: '0.75',
    endpoint: '/x402/trade-signals',
    network: 'base',
    category: 'trading'
  },

  // ─── Execution & Infrastructure ─────────────────────────────────────────────
  {
    id: 'payment-processing',
    name: 'Payment Processing',
    description: 'Cross-chain payment processing and settlement',
    price: '0.50',
    endpoint: '/x402/service/payment-processing',
    network: 'base',
    category: 'infrastructure'
  },
  {
    id: 'contract-scan',
    name: 'Contract Security Scanner',
    description: 'Smart contract vulnerability and risk analysis',
    price: '1.00',
    endpoint: '/x402/contract-scan',
    network: 'base',
    category: 'infrastructure'
  },
  {
    id: 'instant-agent-wallet',
    name: 'Instant Agent Wallet',
    description: 'Create Circle MPC wallet for AI agents instantly',
    price: '1.00',
    endpoint: '/x402/instant-agent-wallet',
    network: 'base',
    category: 'infrastructure'
  },
  {
    id: 'instant-api-key',
    name: 'Instant API Key',
    description: 'Frictionless API key provisioning via USDC payment — single call to go from agent to API key',
    price: '1.00',
    endpoint: '/x402/instant-api-key',
    network: 'base',
    category: 'infrastructure'
  },
  {
    id: 'agent-create-wallet',
    name: 'Agent Wallet Provisioning',
    description: 'Create CDP-managed wallets for AI agents with instant USDC support on Base',
    price: '2.00',
    endpoint: '/x402/agent-create-wallet',
    network: 'base',
    category: 'infrastructure'
  },
  {
    id: 'seamless-chain-bridge',
    name: 'Seamless Chain Bridge',
    description: 'Circle CCTP cross-chain USDC routing',
    price: '2.00',
    endpoint: '/x402/seamless-chain-bridge',
    network: 'base',
    category: 'infrastructure'
  },

  // ─── Premium Services ───────────────────────────────────────────────────────
  {
    id: 'verified-agent-identity',
    name: 'Verified Agent Identity',
    description: 'KYA with ERC-8004 on-chain identity on Base',
    price: '5.00',
    endpoint: '/x402/verified-agent-identity',
    network: 'base',
    category: 'premium'
  },
  {
    id: 'compliance-consultation',
    name: 'Compliance Consultation',
    description: 'Expert compliance consultation for crypto operations and regulatory requirements',
    price: '5.00',
    endpoint: '/x402/service/compliance-consultation',
    network: 'base',
    category: 'premium'
  },
  {
    id: 'smart-contract-audit',
    name: 'Smart Contract Audit',
    description: 'Comprehensive AI-powered smart contract security audit',
    price: '10.00',
    endpoint: '/x402/service/smart-contract-audit',
    network: 'base',
    category: 'premium'
  },

  // ─── Real Estate ────────────────────────────────────────────────────────────
  {
    id: 'property-valuation',
    name: 'AI Property Valuation',
    description: 'AI-powered real estate valuation with tokenization analysis',
    price: '0.75',
    endpoint: '/x402/property-valuation',
    network: 'base',
    category: 'real-estate'
  },
  {
    id: 'lease-analysis',
    name: 'Lease Analysis',
    description: 'AI-powered lease terms analysis and optimization',
    price: '1.00',
    endpoint: '/x402/lease-analysis',
    network: 'base',
    category: 'real-estate'
  },
  {
    id: 'construction-progress',
    name: 'Construction Progress Tracking',
    description: 'Track and verify construction project progress',
    price: '1.50',
    endpoint: '/x402/construction-progress',
    network: 'base',
    category: 'real-estate'
  },

  // ─── Banking & Compliance ───────────────────────────────────────────────────
  {
    id: 'fraud-detection',
    name: 'Fraud Detection',
    description: 'AI-powered fraud and suspicious activity detection',
    price: '0.75',
    endpoint: '/x402/fraud-detection',
    network: 'base',
    category: 'banking'
  },
  {
    id: 'credit-risk-score',
    name: 'DeFi Credit Score',
    description: 'On-chain credit scoring for DeFi lending protocols',
    price: '1.25',
    endpoint: '/x402/credit-risk-score',
    network: 'base',
    category: 'banking'
  },
  {
    id: 'compliance-check',
    name: 'AML/KYC Compliance Check',
    description: 'Wallet compliance screening for regulated entities',
    price: '1.75',
    endpoint: '/x402/compliance-check',
    network: 'base',
    category: 'banking'
  },

  // ─── Trading / Investment ───────────────────────────────────────────────────
  {
    id: 'sentiment-analysis',
    name: 'Social Sentiment Analysis',
    description: 'AI-powered sentiment analysis from Twitter, Reddit, Discord',
    price: '0.50',
    endpoint: '/x402/sentiment-analysis',
    network: 'base',
    category: 'investment'
  },
  {
    id: 'trading-signal',
    name: 'Trading Signal',
    description: 'AI-powered trading signals with entry/exit points',
    price: '1.00',
    endpoint: '/x402/trading-signal',
    network: 'base',
    category: 'investment'
  },
  {
    id: 'portfolio-optimization',
    name: 'Portfolio Optimization',
    description: 'AI-powered portfolio rebalancing and yield optimization',
    price: '2.00',
    endpoint: '/x402/portfolio-optimization',
    network: 'base',
    category: 'investment'
  },

  // ─── Market Intelligence ────────────────────────────────────────────────────
  {
    id: 'correlation-matrix',
    name: 'Asset Correlation Matrix',
    description: 'Cross-asset correlation analysis for portfolio diversification',
    price: '0.75',
    endpoint: '/x402/correlation-matrix',
    network: 'base',
    category: 'market-intelligence'
  },
  {
    id: 'risk-metrics',
    name: 'Risk Metrics Dashboard',
    description: 'Comprehensive risk metrics and analytics',
    price: '1.00',
    endpoint: '/x402/risk-metrics',
    network: 'base',
    category: 'market-intelligence'
  },
  {
    id: 'arbitrage-scanner',
    name: 'Cross-Chain Arbitrage Scanner',
    description: 'Identify arbitrage opportunities across 7 blockchains',
    price: '1.25',
    endpoint: '/x402/arbitrage-scanner',
    network: 'base',
    category: 'market-intelligence'
  },

  // ─── Prediction Markets ─────────────────────────────────────────────────────
  {
    id: 'polymarket-events',
    name: 'Polymarket Events',
    description: 'Trending events from Polymarket prediction markets',
    price: '0.25',
    endpoint: '/x402/polymarket-events',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'polymarket-search',
    name: 'Polymarket Search',
    description: 'Search Polymarket prediction markets',
    price: '0.25',
    endpoint: '/x402/polymarket-search',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'kalshi-markets',
    name: 'Kalshi Markets',
    description: 'Active CFTC-regulated Kalshi prediction markets',
    price: '0.25',
    endpoint: '/x402/kalshi-markets',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'kalshi-search',
    name: 'Kalshi Search',
    description: 'Search CFTC-regulated Kalshi prediction markets',
    price: '0.25',
    endpoint: '/x402/kalshi-search',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'polymarket-odds',
    name: 'Polymarket Odds',
    description: 'Current odds for a specific Polymarket market',
    price: '0.50',
    endpoint: '/x402/polymarket-odds',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'prediction-market-odds',
    name: 'Prediction Market Odds',
    description: 'Current odds and probability for any prediction market event',
    price: '0.50',
    endpoint: '/x402/prediction-market-odds',
    network: 'base',
    category: 'prediction-markets'
  },
  {
    id: 'kalshi-odds',
    name: 'Kalshi Odds',
    description: 'Current odds for a specific CFTC-regulated Kalshi market',
    price: '0.50',
    endpoint: '/x402/kalshi-odds',
    network: 'base',
    category: 'prediction-markets'
  },

  // ─── Traditional Markets ────────────────────────────────────────────────────
  {
    id: 'stock-sentiment',
    name: 'Stock Sentiment Analysis',
    description: 'AI-powered stock market sentiment with news, technicals, and institutional signals',
    price: '0.40',
    endpoint: '/x402/stock-sentiment',
    network: 'base',
    category: 'traditional-markets'
  },
  {
    id: 'forex-sentiment',
    name: 'Forex Sentiment Analysis',
    description: 'AI-powered forex currency pair sentiment with economic and central bank insights',
    price: '0.40',
    endpoint: '/x402/forex-sentiment',
    network: 'base',
    category: 'traditional-markets'
  },

  // ─── Solana DeFi ────────────────────────────────────────────────────────────
  {
    id: 'solana-yield-finder',
    name: 'Solana Yield Finder',
    description: 'Real-time Solana lending and yield rates via Dialect integration',
    price: '0.05',
    endpoint: '/x402/solana-yield-finder',
    network: 'base',
    category: 'solana'
  },

  // ─── Satellite Data (NASA + ESA) ────────────────────────────────────────────
  {
    id: 'fire-alerts',
    name: 'Fire Alerts',
    description: 'NASA FIRMS active fire detection — real-time wildfire data from MODIS and VIIRS',
    price: '0.05',
    endpoint: '/x402/fire-alerts',
    network: 'base',
    category: 'satellite'
  },
  {
    id: 'weather-imagery',
    name: 'Weather Imagery',
    description: 'NASA GIBS satellite imagery for weather pattern analysis',
    price: '0.05',
    endpoint: '/x402/weather-imagery',
    network: 'base',
    category: 'satellite'
  },
  {
    id: 'air-quality',
    name: 'Air Quality',
    description: 'ESA Sentinel-5P TROPOMI global air quality measurements',
    price: '0.05',
    endpoint: '/x402/air-quality',
    network: 'base',
    category: 'satellite'
  },
  {
    id: 'vegetation',
    name: 'Vegetation Index',
    description: 'NASA MODIS + ESA Sentinel-2 NDVI vegetation health data',
    price: '0.10',
    endpoint: '/x402/vegetation',
    network: 'base',
    category: 'satellite'
  },
  {
    id: 'flood-detection',
    name: 'Flood Detection',
    description: 'ESA Sentinel-1 SAR water detection for flood and inundation mapping',
    price: '0.10',
    endpoint: '/x402/flood-detection',
    network: 'base',
    category: 'satellite'
  },
  {
    id: 'land-use',
    name: 'Land Use Classification',
    description: 'NASA Landsat + ESA Sentinel-2 land cover classification',
    price: '0.15',
    endpoint: '/x402/land-use',
    network: 'base',
    category: 'satellite'
  },

  // ─── NASA Earthdata Intelligence ────────────────────────────────────────────
  {
    id: 'earthdata-sst',
    name: 'Earthdata Sea Surface Temperature',
    description: 'MUR multi-scale ultra-high resolution sea surface temperature via OPeNDAP',
    price: '0.25',
    endpoint: '/x402/earthdata-sst',
    network: 'base',
    category: 'nasa-earthdata'
  },
  {
    id: 'earthdata-soil-moisture',
    name: 'Earthdata Soil Moisture',
    description: 'SMAP soil moisture granule discovery — critical for agriculture and climate monitoring',
    price: '0.25',
    endpoint: '/x402/earthdata-soil-moisture',
    network: 'base',
    category: 'nasa-earthdata'
  },
  {
    id: 'earthdata-ocean-color',
    name: 'Earthdata Ocean Color',
    description: 'MODIS ocean color and chlorophyll-a concentration for marine ecosystem monitoring',
    price: '0.25',
    endpoint: '/x402/earthdata-ocean-color',
    network: 'base',
    category: 'nasa-earthdata'
  },

  // ─── IoT / DePIN ────────────────────────────────────────────────────────────
  {
    id: 'weather-station-data',
    name: 'Weather Station Data',
    description: 'Temperature, humidity, and pressure from IoT weather stations',
    price: '0.05',
    endpoint: '/x402/weather-station-data',
    network: 'base',
    category: 'iot'
  },
  {
    id: 'iot-sensor-reading',
    name: 'IoT Sensor Reading',
    description: 'Single sensor reading from a registered IoT device',
    price: '0.025',
    endpoint: '/x402/iot-sensor-reading',
    network: 'base',
    category: 'iot'
  },
  {
    id: 'fleet-telematics',
    name: 'Fleet Telematics',
    description: 'GPS location, fuel consumption, and driver behavior data from fleet vehicles',
    price: '0.10',
    endpoint: '/x402/fleet-telematics',
    network: 'base',
    category: 'iot'
  },
  {
    id: 'iot-device-stream',
    name: 'IoT Device Stream',
    description: 'Real-time data stream from an IoT device (per minute)',
    price: '0.25',
    endpoint: '/x402/iot-device-stream',
    network: 'base',
    category: 'iot'
  },
  {
    id: 'iot-bulk-data',
    name: 'IoT Bulk Data Export',
    description: 'Bulk historical data export from IoT devices',
    price: '0.50',
    endpoint: '/x402/iot-bulk-data',
    network: 'base',
    category: 'iot'
  },

  // ─── AI Inference ───────────────────────────────────────────────────────────
  {
    id: 'ai-inference',
    name: 'AI Inference Gateway',
    description: 'Pay-per-call LLM access via x402 — GPT-4o-mini at $0.05/call, no API key required',
    price: '0.05',
    endpoint: '/x402/ai-inference',
    network: 'base',
    category: 'ai'
  },

  // ─── Robinhood Chain ─────────────────────────────────────────────────────────
  {
    id: 'robinhood-token-price',
    name: 'Robinhood Chain Token Price',
    description: 'Live token price + pool data on Robinhood Chain — day-1 exclusivity',
    price: '0.60',
    endpoint: '/x402/robinhood-token-price',
    network: 'base',
    category: 'robinhood-chain'
  },
  {
    id: 'robinhood-dex-pools',
    name: 'Robinhood Chain DEX Pools',
    description: 'Top DEX liquidity pools on Robinhood Chain for trading and routing',
    price: '1.25',
    endpoint: '/x402/robinhood-dex-pools',
    network: 'base',
    category: 'robinhood-chain'
  },
  {
    id: 'robinhood-chain-stats',
    name: 'Robinhood Chain Stats',
    description: 'Chain health: block height, gas, total DEX volume, active pools',
    price: '0.75',
    endpoint: '/x402/robinhood-chain-stats',
    network: 'base',
    category: 'robinhood-chain'
  },
  {
    id: 'rh-stock-price',
    name: 'RH Stock Price (Chainlink)',
    description: 'Live Chainlink price feed for RH tokenized stocks: AAPL, NVDA, SPY, and more',
    price: '0.05',
    endpoint: '/x402/rh-stock-price',
    network: 'base',
    category: 'robinhood-chain'
  },
  {
    id: 'rh-bridge-usdc',
    name: 'RH USDC Bridge',
    description: 'Bridge USDC (Base) to USDG (Robinhood Chain) via Across Protocol',
    price: '0.75',
    endpoint: '/x402/rh-bridge-usdc',
    network: 'base',
    category: 'robinhood-chain'
  },

  // ─── B20 Token Compliance ────────────────────────────────────────────────────
  {
    id: 'b20-token-info',
    name: 'B20 Token Info',
    description: 'ERC-20 metadata + B20 compliance mode and freeze state',
    price: '0.05',
    endpoint: '/x402/b20-token-info',
    network: 'base',
    category: 'compliance'
  },
  {
    id: 'b20-transfer-check',
    name: 'B20 Transfer Check',
    description: 'Simulate a transfer against live freeze/blocklist/allowlist rules',
    price: '0.10',
    endpoint: '/x402/b20-transfer-check',
    network: 'base',
    category: 'compliance'
  },
  {
    id: 'b20-compliance-scan',
    name: 'B20 Compliance Scan',
    description: 'Multi-issuer compliance scan for a wallet address across B20 tokens',
    price: '0.25',
    endpoint: '/x402/b20-compliance-scan',
    network: 'base',
    category: 'compliance'
  },

  // ─── RWA & Tokenized Assets ──────────────────────────────────────────────────
  {
    id: 'rwa-nav-oracle',
    name: 'RWA NAV Oracle',
    description: 'Synthetic market-based NAV estimate with EIP-712 attestation for tokenized real-world assets',
    price: '0.50',
    endpoint: '/x402/rwa-nav-oracle',
    network: 'base',
    category: 'rwa'
  },
  {
    id: 'tokenized-yield-compare',
    name: 'Tokenized Yield Compare',
    description: 'Live yield comparison across Ondo, Backed, Superstate, Mountain, and OpenEden',
    price: '0.25',
    endpoint: '/x402/tokenized-yield-compare',
    network: 'base',
    category: 'rwa'
  },

  // ─── Prediction Markets ──────────────────────────────────────────────────────
  {
    id: 'prediction-market-spread',
    name: 'Prediction Market Spread',
    description: 'Cross-platform arbitrage spread between Polymarket and Kalshi for the same event',
    price: '0.25',
    endpoint: '/x402/prediction-market-spread',
    network: 'base',
    category: 'prediction-markets'
  },

  // ─── Bankroll Network / VLT Vault ───────────────────────────────────────────
  {
    id: 'vlt-stats',
    name: 'VLT + vltUSDC Vault Stats',
    description: 'Live VLT token price, market cap, liquidity, and vltUSDC vault stats (TVL, estimated LP fee APR, L/share). Use for autonomous vault allocation decisions.',
    price: '0.05',
    endpoint: '/x402/vlt-stats',
    network: 'base',
    category: 'bankroll-network'
  },
  {
    id: 'vlt-usdc-deposit',
    name: 'vltUSDC Vault Deposit Builder',
    description: 'FREE — Calldata builder for depositing into the Bankroll Network vltUSDC vault on Ethereum mainnet. Balanced (VLT+USDC) or USDC-only via ZapHelper. No payment required with API key.',
    price: '0.00',
    endpoint: '/x402/vlt-usdc-deposit',
    network: 'base',
    category: 'bankroll-network'
  },
  {
    id: 'vlt-usdc-withdraw',
    name: 'vltUSDC Vault Withdraw Builder',
    description: 'FREE — Calldata builder for redeeming vltUSDC shares from the Bankroll Network vault on Ethereum mainnet. Single transaction, no approvals needed. No payment required with API key.',
    price: '0.00',
    endpoint: '/x402/vlt-usdc-withdraw',
    network: 'base',
    category: 'bankroll-network'
  }
];
