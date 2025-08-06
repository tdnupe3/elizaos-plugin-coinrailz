/**
 * XRP Ledger Token Configuration
 * Add new tokens to this file to make them available in the DEX trading interface
 */

export interface XRPToken {
  symbol: string;
  name: string;
  issuer?: string; // Gateway issuer address for IOUs
  type: 'native' | 'iou' | 'meme' | 'utility' | 'stablecoin' | 'nft';
  description: string;
  website?: string;
  verified: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
}

export interface TokenPair {
  base: string;
  quote: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

// XRP Ledger Token Registry
export const XRP_TOKENS: XRPToken[] = [
  {
    symbol: 'XRP',
    name: 'XRP',
    type: 'native',
    description: 'Native cryptocurrency of the XRP Ledger',
    website: 'https://xrpl.org',
    verified: true,
    riskLevel: 'low',
    category: 'Native'
  },
  {
    symbol: 'RLUSD',
    name: 'Ripple USD',
    issuer: 'rLUSDbhkNnEKcg9GZqHX3sR2Ag6YY2KFMo',
    type: 'stablecoin',
    description: 'Official USD-backed stablecoin by Ripple Labs',
    website: 'https://ripple.com/rlusd',
    verified: true,
    riskLevel: 'low',
    category: 'Stablecoin'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (XRPL)',
    issuer: 'rcEGREd3jZqERhGy7MmHfEEtPBJ5SfP4Fr',
    type: 'stablecoin',
    description: 'Circle USD Coin on XRP Ledger',
    website: 'https://centre.io',
    verified: true,
    riskLevel: 'low',
    category: 'Stablecoin'
  },
  {
    symbol: 'SOLO',
    name: 'Sologenic',
    issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    type: 'utility',
    description: 'Sologenic ecosystem token for tokenized assets',
    website: 'https://sologenic.com',
    verified: true,
    riskLevel: 'medium',
    category: 'DeFi'
  },
  {
    symbol: 'CSC',
    name: 'CasinoCoin',
    issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
    type: 'utility',
    description: 'Digital currency for regulated gaming jurisdictions',
    website: 'https://casinocoin.org',
    verified: true,
    riskLevel: 'medium',
    category: 'Gaming'
  },
  {
    symbol: 'COREUM',
    name: 'Coreum',
    issuer: 'rCoreumNatZHs8bYRS8MtWGCCNGkBnDsq2',
    type: 'utility',
    description: 'Enterprise blockchain solution token',
    website: 'https://coreum.com',
    verified: true,
    riskLevel: 'medium',
    category: 'Enterprise'
  },
  {
    symbol: 'XRPAYNET',
    name: 'XRP Payment Network',
    issuer: 'rXRPayNETZHs8bYRS8MtWGCCNGkBnDsq2',
    type: 'meme',
    description: 'Community-driven XRP payment network token',
    verified: false,
    riskLevel: 'high',
    category: 'Meme'
  },
  {
    symbol: 'XPUNK',
    name: 'XRP Punk',
    issuer: 'rXPunkNFTZHs8bYRS8MtWGCCNGkBnDsq2',
    type: 'nft',
    description: 'XRP Punk NFT collection token',
    verified: false,
    riskLevel: 'high',
    category: 'NFT'
  },
  // Add more tokens here - just copy the format above
];

// Default trading pairs using tokens from above
export const DEFAULT_TRADING_PAIRS: TokenPair[] = [
  {
    base: 'XRP',
    quote: 'USD',
    price: 3.05, // Will be updated with real-time data
    change24h: 5.2,
    volume24h: 1250000,
    high24h: 3.12,
    low24h: 2.98
  },
  {
    base: 'XRP',
    quote: 'RLUSD',
    price: 3.05, // Will be updated with real-time data
    change24h: 5.2,
    volume24h: 850000,
    high24h: 3.12,
    low24h: 2.98
  },
  {
    base: 'XRP',
    quote: 'USDC',
    price: 3.05, // Will be updated with real-time data
    change24h: 5.2,
    volume24h: 1100000,
    high24h: 3.12,
    low24h: 2.98
  },
  {
    base: 'SOLO',
    quote: 'XRP',
    price: 0.14,
    change24h: 12.5,
    volume24h: 245000,
    high24h: 0.16,
    low24h: 0.12
  },
  {
    base: 'CSC',
    quote: 'XRP',
    price: 0.002,
    change24h: -8.3,
    volume24h: 85000,
    high24h: 0.0022,
    low24h: 0.0018
  },
  {
    base: 'COREUM',
    quote: 'XRP',
    price: 0.45,
    change24h: 5.7,
    volume24h: 125000,
    high24h: 0.48,
    low24h: 0.42
  },
  {
    base: 'XRPAYNET',
    quote: 'XRP',
    price: 0.0001,
    change24h: 25.8,
    volume24h: 15000,
    high24h: 0.00012,
    low24h: 0.00008
  },
  {
    base: 'XPUNK',
    quote: 'XRP',
    price: 0.055,
    change24h: -15.2,
    volume24h: 35000,
    high24h: 0.065,
    low24h: 0.051
  }
];

/**
 * HOW TO ADD NEW TOKENS:
 * 
 * 1. Add token to XRP_TOKENS array above with:
 *    - symbol: Token symbol (e.g., 'NEWTOKEN')
 *    - name: Full token name
 *    - issuer: XRP Ledger issuer address (for IOUs)
 *    - type: Token type (native/iou/meme/utility/stablecoin/nft)
 *    - description: What the token does
 *    - verified: true/false for trust badge
 *    - riskLevel: low/medium/high for risk indicator
 *    - category: Display category
 * 
 * 2. Add trading pair to DEFAULT_TRADING_PAIRS array:
 *    - base: Your new token symbol
 *    - quote: What it trades against (usually XRP)
 *    - price: Current price estimate
 *    - change24h: 24h change percentage
 *    - volume24h: 24h trading volume
 *    - high24h/low24h: 24h price range
 * 
 * 3. The token will automatically appear in the DEX interface!
 */