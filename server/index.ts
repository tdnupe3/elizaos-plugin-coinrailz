// ============================================================================
// CRITICAL: FAST STARTUP FOR HEALTH CHECK COMPLIANCE
// ============================================================================
// Cloud Run/Autoscale requires / to respond with 200 within seconds.
// We MUST start listening BEFORE loading heavy modules.
// ============================================================================

// Known safe transient errors from the ws library during client disconnections.
// These are not app faults — they occur when a WebSocket client disconnects mid-handshake.
function isKnownWsTransientError(err: Error): boolean {
  // Accept TypeError or plain Error — some Neon/ws error paths construct a base Error
  // rather than TypeError depending on the Node.js / ws version, so both are safe here
  const isExpectedType = err instanceof TypeError || err.name === 'Error';
  // Two confirmed Neon/ws message variants:
  // 1. "Cannot read properties of null (reading 'setHeader')" — ws client disconnect
  // 2. "Cannot set property message of #<ErrorEvent> which has only a getter" — Neon WS timeout
  const hasWsMessage = /setHeader|Cannot read propert|Cannot set propert/i.test(err.message);
  // Stack must trace through ws internals or Neon serverless (both are safe to swallow)
  const hasWsStack = !!(err.stack && (/ws[\\/](lib[\\/])?websocket/i.test(err.stack) || err.stack.includes('@neondatabase/serverless')));
  return isExpectedType && hasWsMessage && hasWsStack;
}

// ============================================================================
// STARTUP WINDOW: track whether initApp has completed.
// During the startup window, unhandledRejections are logged but NOT fatal —
// fire-and-forget optional services (CDP, Alchemy, jobs) can reject without
// killing the container before Cloud Run marks the revision healthy.
// After startup completes, unhandledRejections become fatal again so genuine
// post-startup bugs still crash loudly.
// ============================================================================
let _startupComplete = false;
export function markStartupComplete() {
  _startupComplete = true;
}

