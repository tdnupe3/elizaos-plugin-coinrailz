---
name: Platform vltUSDC position
description: Platform wallet holds an active vltUSDC position on Ethereum mainnet as of Aug 5 2026
---

# Platform vltUSDC Position

## Position (as of Aug 5 2026)
- **Wallet:** 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91 (platform wallet)
- **vltUSDC shares:** 107 T ≈ $196.92
- **Share of vault:** 0.53%
- **Underlying:** 118.19 VLT + 98.46 USDC
- **Network:** Ethereum mainnet
- **Deposit tx:** 0x801c09526776a1f028ba686a79e9773739a0a09bce4fcce96167bc468587c8ec

## How it was set up
Deposited manually via bankroll.network/app.html. User sent USDC to platform wallet on Ethereum, connected wallet to Bankroll UI, executed 3-tx deposit sequence (VLT.approve + USDC.approve + vault.deposit).

## Key facts
- vltUSDC vault: 0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f (Ethereum mainnet)
- Auto-compounds VLT/USDC Uniswap V4 1% LP fees — no claiming needed
- ~31.9% APR lifetime; L/share grows passively
- No admin keys, no pause switch, immutable contract
- Track position: bankroll.network/app.html → Yours tab

**Why:** Platform built and sells vltUSDC deposit/withdraw tooling — now using it for own treasury yield.

## Monitoring
- The Coin Railz YieldPortal (client/src/pages/YieldPortal.tsx) tracks the BASE ERC-4626 vault, NOT this position
- To display vltUSDC position in dashboard, would need to read vltUSDC balance on Ethereum for platform wallet
- For now, track manually at bankroll.network
