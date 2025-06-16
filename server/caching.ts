/**
 * Production Caching System
 * Optimizes performance for high-traffic production deployment
 */
class CacheManager {
  private cache = new Map<string, { data: any; expires: number }>();

  async initialize() {
    console.log('✅ Production cache system initialized');
  }

  async get(key: string): Promise<any> {
    try {
      const cached = this.cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      this.cache.delete(key);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, expirationSeconds: number = 300): Promise<void> {
    try {
      this.cache.set(key, {
        data: value,
        expires: Date.now() + (expirationSeconds * 1000)
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      this.cache.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Production-specific cache patterns
  async cacheUserBalance(userId: string, balance: number): Promise<void> {
    await this.set(`user:${userId}:balance`, balance, 60); // 1 minute cache
  }

  async getUserBalance(userId: string): Promise<number | null> {
    return await this.get(`user:${userId}:balance`);
  }

  async cacheExchangeRates(rates: any): Promise<void> {
    await this.set('exchange:rates', rates, 300); // 5 minute cache
  }

  async getExchangeRates(): Promise<any> {
    return await this.get('exchange:rates');
  }

  async cacheTransactionFee(amount: number, fee: number): Promise<void> {
    await this.set(`fee:${amount}`, fee, 3600); // 1 hour cache
  }

  async getTransactionFee(amount: number): Promise<number | null> {
    return await this.get(`fee:${amount}`);
  }

  // Health check for monitoring
  async healthCheck(): Promise<{ cache: boolean; entries: number }> {
    return {
      cache: true,
      entries: this.cache.size
    };
  }

  // Cleanup for graceful shutdown
  async disconnect(): Promise<void> {
    this.cache.clear();
  }
}

export const cacheManager = new CacheManager();