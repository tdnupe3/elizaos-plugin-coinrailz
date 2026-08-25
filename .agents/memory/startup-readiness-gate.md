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

## Production operational nuance

On August 24, 2026, production logs showed the root/listener health signal becoming
available before full initialization finished; a watchdog also released the frontend
before post-listen initialization completed. This does not invalidate the route gate,
but it means a root-level deployment health check is not proof that all paid routes
are ready.

**Why:** A process can accept connections and serve exempt fast-path routes while
full application initialization is still ongoing.

**How to apply:** Use `/readyz` for external full-readiness checks and verify that
the deployment's startup health contract cannot mark the paid surface healthy merely
because `/` is reachable.

## Architect review boundary

The production x402/MCP retry behavior is already correctly gated; do not duplicate
it as a production hardening change without a demonstrated bypass. The remaining
test gap is useful but non-blocking. One separate caveat is the development-only
`/api/mcp/payments` route mounted after `markAppReady()`; clarify that contract
before treating it as a production readiness defect.

**Why:** `markFrontendReady()` and the startup watchdog control frontend/root
serving, while `markAppReady()` independently controls API-route access.

**How to apply:** Preserve the current production gate. If adding coverage, use one
focused test for the pre-ready 503/`Retry-After` behavior and post-ready dispatch,
and inspect the development-only payment-kit route separately.
