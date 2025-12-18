import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });

console.log('🔧 Neon: HTTP mode via drizzle-orm/neon-http');

export async function checkDatabaseHealth() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export async function closeDatabaseConnections() {
  console.log('Database connections closed (HTTP mode - no persistent connections)');
}

// Compatibility layer for code that imports pool
// HTTP mode doesn't use a persistent pool, but we provide a full Pool-like interface
class HttpPoolCompatibility {
  private eventHandlers: Map<string, Function[]> = new Map();
  
  async query(textOrConfig: string | { text: string; values?: any[] }, params?: any[]) {
    let queryText: string;
    let queryParams: any[] | undefined;
    
    if (typeof textOrConfig === 'object') {
      queryText = textOrConfig.text;
      queryParams = textOrConfig.values;
    } else {
      queryText = textOrConfig;
      queryParams = params;
    }
    
    const result = await sql(queryText, queryParams || []);
    return { rows: result, rowCount: result.length };
  }
  
  async connect() {
    // Return a pseudo-client for HTTP mode that mimics pg.PoolClient
    const self = this;
    return {
      query: async (textOrConfig: string | { text: string; values?: any[] }, params?: any[]) => self.query(textOrConfig, params),
      release: () => { /* no-op */ },
      on: (_event: string, _handler: any) => { /* no-op */ }
    };
  }
  
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }
  
  async end() {
    // No-op for HTTP mode
  }
}

export const pool = new HttpPoolCompatibility();
