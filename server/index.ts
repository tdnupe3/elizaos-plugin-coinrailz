// ============================================================================
// CRITICAL: FAST STARTUP FOR HEALTH CHECK COMPLIANCE
// ============================================================================
// Cloud Run/Autoscale requires / to respond with 200 within seconds.
// We MUST start listening BEFORE loading heavy modules.
// With esbuild --splitting, the dynamic import() of appMain.ts is kept as a
// separate chunk, so its module-level code runs AFTER listen() completes.
// ============================================================================

import express, { Router } from "express";
import http from "http";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const httpServer = http.createServer(app);

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers['accept'] || '';

  const isBrowserRequest = acceptHeader.includes('text/html') && 
                           !userAgent.includes('curl') && 
                           !userAgent.includes('health') && 
                           !userAgent.includes('kube') && 
                           !userAgent.includes('Replit') &&
                           !userAgent.includes('Uptime') &&
                           !userAgent.includes('Monitor');

  if (!isBrowserRequest) {
    return res.status(200).json({ 
      status: 'ok', 
      service: 'Coin Railz', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  next();
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SERVER LISTENING ON PORT ${port} - Health checks now responding`);
  console.log('🔄 Loading application modules in background...');
});

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
