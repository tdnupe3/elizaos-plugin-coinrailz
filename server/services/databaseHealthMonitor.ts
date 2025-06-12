/**
 * Database Health Monitor - Production Stability Service
 * Monitors connection health and implements circuit breaker pattern
 */

import { pool } from '../db';

interface HealthMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  lastSuccessfulQuery: number;
  consecutiveFailures: number;
  isHealthy: boolean;
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private consecutiveFailures = 0;
  private lastHealthCheck = Date.now();
  private circuitBreakerOpen = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    console.log('Database health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`Database health check failed (${this.consecutiveFailures} consecutive failures):`, error);

      // Open circuit breaker after 3 consecutive failures
      if (this.consecutiveFailures >= 3) {
        this.circuitBreakerOpen = true;
        console.error('Database circuit breaker OPEN - degraded mode activated');
      }
    }
  }

  /**
   * Get current health metrics
   */
  getHealthMetrics(): HealthMetrics {
    return {
      totalConnections: pool.totalCount,
      activeConnections: pool.totalCount - pool.idleCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      lastSuccessfulQuery: this.lastHealthCheck,
      consecutiveFailures: this.consecutiveFailures,
      isHealthy: !this.circuitBreakerOpen && this.consecutiveFailures < 3
    };
  }

  /**
   * Execute query with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(queryFunction: () => Promise<T>): Promise<T> {
    if (this.circuitBreakerOpen) {
      throw new Error('Database circuit breaker is OPEN - service temporarily unavailable');
    }

    try {
      const result = await queryFunction();
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= 3) {
        this.circuitBreakerOpen = true;
      }
      
      throw error;
    }
  }

  /**
   * Force circuit breaker reset
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.consecutiveFailures = 0;
    console.log('Database circuit breaker manually reset');
  }
}

export const dbHealthMonitor = DatabaseHealthMonitor.getInstance();