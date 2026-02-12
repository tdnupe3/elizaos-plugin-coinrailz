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
  // If frontend is not ready yet, return a proper HTML page with OG tags
  // so social media crawlers (Facebook, Twitter, LinkedIn) still get metadata
  if (!frontendReady) {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Coin Railz - Micropayment Rail for AI Agents</title>
<meta name="description" content="Two payment rails, one platform. x402/USDC for autonomous agents. Stripe prepaid credits for TradFi teams. 58 x402 services from crypto to satellite data & IoT.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://coinrailz.com">
<meta property="og:title" content="Coin Railz - Micropayment Rail for AI Agents">
<meta property="og:description" content="Two payment rails, one platform. x402/USDC for autonomous agents. Stripe prepaid credits for TradFi teams. 58 x402 services from crypto to satellite data & IoT.">
<meta property="og:image" content="https://coinrailz.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="Coin Railz">
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:title" content="Coin Railz - Micropayment Rail for AI Agents">
<meta property="twitter:image" content="https://coinrailz.com/og-image.png">
<meta http-equiv="refresh" content="3">
</head>
<body style="margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;text-align:center">
<div><h1 style="font-size:2.5rem;margin:0 0 1rem">Coin Railz</h1><p style="opacity:0.9">Loading...</p></div>
</body>
</html>`);
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
