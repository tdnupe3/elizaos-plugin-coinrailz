// ============================================================================
// CRITICAL: FAST STARTUP FOR HEALTH CHECK COMPLIANCE
// ============================================================================
// Cloud Run/Autoscale requires / to respond with 200 within seconds.
// We MUST start listening BEFORE loading heavy modules.
// ============================================================================

// Global exception handlers MUST be first — before any imports that could throw
process.on('uncaughtException', (err: Error) => {
  console.error('⚠️ Uncaught Exception (process kept alive):', err.message);
  // Do NOT exit — health checks must keep passing in production
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('⚠️ Unhandled Rejection (process kept alive):', reason);
  // Do NOT exit — health checks must keep passing in production
});

import express, { Router } from "express";
import http from "http";
import path from "path";
import fs from "fs";

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

// Pre-read the built index.html for serving during startup (single source of truth for OG tags)
const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
let fallbackHtml = '';
if (isProduction) {
  const distIndexPath = path.resolve(process.cwd(), 'dist', 'public', 'index.html');
  try {
    fallbackHtml = fs.readFileSync(distIndexPath, 'utf-8');
    console.log('✅ Loaded dist/public/index.html for startup fallback (with OG tags)');
  } catch {
    // Fallback if dist not found - include essential OG tags
    const srcIndexPath = path.resolve(process.cwd(), 'client', 'index.html');
    try {
      fallbackHtml = fs.readFileSync(srcIndexPath, 'utf-8');
      console.log('✅ Loaded client/index.html for startup fallback (with OG tags)');
    } catch {
      fallbackHtml = `<!DOCTYPE html><html><head><title>Coin Railz</title>
<meta property="og:title" content="Coin Railz - Micropayment Rail for AI Agents">
<meta property="og:image" content="https://coinrailz.com/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
</head><body><p>Loading...</p></body></html>`;
      console.log('⚠️ Using minimal fallback HTML (index.html not found)');
    }
  }
}

// CRITICAL: Health check endpoints FIRST - before ANY other code
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res, next) => {
  if (!frontendReady) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isCrawler = ua.includes('bot') || ua.includes('crawler') || ua.includes('facebookexternalhit') || ua.includes('twitterbot') || ua.includes('linkedinbot') || ua.includes('slackbot');
    if (isCrawler && fallbackHtml) {
      return res.status(200).type('html').send(fallbackHtml);
    }
    return res.status(200).json({ status: 'ok', service: 'Coin Railz', ready: false });
  }
  next();
});

// START LISTENING IMMEDIATELY - before loading heavy modules
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SERVER LISTENING ON PORT ${port} - Health checks now responding`);
  console.log('🔄 Loading application modules in background...');

  // Defer heavy application loading AFTER listen callback completes
  setTimeout(async () => {
    try {
      const { initApp } = await import('./appMain.js');
      await initApp();
      console.log('✅ Full application loaded and initialized');
    } catch (err) {
      console.error('❌ Failed to load application:', err);
    }
  }, 100);
});

export { app, httpServer, port };
export default app;
