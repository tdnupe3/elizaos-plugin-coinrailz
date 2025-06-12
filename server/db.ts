import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Production-ready Neon configuration
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false;
neonConfig.pipelineTLS = false;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Ultra-conservative connection pool for Neon stability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Single connection to prevent overload
  min: 0,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
  maxUses: 1000
});

export const db = drizzle({ client: pool, schema });

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});