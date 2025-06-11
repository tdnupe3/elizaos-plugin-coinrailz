/**
 * Production Optimization Service
 * Implements caching, performance monitoring, and automatic scaling
 */

import { env } from '../environment';

interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastReset: Date;
}

interface CacheEntry {
  data: any;
  expiry: number;
  hits: number;
}

export class ProductionOptimizer {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    lastReset: new Date()
  };

  private cache: Map<string, CacheEntry> = new Map();
  private responseTimes: number[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.startMetricsCollection();
    this.startCacheCleanup();
  }

  /**
   * Start collecting performance metrics
   */
  private startMetricsCollection() {
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Update system performance metrics
   */
  private updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
    
    // Calculate average response time
    if (this.responseTimes.length > 0) {
      this.metrics.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      
      // Keep only last 1000 response times
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }
    }
  }

  /**
   * Record API request performance
   */
  recordRequest(responseTime: number, isError: boolean = false) {
    this.metrics.requestCount++;
    this.responseTimes.push(responseTime);
    
    if (isError) {
      this.metrics.errorCount++;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Cache data with automatic expiration
   */
  setCache(key: string, data: any, ttlSeconds: number = 300) {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, {
      data,
      expiry,
      hits: 0
    });
  }

  /**
   * Get cached data
   */
  getCache(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /**
   * Cache middleware for API responses
   */
  cacheMiddleware(ttlSeconds: number = 300) {
    return (req: any, res: any, next: any) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = `${req.url}:${JSON.stringify(req.query)}`;
      const cached = this.getCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache-Status', 'HIT');
        return res.json(cached);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(body: any) {
        if (res.statusCode === 200) {
          productionOptimizer.setCache(cacheKey, body, ttlSeconds);
        }
        res.setHeader('X-Cache-Status', 'MISS');
        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  performanceMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - start;
        const isError = res.statusCode >= 400;
        this.recordRequest(responseTime, isError);
      });

      next();
    };
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Remove expired cache entries
   */
  private cleanExpiredCache() {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiry) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let totalHits = 0;
    let activeEntries = 0;
    const now = Date.now();

    this.cache.forEach(entry => {
      if (now <= entry.expiry) {
        activeEntries++;
        totalHits += entry.hits;
      }
    });

    return {
      activeEntries,
      totalHits,
      cacheSize: this.cache.size,
      hitRate: totalHits > 0 ? (totalHits / (totalHits + this.metrics.requestCount)) : 0
    };
  }

  /**
   * Database connection pooling optimization
   */
  optimizeDatabaseConnections() {
    return {
      connectionLimit: env.NODE_ENV === 'production' ? 20 : 5,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true,
      reconnectTimeout: 2000,
      maxReconnects: 3
    };
  }

  /**
   * Rate limiting configuration for production
   */
  getProductionRateLimits() {
    if (env.NODE_ENV === 'production') {
      return {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: {
          error: 'Too many requests',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false
      };
    }
    
    // Development - very permissive
    return {
      windowMs: 1000,
      max: 10000,
      skip: () => true // Skip rate limiting in development
    };
  }

  /**
   * Memory usage monitoring and cleanup
   */
  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    const threshold = 0.9; // 90% memory usage threshold

    if (usage.heapUsed / usage.heapTotal > threshold) {
      console.warn('High memory usage detected, triggering cleanup');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear old cache entries more aggressively
      this.cleanExpiredCache();
      
      // Clear old response times
      this.responseTimes = this.responseTimes.slice(-100);
    }

    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      usagePercentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }

  /**
   * Reset metrics (useful for health checks)
   */
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastReset: new Date()
    };
    this.responseTimes = [];
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

export const productionOptimizer = new ProductionOptimizer();