
/**
 * Database Connection Pool Optimizer for High-Scale Operations
 */

import { Pool } from 'pg';

export class ConnectionPoolOptimizer {
  private static pool: Pool | null = null;
  private static poolStats = {
    queriesExecuted: 0,
    averageQueryTime: 0,
    errors: 0,
    lastHealthCheck: Date.now()
  };

  /**
   * Initialize optimized connection pool for scaling
   */
  static initializePool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Enhanced scaling-optimized pool settings
        max: 25, // Increased maximum connections
        min: 8,  // Increased minimum connections
        idle: 8000, // Reduced idle timeout for faster turnover
        connect_timeout: 45000, // Reduced connect timeout
        acquireTimeoutMillis: 20000, // Reduced acquire timeout
        
        // Health check configuration
        allowExitOnIdle: false,
        
        // Connection validation
        application_name: 'coinrailz_production_optimized',
        
        // Enhanced performance optimization
        statement_timeout: 25000, // Reduced statement timeout
        query_timeout: 20000, // Reduced query timeout
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
        
        // SSL configuration for production
        ssl: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false
        } : false
      });

      // Monitor pool events for scaling insights
      this.pool.on('connect', () => {
        console.log('Database connection established');
      });

      this.pool.on('error', (err) => {
        console.error('Database pool error:', err);
      });

      this.pool.on('remove', () => {
        console.log('Database connection removed from pool');
      });
    }

    return this.pool;
  }

  /**
   * Get pool statistics for monitoring
   */
  static getPoolStats() {
    if (!this.pool) return null;

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Health check for connection pool
   */
  static async healthCheck(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}
