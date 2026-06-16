---
name: Canary job pattern
description: How the x402 canary payment job works and how it connects to the 402 challenge body
---

**Purpose:** Every 6h (production only), X402CanaryJob makes a real $0.05 USDC payment to /x402/first-call and stores the tx hash in `x402_canary_payments`. The enricher reads this and surfaces it as `confidenceMetrics.lastVerifiedPayment` in every 402 challenge body.

**Files:**
- Job: `server/jobs/x402CanaryJob.ts`
- Table: `x402_canary_payments` (created via raw SQL; drizzle schema in `shared/schema.ts`)
- Enricher: `server/middleware/x402ResponseEnricher.ts` — exports `getConfidenceMetrics()` and `invalidateCanaryCache()`
- Injection point: `server/routes/x402MicroserviceRoutesV2.ts` router.use wrapper

**Safety guards:**
- Only fires when `REPLIT_DEPLOYMENT === '1'` or `NODE_ENV === production`, and not when `DEV_LITE_MODE === true`
- Circuit breaker: stops after 3 consecutive failures; `X402CanaryJob.resetCircuit()` or server restart to resume
- Insufficient USDC: gracefully skips (records 'skipped' row, does NOT count toward circuit breaker)
- `intervalId.unref()` so the interval doesn't prevent clean process exit

**TX hash retrieval:** After 200 response, waits 3 seconds then queries `x402_payment_intents` for most recent SUCCEEDED entry for 'first-call' after the canary started. Stores that tx hash + Basescan URL in `x402_canary_payments`.

**Cache invalidation:** After a successful run, calls `invalidateCanaryCache()` so the next 402 challenge issued picks up the fresh proof without waiting the 10-minute cache TTL.

**Why:** `lastVerifiedPayment` in the 402 challenge body is machine-verifiable settlement proof — any evaluating agent can check Basescan independently. This converts "spec-compliant challenge" to "proven live payment rail" without requiring trust.

**Canary wallet identity (verified Jun 16 2026):**
- Active canary wallet: `0x5837a864...` — derived from `X402_BUYER_PRIVATE_KEY`. Marked `is_canary=true` in `x402_payment_intents`. Has been the canary since at least Feb 7 2026. $124.95 spent across 176 intents = all internal.
- `0xa4bbe37f...` (TK5 MetaMask, still funded ~$47 USDC) — legacy dev/test wallet, `is_canary=false` in DB. Stopped firing Jun 13 2026. Was never the production canary.
- The analytics inventory doc previously labeled `0x5837a864` as "Largest external payer" — this was WRONG. Corrected Jun 16 2026.
- **Transient failures** (e.g. June 15 09:21 + 17:11) are NOT wallet balance issues — insufficient funds shows as 'skipped', not 'failed'. Mid-day UTC failure clusters are Base network/CDP API congestion. Self-healing (recover same day).
