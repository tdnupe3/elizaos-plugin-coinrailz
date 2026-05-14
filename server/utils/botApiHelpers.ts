import { Response } from 'express';
import { ethers } from 'ethers';

export interface BotApiError {
  success: false;
  error: string;
  code: string;
  timestamp: number;
}

export function sendBotError(
  res: Response,
  statusCode: number,
  error: string,
  code: string
): void {
  res.status(statusCode).json({
    success: false,
    error,
    code,
    timestamp: Date.now()
  } as BotApiError);
}

export interface TokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
}

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const TOKEN_METADATA: Record<string, Record<string, TokenMetadata>> = {
  ethereum: {
    ETH: { symbol: 'ETH', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WETH: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, isNative: false },
    USDT: { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, isNative: false },
    DAI: { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, isNative: false },
    WBTC: { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, isNative: false },
    VLT: { symbol: 'VLT', address: '0x6b785a0322126826d8226d77e173d75DAfb84d11', decimals: 18, isNative: false },
  },
  base: {
    ETH: { symbol: 'ETH', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WETH: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, isNative: false },
    USDbC: { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, isNative: false },
    USDT: { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, isNative: false },
    DAI: { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, isNative: false },
  },
  polygon: {
    MATIC: { symbol: 'MATIC', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WMATIC: { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, isNative: false },
    'USDC.e': { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, isNative: false },
    USDT: { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, isNative: false },
    DAI: { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, isNative: false },
  },
  bsc: {
    BNB: { symbol: 'BNB', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WBNB: { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, isNative: false },
    USDT: { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, isNative: false },
    DAI: { symbol: 'DAI', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18, isNative: false },
  },
  arbitrum: {
    ETH: { symbol: 'ETH', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WETH: { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, isNative: false },
    'USDC.e': { symbol: 'USDC.e', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, isNative: false },
    USDT: { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, isNative: false },
    DAI: { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, isNative: false },
  },
  optimism: {
    ETH: { symbol: 'ETH', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WETH: { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: false },
    USDC: { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, isNative: false },
    'USDC.e': { symbol: 'USDC.e', address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6, isNative: false },
    USDT: { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, isNative: false },
    DAI: { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, isNative: false },
    WBTC: { symbol: 'WBTC', address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', decimals: 8, isNative: false },
  },
  pulsechain: {
    PLS: { symbol: 'PLS', address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true },
    WPLS: { symbol: 'WPLS', address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', decimals: 18, isNative: false },
    PLSX: { symbol: 'PLSX', address: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab', decimals: 18, isNative: false },
    HEX: { symbol: 'HEX', address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', decimals: 8, isNative: false },
    DAI: { symbol: 'DAI', address: '0xefD766cCb38EaF1dfd701853BFCe31359239F305', decimals: 18, isNative: false },
  },
};

export function resolveTokenAddress(symbol: string, chain: string): TokenMetadata | null {
  const chainLower = chain.toLowerCase();
  // Normalize symbol: uppercase, but preserve dots for bridged tokens like USDC.e
  const symbolNormalized = symbol.toUpperCase();
  
  const chainMetadata = TOKEN_METADATA[chainLower];
  if (!chainMetadata) return null;
  
  // Try exact match first (handles USDC.e correctly)
  if (chainMetadata[symbolNormalized]) {
    return chainMetadata[symbolNormalized];
  }
  
  // Fallback: case-insensitive search for tokens with dots
  for (const [key, value] of Object.entries(chainMetadata)) {
    if (key.toUpperCase() === symbolNormalized) {
      return value;
    }
  }
  
  return null;
}

export function resolveTokenByAddress(address: string, chain: string): TokenMetadata | null {
  const chainLower = chain.toLowerCase();
  const addressLower = address.toLowerCase();
  
  const chainMetadata = TOKEN_METADATA[chainLower];
  if (!chainMetadata) return null;
  
  // Search through all tokens in this chain for matching address
  for (const token of Object.values(chainMetadata)) {
    if (token.address.toLowerCase() === addressLower) {
      return token;
    }
  }
  
  return null;
}

export function parseAmountToWei(amount: string, decimals: number): string {
  try {
    const parsed = ethers.parseUnits(amount, decimals);
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
}

export function formatAmountFromWei(amountWei: string, decimals: number): string {
  try {
    return ethers.formatUnits(amountWei, decimals);
  } catch (error) {
    throw new Error(`Invalid wei amount: ${amountWei}`);
  }
}