// Global exception handlers MUST be first — before any imports that could throw
process.on('uncaughtException', (err: Error) => {
  if (isKnownWsTransientError(err)) {
    // Safe to swallow — WebSocket client disconnected during handshake, not an app fault
    console.warn('⚠️ ws transient error (swallowed, known safe):', err.message);
    return;
  }
  // Unknown/fatal error — log fully and let the supervisor restart the process cleanly
  console.error('💥 Uncaught Exception (fatal — exiting for clean restart):', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  if (isKnownWsTransientError(err)) {
    console.warn('⚠️ ws transient rejection (swallowed, known safe):', err.message);
    return;
  }
  if (!_startupComplete) {
    // During startup: log but do NOT exit — optional service init rejections
    // (CDP, Alchemy, background jobs) must not crash the container before
    // Cloud Run health-check succeeds.
    console.warn('⚠️ Unhandled Rejection during startup (non-fatal):', err.message || reason);
    return;
  }
  // Post-startup: fatal — genuine app bugs should crash loudly
  console.error('💥 Unhandled Rejection (fatal — exiting for clean restart):', reason);
  process.exit(1);
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
<meta property="og:image" content="https://coinrailz.com/og-image.png?v=20260728">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
</head><body><p>Loading...</p></body></html>`;
      console.log('⚠️ Using minimal fallback HTML (index.html not found)');
    }
  }
}

// Platform constants — used in fast-path discovery responses during cold-start
const PLATFORM_PAY_TO = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const CDP_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';

// CRITICAL: Health check endpoints FIRST - before ANY other code
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res, next) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  // Cloud Run / Kubernetes health probes — ALWAYS return terminal 200, never next()
  // This prevents probe failures during rolling promote when static middleware
  // isn't fully registered yet (frontendReady race window).
  const isHealthProbe = ua.includes('googlehc') || ua.includes('kube-probe') || ua.includes('go-http-client') || ua === '';
  if (isHealthProbe) {
    return res.status(200).json({ status: 'ok', service: 'Coin Railz', ts: Date.now() });
  }
  if (!frontendReady) {
    const isCrawler = ua.includes('bot') || ua.includes('crawler') || ua.includes('facebookexternalhit') || ua.includes('twitterbot') || ua.includes('linkedinbot') || ua.includes('slackbot');
    if (isCrawler && fallbackHtml) {
      return res.status(200).type('html').send(fallbackHtml);
    }
    return res.status(200).json({ status: 'ok', service: 'Coin Railz', ready: false });
  }
  next();
});

// ============================================================================
// FAST-PATH DISCOVERY ENDPOINTS
// ============================================================================
// These serve valid minimal responses during a cold-start stall (before initApp
// completes). Once initApp() finishes and frontendReady is true, they pass
// through to the full wellKnownRoutes handlers via next() — no permanent override.
// This prevents crawlers (AgentIndex, Waggle, decixa.ai, flows-crawler, etc.)
// from receiving 404s during the ~90s production cold-start window.
// ============================================================================

app.get('/.well-known/x402.json', (req, res, next) => {
  if (frontendReady) return next();
  console.log('⚡ Fast-path x402.json (cold-start)');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    x402Version: 2,
    facilitatorUrl: CDP_FACILITATOR_URL,
    payTo: PLATFORM_PAY_TO,
    facilitator: CDP_FACILITATOR_URL,
    description: 'Coin Railz - Universal payment infrastructure for AI agents. Multi-chain USDC across 9 networks (8 EVM + Solana).',
    version: 'x402-2.3',
    updated: '2026-05-05T00:00:00Z',
    platformUrl: 'https://coinrailz.com',
    services: [],
    _cold_start: true,
  });
});

app.get('/.well-known/agent-card.json', (req, res, next) => {
  if (frontendReady) return next();
  console.log('⚡ Fast-path agent-card.json (cold-start)');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    name: 'Coin Railz Payment Infrastructure',
    description: 'Universal payment layer for the AI agent economy — x402 micropayments, multi-chain USDC, DEX aggregation, and IoT payment infrastructure.',
    url: 'https://coinrailz.com',
    version: '1.0.0',
    capabilities: {
      x402Payments: true,
      x402: {
        protocolVersion: '2.0.0',
        facilitatorUrl: CDP_FACILITATOR_URL,
        payTo: PLATFORM_PAY_TO,
        paymentNetwork: 'eip155:8453',
        paymentToken: {
          symbol: 'USDC',
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          decimals: 6,
        },
      },
    },
    _cold_start: true,
  });
});

app.get('/api/monitoring/health', (req, res, next) => {
  if (frontendReady) return next();
  res.json({ status: 'starting', ready: false, timestamp: new Date().toISOString() });
});

// START LISTENING IMMEDIATELY - before loading heavy modules
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SERVER LISTENING ON PORT ${port} - Health checks now responding`);
  console.log('🔄 Loading application modules in background...');

  // Defer heavy application loading AFTER listen callback completes
  const initStart = Date.now();
  setTimeout(async () => {
    try {
      const { initApp } = await import('./appMain.js');
      await initApp();
      console.log(`✅ Full application loaded and initialized (${Math.round((Date.now() - initStart) / 1000)}s)`);
    } catch (err) {
      console.error('❌ Failed to load application:', err);
      // Even on failure, call markFrontendReady so static frontend is served
      if (!frontendReady) {
        console.warn('⚠️ Calling markFrontendReady after initApp failure to unblock static serving');
        markFrontendReady();
      }
    }
  }, 100);

  // ============================================================================
  // STARTUP WATCHDOG — production cold-start resilience
  // ============================================================================
  // If initApp() hangs (external API timeout, Neon WS stall, etc.) without
  // throwing, the server would stay in fast-startup mode forever — crawlers and
  // users both get 404/partial responses. This watchdog fires after 150s and
  // calls markFrontendReady() regardless, so the static frontend always serves.
  // API routes may still be unavailable if initApp() is mid-stall, but the
  // platform is not completely dark.
  if (isProduction) {
    setTimeout(() => {
      if (!frontendReady) {
        console.warn('⚠️ STARTUP WATCHDOG: initApp() did not complete within 150s — calling markFrontendReady to unblock serving');
        markFrontendReady();
      }
    }, 150_000);
  }
});

export { app, httpServer, port };
export default app;
