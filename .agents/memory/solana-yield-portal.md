---
name: Solana USDC Yield Portal
description: Kamino Lending v1 non-custodial yield portal — architecture, fee structure, activation state, and production gaps.
---

# Solana USDC Yield Portal

## Architecture
- Route prefix: `/api/solana-yield/*` — server/routes/solanaYieldPortalRoutes.ts
- Services: server/services/solanaYield/{kaminoClient,txBuilder,positionReader}.ts
- Keeper: server/jobs/solanaYieldKeeper.ts (recursive setTimeout, 60-min interval)
- DB: 3 isolated tables — solana_yield_positions, solana_yield_events, solana_yield_rate_snapshots
- Frontend: client/src/pages/SolanaYieldPortal.tsx at /solana-yield (registered in App.tsx)
- SDK: @kamino-finance/klend-sdk@5.10.25 (web3.js v1 compatible — v8+ has irreconcilable peer dep conflict)

## Correct Kamino Market + Reserve Addresses (verified on-chain June 2026)
- **Main market**: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
  Source: `node_modules/@kamino-finance/klend-sdk/src/client.ts` → `MAINNET_LENDING_MARKET`
  The original address `7u3HeL2w6R5n41F89LGa5bCXJxmMTMGSFjcP6A9WDvNR` does NOT exist on-chain.
- **USDC reserve**: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`
  Found via `market.getReserveByMint(USDC_MINT)` after loading 55 reserves.

## Critical SDK Loading Pattern
```typescript
// CORRECT — setupLocalTest=true skips Scope price-oracle init; withReserves=false avoids
// a DecimalError that occurs because one of the 55 reserves has an undefined oracle config.
const market = await KaminoMarket.load(conn, marketAddr, slotDuration, PROG, true, false);
await market.reloadSingleReserve(new PublicKey(USDC_RESERVE_ADDRESS));
// Now market.getReserveByMint(USDC_MINT) returns the reserve correctly.
```
**Why:** `withReserves=true` loads all 55 reserves; at least one has an undefined Scope oracle
config field that causes `[DecimalError] Invalid argument: undefined` inside `buildDepositTxns`.
Loading only the USDC reserve via `reloadSingleReserve` avoids the bad reserve entirely.

## Correct Reserve Methods (klend-sdk v5.10.25)
- `reserve.getTotalSupply()` — total deposited supply (raw units, 6 decimals). Use instead of `getDepositTvl()` which returns near-zero without price feeds.
- `reserve.getLiquidityAvailableAmount()` — unborrowed liquidity
- `reserve.calculateSupplyAPR()` — supply APR as Decimal. Wrap in try/catch (not always available).
- `reserve.calculateSupplyAPY` — **does NOT exist** in v5.10.25; use `calculateSupplyAPR`
- `reserve.getEstimatedCollateralExchangeRate()` — **throws** DecimalError; use `getCollateralExchangeRate()` instead

## Fee Structure (matches Base vault)
- Deposit: 0.50% (DEPOSIT_FEE_BPS: 50)
- Withdrawal: 0.50% (WITHDRAW_FEE_BPS: 50)
- Performance: 15% of yield (PERF_FEE_BPS: 1500) — **declared in config/UI but NOT yet collected on-chain (v2)**

## Fee Collection (deposit + withdrawal fees only — live)
- `getPlatformSolanaWallet()` in kaminoClient.ts derives platform pubkey:
  Priority: SOLANA_FEE_WALLET env var → fallback derive from SOLANA_PRIVATE_KEY
- txBuilder.ts injects two instructions into the tx bundle:
  1. `createAssociatedTokenAccountIdempotentInstruction` — ensures platform USDC ATA exists (rent paid by depositor, ~0.002 SOL one-time)
  2. `createTransferInstruction` — transfers feeRaw USDC lamports to platform ATA
- Deposit fee ix is prepended to preLendingTxn; withdrawal fee ix is appended to postLendingTxn

## Current Activation State (as of 2026-06-10)
- `SOLANA_YIELD_ENABLED=true` ✅ — set in shared env vars
- `HELIUS_API_KEY` ✅ — already configured; kaminoClient uses it automatically
- `SOLANA_PRIVATE_KEY` ✅ — already configured; used as fee wallet derivation source
- deposit-tx verified returning 2 real transactions in dev

## Known Gaps (v2 backlog)
- Performance fee (15%) is declared in config/UI/manifest but NOT collected anywhere
  Requires: per-position yield tracking across keeper cycles + sweep tx + revenue ledger
- Liquidation monitoring — no Health Factor alert
- Auto-compounding

## React Query Pattern (critical)
Use template literal for dynamic URLs: `queryKey: [\`/api/solana-yield/position/\${wallet}\`]`
NOT: `queryKey: ["/api/solana-yield/position", wallet]`
The default queryFn uses only queryKey[0] as the URL — array[1..n] are cache segments only.

**Why:** E2E caught position cards not rendering. Array form called wrong URL (missing wallet param).

## Biz-Dev Revenue Projections (0.5%/0.5%/15% @ 8% APY)
| TVL     | 90-day revenue |
|---------|----------------|
| $100k   | ~$1,300        |
| $500k   | ~$6,500        |
| $1M     | ~$13,000       |
| $5M     | ~$65,000       |
Min TVL for meaningful revenue line: $1M+. Breakeven on 1% round-trip at ~45 days @ 8% APY.
