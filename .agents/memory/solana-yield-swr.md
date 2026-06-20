---
name: Solana yield rates SWR cache
description: SWR pattern for /api/solana-yield/rates — why it was needed and how it works
---

# Solana Yield Rates — Stale-While-Revalidate Cache

## The Rule
`/api/solana-yield/rates` must use SWR caching with a 60s fresh window and 10min stale window. Do NOT replace with a simple hard-TTL cache.

**Why:** The Kamino/DeFiLlama RPC call takes 80–1800ms depending on network conditions. With a hard TTL cache, every miss causes a blocking 700ms+ response. With SWR, only the very first cold-start call blocks — all subsequent calls are sub-10ms served from cache, with a background refresh for staleness.

## How It Works (solanaYieldPortalRoutes.ts)

- `fetchSolanaRates()` — standalone async function containing all 3 data sources (Dialect → DeFiLlama → Kamino on-chain)
- `triggerBackgroundRefresh()` — fire-and-forget wrapper guarded by `_ratesRefreshing` boolean lock
- Cache windows:
  - `age < SOLANA_RATE_FRESH_MS (60s)` → return cached, no refresh
  - `age < SOLANA_RATE_STALE_MS (600s)` → return stale instantly + `triggerBackgroundRefresh()`
  - `age >= 600s` → block for live fetch (cold start only); if `_ratesRefreshing`, return stale if available
  - Error fallback → return stale rather than 500

## Observed Results
- Before: 714ms avg / 1770ms peak
- After: ~82ms cold MISS, 4–9ms HIT, all parallel burst calls served from cache

## How to Apply
Any route that calls an external RPC/API (Kamino, DeFiLlama, Solana) more than once per minute should use this SWR pattern. Hard-TTL caches with <60s TTL are almost always wrong for slow external calls.
