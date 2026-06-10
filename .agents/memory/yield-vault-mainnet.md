---
name: Yield Vault mainnet deployment
description: CoinRailz ERC-4626 yield vault live on Base mainnet — current address, compilation, ABI, keeper, Morpho config
---

## Vault Addresses
- **Mainnet v2.2 (Base)**: `0xb7697bf34f1566dd3d19792e12c366e396816736` (ACTIVE — re-deployed 2026-06-10 for Basescan verification; fresh source match; Morpho NOT yet configured — vault runs on Aave)
- **Mainnet v2.1 (Base)**: `0x86e2508ca0de34530dc847645f60f0d46d95176a` (DEPRECATED — bytecode/source mismatch post-Basescan attempt; all funds redeemed 2026-06-10)
- **Mainnet v2 (Base)**: `0x24594ffa7b25333d41e0032c2ad7b47d68c84904` (ABANDONED — $12.12 permanently stuck in Morpho; do not use)
- **Mainnet v1 (Base)**: `0xf8f67d6422fc60114a11ada3dca297ab6a255a29` (DEPRECATED)
- **Env var**: `YIELD_VAULT_ADDRESS=0xb7697bf34f1566dd3d19792e12c366e396816736` (shared env)
- **Also update secret**: The `YIELD_VAULT_ADDRESS` secret in Replit Secrets panel must be updated too (env var takes precedence in dev but secret may win in production deployments)

## IMPORTANT: Hardcoded address pattern
- `client/src/pages/YieldPortal.tsx` and `server/routes/wellKnownRoutes.ts` no longer hardcode the vault address — both use `process.env.YIELD_VAULT_ADDRESS` dynamically. When re-deploying again, only update the env var + secret + restart — no code edits required.

## Morpho Blue — NOT configured on v2.2
- Old vault (v2.1) also had morpho=address(0). Morpho APY in rates is from off-chain reads only; vault was running on Aave the whole time.
- To enable Morpho: POST /api/yield/platform-configure-morpho (admin) with market params (see Morpho Blue on Base section below).
- After configuring, keeper will rebalance within 24h cooldown period.

## CRITICAL: Morpho Blue Balance Bug (fixed in v2.1+)
`expectedSupplyAssets(marketParams, user)` is a **MorphoLib library helper — it does NOT exist on the Morpho Blue singleton**. Calling it on the singleton reverts. The `try/catch` silently returns 0, causing `totalAssets() = 0`. This makes `emergencyWithdraw()` burn shares for 0 USDC — funds permanently stuck.

**Fix**: Use shares math directly:
```solidity
(uint256 supplyShares,,) = morpho.position(morphoMarketId, address(this));
return supplyShares * (uint256(m.totalSupplyAssets) + 1) / (uint256(m.totalSupplyShares) + 1_000_000);
// VIRTUAL_ASSETS=1, VIRTUAL_SHARES=1e6 per Morpho Blue spec
```
Also added `ownerRescueMorpho(address recipient)` which withdraws by shares (`assets=0, shares=allShares`) — bypasses any totalAssets() path.

## Vault Config v2.2
- Token: crUSDC, ERC-4626, asset = USDC
- Deployer/owner/fee recipient: `0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91` (server wallet)
- Entry fee: 0.5%, Performance fee: 15% (Yearn-style share-mint accrual), Exit fee: 0%
- Protocols: Aave v3, Compound v3, Morpho Blue — Aave currently active (Morpho not yet configured)
- Rebalance: auto 24h cooldown; keeper fires every 6h
- Initial TVL: 2.039750 crUSDC (~$2.04 platform seed)

## v2 ABI CHANGES vs v1 — CRITICAL
| v1 function | v2/v2.1 function | Notes |
|---|---|---|
| `harvest()` | `accrueFees()` | Mints fee shares (Yearn-style) |
| `pendingFees() → uint256` | `pendingFeeAccrual() → (uint256 gainAssets, uint256 feeAssets)` | Tuple; use [1] for fee USDC |
| `userPosition() → (4 values)` | `userPosition() → (shares, value, yield)` | 3 return values |

## Morpho Blue on Base (verified mainnet addresses)
- Morpho singleton: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`
- Adaptive Curve IRM: `0x46415998764C29aB2a25CbeA6254146D50D22687`
- cbXRP/USDC market ID: `0xfdfecf85a4dd90a7637ae2aaf28b35061166f0e62bfc714c565eed9f7e959783`
- lltv: `770000000000000000` (77%), collateral: `0xcb585250f852C6c6bf90434AB21A00f02833a4af`, oracle: `0x031b2EFC8d70042Ac8d9f5c793c4149eC4b60fdE`
- Use `morpho.market(id)` + `morpho.position(id, user)` for balance reads. Never `expectedSupplyAssets`.

## How to compile (Node 20 — hardhat@3 incompatible)
```bash
node scripts/compile-vault.cjs   # uses bundled solc 0.8.30
```
Output: `contracts/CoinRailzYieldVault.json`

## Keeper
- `server/jobs/yieldVaultKeeper.ts` — calls `accrueFees()` + `rebalance()` every 6h
- Reads `YIELD_VAULT_ADDRESS` from env
- Registered in `appMain.ts` after X402CanaryJob

## Constructor (v2.1+ — 9 args)
`_asset, _feeRecipient, _aavePool, _aUsdc, _compoundComet, _morpho, _morphoMarket, _morphoIrm, _initialProtocol`
- Deploy with `_morpho=zero, _morphoMarket=empty, _morphoIrm=zero` then call `configureMorphoMarket()` after verifying market params on-chain.
- Compound Comet on Base: `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf` (not `0xb125...` — wrong checksum/length)

## Re-deploy procedure (safe, tested 2026-06-10)
1. GET /api/yield/stats → read vault shares balance
2. POST /api/yield/platform-withdraw { shares: "X.XXXXXX" } — query on-chain balance to get exact amount
3. POST /api/yield/server-deploy { network: "mainnet" } — captures new address in response
4. setEnvVars({ YIELD_VAULT_ADDRESS: newAddr }, "shared") + update secret in Replit Secrets panel
5. Restart server
6. Verify server reads new address: GET /api/yield/stats → vault.address
7. POST /api/yield/platform-deposit { amountUsdc: "X.XX" }
8. POST /api/yield/platform-configure-morpho (when market params confirmed)
**Note**: `sharesReceived` and `newShares` fields in platform-withdraw/deposit responses show 0 due to stale RPC read race — verify on-chain directly via eth_call balanceOf.

## RPC
- Always `base-rpc.publicnode.com` for mainnet — `mainnet.base.org` rate-limits parallel calls

## Deposit flow
- Approve for exact amount + `await waitForTransactionReceipt` before deposit call
