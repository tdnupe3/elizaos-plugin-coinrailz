/**
 * Redis Caching Layer with Graceful Fallback
 * Optional enhancement that degrades gracefully if Redis unavailable
 */

import Redis from 'ioredis';

interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  redis?: Redis;
}

class CacheLayer {
  private config: CacheConfig;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();

  constructor() {
    this.config = {
      enabled: false,
      ttl: 300, // 5 minutes default
    };

    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Try to connect to Redis (optional)
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      
      if (redisUrl) {
        this.config.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        // Test connection
        await this.config.redis.ping();
        this.config.enabled = true;
        console.log('Redis cache initialized successfully');
      } else {
        console.log('Redis not configured, using memory cache fallback');
        this.config.enabled = true; // Enable with memory fallback
      }
    } catch (error) {
      console.log('Redis unavailable, using memory cache fallback');
      this.config.enabled = true; // Enable with memory fallback
    }
  }

  async get(key: string): Promise<any> {
    if (!this.config.enabled) return null;

    try {
      // Try Redis first
      if (this.config.redis) {
        const value = await this.config.redis.get(key);
        return value ? JSON.parse(value) : null;
      }

      // Fallback to memory cache
      const cached = this.memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      } else if (cached) {
        this.memoryCache.delete(key);
      }
      return null;
    } catch (error) {
      // Graceful degradation - cache failures don't affect application
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.config.enabled) return;

    const ttl = ttlSeconds || this.config.ttl;

    try {
      // Try Redis first
      if (this.config.redis) {
        await this.config.redis.setex(key, ttl, JSON.stringify(value));
        return;
      }

      // Fallback to memory cache
      this.memoryCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });

      // Cleanup expired entries periodically
      if (this.memoryCache.size % 100 === 0) {
        this.cleanupMemoryCache();
      }
    } catch (error) {
      // Graceful degradation - cache failures don't affect application
    }
  }

  async del(key: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      if (this.config.redis) {
        await this.config.redis.del(key);
      }
      this.memoryCache.delete(key);
    } catch (error) {
      // Graceful degradation
    }
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Cache wrapper for expensive operations
  async cached<T>(key: string, operation: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await operation();
    await this.set(key, result, ttlSeconds);
    return result;
  }

  getStats() {
    return {
      enabled: this.config.enabled,
      redis_connected: !!this.config.redis,
      memory_cache_size: this.memoryCache.size,
      ttl_seconds: this.config.ttl
    };
  }

  // Graceful shutdown
  async cleanup() {
    if (this.config.redis) {
      await this.config.redis.quit();
    }
    this.memoryCache.clear();
  }
}

export const cache = new CacheLayer();