
/**
 * Database Connection Pool Optimizer for High-Scale Operations
 * FIXED: Now uses the main Neon-compatible pool from db.ts
 */

import { pool, checkDatabaseHealth } from '../db';

export class ConnectionPoolOptimizer {
  private static poolStats = {
    queriesExecuted: 0,
    averageQueryTime: 0,
    errors: 0,
    lastHealthCheck: Date.now()
  };

  /**
   * Initialize optimized connection pool for scaling
   * Returns the main Neon-compatible pool
   */
  static initializePool() {
    return pool;
  }

  /**
   * Get pool statistics for monitoring
   */
  static getPoolStats() {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }

  /**
   * Health check for connection pool
   */
  static async healthCheck(): Promise<boolean> {
    return await checkDatabaseHealth();
  }
}
