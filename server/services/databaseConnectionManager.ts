/**
 * Database Connection Manager - Production Stability
 * Handles connection pooling, timeouts, and graceful degradation
 */

import { Pool } from '@neondatabase/serverless';

class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connectionQueue: Array<{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = [];
  private activeConnections = 0;
  private readonly maxConcurrentConnections = 2;
  private readonly connectionTimeout = 10000;

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Acquire a database connection with queue management
   */
  async acquireConnection<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeConnections < this.maxConcurrentConnections) {
      return this.executeOperation(operation);
    }

    // Queue the request if at connection limit
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.connectionQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.connectionQueue.splice(index, 1);
        }
        reject(new Error('Database connection timeout - service temporarily unavailable'));
      }, this.connectionTimeout);

      this.connectionQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Execute database operation with connection management
   */
  private async executeOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.activeConnections++;
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 8000)
        )
      ]);
      
      return result;
    } catch (error) {
      console.error('Database operation failed:', error);
      throw error;
    } finally {
      this.activeConnections--;
      this.processQueue();
    }
  }

  /**
   * Process queued connection requests
   */
  private processQueue(): void {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.maxConcurrentConnections) {
      const { resolve, reject, timeout } = this.connectionQueue.shift()!;
      clearTimeout(timeout);
      
      this.executeOperation(async () => {
        // This will be replaced by the actual operation when resolve is called
        return new Promise<any>((res, rej) => {
          resolve({ execute: res, error: rej });
        });
      }).catch(reject);
    }
  }

  /**
   * Get connection manager statistics
   */
  getStats() {
    return {
      activeConnections: this.activeConnections,
      queuedRequests: this.connectionQueue.length,
      maxConcurrentConnections: this.maxConcurrentConnections
    };
  }

  /**
   * Clear connection queue (emergency reset)
   */
  clearQueue(): void {
    this.connectionQueue.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection queue cleared'));
    });
    this.connectionQueue = [];
  }
}

export const dbConnectionManager = DatabaseConnectionManager.getInstance();