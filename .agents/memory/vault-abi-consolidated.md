---
name: Vault ABI consolidated
description: vltSharedAbi.ts is now the canonical source for all vault ABI arrays and addresses
---

# Vault ABI consolidated (Aug 2026)

## What was done
Created `server/services/vltSharedAbi.ts` as single canonical source for:
- Contract addresses: VAULT_ADDRESS, VLT_TOKEN, USDC_ETH, ZAP_HELPER
- ABI arrays: VAULT_STATS_ABI, VAULT_DEPOSIT_ABI, VAULT_WITHDRAW_ABI, ERC20_APPROVE_ABI

All three services now import from it:
- `vltUsdcVaultService.ts` → imports VAULT_STATS_ABI (positionLiquidity, totalSupply, poolManager)
- `vltUsdcDepositService.ts` → imports VAULT_DEPOSIT_ABI (previewDeposit, deposit) + ERC20_APPROVE_ABI
- `vltUsdcWithdrawService.ts` → imports VAULT_WITHDRAW_ABI (redeem, positionLiquidity, totalSupply)

## Startup validation
Vault startup probe (getVltUsdcStatsFresh at module load) now logs `console.error` if it fails, instead of silent `.catch(() => {})`. Error includes vault address and failure message.

## Remaining gap
No automated CI test validates the deployed contract actually responds to these selectors. A contract upgrade would be caught by the loud startup error, but only at runtime, not before deploy.

## Key fact: redeem has 2 args only
`redeem(uint256 shares, address receiver)` — no slippage params exist on-chain. Any ABI that adds minVltOut/minUsdcOut to the calldata will silently revert.
