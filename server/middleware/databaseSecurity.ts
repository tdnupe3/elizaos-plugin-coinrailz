/**
 * Database Security and Connection Pool Management
 * Prevents connection exhaustion attacks and manages database resources
 */

import { pool } from '../db';

interface ConnectionMetrics {
  activeConnections: number;
  totalConnections: number;
  queuedRequests: number;
  avgResponseTime: number;
  errorRate: number;
}

export class DatabaseSecurity {
  private static connectionCount = 0;
  private static queryTimes: number[] = [];
  private static errorCount = 0;
  private static totalQueries = 0;
  private static readonly MAX_CONNECTIONS = 50;
  private static readonly MAX_QUERY_TIME = 30000; // 30 seconds
  private static readonly SLOW_QUERY_THRESHOLD = 5000; // 5 seconds

  /**
   * Monitor database connection health
   */
  static async getConnectionMetrics(): Promise<ConnectionMetrics> {
    try {
      const poolInfo = pool as any;
      const activeConnections = poolInfo.totalCount || 0;
      const queuedRequests = poolInfo.waitingCount || 0;
      
      const avgResponseTime = this.queryTimes.length > 0 
        ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length 
        : 0;
      
      const errorRate = this.totalQueries > 0 
        ? (this.errorCount / this.totalQueries) * 100 
        : 0;

      return {
        activeConnections,
        totalConnections: this.connectionCount,
        queuedRequests,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(errorRate * 100) / 100
      };
    } catch (error) {
      console.error('Failed to get connection metrics:', error);
      return {
        activeConnections: 0,
        totalConnections: 0,
        queuedRequests: 0,
        avgResponseTime: 0,
        errorRate: 100
      };
    }
  }

  /**
   * Middleware to track and limit database connections
   */
  static connectionLimiter() {
    return async (req: any, res: any, next: any) => {
      if (this.connectionCount >= this.MAX_CONNECTIONS) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Database connection limit reached',
          retryAfter: 30
        });
      }

      this.connectionCount++;
      
      // Set up connection cleanup
      res.on('finish', () => {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
      });

      next();
    };
  }

  /**
   * Query performance monitoring
   */
  static monitorQuery<T>(queryPromise: Promise<T>, queryName: string): Promise<T> {
    const startTime = Date.now();
    this.totalQueries++;

    return queryPromise
      .then((result) => {
        const queryTime = Date.now() - startTime;
        this.trackQueryPerformance(queryTime, queryName);
        return result;
      })
      .catch((error) => {
        const queryTime = Date.now() - startTime;
        this.errorCount++;
        this.trackQueryPerformance(queryTime, queryName, error);
        throw error;
      });
  }

  /**
   * Track query performance metrics
   */
  private static trackQueryPerformance(
    queryTime: number, 
    queryName: string, 
    error?: any
  ): void {
    // Keep rolling average of last 100 queries
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }

    // Log slow queries
    if (queryTime > this.SLOW_QUERY_THRESHOLD) {
      console.warn(`Slow query detected: ${queryName} took ${queryTime}ms`);
    }

    // Log query timeouts
    if (queryTime > this.MAX_QUERY_TIME) {
      console.error(`Query timeout: ${queryName} exceeded ${this.MAX_QUERY_TIME}ms`);
    }

    // Log errors
    if (error) {
      console.error(`Query error in ${queryName}:`, error);
    }
  }

  /**
   * Prevent SQL injection in dynamic queries
   */
  static sanitizeQueryInput(input: any): any {
    if (typeof input === 'string') {
      // Remove dangerous SQL keywords and characters
      return input
        .replace(/['"\\;]/g, '') // Remove quotes and semicolons
        .replace(/\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC|UNION|SELECT)\b/gi, '') // Remove SQL keywords
        .trim()
        .substring(0, 255); // Limit length
    }
    
    if (typeof input === 'number') {
      return isFinite(input) ? input : 0;
    }
    
    return input;
  }

  /**
   * Database health check
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple query to test connection
      await pool.query('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      const metrics = await this.getConnectionMetrics();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (responseTime > 1000 || metrics.errorRate > 10) {
        status = 'degraded';
      }
      
      if (responseTime > 5000 || metrics.errorRate > 25) {
        status = 'unhealthy';
      }
      
      return {
        status,
        details: {
          responseTime,
          ...metrics,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Emergency circuit breaker for database issues
   */
  static circuitBreaker() {
    let failureCount = 0;
    let lastFailureTime = 0;
    const FAILURE_THRESHOLD = 10;
    const RECOVERY_TIMEOUT = 60000; // 1 minute

    return async (req: any, res: any, next: any) => {
      const now = Date.now();
      
      // Reset failure count after recovery timeout
      if (now - lastFailureTime > RECOVERY_TIMEOUT) {
        failureCount = 0;
      }
      
      // Check if circuit breaker is open
      if (failureCount >= FAILURE_THRESHOLD) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Database circuit breaker is open',
          retryAfter: Math.ceil((RECOVERY_TIMEOUT - (now - lastFailureTime)) / 1000)
        });
      }
      
      // Monitor response for failures
      res.on('finish', () => {
        if (res.statusCode >= 500) {
          failureCount++;
          lastFailureTime = now;
        }
      });
      
      next();
    };
  }
}

export default DatabaseSecurity;