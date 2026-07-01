---
name: 0x9cc42f3d payment pattern
description: Returning high-value payer from IP 74.220.48.244; session history, stuck-retry pattern diagnosis, and what NOT to flag as bugs.
---

# Payer 0x9cc42f3d — Session History & Diagnosis Rules

**Why:** This payer repeatedly returns after depleting their wallet. Their stuck-retry behavior has been mistakenly flagged as a platform bug multiple times. This file documents the pattern so future agents don't waste diagnostic cycles.

**How to apply:** When 74.220.48.244 shows 20+ POST retries on any service with no X-PAYMENT header attached, check session history and assume wallet depleted before any platform investigation.

---

## Session History (all from IP 74.220.48.244, UA: node)

| Session | Date | Revenue | Services | Notes |
|---------|------|---------|----------|-------|
| S1 | ~Feb 2026 | $10.30 | ~6 | First appearance |
| S2 | ~Mar 2026 | $11.95 | ~8 | |
| S3 | ~Apr 2026 | $9.75 | ~7 | |
| S4 | ~May 2026 | $0.30 | recon | Low spend, scouting session |
| S5 | ~Jun 2026 | $5.40 | 11 | Prediction markets, forex/stock sentiment, trading-signal $1, risk-metrics $1; returns every 2–7 days |
| S7 | Jul 1 2026 | $0.00 | — | WALLET DEPLETED: 28 retries on construction-progress, 26 on credit-risk-score, no payment on either; parallel retries = classic depletion signature |

## Stuck-Retry Pattern (Wallet Depletion Signature)

- 40–50 second retry interval (agent SDK backoff)
- Multiple services hit simultaneously from same IP
- Zero X-PAYMENT headers across all retries
- Retries stop after 1–2 hours (agent process killed or manual stop)
- Platform 402 body is correct — enricher fires, x402Version:2 + accepts array intact

## Root Cause of Stuck Retries

The agent's x402 SDK reads the 402 body, attempts EIP-3009 authorization or USDC transfer, gets an on-chain insufficient-balance error, and retries without X-PAYMENT (because payment construction failed — there's nothing to attach). The SDK loops until the process is killed.

**Platform action required: none.** The 402 body already includes top-up instructions (trial key, Stripe checkout, Transak on-ramp). The agent will return when they refill their wallet.

## Diagnostic Elimination Checklist

Before flagging CP/CRS (or any service) as broken:
1. Is it from 74.220.48.244 with node UA and 40–50s retry intervals? → Wallet depleted.
2. Does `📚 Added N recommendations` appear in the 402 log? → Enricher fired correctly, body is good.
3. Is the 402 body missing from logs (only funnel logs visible)? → Log filter excludes "🔧 Injecting" (doesn't contain service name); search for "Injecting discoverable" separately.
