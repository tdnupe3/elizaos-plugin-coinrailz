// ============================================================================
// CRITICAL: FAST STARTUP FOR HEALTH CHECK COMPLIANCE
// ============================================================================
// Cloud Run/Autoscale requires / to respond with 200 within seconds.
// We MUST start listening BEFORE loading heavy modules.
// ============================================================================

import express, { Router } from "express";
import http from "http";

// Create Express app and HTTP server IMMEDIATELY
const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const httpServer = http.createServer(app);

// Readiness flag - frontend is NOT ready until appMain completes setup
let frontendReady = false;
export function markFrontendReady() {
  frontendReady = true;
  console.log('✅ Frontend ready - / will now serve the app');
}

// CRITICAL: Health check endpoints FIRST - before ANY other code
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res, next) => {
  // If frontend is not ready yet, ALWAYS return 200 for health checks
  if (!frontendReady) {
    return res.status(200).send(`<!DOCTYPE html><html><head><title>Coin Railz</title><meta http-equiv="refresh" content="3"></head><body><p>Loading...</p></body></html>`);
  }
  
  // Frontend is ready - pass to Vite/static handler
  next();
});

// START LISTENING IMMEDIATELY - before loading heavy modules
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SERVER LISTENING ON PORT ${port} - Health checks now responding`);
  console.log('🔄 Loading application modules in background...');
});

// Defer heavy application loading so health checks respond instantly
setTimeout(async () => {
  try {
    await import('./appMain.js');
    console.log('✅ Full application loaded and initialized');
  } catch (err) {
    console.error('❌ Failed to load application:', err);
  }
}, 0);

export { app, httpServer, port };
export default app;
