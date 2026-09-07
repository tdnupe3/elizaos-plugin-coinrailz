---
name: Organic revenue reporting
description: Durable rules for separating organic revenue from canaries, platform wallets, and stale historical snapshots.
---

# Organic Revenue Reporting

Always calculate payment counts, revenue, payer counts, and the latest organic payment from a fresh production query. Never reuse a historical total or “last payment” date from memory.

**Why:** Organic payments can arrive between assessments, while canary and platform-wallet activity can dominate raw totals and make a stale snapshot materially misleading.

**How to apply:** Use the authoritative payment-intent ledger with successful status, report `is_canary=true` separately, and exclude known platform/test wallets from organic totals. Reconcile any new external payment with its service, transaction, and delivery telemetry before calling it a conversion.
