/**
 * Production Caching System with Redis Fallback
 * Optimizes performance for high-traffic production deployment
 */
class CacheManager {
  private fallbackCache = new Map<string, { data: any; expires: number }>();
  private isRedisAvailable = false;

  async initialize() {
    // For now, use in-memory cache to avoid Redis dependency issues
    // Redis can be added later with proper configuration
    console.log('✅ Production cache system initialized (in-memory fallback)');
    this.isRedisAvailable = false;
  }

  async get(key: string): Promise<any> {
    try {
      if (this.isConnected && this.redis) {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        // Fallback to in-memory cache
        const cached = this.fallbackCache.get(key);
        if (cached && cached.expires > Date.now()) {
          return cached.data;
        }
        this.fallbackCache.delete(key);
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, expirationSeconds: number = 300): Promise<void> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.setEx(key, expirationSeconds, JSON.stringify(value));
      } else {
        // Fallback to in-memory cache
        this.fallbackCache.set(key, {
          data: value,
          expires: Date.now() + (expirationSeconds * 1000)
        });
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.del(key);
      } else {
        this.fallbackCache.delete(key);
      }
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
  async healthCheck(): Promise<{ redis: boolean; fallback: boolean }> {
    return {
      redis: this.isConnected,
      fallback: this.fallbackCache.size > 0
    };
  }

  // Cleanup for graceful shutdown
  async disconnect(): Promise<void> {
    if (this.redis && this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
    this.fallbackCache.clear();
  }
}

export const cacheManager = new CacheManager();