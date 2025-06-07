/**
 * Cryptocurrency Price Caching Service
 * Fetches real prices from CoinGecko API and caches them for 1 hour
 * Minimizes API calls while maintaining data authenticity
 */

import { env } from '../environment';

interface CachedPrice {
  price: number;
  change: number;
  lastUpdated: number;
}

interface PriceCache {
  [symbol: string]: CachedPrice;
}

class CryptoPriceCacheService {
  private cache: PriceCache = {};
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private fetchPromise: Promise<PriceCache> | null = null;

  constructor() {
    // Initialize cache with first fetch
    this.updatePrices();
    
    // Set up hourly refresh
    setInterval(() => {
      this.updatePrices();
    }, this.CACHE_DURATION);
  }

  async getPrices(): Promise<PriceCache> {
    // Return cached data if recent (within 1 hour)
    if (this.isCacheValid()) {
      return this.cache;
    }

    // If update is already in progress, wait for it
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Fetch fresh data
    return this.updatePrices();
  }

  private isCacheValid(): boolean {
    const symbols = ['BTC', 'ETH', 'ADA', 'DOT'];
    const now = Date.now();
    
    return symbols.every(symbol => {
      const cached = this.cache[symbol];
      return cached && (now - cached.lastUpdated) < this.CACHE_DURATION;
    });
  }

  private async updatePrices(): Promise<PriceCache> {
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchPricesFromAPI();
    
    try {
      const prices = await this.fetchPromise;
      this.cache = prices;
      return prices;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchPricesFromAPI(): Promise<PriceCache> {
    if (!env.COINGECKO_API_KEY) {
      throw new Error('CoinGecko API key required for cryptocurrency data');
    }

    const coinGeckoIds = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'DOT': 'polkadot'
    };

    const ids = Object.values(coinGeckoIds).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    
    const response = await fetch(url, {
      headers: {
        'x-cg-demo-api-key': env.COINGECKO_API_KEY
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      // If API fails, return last known cache if available
      if (Object.keys(this.cache).length > 0) {
        console.warn(`CoinGecko API error ${response.status}, using cached prices`);
        return this.cache;
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const now = Date.now();
    
    return {
      BTC: {
        price: data.bitcoin?.usd || 0,
        change: data.bitcoin?.usd_24h_change || 0,
        lastUpdated: now
      },
      ETH: {
        price: data.ethereum?.usd || 0,
        change: data.ethereum?.usd_24h_change || 0,
        lastUpdated: now
      },
      ADA: {
        price: data.cardano?.usd || 0,
        change: data.cardano?.usd_24h_change || 0,
        lastUpdated: now
      },
      DOT: {
        price: data.polkadot?.usd || 0,
        change: data.polkadot?.usd_24h_change || 0,
        lastUpdated: now
      }
    };
  }

  getCacheInfo(): { lastUpdated: string; nextUpdate: string; isValid: boolean } {
    const btcCache = this.cache.BTC;
    if (!btcCache) {
      return {
        lastUpdated: 'Never',
        nextUpdate: 'In progress',
        isValid: false
      };
    }

    const lastUpdated = new Date(btcCache.lastUpdated);
    const nextUpdate = new Date(btcCache.lastUpdated + this.CACHE_DURATION);
    
    return {
      lastUpdated: lastUpdated.toISOString(),
      nextUpdate: nextUpdate.toISOString(),
      isValid: this.isCacheValid()
    };
  }

  async forceRefresh(): Promise<PriceCache> {
    // Clear cache to force refresh
    this.cache = {};
    return this.updatePrices();
  }
}

// Export singleton instance
export const cryptoPriceCache = new CryptoPriceCacheService();