import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon based on environment
// Production uses HTTP fetch mode to avoid the Neon/esbuild WebSocket bundling bug:
// "Cannot set property message of # which has only a getter"
// See: https://github.com/brianc/node-postgres/issues/3373
if (process.env.NODE_ENV === 'production') {
  neonConfig.fetchConnectionCache = true;
  neonConfig.poolQueryViaFetch = true;
} else {
  // Development: Use WebSocket for better performance
  neonConfig.webSocketConstructor = ws;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool with error handling and timeout
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // 10 second timeout
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  max: 10, // Reduced max connections for Neon compatibility
  maxUses: 7500, // Limit connection reuse for stability
  allowExitOnIdle: false, // Keep pool alive during low activity
});

// Critical: Add pool error handling to prevent crashes
pool.on('error', (err: any) => {
  console.error('Unexpected database pool error:', err);
  // Don't exit process, just log the error and attempt recovery
  
  // Attempt to recover from connection termination
  if ((err as any).code === '57P01') {
    console.log('Database connection terminated, attempting to recover...');
    // Connection will be automatically re-established on next query
  }
});

pool.on('connect', () => {
  console.log('Database pool connected successfully');
});

export const db = drizzle({ client: pool, schema });

// Database health check function
export async function checkDatabaseHealth() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful database shutdown
export async function closeDatabaseConnections() {
  try {
    await pool.end();
    console.log('Database connections closed gracefully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}