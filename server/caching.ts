/**
 * Production Caching System
 * High-performance in-memory caching with TTL and memory management
 */

interface CacheEntry {
  data: any;
  expires: number;
  size: number;
}

class ProductionCache {
  private cache = new Map<string, CacheEntry>();
  private maxMemoryMB = 50; // 50MB cache limit
  private currentMemoryBytes = 0;
  private hitCount = 0;
  private missCount = 0;

  constructor() {
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(key: string, value: any, ttlSeconds: number = 300): void {
    const serialized = JSON.stringify(value);
    const size = Buffer.byteLength(serialized, 'utf8');
    
    // Check if we need to free memory
    if (this.currentMemoryBytes + size > this.maxMemoryMB * 1024 * 1024) {
      this.evictLRU();
    }

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.currentMemoryBytes -= this.cache.get(key)!.size;
    }

    const entry: CacheEntry = {
      data: value,
      expires: Date.now() + (ttlSeconds * 1000),
      size
    };

    this.cache.set(key, entry);
    this.currentMemoryBytes += size;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.data;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryBytes -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentMemoryBytes = 0;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));
  }

  private evictLRU(): void {
    // Simple LRU: remove oldest entries until we have 20% free space
    const targetSize = this.maxMemoryMB * 1024 * 1024 * 0.8;
    const entries: [string, CacheEntry][] = [];
    
    this.cache.forEach((entry, key) => {
      entries.push([key, entry]);
    });
    
    // Sort by access time (approximate LRU)
    entries.sort((a, b) => a[1].expires - b[1].expires);
    
    while (this.currentMemoryBytes > targetSize && entries.length > 0) {
      const [key] = entries.shift()!;
      this.delete(key);
    }
  }

  getStats() {
    return {
      entries: this.cache.size,
      memoryUsageMB: Math.round(this.currentMemoryBytes / 1024 / 1024 * 100) / 100,
      hitRate: this.hitCount + this.missCount > 0 
        ? Math.round((this.hitCount / (this.hitCount + this.missCount)) * 100) 
        : 0,
      hits: this.hitCount,
      misses: this.missCount
    };
  }
}

export const productionCache = new ProductionCache();

// Cache middleware for Express routes
export function cacheMiddleware(ttlSeconds: number = 300) {
  return (req: any, res: any, next: any) => {
    const key = `route:${req.method}:${req.originalUrl}`;
    const cached = productionCache.get(key);
    
    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body: any) {
      productionCache.set(key, body, ttlSeconds);
      return originalJson.call(this, body);
    };

    next();
  };
}