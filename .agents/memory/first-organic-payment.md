---
name: First organic external revenue
description: The first confirmed real, non-canary payment from an external autonomous agent — June 1, 2026
---

## The Milestone

**Date:** June 1, 2026
**Agent:** `undici` user-agent, IP `92.255.110.46`
**Wallet:** `0x3803a19280deefe533d177c4a169412bd341101b`

## Payments Made

| Time (UTC) | Service | Amount | TX / Record |
|-----------|---------|--------|-------------|
| 04:15 | earthdata-ocean-color | **$0.25 USDC** | authorized + payment-verified, x402_interactions IDs 681520/681521 |
| 07:15 | first-call | **$0.05 USDC** | authorized + payment-verified, x402_interactions IDs 681808/681809 |

**Total: $0.30 USDC organic external revenue**

## Context

- This agent first appeared May 29, 2026 attempting `satellite-earthdata` with insufficient balance
- Spent ~3 days exploring the catalog across multiple services
- Funded its wallet and returned June 1, paying twice
- At 09:15 UTC, submitted a full 1,077-byte payment payload to `satellite-earthdata` ($0.25) — the payment was decoded and processed correctly, but the wallet had run dry after the first two payments
- The platform had zero implementation friction — the only failure mode was the agent's own balance

## What it Means

**Why:** This confirms the x402 payment flow works end-to-end for a real autonomous agent operating on its own budget. The agent explored, evaluated, funded, paid, and attempted to pay again. That is the intended behavior of the entire platform.

**How to apply:** When reviewing future payment data, treat wallet `0x3803a192...` as a known returning payer. It targets environmental/earth data services primarily (earthdata-ocean-color, satellite-earthdata) and uses first-call as a canonical handshake test. Expect return after wallet replenishment — likely 24-72 hours from last dry event.
