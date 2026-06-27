---
name: VLT ERC-20 payout rails
description: Multi-token payout system for esports; VLT as launch token; key field names and chain constraints
---

## What was built
`server/routes/esportsPartnerRoutes.ts` v2.0.0 with full VLT payout support.

## Critical facts

**VLT contract:** `0x6b785a0322126826d8226d77e173d75DAfb84d11` — Ethereum mainnet ONLY (18 decimals)
**Platform wallet:** `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` — send VLT here to fund payouts
**Recommended float:** ≥20,000 VLT (~$6,500 at $0.32/VLT) for ~40 × $150 prize payouts

## New endpoints
- `POST /api/partner/esports/payout` — `currency:'VLT'` param; VLT forced to ethereum chain; USD→VLT via vltMarketCache
- `POST /api/partner/esports/register-recipient` — pre-registers winner wallets (required before VLT payout); auto-whitelists in CDP safety layer
- `GET /api/partner/esports/wallet-balance` — live VLT + USDC float with ⚠️ warning < 5000 VLT
- `GET /api/partner/esports/swap-quote?type=eth-vlt&amount=X` — live Uniswap V2 quote (read-only)

## Schema additions
- `esports_partner_recipients` table: `partner_api_key_hash, wallet_address, chain, label, per_tx_limit_usd, daily_limit_usd, active`
- `esports_transactions` new columns: `payout_token, payout_amount_token, fee_token, swap_tx_hash`

## Bug fixed: aiAgentSubscriptions field name
The `requirePartnerKey` middleware was using `aiAgentSubscriptions.apiKey` — WRONG.
Correct field: `aiAgentSubscriptions.apiKeyHash` (maps to `api_key_hash` column).
Without this fix the WHERE clause was blank and every auth attempt threw a DB error.

## CDP service TOKEN_REGISTRY
```typescript
'VLT': { 'ethereum-mainnet': '0x6b785a0322126826d8226d77e173d75DAfb84d11' }
```
To add future ERC-20 tokens: add a new entry here + update `SUPPORTED_PAYOUT_TOKENS`.
`sendToken()` already handles decimals dynamically via on-chain `decimals()` call.

**Why:** VLT only exists on Ethereum mainnet; the system hardcodes `chainKey = 'ethereum'` when `currency === 'VLT'`.
**How to apply:** Any future multi-chain token needs its chain entries in TOKEN_REGISTRY and the payout route's chain override logic updated.
