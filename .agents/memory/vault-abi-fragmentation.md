---
name: Vault ABI fragmentation
description: 3 independent inline ABIs for vltUSDC vault; no shared source or on-chain validation
---

# Vault ABI fragmentation (open task #90)

## The problem
Three separate files each define their own inline ABI fragments for the vltUSDC vault (0xee8d, Ethereum mainnet):

- `server/services/vltUsdcVaultService.ts`: `VAULT_ABI` with `positionLiquidity()`, `totalSupply()`, `poolManager()`
- `server/services/vltUsdcDepositService.ts`: `previewDeposit(uint256,uint256)` + `deposit(uint256,uint256,uint256,uint256,address)` calldata
- `server/services/vltUsdcWithdrawService.ts`: `redeem(uint256,address) returns (uint256,uint256)` + stats methods

No shared canonical ABI source. No validation against on-chain bytecode or selector hashes.

**Why this matters:** If the vault contract is upgraded (same or new address), all 3 files need manual updates. A missed update causes silent incorrect behavior or reverts at runtime — funds-flow risk for deposit/withdraw services.

## Fix approach
1. Create one canonical ABI source file (generated from verified contract artifact or manually maintained as single truth)
2. Import that ABI into all 3 services
3. Add startup or CI check against configured chain/address: validate interface selectors or bytecode hash
4. Add integration tests covering `previewDeposit`, `deposit`, `redeem`, stats methods
5. Fail closed with explicit operational error when contract identity is unexpected

## Priority
P1 — no current mismatch, but contract upgrades are silent failures. Handle before next vault upgrade or promotion.
