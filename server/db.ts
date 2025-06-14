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

// Optimized connection pool for production stability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3, // Increased for concurrent operations
  min: 1, // Keep one connection alive
  idleTimeoutMillis: 30000, // Extended idle timeout
  connectionTimeoutMillis: 15000, // Extended connection timeout
  allowExitOnIdle: false, // Keep connections alive
  maxUses: 500, // Reduced reuse count
  maxLifetimeSeconds: 300 // 5 minute connection lifetime
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