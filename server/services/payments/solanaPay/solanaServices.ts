/**
 * Solana Services - Paid data services for AI agents
 * ISOLATED: Completely separate from x402 EVM infrastructure
 * 
 * Services:
 * - Token Price Feed: Real-time Solana token prices
 * - Trending Tokens: Hot tokens on Solana DEXs
 * - Whale Wallet Alerts: Track large wallet movements
 */

import { SERVICE_SLUGS, SERVICE_PRICING } from './constants.js';

interface TokenPrice {
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: string;
}

interface TrendingToken {
  rank: number;
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  txCount24h?: number;
  holders?: number;
}

interface WhaleAlert {
  wallet: string;
  type: 'buy' | 'sell' | 'transfer';
  tokenSymbol: string;
  tokenMint: string;
  amount: number;
  amountUsd: number;
  timestamp: string;
  txSignature: string;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cachedAt?: string;
  serviceSlug: string;
}

const CACHE_TTL_MS = 30000;
const priceCache = new Map<string, { data: TokenPrice; timestamp: number }>();
const trendingCache: { data: TrendingToken[] | null; timestamp: number } = { data: null, timestamp: 0 };

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export class SolanaDataServices {
  private static instance: SolanaDataServices;

  private constructor() {}

  static getInstance(): SolanaDataServices {
    if (!SolanaDataServices.instance) {
      SolanaDataServices.instance = new SolanaDataServices();
    }
    return SolanaDataServices.instance;
  }

  async getTokenPrice(mintAddress: string): Promise<ServiceResponse<TokenPrice>> {
    const cached = priceCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        success: true,
        data: cached.data,
        cachedAt: new Date(cached.timestamp).toISOString(),
        serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
      };
    }

    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as { pairs?: Array<{
        baseToken: { symbol: string; name: string; address: string };
        priceUsd: string;
        priceChange: { h24: number };
        volume: { h24: number };
        fdv?: number;
      }> };
      
      if (!data.pairs || data.pairs.length === 0) {
        return {
          success: false,
          error: 'Token not found on DexScreener',
          serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
        };
      }

      const pair = data.pairs[0];
      const tokenPrice: TokenPrice = {
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        mint: pair.baseToken.address,
        priceUsd: parseFloat(pair.priceUsd),
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        marketCap: pair.fdv,
        lastUpdated: new Date().toISOString(),
      };

      priceCache.set(mintAddress, { data: tokenPrice, timestamp: Date.now() });

      return {
        success: true,
        data: tokenPrice,
        serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch token price',
        serviceSlug: SERVICE_SLUGS.TOKEN_PRICE_FEED,
      };
    }
  }

  async getSolPrice(): Promise<ServiceResponse<TokenPrice>> {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    return this.getTokenPrice(SOL_MINT);
  }

  async getTrendingTokens(limit = 10): Promise<ServiceResponse<TrendingToken[]>> {
    if (trendingCache.data && Date.now() - trendingCache.timestamp < CACHE_TTL_MS) {
      return {
        success: true,
        data: trendingCache.data.slice(0, limit),
        cachedAt: new Date(trendingCache.timestamp).toISOString(),
        serviceSlug: SERVICE_SLUGS.TRENDING_TOKENS,
      };
    }

    try {
      const url = 'https://api.dexscreener.com/token-boosts/top/v1';
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as Array<{
        chainId: string;
        tokenAddress: string;
        description?: string;
        icon?: string;
        totalAmount?: number;
      }>;

      const solanaTokens = data.filter((t: { chainId: string }) => t.chainId === 'solana').slice(0, 20);
      
      const trendingTokens: TrendingToken[] = await Promise.all(
        solanaTokens.slice(0, limit).map(async (token: { tokenAddress: string; description?: string }, index: number) => {
          const priceData = await this.getTokenPrice(token.tokenAddress);
          return {
            rank: index + 1,
            symbol: priceData.data?.symbol || 'UNKNOWN',
            name: priceData.data?.name || token.description || 'Unknown Token',
            mint: token.tokenAddress,
            priceUsd: priceData.data?.priceUsd || 0,
            priceChange24h: priceData.data?.priceChange24h || 0,
            volume24h: priceData.data?.volume24h || 0,
          };
        })
      );

      trendingCache.data = trendingTokens;
      trendingCache.timestamp = Date.now();

      return {
        success: true,
        data: trendingTokens,
        serviceSlug: SERVICE_SLUGS.TRENDING_TOKENS,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trending tokens',
        serviceSlug: SERVICE_SLUGS.TRENDING_TOKENS,
      };
    }
  }

  async getWhaleAlerts(walletAddress?: string): Promise<ServiceResponse<WhaleAlert[]>> {
    try {
      const heliusApiKey = process.env.HELIUS_API_KEY;
      if (!heliusApiKey) {
        return {
          success: false,
          error: 'Helius API key not configured',
          serviceSlug: SERVICE_SLUGS.WHALE_ALERTS,
        };
      }

      const targetWallet = walletAddress || 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
      
      const url = `https://api.helius.xyz/v0/addresses/${targetWallet}/transactions?api-key=${heliusApiKey}&type=SWAP`;
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const transactions = await response.json() as Array<{
        signature: string;
        timestamp: number;
        type: string;
        tokenTransfers?: Array<{
          mint: string;
          tokenAmount: number;
          tokenStandard?: string;
        }>;
        nativeTransfers?: Array<{
          amount: number;
          fromUserAccount: string;
          toUserAccount: string;
        }>;
      }>;
      
      const alerts: WhaleAlert[] = transactions.slice(0, 10).map((tx) => {
        const transfer = tx.tokenTransfers?.[0] || tx.nativeTransfers?.[0];
        return {
          wallet: targetWallet,
          type: 'transfer' as const,
          tokenSymbol: transfer && 'mint' in transfer ? 'TOKEN' : 'SOL',
          tokenMint: transfer && 'mint' in transfer ? transfer.mint : 'native',
          amount: transfer && 'tokenAmount' in transfer ? transfer.tokenAmount : (transfer && 'amount' in transfer ? transfer.amount / 1e9 : 0),
          amountUsd: 0,
          timestamp: new Date(tx.timestamp * 1000).toISOString(),
          txSignature: tx.signature,
        };
      });

      return {
        success: true,
        data: alerts,
        serviceSlug: SERVICE_SLUGS.WHALE_ALERTS,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch whale alerts',
        serviceSlug: SERVICE_SLUGS.WHALE_ALERTS,
      };
    }
  }

  getServicePricing() {
    return SERVICE_PRICING;
  }

  getAvailableServices() {
    return Object.entries(SERVICE_PRICING).map(([slug, info]) => ({
      slug,
      ...info,
    }));
  }
}

export const solanaDataServices = SolanaDataServices.getInstance();
