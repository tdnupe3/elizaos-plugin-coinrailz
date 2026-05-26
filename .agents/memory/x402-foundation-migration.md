---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Verified Architecture (May 2026) — Read This First

**x402GatedRoutes.ts** — NOT MOUNTED. Deprecated in appMain.ts line 1057. Edits here have zero runtime effect. Now migrated to @x402/express 2.x (harmless, irrelevant).

**x402MicroserviceRoutesV2.ts** — THE LIVE ROUTER. Mounted at `/x402` in appMain.ts line 1062. All 60+ services live here. `createPaymentOrchestrator` handles ALL payment gating — `x402Middleware` was already removed from every route. Old `paymentMiddleware` import was dead code.

**x402CanaryJob.ts** — Still uses `x402-fetch@0.7.3`. Pays into `POST /x402/first-call` which is gated by `createPaymentOrchestrator` → `hybridPaymentMiddleware` → `verifyTransactionPayment`. Canary client migration is INDEPENDENT of server migration.

**paymentOrchestrator.ts** — The real payment engine. No dependency on x402-express at all.

## Migration Status (May 2026)

### Server Side — COMPLETE
- `x402MicroserviceRoutesV2.ts`: Dead imports (`x402-express`, `@coinbase/x402`) and dead `x402Middleware` instantiation removed. Regression checks passed — 402 body contract identical.
- `x402GatedRoutes.ts`: Migrated to @x402/express 2.x (new RouteConfig format, x402ResourceServer, ExactEvmScheme). File is unmounted so zero runtime impact.

### Canary Client — PENDING
- `x402CanaryJob.ts` still uses `x402-fetch@0.7.3`. Previous migration to `@x402/fetch` failed twice.

## Why Previous Canary Migration Failed

The orchestrator emits `"network":"base"` (shorthand) in 402 challenges. `@x402/fetch` 2.x / `ExactEvmScheme` requires CAIP-2 format (`"eip155:8453"`). These are incompatible.

**Architect recommendation (confirmed):** Before migrating canary, either:
- (A) Add a canary-only CAIP-2 challenge path/header so canary gets CAIP-2 while live traffic stays on `"base"`, OR
- (B) Change the orchestrator to emit CAIP-2 globally, then migrate all clients

Do NOT attempt the canary migration again without resolving the network format mismatch first.

## x402Routes Config Object — Do NOT Convert

The big `x402Routes` object (line ~374 in x402MicroserviceRoutesV2.ts) uses old format (`price`, `network`, `config`). It is consumed ONLY by `generate402ResponseForGet()` for Bazaar discovery responses — it is NOT an @x402/express RouteConfig. Leave it as-is. Consider renaming to `x402DiscoveryConfig` for clarity later.

## Next Steps (Architect-Ordered)

1. ✅ Remove dead legacy imports/instantiation in x402MicroserviceRoutesV2.ts — DONE
2. ✅ Regression check: first-call + core endpoints still return correct 402 — PASSED
3. ⏳ Decide canary strategy (Option A or B above), then migrate x402CanaryJob.ts
4. ⏳ After canary stable (≥10 consecutive successes), remove legacy packages from package.json

## Key API Facts for Canary Migration (when ready)

- Old: `wrapFetchWithPayment(fetch, wallet, max)` (3 args)
- New: `wrapFetchWithPayment(fetch, x402Client)` (2 args)
- `x402Client` builder: `new x402Client().register(network, scheme).registerPolicy(fn)`
- `ExactEvmScheme` from `@x402/evm` (CLIENT side for canary — different from server-side `@x402/evm/exact/server`)
- Max amount safety: `.registerPolicy((_v, reqs) => reqs.filter(r => BigInt(r.maxAmountRequired) <= MAX))`
- Network string in policy/scheme must be CAIP-2: `"eip155:8453"`
