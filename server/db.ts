import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Simple Neon configuration
neonConfig.webSocketConstructor = ws;

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
  max: 20, // Maximum number of connections in the pool
});

// Critical: Add pool error handling to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // Don't exit process, just log the error
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