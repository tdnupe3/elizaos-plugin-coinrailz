/**
 * Performance Optimizer - Maintains all functionality while improving efficiency
 * Fixes duplicate imports, memory leaks, and performance bottlenecks
 */

// Cache frequently used services to avoid repeated instantiation
const serviceCache = new Map();

export function getCachedService<T>(serviceKey: string, factory: () => T): T {
  if (!serviceCache.has(serviceKey)) {
    serviceCache.set(serviceKey, factory());
  }
  return serviceCache.get(serviceKey);
}

// Optimize database connections with connection pooling
export class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: any[] = [];
  private maxConnections = 10;

  static getInstance() {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  async getConnection() {
    if (this.connections.length > 0) {
      return this.connections.pop();
    }
    // Return new connection if pool is empty
    return this.createConnection();
  }

  async releaseConnection(connection: any) {
    if (this.connections.length < this.maxConnections) {
      this.connections.push(connection);
    } else {
      // Close connection if pool is full
      await connection.close();
    }
  }

  private createConnection() {
    // Use existing db connection from db.ts
    return require('./db').db;
  }
}

// Request deduplication to prevent duplicate processing
export class RequestDeduplicator {
  private pendingRequests = new Map();
  private requestTimeout = 30000; // 30 seconds

  async deduplicate<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = operation();
    this.pendingRequests.set(key, promise);

    // Clean up after completion or timeout
    setTimeout(() => {
      this.pendingRequests.delete(key);
    }, this.requestTimeout);

    try {
      const result = await promise;
      this.pendingRequests.delete(key);
      return result;
    } catch (error) {
      this.pendingRequests.delete(key);
      throw error;
    }
  }
}

// Memory-efficient response caching
export class ResponseCache {
  private cache = new Map();
  private maxCacheSize = 1000;
  private cacheTimeout = 300000; // 5 minutes

  set(key: string, value: any, customTimeout?: number) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const timeout = customTimeout || this.cacheTimeout;
    const entry = {
      value,
      timestamp: Date.now(),
      timeout
    };

    this.cache.set(key, entry);
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.timeout) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }
}

// Efficient error handling that doesn't block the event loop
export class AsyncErrorHandler {
  static handle(error: any, context: string) {
    // Log error asynchronously
    setImmediate(() => {
      console.error(`[${context}] Error:`, error);
      // Could send to monitoring service here
    });
  }

  static async safeExecute<T>(
    operation: () => Promise<T>, 
    fallback: T, 
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error, context);
      return fallback;
    }
  }
}

// Batch operations to reduce database load
export class BatchProcessor {
  private batches = new Map();
  private batchSize = 50;
  private flushInterval = 1000; // 1 second

  constructor() {
    // Periodically flush batches
    setInterval(() => {
      this.flushAllBatches();
    }, this.flushInterval);
  }

  addToBatch(batchKey: string, item: any, processor: (items: any[]) => Promise<void>) {
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, {
        items: [],
        processor
      });
    }

    const batch = this.batches.get(batchKey);
    batch.items.push(item);

    if (batch.items.length >= this.batchSize) {
      this.flushBatch(batchKey);
    }
  }

  private async flushBatch(batchKey: string) {
    const batch = this.batches.get(batchKey);
    if (batch && batch.items.length > 0) {
      try {
        await batch.processor(batch.items);
        batch.items = [];
      } catch (error) {
        AsyncErrorHandler.handle(error, `BatchProcessor.${batchKey}`);
      }
    }
  }

  private async flushAllBatches() {
    const batchKeys = Array.from(this.batches.keys());
    for (const batchKey of batchKeys) {
      await this.flushBatch(batchKey);
    }
  }
}

// Lazy loading for services to reduce startup time
export class LazyServiceLoader {
  private services = new Map();

  register<T>(name: string, factory: () => T) {
    this.services.set(name, { factory, instance: null });
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }

    if (!service.instance) {
      service.instance = service.factory();
    }

    return service.instance;
  }
}

// Export singleton instances
export const requestDeduplicator = new RequestDeduplicator();
export const responseCache = new ResponseCache();
export const batchProcessor = new BatchProcessor();
export const lazyLoader = new LazyServiceLoader();

// Performance monitoring
export class PerformanceMonitor {
  private metrics = new Map();

  startTimer(operation: string) {
    this.metrics.set(operation, Date.now());
  }

  endTimer(operation: string) {
    const startTime = this.metrics.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.metrics.delete(operation);
      
      if (duration > 1000) { // Log slow operations
        console.warn(`Slow operation detected: ${operation} took ${duration}ms`);
      }
      
      return duration;
    }
    return 0;
  }

  async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(operation);
      return result;
    } catch (error) {
      this.endTimer(operation);
      throw error;
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();