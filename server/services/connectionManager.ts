/**
 * Production Connection Manager
 * Implements connection pooling and automatic recovery for server stability
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export class ConnectionManager extends EventEmitter {
  private dbPool: Pool | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initialize();
  }

  private initialize() {
    this.setupDatabasePool();
    this.startHealthChecks();
  }

  private setupDatabasePool() {
    try {
      this.dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });

      this.dbPool.on('error', (err) => {
        console.error('Database pool error:', err);
        this.handleConnectionError();
      });

      this.dbPool.on('connect', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      console.log('✅ Database connection pool initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database pool:', error);
      this.handleConnectionError();
    }
  }

  private async handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.setupDatabasePool();
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
      if (this.dbPool) {
        const client = await this.dbPool.connect();
        await client.query('SELECT 1');
        client.release();
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.handleConnectionError();
    }
  }

  public async getConnection() {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }
    
    try {
      return await this.dbPool.connect();
    } catch (error) {
      console.error('Failed to get database connection:', error);
      throw error;
    }
  }

  public async executeQuery(query: string, params?: any[]) {
    const client = await this.getConnection();
    try {
      const result = await client.query(query, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async executeTransaction(queries: Array<{ query: string, params?: any[] }>) {
    const client = await this.getConnection();
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const { query, params } of queries) {
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public getStatus() {
    return {
      poolConnected: !!this.dbPool,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    };
  }

  public async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.dbPool) {
      await this.dbPool.end();
      this.dbPool = null;
    }
  }
}

export const connectionManager = new ConnectionManager();