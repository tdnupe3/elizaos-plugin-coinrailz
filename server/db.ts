import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon to use WebSockets in Node.js environment
neonConfig.webSocketConstructor = ws;

// Pool config: explicit limits + timeouts for Neon WebSocket resilience.
// Neon WS pools experience idle disconnects more frequently than raw TCP —
// idleTimeoutMillis forces clean recycling before the server-side timeout hits.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 20000,      // recycle idle connections at 20s (before Neon's ~30s WS timeout)
  connectionTimeoutMillis: 5000, // fail fast if we can't acquire a connection in 5s
});

// Pool-level error handler — catches idle client errors (e.g. Neon WS drops on
// idle connections) before they propagate as uncaughtExceptions.
// Classification: transient errors are logged as warnings; persistent/config
// errors escalate after a sustained burst.
let _poolErrorCount = 0;
let _poolErrorWindowStart = Date.now();
const POOL_ERROR_WINDOW_MS = 60_000; // 1 minute window
const POOL_ERROR_THRESHOLD = 5;      // >5 errors/min = likely persistent failure

// True network/socket transients — Neon WS idle drops, connection resets.
// Do NOT include config/lifecycle defects here (enotfound = DNS/config issue,
// 'client has already been connected' = app-layer lifecycle bug — both should
// surface as errors so they are actionable, not silently swallowed).
const TRANSIENT_POOL_ERRORS = [
  'connection terminated unexpectedly',
  'connection timeout',
  'read econnreset',
  'socket hang up',
  'write econnaborted',
];

function isTransientPoolError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return TRANSIENT_POOL_ERRORS.some(pattern => msg.includes(pattern));
}

pool.on('error', (err: Error) => {
  const now = Date.now();

  // Reset burst counter every window
  if (now - _poolErrorWindowStart > POOL_ERROR_WINDOW_MS) {
    _poolErrorCount = 0;
    _poolErrorWindowStart = now;
  }
  _poolErrorCount++;

  if (isTransientPoolError(err)) {
    console.warn(`⚠️ DB pool transient error (swallowed — Neon WS reconnect expected): ${err.message}`);
  } else {
    console.error(`❌ DB pool error: ${err.message}`);
  }

  if (_poolErrorCount >= POOL_ERROR_THRESHOLD) {
    console.error(`🚨 DB pool error threshold exceeded: ${_poolErrorCount} errors in last minute — possible sustained DB failure`);
  }
  // Do NOT throw — throwing from pool.on('error') would become an uncaughtException
});

// Initialize Drizzle ORM with the pool
export const db = drizzle({ client: pool, schema });

console.log('🔧 Neon: WebSocket mode via drizzle-orm/neon-serverless (transactions enabled)');

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

export async function closeDatabaseConnections() {
  try {
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}
