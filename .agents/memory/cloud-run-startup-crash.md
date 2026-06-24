---
name: Cloud Run startup crash — unhandledRejection exit
description: process.exit(1) on unhandledRejection killed container before Cloud Run health check; fix pattern for startup window
---

# Cloud Run startup crash — unhandledRejection exit

## The Rule
Never call `process.exit(1)` on `unhandledRejection` during the startup window. Log-only until `markStartupComplete()` is called.

**Why:** Cloud Run requires the new revision to pass a health check (`GET /`) before promoting it. If any fire-and-forget optional service init (CDP, Alchemy, canary jobs, background jobs) rejects without a `.catch()`, the global `unhandledRejection` handler exits the process — before Cloud Run can mark the revision healthy. This caused two consecutive failed publishes on Jun 24, 2026.

**How to apply:**
- `server/index.ts` exports `markStartupComplete()` and a `_startupComplete` flag
- `unhandledRejection` handler: if `!_startupComplete`, log warning and return (no exit)
- After startup completes, rejections are fatal again
- `appMain.ts` calls `markStartupComplete()` at the end of the `setImmediate` background init block (both success and catch paths)
- Production startup test: `PORT=5001 NODE_ENV=production REPLIT_DEPLOYMENT=1 timeout 12 node dist/index.js` — EXIT=124 (timeout) means healthy, not a crash

## Symptoms
- Build log: "Pushed image manifest" → "Skipping container streaming artifacts" → logs end (no "Creating Autoscale service")
- OR: "Waiting for service to be ready" fails within seconds of being logged
- No runtime logs captured for the failing window (container never served traffic)
- Env vars match dev/prod, build succeeds cleanly, previous deploys worked fine
