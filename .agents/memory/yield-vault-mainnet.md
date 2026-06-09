---
name: Yield Vault mainnet deployment
description: CoinRailz ERC-4626 yield vault live on Base mainnet — addresses, testnet limitations, RPC quirks, deposit flow
---

## Vault Addresses
- **Mainnet (Base)**: `0xf8f67d6422fc60114a11ada3dca297ab6a255a29`
- **Testnet (Base Sepolia)**: `0xedb63d0a32282649dd4fb98dbfc22bbbe1516164`
- **Env vars**: `YIELD_VAULT_ADDRESS` (mainnet), `YIELD_VAULT_TESTNET_ADDRESS` (testnet)
- **Basescan**: https://basescan.org/address/0xf8f67d6422fc60114a11ada3dca297ab6a255a29

## Vault Config (both networks)
- Token: crUSDC, ERC-4626, asset = USDC
- Deployer/owner/fee recipient: `0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91` (server wallet via EVM_PRIVATE_KEY)
- Entry fee: 0.5%, Performance fee: 15%, Exit fee: 0%
- Active protocol: Aave v3 (3.13% APY as of June 2026)
- Rebalance: auto, 24h cooldown, anyone can call

## Testnet Limitation
- `aUsdc` at `0x96E32dE4B1D6B4BA845c7e8f9F95F5cC0B66b4A4` has NO code on Base Sepolia
- `deposit()` succeeds and shares are minted, but `totalAssets()` reverts (aUsdc.balanceOf → empty bytes → ABI decode error)
- This is a testnet address mismatch — mainnet aUsdc `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` is correct

## RPC
- **Use `base-rpc.publicnode.com`** for mainnet — `mainnet.base.org` rate-limits parallel calls
- Route file sets this in `RPC_URL` constant at top of `server/routes/yieldPortalRoutes.ts`

## Deposit Race Condition Fix
- Load-balanced RPC nodes can serve stale allowance state right after an `approve` tx confirms
- Fix: approve for `MaxUint256` (unlimited) and add `await new Promise(r => setTimeout(r, 2_000))` after approve receipt before calling `deposit`

## Platform API Endpoints (all require `x-admin-key` header)
- `GET /api/yield/platform-balance` — server wallet USDC + vault shares
- `POST /api/yield/platform-deposit { amountUsdc: "10.00" }` — sweep revenue into vault
- `POST /api/yield/platform-withdraw { shares: "9.95" }` — redeem shares
- `POST /api/yield/platform-rebalance` — trigger protocol switch
- `POST /api/yield/platform-harvest` — sweep pending fees

## Scripts
- `npx tsx scripts/testnet_flow.ts` — full testnet flow (swap + deposit)
- `npx tsx scripts/check_mainnet_vault.ts` — read all mainnet vault state
- `npx tsx scripts/debug_deposit.ts` — step-by-step deposit debug
- Scripts must be in the project root (not /tmp) so viem resolves correctly

**Why:** `mainnet.base.org` returns `-32016 over rate limit` on concurrent eth_call; testnet aUsdc config issue will surface on redeploy; MaxUint256 approval pattern is idiomatic for DeFi vaults.
