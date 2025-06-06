/**
 * In-Memory Cache Service for Performance Optimization
 * Improves API response times by caching frequently accessed data
 */

interface CacheItem {
  data: any;
  expires: number;
}

class CacheService {
  private cache: Map<string, CacheItem> = new Map();
  private defaultTTL: number = 300000; // 5 minutes default

  /**
   * Set cache item with optional TTL
   */
  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    const expires = Date.now() + ttl;
    this.cache.set(key, { data, expires });
  }

  /**
   * Get cache item if not expired
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Delete specific cache item
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired items
   */
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Cache wrapper for functions
   */
  async cached<T>(
    key: string, 
    fn: () => Promise<T>, 
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }
}

// Initialize cache service
export const cacheService = new CacheService();

// Clean up expired items every 5 minutes
setInterval(() => {
  cacheService.cleanup();
}, 300000);

/**
 * Cache keys for different data types
 */
export const CacheKeys = {
  NETWORK_STATS: 'network_stats',
  AGENT_DISCOVERY: 'agent_discovery',
  EXCHANGE_RATES: 'exchange_rates',
  COMPLIANCE_LISTS: 'compliance_lists',
  AGENT_SERVICES: (agentId: string) => `agent_services_${agentId}`,
  USER_BALANCE: (userId: string) => `user_balance_${userId}`,
  REFERRAL_STATS: (agentId: string) => `referral_stats_${agentId}`
};