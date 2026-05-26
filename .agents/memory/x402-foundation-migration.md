---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Rule
Migrate server middleware FIRST, then the canary client. The original phase order (canary first) was wrong.

**Correct order:**
1. x402GatedRoutes.ts → @x402/express (server emits CAIP-2 network IDs for those routes)
2. x402MicroserviceRoutesV2.ts → @x402/express (main 60-service router)
3. x402CanaryJob.ts → @x402/fetch (ONLY after server emits CAIP-2)

**Why order matters:** ExactEvmScheme from @x402/evm internally validates that the network string in the 402 challenge is CAIP-2 format (`eip155:8453`). The server currently emits `"network":"base"` (shorthand). Changing network identifier in the client (canary) without changing the server causes: `Unsupported network format: base (expected eip155:CHAIN_ID)`. You cannot fix this on the client side — the server controls what goes in the 402 challenge.

**Why you can't just change the server network field yet:** x402-express@0.7.1 PaymentRequirementsSchema validates network against a hardcoded enum that includes `"base"` but NOT `"eip155:8453"`. Emitting CAIP-2 would cause a ZodError blocking all payments (same issue that killed Ethereum mainnet support).

## CRITICAL: Network Identifier Facts (verified in production)
- Server currently emits: `"network":"base"` (x402-express@0.7.1 enum constraint)
- @x402/evm ExactEvmScheme requires: `"eip155:8453"` (CAIP-2 internally)
- These are incompatible until the server is migrated to @x402/express

## Current State (May 2026)
- Canary: REVERTED to x402-fetch@0.7.3 (was working, 9/9 successes — keep it there)
- New: `POST /x402/canary-trigger` admin endpoint added (gated by ADMIN_KEY) for manual runs
- New: `X402CanaryJob.triggerNow()` public static method
- @x402/* packages all installed at 2.12.0, dormant until server migration

## Key API Changes (verified against @x402/fetch 2.12.0 types — for future use)
- `wrapFetchWithPayment(fetch, wallet, max)` (3 args) → `wrapFetchWithPayment(fetch, x402Client)` (2 args)
- `x402Client` builder: `new x402Client().register(network, scheme).registerPolicy(fn)`
- `ExactEvmScheme` from `@x402/evm` takes viem walletClient `.extend(publicActions)`
- Max amount safety: `.registerPolicy((_v, reqs) => reqs.filter(r => BigInt(r.maxAmountRequired) <= MAX))`
- `paymentMiddleware(payTo, routes, facilitator)` → `paymentMiddleware({ payTo, routes, facilitator })` (Phase 1/2)

## Key Risks for Phase 1 (x402GatedRoutes.ts)
- hybridPaymentMiddleware header extraction may conflict with @x402/express req augmentation
- facilitatorUrl double-injection: x402ResponseEnricher already injects it; verify @x402/express doesn't add a second one
- req.paymentAlreadyVerified bypass flag must still work with new middleware
- Once migrated, 402 challenges for those routes will emit CAIP-2 — verify Bazaar/x402scan still indexes them correctly

## Full Plan Location
.local/x402-migration-plan.md (complete phased plan with code examples — update phase order before using)
