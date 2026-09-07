---
name: Trial identity and grants
description: Durable anti-abuse rules for free-trial key and credit issuance.
---

Caller-supplied forwarded IP values are not trustworthy trial identities. Hashing an untrusted value does not make it trustworthy. A trial claim must be reserved durably and atomically before creating a key or granting credits.

**Why:** A rotating forwarded-IP campaign created a distinct identity per request at high volume. Process-local caching, fail-open database checks, and asynchronous post-provision claim logging could not enforce a global one-trial rule.

**How to apply:** Derive client IP only through explicitly trusted proxy configuration, add stronger identity and velocity controls, fail closed on claim-reservation errors, and use a unique transactional reservation as the prerequisite for every key and credit grant.