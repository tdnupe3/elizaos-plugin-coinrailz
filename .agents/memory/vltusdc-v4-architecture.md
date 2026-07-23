---
name: vltUSDC Uniswap V4 vault — correct architecture
description: Correct contract addresses, ABIs, and pool facts for the Bankroll Network vltUSDC vault. Previous code had vault/ZapHelper swapped and wrong pool entirely.
---

## Confirmed addresses (verified via eth_call on Ethereum mainnet)

| Contract | Address | How confirmed |
|---|---|---|
| **Vault = vltUSDC ERC-20** | `0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f` | `totalSupply()` returns 4,643 T — page matches |
| **ZapHelper** (USDC-only periphery) | `0x348A57b1dc6E3dCAa645DE6e4E864924B410525D` | `totalSupply()` reverts — NOT an ERC-20 |
| **VLT token** | `0x6b785a0322126826d8226d77e173d75DAfb84d11` | unchanged |
| **USDC (Ethereum)** | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | unchanged |
| **V4 PoolManager** | `0xe0554a476a092703abdb3ef35c80e0d76d32939f` | from bankroll vltUSDC.bundle.js |

## The vault IS the share token
In Bankroll's design, the vault contract (0xee8d...) IS the vltUSDC ERC-20. There is no separate "vault" and "share token" — they are the same contract.

## What the previous code had wrong
- `VAULT_ADDRESS = 0x348A...` — this was actually the ZapHelper
- `VLT_USDC_TOKEN = 0xee8d...` — this was actually the vault (correct address, wrong label)
- Underlying pool described as "VLT/WETH Uniswap V2" — WRONG. It's VLT/USDC Uniswap V4
- `getReserves()` called on VLT/WETH V2 pair `0x966053...` — wrong contract entirely
- Deposit calldata sent to ZapHelper (0x348A) with ERC-4626 interface — wrong

## Underlying pool
- **Pair**: VLT/USDC (NOT VLT/WETH)
- **Protocol**: Uniswap V4 (NOT V2)
- **Fee**: 1% (10000 bps)
- **Tick spacing**: 200
- **Range**: Full-range
- **Hooks**: None (address(0))
- **Auto-compounds**: Yes — on next deposit, fees harvested and reinvested; no keeper needed

## Vault deposit ABI (from bankroll/vltUSDC.bundle.js)
```solidity
// Balanced deposit (both tokens required)
function deposit(
  uint256 vltAmount,
  uint256 usdcAmount,
  uint256 minShares,
  uint256 deadline,
  address recipient
) returns (uint256 shares)
```
- Requires approvals: VLT.approve(vault, vltAmount) AND USDC.approve(vault, usdcAmount)
- Vault uses tokens in proportion to current pool price; returns any excess to recipient
- 3 steps total: VLT approve → USDC approve → vault.deposit

## ZapHelper deposit ABI (USDC-only path)
```solidity
function zapDeposit(
  uint256 usdcAmount,
  uint256 swapUsdcToVlt,
  uint256 minVltOut,
  uint256 deadline,
  address recipient,
  bytes swapData       // ← encoded Universal Router swap path, must be fetched at runtime
) returns (uint256 shares)
```
- Requires USDC.approve(ZapHelper, usdcAmount) — approve to ZapHelper NOT vault
- `swapData` requires live routing from Uniswap Universal Router — cannot be statically pre-computed
- Best for agents via Bankroll UI: https://bankroll.network/vltUSDC.html

## Share denomination
- Shares are in Uniswap V4 liquidity units (L) — NOT USD
- L/share starts at 1.0000, grows as fees auto-compound
- No oracle anywhere in the system — value is pro-rata claim on V4 position
- Page stat "positionLiquidity (L): 4,643 T" = raw uint128 liquidity units

## Stats derivation (correct approach)
1. `vault.positionLiquidity()` → L (uint128, raw liquidity)
2. `vault.totalSupply()` → total vltUSDC shares (same units)
3. L/share = positionLiquidity / totalSupply
4. TVL: DexScreener — query VLT token, find VLT/USDC pair on Ethereum

## Files updated
- `server/services/vltUsdcVaultService.ts` — complete rewrite
- `server/services/vltUsdcDepositService.ts` — complete rewrite  
- `server/routes/vltVaultRoutes.ts` — corrected addresses and descriptions
- `server/routes/x402MicroserviceRoutesV2.ts` — updated service description
- `client/src/pages/YieldPortal.tsx` — updated interface and UI labels
- `server/appMain.ts` — updated info endpoint and comment

**Why this matters:** The old code was calling getReserves() on a V2 pair that has nothing to do with vltUSDC. All TVL stats were wrong, deposit calldata went to wrong address, and every description told agents incorrect information about the pool.
