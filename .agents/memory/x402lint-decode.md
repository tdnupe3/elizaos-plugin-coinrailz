---
name: x402lint decode failures
description: payment-decode-failed events from x402lint.dev are their bug, not ours
---

# x402lint decode failures — not our bug

## The rule
When `payment-decode-failed` fires at `paymentOrchestrator.ts:1884`, it means OUR server received an `X-PAYMENT` header from the client that our decoder could not parse — NOT that we sent a malformed 402 body.

**Why this matters:** The architect's first hypothesis (network field encoding) was wrong. Live curl confirmed `accepts[0].network = eip155:8453` for all services including the ones x402lint marked as failing.

**Empirical proof:** A valid x402 v2 payment (base64-JSON, `network: eip155:8453`, real EIP-3009 structure, zero-byte dummy sig) was sent to both `first-call` and `satellite-earthdata`. Our decoder decoded it successfully; the failure came at ECRecover signature verification — correct behavior. No `payment-decode-failed` event was generated.

**How to apply:**
- If `payment-decode-failed` appears in logs for x402lint.dev specifically, it is their implementation issue
- Our decoder handles 6 formats: base64-JSON, base64-CBOR, msgpack, raw JSON string, `0x` tx hash, raw EIP-3009 binary
- x402lint selectively sends payment attempts to some services (first-call, satellite-earthdata, earthdata-precipitation) but not others (ping, gas-price-oracle) — reason unknown (possibly vertical classifier or `firstCallFree` heuristic)
- No code change needed on our side; if x402lint fixes their payment construction and rescans, it will succeed
