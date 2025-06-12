/**
 * Production Crash Prevention System
 * Comprehensive solution for database connection stability
 */

import { pool } from '../db';

class CrashPreventionSystem {
  private static instance: CrashPreventionSystem;
  private connectionQueue: Array<{ operation: () => Promise<any>; resolve: Function; reject: Function }> = [];
  private isProcessing = false;
  private activeConnections = 0;
  private readonly maxConcurrentConnections = 1;

  static getInstance(): CrashPreventionSystem {
    if (!CrashPreventionSystem.instance) {
      CrashPreventionSystem.instance = new CrashPreventionSystem();
    }
    return CrashPreventionSystem.instance;
  }

  /**
   * Queue database operations to prevent connection overload
   */
  async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.connectionQueue.push({ 
        operation: operation as () => Promise<any>, 
        resolve, 
        reject 
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.connectionQueue.length > 0) {
      const { operation, resolve, reject } = this.connectionQueue.shift()!;
      
      try {
        this.activeConnections++;
        const result = await Promise.race([
          operation(),
          new Promise((_, timeoutReject) => 
            setTimeout(() => timeoutReject(new Error('Operation timeout')), 5000)
          )
        ]);
        resolve(result);
      } catch (error) {
        console.error('Queued database operation failed:', error);
        reject(error);
      } finally {
        this.activeConnections--;
        // Add delay between operations to prevent connection flooding
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Safe database query with automatic queuing
   */
  async safeQuery<T>(queryFunction: () => Promise<T>): Promise<T> {
    return this.queueOperation(queryFunction);
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      queueLength: this.connectionQueue.length,
      isProcessing: this.isProcessing,
      activeConnections: this.activeConnections,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  }

  /**
   * Emergency queue clear
   */
  clearQueue(): void {
    this.connectionQueue.forEach(({ reject }) => {
      reject(new Error('Queue cleared due to system reset'));
    });
    this.connectionQueue = [];
    this.isProcessing = false;
  }
}

export const crashPrevention = CrashPreventionSystem.getInstance();