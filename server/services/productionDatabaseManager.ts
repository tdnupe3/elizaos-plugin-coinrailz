/**
 * Production Database Manager - Comprehensive Stability Solution
 * Resolves connection timeout crashes and implements graceful degradation
 */

import { db, pool } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';

interface DatabaseOperation<T> {
  operation: () => Promise<T>;
  timeout?: number;
  retries?: number;
  fallback?: () => T;
}

class ProductionDatabaseManager {
  private static instance: ProductionDatabaseManager;
  private operationQueue: Array<() => Promise<any>> = [];
  private processingQueue = false;
  private circuitBreakerOpen = false;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly maxFailures = 3;
  private readonly circuitBreakerTimeout = 30000; // 30 seconds

  static getInstance(): ProductionDatabaseManager {
    if (!ProductionDatabaseManager.instance) {
      ProductionDatabaseManager.instance = new ProductionDatabaseManager();
    }
    return ProductionDatabaseManager.instance;
  }

  /**
   * Execute database operation with comprehensive error handling
   */
  async executeWithFallback<T>(config: DatabaseOperation<T>): Promise<T> {
    const { operation, timeout = 5000, retries = 2, fallback } = config;

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.lastFailureTime > this.circuitBreakerTimeout) {
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
      } else {
        if (fallback) {
          console.log('Circuit breaker open, using fallback');
          return fallback();
        }
        throw new Error('Database service temporarily unavailable - circuit breaker open');
      }
    }

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
        
        // Reset failure count on success
        this.failureCount = 0;
        return result;
        
      } catch (error: any) {
        console.error(`Database operation failed (attempt ${attempt}):`, error.message);
        
        if (attempt === retries + 1) {
          this.handleFailure();
          
          if (fallback) {
            console.log('All retries exhausted, using fallback');
            return fallback();
          }
          
          throw new Error(`Database operation failed after ${retries + 1} attempts: ${error.message}`);
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }

    throw new Error('Database operation failed');
  }

  /**
   * Handle database failures and circuit breaker logic
   */
  private handleFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.maxFailures) {
      this.circuitBreakerOpen = true;
      console.error('Database circuit breaker opened due to repeated failures');
    }
  }

  /**
   * Safe database query with automatic fallback
   */
  async safeQuery<T>(queryFn: () => Promise<T>, fallbackData?: T): Promise<T> {
    return this.executeWithFallback({
      operation: queryFn,
      timeout: 8000,
      retries: 2,
      fallback: fallbackData ? () => fallbackData : undefined
    });
  }

  /**
   * Queue database operations to prevent connection overload
   */
  async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          const result = await this.safeQuery(operation);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('Queued operation failed:', error);
        }
        
        // Small delay between operations to prevent connection flooding
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.processingQueue = false;
  }

  /**
   * Get database health status
   */
  getHealthStatus() {
    return {
      circuitBreakerOpen: this.circuitBreakerOpen,
      failureCount: this.failureCount,
      queueLength: this.operationQueue.length,
      poolStats: {
        totalConnections: pool.totalCount,
        activeConnections: pool.totalCount - pool.idleCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      }
    };
  }

  /**
   * Force reset circuit breaker (emergency use)
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    console.log('Database circuit breaker manually reset');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down database manager...');
    
    // Wait for queue to process
    while (this.operationQueue.length > 0 && this.processingQueue) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      await pool.end();
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }
}

export const productionDbManager = ProductionDatabaseManager.getInstance();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await productionDbManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await productionDbManager.shutdown();
  process.exit(0);
});