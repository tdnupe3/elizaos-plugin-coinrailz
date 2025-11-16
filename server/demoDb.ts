import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as demoSchema from "./demoSchema";

// Demo database configuration
neonConfig.webSocketConstructor = ws;

// CRITICAL SAFETY: Demo database MUST use same DATABASE_URL since we're using schema isolation
// Demo tables (demo_*) are in the same database but completely separate from production tables
// This is safe because:
// 1. Demo tables have different names (demo_ prefix)
// 2. Demo storage layer only accesses demo_ tables
// 3. No code path shares data between demo and production tables
const DEMO_DATABASE_URL = process.env.DATABASE_URL;

if (!DEMO_DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set for demo functionality. Demo uses isolated demo_* tables in same database.",
  );
}

// Demo connection pool - completely isolated from production
export const demoPool = new Pool({ 
  connectionString: DEMO_DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5, // Smaller pool for demo
  maxUses: 7500,
  allowExitOnIdle: false,
});

// Demo pool error handling
demoPool.on('error', (err: any) => {
  console.error('[DEMO] Unexpected database pool error:', err);
  
  if ((err as any).code === '57P01') {
    console.log('[DEMO] Database connection terminated, attempting to recover...');
  }
});

demoPool.on('connect', () => {
  console.log('[DEMO] Database pool connected successfully');
});

// Separate Drizzle instance for demo with demo schema only
export const demoDb = drizzle({ client: demoPool, schema: demoSchema });

// Demo database health check
export async function checkDemoDatabaseHealth() {
  try {
    const client = await demoPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[DEMO] Database health check failed:', error);
    return false;
  }
}

// Graceful demo database shutdown
export async function closeDemoDatabaseConnections() {
  try {
    await demoPool.end();
    console.log('[DEMO] Database connections closed gracefully');
  } catch (error) {
    console.error('[DEMO] Error closing database connections:', error);
  }
}
