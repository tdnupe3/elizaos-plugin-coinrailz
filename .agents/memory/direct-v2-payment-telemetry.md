---
name: Direct v2 payment telemetry
description: A production safe probe exposed a direct x402 analytics mismatch for the current v2 payment header.
---

Direct x402 telemetry must recognize `PAYMENT-SIGNATURE` as a payment header in the same way it recognizes legacy `X-PAYMENT`.

**Why:** A no-money production probe on 2026-08-26 sent the same deliberately incomplete v2 envelope under each header. Both requests reached the payment parser and were rejected with a structured 400 before settlement, but the direct interaction record for the v2 header could report `hasPaymentHeader: false`. That makes real v2 payment attempts and retries appear to be ordinary no-payment traffic.

**How to apply:** Keep payment-funnel assessments separate from raw 402 volume. Until direct telemetry is corrected and tested, validate v2 attempt behavior using payment parser events and request-level evidence rather than the direct retry flag alone.