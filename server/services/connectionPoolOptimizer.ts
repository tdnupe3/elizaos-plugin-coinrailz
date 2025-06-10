
/**
 * Database Connection Pool Optimizer for High-Scale Operations
 */

import { Pool } from 'pg';

export class ConnectionPoolOptimizer {
  private static pool: Pool | null = null;

  /**
   * Initialize optimized connection pool for scaling
   */
  static initializePool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Scaling-optimized pool settings
        max: 20, // Maximum connections
        min: 5,  // Minimum connections
        idle: 10000, // 10 seconds idle timeout
        connect_timeout: 60000, // 60 seconds connect timeout
        acquireTimeoutMillis: 30000, // 30 seconds acquire timeout
        
        // Health check configuration
        allowExitOnIdle: false,
        
        // Connection validation
        application_name: 'coinrailz_production',
        
        // Performance optimization
        statement_timeout: 30000, // 30 seconds
        query_timeout: 25000, // 25 seconds
        
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
