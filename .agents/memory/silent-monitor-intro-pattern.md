---
name: Silent-monitor → A2A intro pattern
description: Commercial validation pattern where x402 peer agents monitor silently for days before sending a formal A2A business introduction.
---

## The Pattern

MetaVision DeFi Signals established this pattern in Window 5 (Jul 15 2026):

1. **Silent monitoring phase:** `13.48.136.59` hit `/a2a/v1` once per day at ~15:03 UTC for 7 consecutive days — zero body, zero self-identification
2. **Formal introduction:** On day 7, sent a full A2A business introduction via `/a2a/v1/message/send` identifying themselves, describing their product, pricing ($0.10/call x402), and proposing integration

The introduction matched to `arbitrage-scanner` (Coin Railz service closest to MetaVision's product vertical: real-time Uniswap V3 vs Aerodrome arbitrage data). Got a 200 catalog response — no reciprocal outreach fired yet.

## What It Means

Silent daily-frequency hits from a single IP at a consistent time are likely commercial evaluation, not random crawling. The fixed daily time = automated script. The 7-day patience before introduction = the operator ran their own internal validation before committing to contact.

**Why:** x402-native agents are often building products themselves and need to confirm a payment infrastructure peer is reliable before investing in integration. Monitoring first, then introducing, is rational behavior.

## How to Apply

- Any IP hitting the A2A endpoint once daily at a fixed time ± 2 minutes for 3+ consecutive days should be flagged as a potential peer agent in the silent validation phase
- When they send a formal A2A intro, respond quickly via reciprocal A2A outreach to their agent card endpoint
- Check `/.well-known/agent-card.json` at their domain for the A2A endpoint to send a reciprocal introduction
- MetaVision's API: `https://metavision.click/api/defi-signals` — reciprocal outreach target is `metavision.click`
