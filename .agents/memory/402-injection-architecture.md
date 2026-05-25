---
name: 402 body injection architecture
description: Where to inject fields into 402 challenge bodies — which middleware is actually active vs dead code
---

The `x402ResponseEnricher` middleware in `server/middleware/x402ResponseEnricher.ts` is **never registered** in `server/appMain.ts`. Its `x402ResponseEnricher()` export is only used in `x402GatedRoutes.ts` (a small subset of routes).

**The live injection path for all main x402 services is:**
`server/routes/x402MicroserviceRoutesV2.ts` → `router.use(async ...)` at line ~1779

This middleware is a monkey-patch on `res.json` that runs for every request through the main x402 router. It adds `facilitatorUrl`, `facilitators`, `walletProviders`, `discoverable`, `accepts` normalization, and now `confidenceMetrics`.

**Why:** The orchestrator (`paymentOrchestrator.ts`) builds its own custom 402 body directly with `res.status(402).json(response)`, bypassing x402-express's own response builder. This wrapper intercepts that call.

**How to apply:** Any new field that should appear in every 402 challenge body must be added in the `res.json` wrapper in `x402MicroserviceRoutesV2.ts`. If it requires async data, pre-fetch it before setting up the wrapper (the middleware is now async so `await` works there).
