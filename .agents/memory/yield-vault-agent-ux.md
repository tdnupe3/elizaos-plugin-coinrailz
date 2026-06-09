---
name: Yield vault agent UX design decisions
description: Why the deposit widget uses preset amounts and how the agent API is structured
---

## Rule
The deposit widget uses preset buttons ($10, $50, $100, $250, $1000) as the primary interaction model, not free-text amount inputs. Wallet address is the only free-text input.

**Why:** "Paste your wallet and amount" is human form UX. AI agents don't paste — they call APIs. Presets reduce the decision surface to one choice and eliminate float/decimal confusion. Agents call `GET /api/yield/deposit-tx?preset=100&recipient=0xWALLET` — no math, no unit conversion.

**How to apply:**
- Always keep `?preset=` as the recommended param (vs `?amount=` for custom amounts)
- New `/api/yield/presets` endpoint returns all presets with pre-computed fee breakdown — agents can read this before deciding
- Widget auto-fetches transactions when preset + valid wallet are both present (no click needed)

## Security rules (enforced in deposit-tx route)
- $10 minimum (dust/spam prevention)
- $50,000 maximum per transaction (share price manipulation prevention)  
- 5 requests per wallet per 10 minutes (in-memory Map, resets on server restart)
- Preset whitelist: only [10, 50, 100, 250, 1000] accepted for `?preset=`
- 0x address regex validation

## Fee structure (preserved in contract + API)
- 0.5% entry fee (deducted from principal inside contract)
- 15% performance fee on yield only (never on principal)
- 0% exit fee
- Fee caps hard-coded in bytecode: entry ≤ 2%, performance ≤ 30%

## Endpoints added
- `GET /api/yield/presets` — canonical preset list with per-amount fee/yield preview
- `GET /api/yield/deposit-tx?preset=N&recipient=0x...` — preset param now supported alongside ?amount=
