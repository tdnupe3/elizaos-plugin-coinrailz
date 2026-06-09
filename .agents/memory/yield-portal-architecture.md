---
name: Yield Portal architecture
description: CoinRailz AI Agent Yield Portal — ERC-4626 auto-routing USDC vault for AI agents.
---

## What Was Built

- **Smart contract**: `contracts/CoinRailzYieldVault.sol` — self-contained, no external imports needed to read/review. Uses constructor params for all protocol addresses (testnet/mainnet flexibility). @openzeppelin/contracts IS in package.json but Hardhat is not set up yet.
- **API routes**: `server/routes/yieldPortalRoutes.ts` at `/api/yield/*`
- **Frontend**: `client/src/pages/YieldPortal.tsx` at `/yield-portal`
- **Discovery**: Added to `/.well-known/x402.json` (yieldVault section) and `discoveryManifests.yieldPortal`

## Key Design Decisions

- **0.5% entry fee on ALL deposits** — no exception for returning wallets, charged immediately
- **No switch fee** — rebalancing is automatic (daily), agents never pay to move between protocols
- **15% performance fee** — accumulated as `pendingFees`, only harvested when `pendingFees >= $5` (5_000_000 USDC units)
- **High-watermark**: cost basis tracked per depositor (`costBasisAssets`, `costBasisShares`); performance fee only on positive yield
- **Auto-routing**: `rebalance()` callable by anyone, 24h cooldown, only moves if APY improvement >= 50 bps
- **Gap #5 compliance**: no admin principal withdrawal, fee params behind 48h timelock, emergency exit always available
- **Hard fee caps**: entry ≤ 2%, performance ≤ 30% (enforced in contract, not just UI)

## Live Status (as of June 2026)

- All 5 API endpoints live and returning real data from Base mainnet:
  - Aave v3 APY: ~3.16% (live on-chain via viem + Alchemy)
  - Compound v3: 0% (fetch works but rate shows 0 — may need getUtilization() debugging)
  - Morpho: 0% (not integrated yet — placeholder)
- Contract NOT yet deployed (shows "deploying-soon")
- `YIELD_VAULT_ADDRESS` env var will activate contract-linked endpoints once set

## Next Steps for Deployment

1. Install Hardhat: `npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox`
2. Create `hardhat.config.ts` targeting Base Sepolia
3. Deploy to Base Sepolia with testnet constructor args
4. Set `YIELD_VAULT_ADDRESS` env var
5. Test deposit/withdraw cycle on testnet
6. External audit, then mainnet deploy

## Protocol Addresses (Base Mainnet)

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Aave v3 Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Aave aUSDC: `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB`
- Compound v3 Comet: `0xb125E6687d4313864e53df431d5425969c15Eb2`
- Morpho Blue: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFc`
