---
name: Startup readiness gate
description: How the app prevents paying agents from hitting unregistered routes during cold start
---

# Startup readiness gate

## The rule
All paths that are NOT registered in `server/index.ts` fast-path block must return 503 + `Retry-After: 5` until `markAppReady()` is called from `server/appMain.ts`.

**Why:** `httpServer.listen()` fires in ~1.3s. `initApp()` takes 60–130s. During that window, requests to `/x402/*`, `/mcp/*`, `/api/*` hit Vite's wildcard catch-all and return HTML — a silent failure for paying cron agents.

**How to apply:**
- `let appReady` flag, `markAppReady()`, `isAppReady()` live in `server/index.ts`
- `GET /readyz` → 200 when ready, 503+`Retry-After:5` when starting (Cloud Run can target this as startup probe)
- Gate middleware is `app.use(...)` placed **after** fast-path routes, **before** `httpServer.listen()`
- `markAppReady()` is called in `server/appMain.ts` at line ~4211, right after `_lap('pre-serveStatic — all pre-static routes registered')`
- Exempt paths (handled by fast-path routes above the gate): `/`, `/healthz`, `/readyz`, `/.well-known/*`, `/api/monitoring/*`

**Paths exempt from gate (pre-registered):**
- `/healthz` — always 200
- `/` — root handler (health probe + frontend fallback)
- `/.well-known/x402.json`, `/.well-known/agent-card.json` — cold-start minimal responses
- `/api/monitoring/health` — cold-start starting response
- `/readyz` — the readiness probe itself
