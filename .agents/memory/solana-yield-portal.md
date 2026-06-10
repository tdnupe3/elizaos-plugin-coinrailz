---
name: Solana USDC Yield Portal
description: Kamino Lending v1 non-custodial yield portal — architecture decisions, activation checklist, and known production gaps.
---

# Solana USDC Yield Portal

## Architecture
- Route: `/api/solana-yield/*` — server/routes/solanaYieldPortalRoutes.ts
- Services: server/services/solanaYield/{kaminoClient,txBuilder,positionReader}.ts
- Keeper: server/jobs/solanaYieldKeeper.ts (recursive setTimeout, not setInterval)
- DB: 3 isolated tables — solana_yield_positions, solana_yield_events, solana_yield_rate_snapshots (all with wallet indexes)
- Frontend: client/src/pages/SolanaYieldPortal.tsx at /solana-yield
- SDK: @kamino-finance/klend-sdk@5.10.25 (web3.js v1 compatible — v8+ has irreconcilable peer dep conflict)
- Default market: 7u3HeL2w6R5n41F89LGa5bCXJxmMTMGSFjcP6A9WDvNR (Kamino main market)

## Activation Checklist (required before SOLANA_YIELD_ENABLED=true)
1. `SOLANA_YIELD_ENABLED=true` — gates keeper startup
2. `HELIUS_API_KEY` (or `SOLANA_YIELD_RPC_URL`) — KaminoMarket.load() returns null on public RPC in prod
3. `SOLANA_FEE_WALLET` — platform Solana wallet pubkey; WITHOUT this, deposit fees are deducted from Kamino deposit amount but NOT swept to treasury (platform earns $0 on-chain)
4. `DIALECT_BE_KEY` — primary APY data source (already configured)
5. `npm run db:push` if tables not yet live in target environment

## Key Known Gaps (v2 backlog)
- Performance fee (10%) is NOT yet implemented — requires tracking yield earned per position and a separate sweep tx
- Liquidation monitoring — no Health Factor API alert if utilization hits 100%
- Auto-compounding — yield stays in position, not auto-harvested

## React Query Pattern (important)
Use template literal for dynamic URLs: `queryKey: [\`/api/solana-yield/position/\${wallet}\`]`
NOT array form: `queryKey: ["/api/solana-yield/position", wallet]`
The default queryFn uses only queryKey[0] as the URL — array[1..n] are for cache segmentation only.

**Why:** E2E test caught position cards not rendering after wallet lookup. Array form caused the fetcher to call `/api/solana-yield/position` (404) instead of the full URL.
