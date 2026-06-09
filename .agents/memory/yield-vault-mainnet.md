---
name: Yield Vault mainnet deployment
description: CoinRailz ERC-4626 yield vault live on Base mainnet — v2.1 addresses, compilation, ABI changes, keeper, Morpho bug fix
---

## Vault Addresses
- **Mainnet v2.1 (Base)**: `0x86e2508ca0de34530dc847645f60f0d46d95176a` (ACTIVE — deployed 2026-06-09, currently on Morpho Blue @ 4.96%)
- **Mainnet v2 (Base)**: `0x24594ffa7b25333d41e0032c2ad7b47d68c84904` (ABANDONED — $12.12 permanently stuck in Morpho; do not use)
- **Mainnet v1 (Base)**: `0xf8f67d6422fc60114a11ada3dca297ab6a255a29` (DEPRECATED — all funds redeemed 2026-06-09)
- **Env var**: `YIELD_VAULT_ADDRESS=0x86e2508ca0de34530dc847645f60f0d46d95176a` (shared env)

## CRITICAL: Morpho Blue Balance Bug (fixed in v2.1)
`expectedSupplyAssets(marketParams, user)` is a **MorphoLib library helper — it does NOT exist on the Morpho Blue singleton**. Calling it on the singleton reverts. The `try/catch` silently returns 0, causing `totalAssets() = 0`. This makes `emergencyWithdraw()` burn shares for 0 USDC — funds permanently stuck.

**Fix**: Use shares math directly:
```solidity
(uint256 supplyShares,,) = morpho.position(morphoMarketId, address(this));
return supplyShares * (uint256(m.totalSupplyAssets) + 1) / (uint256(m.totalSupplyShares) + 1_000_000);
// VIRTUAL_ASSETS=1, VIRTUAL_SHARES=1e6 per Morpho Blue spec
```
Also added `ownerRescueMorpho(address recipient)` which withdraws by shares (`assets=0, shares=allShares`) — bypasses any totalAssets() path.

**Why v2 was unrescuable**: The vault must be msg.sender to call `morpho.withdraw(onBehalf=vault)`. All vault paths that call `_withdrawFromProtocol` take amount from `totalAssets()` (= 0). No external function exists to call `_withdrawFromProtocol(amount > 0)` without the vault computing amount itself. Flash loans, delegatecall tricks, and `setAuthorizationWithSig` all fail because Morpho Blue uses ECDSA-only (no EIP-1271) and the vault can't authorize a helper contract.

## Vault Config v2.1
- Token: crUSDC, ERC-4626, asset = USDC
- Deployer/owner/fee recipient: `0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91` (server wallet)
- Entry fee: 0.5%, Performance fee: 15% (Yearn-style share-mint accrual), Exit fee: 0%
- Protocols: Aave v3 (3.13%), Compound v3 (0.63%), Morpho Blue (4.96%) — currently active
- Rebalance: auto 24h cooldown; keeper fires every 6h

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

## Constructor (v2.1 — 9 args)
`_asset, _feeRecipient, _aavePool, _aUsdc, _compoundComet, _morpho, _morphoMarket, _morphoIrm, _initialProtocol`
- Deploy with `_morpho=zero, _morphoMarket=empty, _morphoIrm=zero` then call `configureMorphoMarket()` after verifying market params on-chain.
- Compound Comet on Base: `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf` (not `0xb125...` — wrong checksum/length)

## RPC
- Always `base-rpc.publicnode.com` for mainnet — `mainnet.base.org` rate-limits parallel calls

## Deposit flow
- Approve for exact amount + `await waitForTransactionReceipt` before deposit call
