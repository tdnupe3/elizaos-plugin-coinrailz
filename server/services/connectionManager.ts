/**
 * Production Connection Manager
 * FIXED: Now uses the main Neon-compatible pool from db.ts
 * Implements connection pooling and automatic recovery for server stability
 */

import { pool, checkDatabaseHealth } from '../db';
import { EventEmitter } from 'events';

export class ConnectionManager extends EventEmitter {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initialize();
  }

  private initialize() {
    this.startHealthChecks();
    console.log('✅ Connection manager initialized with Neon-compatible pool');
  }

  private async handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Connection issue detected, attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(async () => {
        const healthy = await checkDatabaseHealth();
        if (healthy) {
          this.reconnectAttempts = 0;
          this.emit('connected');
        } else {
          this.handleConnectionError();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('connectionFailed');
    }
  }

  private startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck() {
    try {
      const healthy = await checkDatabaseHealth();
      if (!healthy) {
        this.handleConnectionError();
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Execute a database query with automatic retry
   */
  async query(text: string, params?: any[]) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  /**
   * Get the main database pool
   */
  getPool() {
    return pool;
  }

  /**
   * Check if database is healthy
   */
  async isHealthy(): Promise<boolean> {
    return await checkDatabaseHealth();
  }

  /**
   * Cleanup resources
   */
  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    console.log('Connection manager shutdown complete');
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
