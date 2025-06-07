/**
 * Database Performance Optimization Service
 * Implements caching, query optimization, and performance monitoring
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export class PerformanceOptimizer {
  private static cache = new Map<string, { data: any; expires: number }>();
  private static readonly CACHE_TTL = 300000; // 5 minutes

  /**
   * Create optimized database indexes for production performance
   */
  static async createProductionIndexes(): Promise<void> {
    const indexes = [
      // User-related indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_referral_code ON users(referral_code)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_account_status ON users(account_status)`,
      
      // Transaction indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id_created ON transactions(user_id, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status ON transactions(status)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)`,
      
      // AI Agent indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_ai_agents_status ON global_ai_agents(status)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_ai_agents_reputation ON global_ai_agents(reputation DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_ai_agents_created ON global_ai_agents(created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_ai_agents_referral ON global_ai_agents(referral_code)`,
      
      // Agent transaction indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_transactions_initiator ON agent_transactions(initiator_agent_id, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_transactions_recipient ON agent_transactions(recipient_agent_id, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_transactions_status ON agent_transactions(status)`,
      
      // Referral tracking indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_referrals_referrer ON agent_referrals(referrer_agent_id)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_referrals_referee ON agent_referrals(referee_agent_id)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_referrals_status ON agent_referrals(status)`,
      
      // Wallet balance indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_balances_user_currency ON wallet_balances(user_id, currency)`,
      
      // Violation tracking indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_violations_user_id ON user_violations(user_id, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_violations_type ON user_violations(violation_type)`,
    ];

    for (const indexQuery of indexes) {
      try {
        await db.execute(sql.raw(indexQuery));
        console.log(`Created index: ${indexQuery.split(' ')[5]}`);
      } catch (error) {
        console.warn(`Index creation warning: ${error}`);
      }
    }
  }

  /**
   * Cached query wrapper with automatic cache invalidation
   */
  static async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const data = await queryFn();
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });

    return data;
  }

  /**
   * Invalidate cache entries by pattern
   */
  static invalidateCache(pattern: string): void {
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Get optimized network statistics with caching
   */
  static async getOptimizedNetworkStats(): Promise<any> {
    return this.cachedQuery('network_stats', async () => {
      const [userCount, agentCount, transactionStats, totalVolume] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM users WHERE account_status = 'active'`),
        db.execute(sql`SELECT COUNT(*) as count FROM global_ai_agents WHERE status = 'active'`),
        db.execute(sql`
          SELECT 
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as daily_transactions
          FROM transactions
        `),
        db.execute(sql`
          SELECT 
            COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_volume
          FROM transactions 
          WHERE status = 'completed'
        `),
      ]);

      return {
        activeUsers: userCount.rows[0]?.count || 0,
        activeAgents: agentCount.rows[0]?.count || 0,
        totalTransactions: transactionStats.rows[0]?.total_transactions || 0,
        dailyTransactions: transactionStats.rows[0]?.daily_transactions || 0,
        totalVolume: totalVolume.rows[0]?.total_volume || '0',
      };
    }, 120000); // Cache for 2 minutes
  }

  /**
   * Get trending AI agents with optimized query
   */
  static async getTrendingAgents(limit: number = 10): Promise<any[]> {
    return this.cachedQuery(`trending_agents_${limit}`, async () => {
      const result = await db.execute(sql`
        SELECT 
          ga.*,
          COALESCE(COUNT(at.id), 0) as recent_transactions,
          COALESCE(SUM(CAST(at.amount AS DECIMAL)), 0) as recent_volume
        FROM global_ai_agents ga
        LEFT JOIN agent_transactions at ON ga.id = at.initiator_agent_id 
          AND at.created_at >= NOW() - INTERVAL '7 days'
          AND at.status = 'completed'
        WHERE ga.status = 'active'
        GROUP BY ga.id
        ORDER BY recent_volume DESC, ga.reputation DESC
        LIMIT ${limit}
      `);
      
      return result.rows;
    }, 300000); // Cache for 5 minutes
  }

  /**
   * Get user transaction history with pagination and caching
   */
  static async getUserTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const cacheKey = `user_transactions_${userId}_${page}_${limit}`;
    
    return this.cachedQuery(cacheKey, async () => {
      const [transactions, totalCount] = await Promise.all([
        db.execute(sql`
          SELECT 
            t.*,
            CASE 
              WHEN t.transaction_type = 'agent_payment' THEN ga.agent_name
              ELSE NULL
            END as agent_name
          FROM transactions t
          LEFT JOIN global_ai_agents ga ON t.metadata->>'agent_id' = ga.id
          WHERE t.user_id = ${userId}
          ORDER BY t.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute(sql`SELECT COUNT(*) as count FROM transactions WHERE user_id = ${userId}`),
      ]);

      return {
        transactions: transactions.rows,
        totalCount: totalCount.rows[0]?.count || 0,
        currentPage: page,
        totalPages: Math.ceil(Number(totalCount.rows[0]?.count || 0) / limit),
      };
    }, 60000); // Cache for 1 minute
  }

  /**
   * Performance monitoring and query analysis
   */
  static async analyzeQueryPerformance(): Promise<any> {
    const slowQueries = await db.execute(sql`
      SELECT 
        query,
        mean_exec_time,
        calls,
        total_exec_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);

    const tableStats = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables
      ORDER BY seq_tup_read DESC
      LIMIT 10
    `);

    return {
      slowQueries: slowQueries.rows,
      tableStats: tableStats.rows,
      recommendations: this.generateOptimizationRecommendations(slowQueries.rows, tableStats.rows),
    };
  }

  /**
   * Generate optimization recommendations based on query analysis
   */
  private static generateOptimizationRecommendations(slowQueries: any[], tableStats: any[]): string[] {
    const recommendations: string[] = [];

    // Check for missing indexes
    tableStats.forEach(table => {
      if (table.seq_scan > table.idx_scan && table.seq_tup_read > 1000) {
        recommendations.push(`Consider adding indexes to ${table.tablename} - high sequential scan ratio`);
      }
    });

    // Check for slow queries
    if (slowQueries.length > 0) {
      recommendations.push('Found slow queries - consider query optimization or additional caching');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Database performance looks good - no immediate optimizations needed');
    }

    return recommendations;
  }

  /**
   * Clear all cached data
   */
  static clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): any {
    return {
      totalEntries: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}