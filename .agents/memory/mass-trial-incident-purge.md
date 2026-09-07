---
name: Mass trial incident purge
description: Durable production status and reporting boundary for the September 2026 mass free-trial abuse incident.
---

The staged exact-ID production purge completed after the published prevention revision and schema were verified. Incident claims, keys, ledger rows, usage rows, and newly created users have zero residuals. Two pre-existing users were preserved and their balances recomputed.

**Why:** The incident created promotional credits and synthetic identities, not customer acquisition or revenue. Future assessments must not rediscover retained telemetry and mistake it for unpurged entitlements or genuine conversion.

**How to apply:** Exclude the entire incident from acquisition, activation, conversion, and revenue reporting. Ambiguous endpoint-hit, SDK-install, and x402 telemetry was intentionally retained because it could not be tied safely to exact identities; do not purge it by time and user agent alone.