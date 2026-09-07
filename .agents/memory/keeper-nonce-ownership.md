---
name: Keeper nonce ownership
description: Transaction-sender isolation and nonce-management rules for scheduled EVM keepers.
---

Scheduled keepers should use a dedicated minimally funded EVM account. If an account must be shared, every transaction must pass through one durable serialized nonce owner using the pending nonce.

**Why:** A fee-accrual keeper using a shared platform sender produced an explicit stale-nonce failure and a later generic raw-transaction submission rejection, while identical zero-argument calls succeeded between failures.

**How to apply:** Treat submission-layer parameter errors as possible nonce or fee-envelope failures, preserve structured provider causes, decode failed raw transactions offline, preflight with simulation, and retry nonce errors only after refreshing pending state.