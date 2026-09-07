---
name: Trial identity and grants
description: Durable anti-abuse rules for free-trial key and credit issuance.
---

Caller-supplied forwarded IP values are not trustworthy trial identities. Hashing an untrusted value does not make it trustworthy. A trial claim must be reserved durably and atomically before creating a key or granting credits. The identity HMAC uses a dedicated, stable secret; reservation-scoped grant references preserve seven-day renewal while preventing duplicate value within one claim attempt.

**Why:** A rotating forwarded-IP campaign created a distinct identity per request at high volume. Process-local caching, fail-open database checks, and asynchronous post-provision claim logging could not enforce a global one-trial rule.

**How to apply:** Replace inbound forwarding headers at the public bootstrap, trust only its loopback hop, and fail closed if the dedicated identity secret is absent. Put reservation, user/account, key, ledger, balance, claim log, and completion in one serializable transaction; retry serialization conflicts only.