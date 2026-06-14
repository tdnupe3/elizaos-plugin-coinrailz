---
name: Dialect Markets — expired keys, DeFiLlama fallback
description: DIALECT_BE_KEY/DIALECT_MARKETS_FE_KEY expired; service now uses DeFiLlama as primary with one-time warning
---

## What Dialect Markets was
A Solana DeFi yield aggregator at `markets.dial.to/api/v0/markets`. Used by:
- `solana-yield-finder` x402 paid service (GET + POST in x402MicroserviceRoutesV2.ts)
- Solana Yield Portal (`/api/solana-yield`)
- SolanaYieldKeeper hourly cycle

## The Problem
Both `DIALECT_BE_KEY` and `DIALECT_MARKETS_FE_KEY` secrets ARE set in Replit, but the
Dialect API returns `{"code":"UNAUTHORIZED","status":401,"message":"Invalid API key..."}`.
The keys were issued at some point and have since expired or been rotated on Dialect's end.

## The Fix (dialectMarketsService.ts)
- `_dialectAuthFailed` latch: on first 401/403, log a warning ONCE, set flag, return null forever after
- `_dialectWarnedAt` throttle: if key is simply missing, warn at most once per hour
- `fetchLlama()`: hits `https://yields.llama.fi/pools`, filters `chain === 'Solana'`, maps to same `YieldFinderResponse` shape
- `getTopYields()`: tries Dialect first; on null result falls through to DeFiLlama
- `dataSource` and `attribution` fields reflect which source is active

**Why:** DeFiLlama is free, no auth, covers all Solana protocols, already confirmed working as fallback in keeper logs.

## Re-enabling Dialect
Get fresh keys from https://docs.dialect.to/markets, update `DIALECT_MARKETS_FE_KEY` or `DIALECT_BE_KEY`
secret in Replit. On next restart, service automatically prefers Dialect again — no code changes needed.

## Note on kaminoRate?.apy bug (pre-existing)
Callers in solanaYieldPortalRoutes.ts and solanaYieldKeeper.ts reference `kaminoRate?.apy` on a
`YieldOpportunity` object — but `YieldOpportunity` has `totalApy` not `apy`. This always evaluates
to `undefined`, meaning the callers always fell through to their own DeFiLlama fallback even when
Dialect was working. Dialect was never actually powering the keeper or portal APY values.
