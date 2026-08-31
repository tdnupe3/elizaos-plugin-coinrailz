
/**
 * Database Stability Wrapper - Prevents database-related crashes
 */

import { db, pool } from '../db';

export class DatabaseStabilityWrapper {
  private static instance: DatabaseStabilityWrapper;
  private connectionHealthy = true;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds
  private operationQueue: Promise<void> = Promise.resolve();

  static getInstance(): DatabaseStabilityWrapper {
    if (!DatabaseStabilityWrapper.instance) {
      DatabaseStabilityWrapper.instance = new DatabaseStabilityWrapper();
    }
    return DatabaseStabilityWrapper.instance;
  }

  /**
   * Execute database query with stability protection
   */
  async safeQuery<T>(
    queryFn: () => Promise<T>,
    context: string = 'database_query'
  ): Promise<T | null> {
    // Check connection health periodically
    await this.checkConnectionHealth();
    
    if (!this.connectionHealthy) {
      console.error('Database connection unhealthy, skipping query');
      return null;
    }

    return this.queueDatabaseOperation(async () => {
      try {
        return await queryFn();
      } catch (error: any) {
        console.error(`Database query failed in ${context}:`, error);
        
        // Check if it's a connection error
        if (error.message?.includes('connection') || error.code === 'ECONNRESET') {
          this.connectionHealthy = false;
          console.error('Database connection marked as unhealthy');
        }
        
        throw error;
      }
    });
  }

  /**
   * Serialize database work so transient connection failures cannot cause a
   * burst of competing retries against the same pool.
   */
  private async queueDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue;
    let release!: () => void;
    this.operationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  /**
   * Check database connection health
   */
  private async checkConnectionHealth(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }
    
    this.lastHealthCheck = now;
    
    try {
      await pool.query('SELECT 1');
      if (!this.connectionHealthy) {
        console.log('Database connection restored');
        this.connectionHealthy = true;
      }
    } catch (error) {
      console.error('Database health check failed:', error);
      this.connectionHealthy = false;
    }
  }

  /**
   * Get wrapper for database operations
   */
  wrapDatabaseOperation<T>(operation: () => Promise<T>, context: string) {
    return () => this.safeQuery(operation, context);
  }

  /**
   * Force connection health check
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastHealthCheck = 0;
    await this.checkConnectionHealth();
    return this.connectionHealthy;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      healthy: this.connectionHealthy,
      lastCheck: new Date(this.lastHealthCheck),
      poolStatus: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  }
}

export const dbStability = DatabaseStabilityWrapper.getInstance();
