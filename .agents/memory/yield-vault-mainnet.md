---
name: Yield Vault mainnet deployment
description: CoinRailz ERC-4626 yield vault live on Base mainnet — v2 addresses, compilation, v2 ABI changes, keeper, deposit flow
---

## Vault Addresses
- **Mainnet v2 (Base)**: `0x24594ffa7b25333d41e0032c2ad7b47d68c84904` (ACTIVE — deployed 2026-06-09)
- **Mainnet v1 (Base)**: `0xf8f67d6422fc60114a11ada3dca297ab6a255a29` (DEPRECATED — all funds redeemed 2026-06-09)
- **Testnet (Base Sepolia)**: `0xedb63d0a32282649dd4fb98dbfc22bbbe1516164`
- **Env var**: `YIELD_VAULT_ADDRESS=0x24594ffa7b25333d41e0032c2ad7b47d68c84904` (set in shared env)

## Vault Config v2
- Token: crUSDC, ERC-4626, asset = USDC
- Deployer/owner/fee recipient: `0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91` (server wallet)
- Entry fee: 0.5%, Performance fee: 15% (Yearn-style share-mint accrual), Exit fee: 0%
- Protocols: Aave v3 (active, 3.13%), Compound v3 (0.63%), Morpho Blue (0% — configure post-deploy)
- Rebalance: auto 24h cooldown, anyone can call; keeper fires every 6h

## v2 ABI CHANGES vs v1 — CRITICAL
| v1 function | v2 function | Notes |
|---|---|---|
| `harvest()` | `accrueFees()` | Mints fee shares (Yearn-style), not USDC transfer |
| `pendingFees() → uint256` | `pendingFeeAccrual() → (uint256 gainAssets, uint256 feeAssets)` | Returns tuple; use [1] for fee USDC amount |
| `userPosition() → (4 values)` | `userPosition() → (shares, value, yield)` | 3 return values now |

All these are updated in `server/routes/yieldPortalRoutes.ts` VAULT_ABI, EXTENDED_VAULT_ABI, and `platform-harvest` handler.

## How to compile the contract (Node 20 — hardhat@3 incompatible)
```bash
node scripts/compile-vault.cjs   # uses bundled solc 0.8.30 in node_modules/solc
```
Output: `contracts/CoinRailzYieldVault.json`

## Keeper
- `server/jobs/yieldVaultKeeper.ts` — calls `accrueFees()` + `rebalance()` every 6h
- Registered in `appMain.ts` after X402CanaryJob
- Reads `pendingFeeAccrual()` tuple; skips accrue if feeAssets == 0; skips rebalance if improvement < 50bps

## Full migration script
`npx tsx scripts/migrate-vault-v2.ts` — redeems v1, deploys v2, re-seeds from same wallet

## Testnet aUsdc limitation
`0x96E32dE4B1D6B4BA845c7e8f9F95F5cC0B66b4A4` has no code on Base Sepolia; deposit mints shares but `totalAssets()` reverts.

## RPC
- Always `base-rpc.publicnode.com` for mainnet — `mainnet.base.org` rate-limits parallel calls

## Deposit Race Condition Fix
- Approve for `MaxUint256` + `await sleep(2000)` after approve receipt before deposit

**Why:** publicnode handles concurrent eth_call without 429s; Morpho zero at deploy is intentional — `configureMorphoMarket()` callable by owner after verifying market params on-chain.
