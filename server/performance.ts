/**
 * Performance Optimization Layer
 * Database query improvements and response optimization
 */

import { cache } from './cache';

export class PerformanceOptimizer {
  private responseTimeCache = new Map<string, number[]>();

  // Database query optimization wrapper
  static async optimizeQuery<T>(
    queryName: string,
    query: () => Promise<T>,
    cacheKey?: string,
    cacheTTL: number = 300
  ): Promise<T> {
    const start = Date.now();

    try {
      // Try cache first if key provided
      if (cacheKey) {
        const cached = await cache.get(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      // Execute query with stability wrapper
      const result = await query();

      // Cache successful results
      if (cacheKey) {
        await cache.set(cacheKey, result, cacheTTL);
      }

      const duration = Date.now() - start;
      console.log(`Query ${queryName}: ${duration}ms`);

      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      console.error(`Query ${queryName} failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  // Response compression for large JSON responses
  static compressResponse(data: any): any {
    if (!data || typeof data !== 'object') return data;

    // Remove null/undefined values to reduce payload
    const compressed = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value === null || value === undefined) return undefined;
      return value;
    }));

    return compressed;
  }

  // Batch database operations
  static async batchOperations<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(op => op())
      );
      results.push(...batchResults);
    }

    return results;
  }

  // Request deduplication for identical concurrent requests
  private static pendingRequests = new Map<string, Promise<any>>();

  static async deduplicateRequest<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = operation();
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  // Memory-efficient pagination
  static paginateResults<T>(
    results: T[],
    page: number = 1,
    limit: number = 20
  ): { data: T[]; total: number; page: number; pages: number } {
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);
    
    return {
      data,
      total: results.length,
      page,
      pages: Math.ceil(results.length / limit)
    };
  }

  // Track response times for optimization insights
  recordResponseTime(endpoint: string, duration: number) {
    if (!this.responseTimeCache.has(endpoint)) {
      this.responseTimeCache.set(endpoint, []);
    }

    const times = this.responseTimeCache.get(endpoint)!;
    times.push(duration);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  getPerformanceInsights() {
    const insights: any = {};

    for (const [endpoint, times] of this.responseTimeCache.entries()) {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);

      insights[endpoint] = {
        avg_ms: Math.round(avg),
        max_ms: max,
        min_ms: min,
        samples: times.length
      };
    }

    return insights;
  }

  // Cleanup for graceful shutdown
  cleanup() {
    this.responseTimeCache.clear();
    PerformanceOptimizer.pendingRequests.clear();
  }
}

export const performance = new PerformanceOptimizer();