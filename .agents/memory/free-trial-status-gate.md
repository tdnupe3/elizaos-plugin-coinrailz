---
name: Free-trial grant gating on handler status
description: first-call-free in paymentOrchestrator.ts must read res.statusCode after await handler() before deciding to persist the grant — malformed requests return 4xx without throwing
---

## Rule
After `await handler(req, res)`, read `const actualStatus = res.statusCode`. Only persist the free-trial grant (trackInteraction + FIRST_CALL_FREE_CACHE.set) if `actualStatus < 400`.

## Why
Express `res.status(400).json()` does NOT throw — so the `catch` block is never reached on malformed input. The old code called trackInteraction with a hardcoded `responseStatus: 200` and set the cache grant immediately after `await handler()`, regardless of what status the handler actually returned. A single malformed POST (missing tokenAddress/chain) burned the actor's free trial permanently.

## How to apply
- On 4xx: log eventType `'first-call-free-rejected'`, metadata `freeGrantOutcome: 'failed-validation'`, `responseStatus: actualStatus`. Do NOT set FIRST_CALL_FREE_CACHE — the actor's trial is preserved for a valid retry.
- On 2xx/3xx: proceed with grant as before, using `actualStatus` (not hardcoded 200) and `freeGrantOutcome: 'success'`.
- `FIRST_CALL_FREE_SERVICES` currently: `['gas-price-oracle', 'token-metadata']`.
