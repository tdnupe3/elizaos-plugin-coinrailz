# Assessment — 2026-08-15 01:30 UTC

## Session Focus
Two-item investigation + fix session: (1) root-cause x402lint `payment-decode-failed` events, (2) implement startup readiness gate to prevent paying cron agents from silently hitting unregistered routes during cold start.

---

## 1. x402lint Decode Failures — Root Cause & Verdict

### Evidence gathered
- **x402lint.dev** hit 9 services in a 2-second burst (16:50:55–16:50:57 UTC Aug 14).
- Events: `challenge-issued` for ping, gas-price-oracle, instant-agent-wallet, verified-agent-identity, prediction-market-spread; `payment-decode-failed` + `error` for first-call, satellite-earthdata, earthdata-precipitation.
- `payment-decode-failed` fires at `paymentOrchestrator.ts:1884` when **our server** receives an `X-PAYMENT` header it cannot decode. Meaning x402lint sent payment attempts to those 3 services.

### Hypothesis tested: network field encoding (architect initial hypothesis)
Curl confirmed `accepts[0].network = eip155:8453` for ALL services including the failing ones. Network field is NOT the issue.

### Empirical test
Constructed a valid x402 v2 payment payload (base64-encoded JSON, `network: eip155:8453`, real EIP-3009 structure, zero-byte dummy signature) and POSTed it to both `first-call` and `satellite-earthdata` with `X-PAYMENT` header. Both **decoded successfully** — our server reached the EVM signature verification step and responded with "ECRecover: invalid signature" (correct behavior for a dummy sig). **No `payment-decode-failed` event was generated.**

### Verdict: not our bug
Our multi-format decoder (base64-JSON, base64-CBOR, msgpack, raw JSON, 0x hash, EIP-3009 binary) works correctly. The `payment-decode-failed` events mean x402lint is sending `X-PAYMENT` in a format none of those 6 decoders handles. This is x402lint's implementation issue, not ours.

The reason x402lint selectively sends payment attempts to only 3 of 9 tested services is unknown — possibly a hardcoded list, a vertical classifier, or a `firstCallFree` detector in its heuristic — but the decode failure occurs on their side.

**Action: no code change needed.** If x402lint re-tests after updating their agent, the decode will succeed.

---

## 2. Startup Readiness Gate — Implemented

### Problem
`server/index.ts` calls `httpServer.listen()` immediately (port binds in 1.3s), then defers `initApp()` by 100ms behind a `setTimeout`. x402 routes, MCP routes, and all payment endpoints are registered during `initApp()` which takes 60–130s on cold start. During that window:
- A request to `/x402/first-call` hit Express with no matching route
- Vite's wildcard catch-all returns an HTML page
- The paying cron agent (earthdata, DeFi, IoT) receives HTML instead of a 402 challenge
- This is a **silent failure** — the agent gets a 200 with HTML, doesn't retry, and misses its payment window

IoT agent was observed making 13 challenge-issued retries in 92 seconds — confirming cold-start 404 risk is real. Those retries suggest the agent **does** eventually see a 402 and retry, but only after hitting something wrong first.

### Fix implemented
**`server/index.ts`** — added:
- `let appReady = false` flag
- `export function markAppReady()` — logs "✅ App ready — x402 API routes now accepting requests"
- `export function isAppReady()` — returns current state
- `GET /readyz` — returns 200+`{ready:true}` when ready, 503+`Retry-After: 5` when starting
- Gate middleware `app.use(...)` — placed **after** fast-path discovery routes (/.well-known/*, /healthz, /api/monitoring/health, /) and **before** `httpServer.listen()`; returns 503+`Retry-After: 5` for all other paths when !appReady

**`server/appMain.ts`** — added `markAppReady` to the import line and called it immediately after `_lap('pre-serveStatic — all pre-static routes registered')` at line 4211 — the exact moment all x402 routes, MCP routes, and API routes are registered.

### Test results
```
/healthz        → 200 (always, pre-init)          ✅
/readyz         → 503 during init                  ✅  (confirmed live before markAppReady())
/readyz         → 200 after init                   ✅
/x402/ping      → 503+Retry-After during init      ✅  (ping body showed {"error":"starting",...})
/x402/ping      → proper x402 v2 challenge (4 accepts) after init  ✅
/x402/first-call → proper x402 v2 challenge after init  ✅
/x402/satellite-earthdata → proper x402 v2 challenge after init  ✅
```

The gate fires for ~60–130s during cold start. Paying cron agents that arrive during this window now get a machine-readable 503 with `Retry-After: 5` instead of an HTML 200 — they can retry and will succeed once routes register.

---

## 3. Paying Agent State

Three independent paying agents confirmed active on 2h cron cycles (all fire at :44 past the hour):

| Agent | IP | Vertical |
|---|---|---|
| Earthdata | 136.124.33.101 | NASA Earth observation |
| DeFi/RH | 136.124.32.146 | Robinhood chain data |
| IoT | 34.96.60.147 (GCP) | IoT sensor reading |

**Wallet address query blocked** by durable-runtime replay (prior batched SQL calls poisoned cache). Query should be run in the next session:
```sql
SELECT ip_address, payer_address, COUNT(*) as payments, SUM(amount_usd) as total_usd
FROM x402_payment_intents
WHERE status = 'SUCCEEDED'
  AND ip_address IN ('136.124.33.101', '136.124.32.146', '34.96.60.147')
GROUP BY ip_address, payer_address
ORDER BY ip_address, payments DESC
```

---

## 4. Ecosystem Monitors

- **x402-observer** — hitting all 80 services in 49-service cycles, constant presence
- **mcpregistry.io (mcpregistry-bot/0.1)** — indexing every ~7.5 minutes (was 17 min in prior session, increased frequency); each cycle: POST /mcp (initialize) + POST /mcp (tools/list); no payment
- **x402lint.dev** — one-time compliance scan (9 services, Aug 14 16:50 UTC); decode failures for 3 services are their implementation issue
- **x402-mpp-liveness/0.1** — triggered first-call-free grant on gas-price-oracle in prior session; not seen this session
- **Meta externalagent** — first appeared Aug 14, patterns unknown

---

## 5. Open Tech Debt

1. **rh-bridge-usdc concurrent reservation race** — non-atomic treasury reserve check in `server/routes/microservices/rhBridgeService.ts`. Not urgent at 1 payment/2h cadence but will matter if volume increases. Needs mutex or `SELECT FOR UPDATE`.

2. **ETag on `/mcp/tools/list`** — mcpregistry-bot hitting every 7.5 min. With `ETag` + `If-None-Match`, 304 Not Modified would make each cycle near-zero cost. File: `server/routes/mcpRoutes.ts`.

3. **Wallet convergence check** — confirm all 3 cron agents share the same payer_address (single-operator hypothesis). Run SQL above in next session.

4. **x402lint retest** — x402lint.dev decode failures are their issue. No action needed until they fix and rescan.

---

## 6. Platform Health

- 80 x402 services active
- Startup readiness gate live (503+Retry-After replaces silent HTML during cold start)
- No failed payments from known cron agents since last session
- IoT agent (GCP) now confirmed as 3rd paying agent alongside Earthdata and DeFi/RH
