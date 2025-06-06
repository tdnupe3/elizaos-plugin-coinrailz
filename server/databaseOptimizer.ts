/**
 * Database Performance Optimization Service
 * Adds indexes and query optimization for production-grade performance
 */

import { db } from "./db";

export class DatabaseOptimizer {
  /**
   * Create optimized indexes for frequently queried tables
   */
  static async createOptimizedIndexes(): Promise<void> {
    try {
      // Index for user wallet lookups (most frequent query)
      await db.execute(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_balances_user_currency 
        ON wallet_balances(user_id, currency);
      `);

      // Index for transaction history queries
      await db.execute(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created 
        ON transactions(from_user_id, created_at DESC);
      `);

      // Index for agent discovery (public API)
      await db.execute(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_status_active 
        ON global_ai_agents(status, last_active DESC) 
        WHERE status = 'active';
      `);

      // Index for referral system queries
      await db.execute(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_referrals_referrer 
        ON agent_referrals(referrer_agent_id, created_at DESC);
      `);

      // Index for transaction volume calculations
      await db.execute(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_transactions_volume 
        ON agent_transactions(status, created_at, amount) 
        WHERE status = 'completed';
      `);

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
    }
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  static async analyzeQueryPerformance(): Promise<any> {
    try {
      // Get slow query statistics
      const slowQueries = await db.execute(`
        SELECT query, mean_exec_time, calls, total_exec_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > 1000 
        ORDER BY mean_exec_time DESC 
        LIMIT 10;
      `);

      // Get table sizes
      const tableSizes = await db.execute(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY size_bytes DESC;
      `);

      return {
        slowQueries,
        tableSizes,
        recommendations: this.generateOptimizationRecommendations()
      };
    } catch (error) {
      console.error('Error analyzing query performance:', error);
      return { error: 'Unable to analyze query performance' };
    }
  }

  /**
   * Generate optimization recommendations
   */
  private static generateOptimizationRecommendations(): string[] {
    return [
      'Enable pg_stat_statements extension for query monitoring',
      'Consider partitioning large transaction tables by date',
      'Implement connection pooling for high-concurrency scenarios',
      'Add VACUUM and ANALYZE scheduled maintenance',
      'Monitor and optimize JOIN operations in complex queries',
      'Consider read replicas for analytics workloads',
      'Implement proper backup and recovery procedures'
    ];
  }

  /**
   * Database health check
   */
  static async performHealthCheck(): Promise<any> {
    try {
      // Check connection
      const connectionTest = await db.execute('SELECT 1 as status');
      
      // Check active connections
      const connections = await db.execute(`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active';
      `);

      // Check database size
      const dbSize = await db.execute(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
      `);

      return {
        status: 'healthy',
        connectionTest: connectionTest.rows[0],
        activeConnections: connections.rows[0],
        databaseSize: dbSize.rows[0],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }
}