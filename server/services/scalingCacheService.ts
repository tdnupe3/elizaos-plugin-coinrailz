
/**
 * Advanced Caching Service for High-Scale Operations
 * Implements multi-tier caching for optimal performance under load
 */

import { Redis } from 'ioredis';
import { PerformanceOptimizer } from './performanceOptimizer';

interface CacheConfig {
  ttl: number;
  namespace: string;
  compression?: boolean;
}

export class ScalingCacheService {
  private static memoryCache = new Map<string, { data: any; expires: number }>();
  private static redis: Redis | null = null;

  /**
   * Initialize Redis for production scaling
   */
  static initializeRedis(redisUrl?: string): void {
    const configuredRedisUrl = redisUrl || process.env.REDIS_URL;
    
    if (configuredRedisUrl) {
      try {
        this.redis = new Redis(configuredRedisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableOfflineQueue: false
        });
        console.log('Redis cache initialized for scaling');
      } catch (error) {
        console.log('Redis cache unavailable, using memory cache only');
        this.redis = null;
      }
    } else {
      console.log('No Redis URL configured, using memory cache only');
    }
  }

  /**
   * Multi-tier cache strategy: Memory -> Redis -> Database
   */
  static async get<T>(key: string, config: CacheConfig): Promise<T | null> {
    const fullKey = `${config.namespace}:${key}`;
    
    // Level 1: Memory cache (fastest)
    const memCached = this.memoryCache.get(fullKey);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.data;
    }
    
    // Level 2: Redis cache (if available)
    if (this.redis) {
      try {
        const redisCached = await this.redis.get(fullKey);
        if (redisCached) {
          const data = JSON.parse(redisCached);
          // Populate memory cache
          this.memoryCache.set(fullKey, {
            data,
            expires: Date.now() + config.ttl
          });
          return data;
        }
      } catch (error) {
        console.warn('Redis cache miss:', error);
      }
    }
    
    return null;
  }

  /**
   * Set data in all cache levels
   */
  static async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    const fullKey = `${config.namespace}:${key}`;
    const expires = Date.now() + config.ttl;
    
    // Level 1: Memory cache
    this.memoryCache.set(fullKey, { data, expires });
    
    // Level 2: Redis cache
    if (this.redis) {
      try {
        await this.redis.setex(fullKey, Math.floor(config.ttl / 1000), JSON.stringify(data));
      } catch (error) {
        console.warn('Redis cache set failed:', error);
      }
    }
  }

  /**
   * Cache frequently accessed data for scaling
   */
  static async getCachedUserBalance(userId: string): Promise<any> {
    return this.get(`user_balance_${userId}`, {
      ttl: 30000, // 30 seconds
      namespace: 'balances'
    });
  }

  static async setCachedUserBalance(userId: string, balance: any): Promise<void> {
    return this.set(`user_balance_${userId}`, balance, {
      ttl: 30000,
      namespace: 'balances'
    });
  }

  /**
   * Cache AI agent marketplace data
   */
  static async getCachedAgentData(agentId: string): Promise<any> {
    return this.get(`agent_${agentId}`, {
      ttl: 300000, // 5 minutes
      namespace: 'agents'
    });
  }

  static async setCachedAgentData(agentId: string, data: any): Promise<void> {
    return this.set(`agent_${agentId}`, data, {
      ttl: 300000,
      namespace: 'agents'
    });
  }

  /**
   * Cache network statistics
   */
  static async getCachedNetworkStats(): Promise<any> {
    return this.get('network_stats', {
      ttl: 120000, // 2 minutes
      namespace: 'stats'
    });
  }

  static async setCachedNetworkStats(stats: any): Promise<void> {
    return this.set('network_stats', stats, {
      ttl: 120000,
      namespace: 'stats'
    });
  }

  /**
   * Clear cache during high memory pressure
   */
  static clearMemoryCache(): void {
    this.memoryCache.clear();
    console.log('Memory cache cleared for scaling optimization');
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    // Clear memory cache
    this.memoryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    });

    // Clear Redis cache if available
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.warn('Redis pattern invalidation failed:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): any {
    return {
      memoryEntries: this.memoryCache.size,
      redisConnected: !!this.redis,
      memoryKeys: Array.from(this.memoryCache.keys())
    };
  }
}

