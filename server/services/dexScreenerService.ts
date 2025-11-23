/**
 * DEXScreener Service - Real-time on-chain trading pair discovery
 * 
 * Free API: 300 req/min, no authentication required
 * Data Source: 80+ chains, hundreds of DEXes
 * 
 * HONESTY GUARANTEE: Returns REAL on-chain pairs from DEXScreener API
 */

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  volume: {
    h24: number;
  };
  liquidity: {
    usd: number;
  };
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

interface SimplePair {
  base: string;
  quote: string;
  dex: string;
  liquidity: number;
  volume24h: number;
}

class DexScreenerService {
  private readonly baseUrl = 'https://api.dexscreener.com/latest/dex';
  private cache: Map<string, { pairs: SimplePair[]; timestamp: number }> = new Map();
  private readonly cacheTTL = 300000; // 5 minutes
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimit = 300; // 300 req/min
  private readonly rateLimitWindow = 60000;

  async getPairsByChain(chainId: string): Promise<SimplePair[]> {
    const cached = this.cache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`✅ Serving cached pairs for ${chainId}`);
      return cached.pairs;
    }

    await this.enforceRateLimit();

    const popularTokens = this.getPopularTokensForChain(chainId);
    const allPairs: SimplePair[] = [];

    for (const token of popularTokens) {
      try {
        const pairs = await this.searchPairs(`${token.symbol}`, chainId);
        allPairs.push(...pairs);
      } catch (error) {
        console.warn(`⚠️ Failed to fetch pairs for ${token.symbol} on ${chainId}:`, error);
      }
    }

    const uniquePairs = this.deduplicatePairs(allPairs);
    const topPairs = uniquePairs
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, 50);

    this.cache.set(chainId, {
      pairs: topPairs,
      timestamp: Date.now()
    });

    console.log(`✅ Fetched ${topPairs.length} real pairs from DEXScreener for ${chainId}`);
    return topPairs;
  }

  async searchPairs(query: string, chainId?: string): Promise<SimplePair[]> {
    await this.enforceRateLimit();

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CoinRailz/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`DEXScreener API error: ${response.status} ${response.statusText}`);
    }

    const data: DexScreenerResponse = await response.json();
    
    let pairs = data.pairs || [];
    
    if (chainId) {
      pairs = pairs.filter(p => p.chainId === chainId);
    }

    return pairs
      .filter(p => p.liquidity?.usd > 10000) // Min $10K liquidity
      .map(p => ({
        base: p.baseToken.symbol,
        quote: p.quoteToken.symbol,
        dex: p.dexId,
        liquidity: p.liquidity?.usd || 0,
        volume24h: p.volume?.h24 || 0
      }));
  }

  async getAllPairs(): Promise<Record<string, SimplePair[]>> {
    const chains = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc'];
    const result: Record<string, SimplePair[]> = {};

    for (const chain of chains) {
      try {
        result[chain] = await this.getPairsByChain(chain);
      } catch (error) {
        console.error(`❌ Failed to fetch pairs for ${chain}:`, error);
        result[chain] = [];
      }
    }

    return result;
  }

  private getPopularTokensForChain(chainId: string): Array<{ symbol: string; name: string }> {
    const commonTokens = [
      { symbol: 'WETH', name: 'Wrapped Ether' },
      { symbol: 'USDC', name: 'USD Coin' },
      { symbol: 'USDT', name: 'Tether' },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin' },
      { symbol: 'DAI', name: 'Dai Stablecoin' }
    ];

    const chainSpecific: Record<string, Array<{ symbol: string; name: string }>> = {
      'bsc': [
        { symbol: 'BNB', name: 'BNB' },
        { symbol: 'CAKE', name: 'PancakeSwap' }
      ],
      'polygon': [
        { symbol: 'MATIC', name: 'Polygon' },
        { symbol: 'WMATIC', name: 'Wrapped MATIC' }
      ],
      'base': [
        { symbol: 'ETH', name: 'Ethereum' }
      ]
    };

    return [...commonTokens, ...(chainSpecific[chainId] || [])];
  }

  private deduplicatePairs(pairs: SimplePair[]): SimplePair[] {
    const seen = new Set<string>();
    const unique: SimplePair[] = [];

    for (const pair of pairs) {
      const key = `${pair.base}/${pair.quote}`;
      const reverseKey = `${pair.quote}/${pair.base}`;
      
      if (!seen.has(key) && !seen.has(reverseKey)) {
        seen.add(key);
        unique.push(pair);
      }
    }

    return unique;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= this.rateLimit) {
      const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
      console.log(`⏳ DEXScreener rate limit: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; chains: string[] } {
    return {
      size: this.cache.size,
      chains: Array.from(this.cache.keys())
    };
  }
}

export const dexScreenerService = new DexScreenerService();
export type { SimplePair, DexScreenerPair };
