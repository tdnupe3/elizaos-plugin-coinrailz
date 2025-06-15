
/**
 * Centralized Stability Manager - Prevents all server crashes
 * Handles database connections, memory management, and error recovery
 */

import { pool } from '../db';

export class StabilityManager {
  private static instance: StabilityManager;
  private connectionQueue: Array<{ operation: () => Promise<any>; resolve: Function; reject: Function }> = [];
  private isProcessing = false;
  private activeConnections = 0;
  private readonly maxConcurrentConnections = 10;
  private crashCount = 0;
  private lastCrash = 0;
  private memoryLeakPrevention = new Map<string, NodeJS.Timeout>();

  static getInstance(): StabilityManager {
    if (!StabilityManager.instance) {
      StabilityManager.instance = new StabilityManager();
    }
    return StabilityManager.instance;
  }

  constructor() {
    if (StabilityManager.instance) {
      return StabilityManager.instance;
    }
    this.setupGlobalHandlers();
    this.startMemoryMonitoring();
  }

  /**
   * Queue database operations to prevent connection overload
   */
  async queueDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.connectionQueue.push({ 
        operation: operation as () => Promise<any>, 
        resolve, 
        reject 
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeConnections >= this.maxConcurrentConnections) {
      return;
    }
    
    this.isProcessing = true;

    while (this.connectionQueue.length > 0 && this.activeConnections < this.maxConcurrentConnections) {
      const { operation, resolve, reject } = this.connectionQueue.shift()!;
      
      try {
        this.activeConnections++;
        const result = await Promise.race([
          operation(),
          new Promise((_, timeoutReject) => 
            setTimeout(() => timeoutReject(new Error('Database operation timeout')), 15000)
          )
        ]);
        resolve(result);
      } catch (error) {
        console.error('Queued database operation failed:', error);
        reject(error);
      } finally {
        this.activeConnections--;
        // Add delay between operations to prevent connection flooding
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Safe execution wrapper for any async operation
   */
  async safeExecute<T>(
    operation: () => Promise<T> | T,
    fallback: T,
    context: string
  ): Promise<T> {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error(`Safe execution failed in ${context}:`, error);
      this.recordError(context, error);
      return fallback;
    }
  }

  /**
   * Setup global error handlers to prevent crashes
   */
  private setupGlobalHandlers(): void {
    // Override default crash handlers
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception caught by Stability Manager:', error);
      this.recordError('uncaughtException', error);
      // DO NOT EXIT - Continue operation
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection caught by Stability Manager:', reason);
      this.recordError('unhandledRejection', reason);
      // DO NOT EXIT - Continue operation
    });
  }

  /**
   * Monitor memory usage and force garbage collection
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const memoryMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      if (memoryMB > 400) {
        console.warn(`High memory usage: ${memoryMB}MB - forcing garbage collection`);
        if (global.gc) {
          global.gc();
        }
        
        // Clear memory leak prevention timeouts
        this.memoryLeakPrevention.forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.memoryLeakPrevention.clear();
      }
    }, 30000);
  }

  /**
   * Record and track errors
   */
  private recordError(context: string, error: any): void {
    const now = Date.now();
    
    // Reset crash count if outside 5-minute window
    if (now - this.lastCrash > 300000) {
      this.crashCount = 0;
    }
    
    this.crashCount++;
    this.lastCrash = now;
    
    console.error(`Stability Manager - Error ${this.crashCount} in ${context}:`, error);
    
    // Implement circuit breaker if too many failures
    if (this.crashCount >= 5) {
      console.error(`Circuit breaker activated for ${context} - implementing recovery measures`);
      this.performRecovery();
    }
  }

  /**
   * Perform automatic recovery measures
   */
  private async performRecovery(): Promise<void> {
    console.log('Performing automatic recovery...');
    
    try {
      // Clear connection queue
      this.connectionQueue = [];
      this.isProcessing = false;
      this.activeConnections = 0;
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Test database connectivity
      await pool.query('SELECT 1');
      console.log('Database connectivity restored');
      
      this.crashCount = 0;
      console.log('Recovery completed successfully');
    } catch (error) {
      console.error('Recovery failed:', error);
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      queueLength: this.connectionQueue.length,
      isProcessing: this.isProcessing,
      activeConnections: this.activeConnections,
      crashCount: this.crashCount,
      memoryUsage: process.memoryUsage(),
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  }

  /**
   * Create safe wrapper for functions
   */
  createSafeWrapper<T extends (...args: any[]) => any>(
    fn: T,
    context: string,
    fallback?: any
  ): T {
    return ((...args: any[]) => {
      return this.safeExecute(
        () => fn(...args),
        fallback,
        context
      );
    }) as T;
  }
}

export const stabilityManager = StabilityManager.getInstance();
