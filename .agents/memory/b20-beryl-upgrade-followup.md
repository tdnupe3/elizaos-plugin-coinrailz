---
name: B20 Beryl Upgrade — Post-Launch Follow-Up
description: Base's Beryl upgrade (B20 native token standard) launches July 8 2026 at 18:00 UTC — review after it goes live before building anything
---

## What Is It
Base's "Beryl" hardfork activates the B20 Native Token Standard on mainnet July 8, 2026 at 18:00 UTC. B20 is a Rust precompile superset of ERC-20 with built-in compliance controls (freeze, seize, blocklist, allowlist, role-based access, transfer memos). Full ERC-20 backward compatible.

## Status
Delayed from June 25 after a 2-hour Base consensus failure at block 47,806,542. The two NULL tx_hash canary rows on June 25 (~01:51–01:55 UTC) are almost certainly caused by that outage — not a platform bug.

## Action Required After Upgrade
**Do not build B20 services until after the upgrade is confirmed stable.** Check back after July 8 18:00 UTC:
1. Confirm Beryl activated cleanly on Basescan (no second outage)
2. Check canary health around that window (18:00–20:00 UTC could see degraded network)
3. Review what B20 tooling/SDKs are available post-launch
4. Then decide which of these services to build:
   - `b20-token-info` — metadata, supply, compliance status for any B20 token (~$0.05)
   - `b20-transfer-check` — simulate whether a transfer will succeed given freeze/blocklist state (~$0.10)
   - `b20-compliance-scan` — check if an address is allowlisted/blocklisted across major B20 issuers (~$0.25)

## Also Watch
- Whether B20 Stablecoin tokens implement EIP-3009 (needed for x402 payment compatibility)
- Next upgrade: **Cobalt** (September 2026) — native account abstraction, gas payment in B20 tokens, ~50% cheaper transfers, doubled throughput

**Why:** User confirmed: wait for upgrade stability before building. Beryl was already delayed once due to a chain outage.
