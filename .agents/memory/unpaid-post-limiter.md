---
name: Unpaid POST rate limiter
description: In-memory per-IP+UA rate limiter for unauthenticated POST requests at /x402 and /mcp
---

## Rule
`server/middleware/unpaidPostLimiter.ts` is applied at:
- `app.use('/mcp', unpaidPostLimiter)` — before mcpDeliveryRoutes
- `app.use('/x402', unpaidPostLimiter)` — before x402Limiter

**Why:** Depleted wallets and persistent cataloguers send burst sweeps (47+ services, 188 POSTs/12h) with zero payment intent, consuming CPU and DB write load.

**How to apply:** Import the named export `{ unpaidPostLimiter }`. The module is imported once near MCP mount (~line 981 appMain.ts) and reused at /x402 (~line 1090).

## Config
- Window: 15 minutes sliding
- Soft limit: 50 unpaid POSTs per IP+UA key
- High-quota UAs: x402-observer/1.0, x402-healthbot/1.0 → 250 limit (not exempt)
- Cardinality cap: 5,000 map entries, oldest evicted on overflow
- Cleanup interval: every 5 minutes

## Exemption rules
1. Non-POST methods: always exempt (GET/HEAD/OPTIONS)
2. Localhost IPs: 127.0.0.1, ::1, ::ffff:127.*, 10.* → canary, healthcheck, internal
3. Any auth header present: X-API-KEY, Authorization, X-PAYMENT → let upstream validate
4. Map overflow: exempt rather than evict (pass through)

## 429 response body
```json
{
  "error": "rate_limit_exceeded",
  "message": "N unauthenticated POST requests in 15 minutes — add X-API-KEY or X-PAYMENT to continue without throttling.",
  "trialKey": "https://coinrailz.com/api/m2m/credits/trial",
  "purchaseKey": "https://coinrailz.com/api/m2m/credits/checkout/session",
  "retryAfterSeconds": N
}
```
Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Cache-Control: no-store`

## Architecture notes
- In-memory Map: per-process only. Multi-replica = limit × replica_count. Acceptable for single Cloud Run instance. If replicas scale, promote to Redis.
- Defense in depth: unpaidPostLimiter (50/15min) → x402Limiter (200/min) → payment orchestrator
- Fires at request #51, not #50 (counter incremented before check)
- Key: `${ip}:${ua.slice(0, 80)}`; IP from X-Forwarded-For first hop (trust proxy = 1)

## Observability
- Log line on 429: `[unpaidPostLimiter] 429 | ip=... | count=N/limit | ua=... | retryAfterSecs=N`
- `getUnpaidPostLimiterStats()` exported for health/observability endpoint integration

## Verified (Aug 10 2026)
E2E: first 429 at request #51, exempt with X-API-KEY, localhost exempt, 429 body valid JSON.
