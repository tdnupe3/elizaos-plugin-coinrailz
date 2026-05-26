---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Rule
Migrate in 3 phases: canary job first (low risk), then x402GatedRoutes.ts (medium), then x402MicroserviceRoutesV2.ts (high/last). Never do phases 2 and 3 in the same deploy.

**Why:** x402 is now governed by the x402 Foundation (coinbase/x402 is now a dev fork). The @x402/* scoped packages are the canonical standard. Old packages still work but should be migrated to unlock SettlementOverrides (usage-based IoT billing) and stay ecosystem-listed.

## CRITICAL: Network Identifier Mismatch (confirmed in production)
The server's 402 challenges emit `"network":"base"` (legacy shorthand). The `@x402/fetch` client must be registered for `"base"`, NOT `"eip155:8453"`. Registering only `"eip155:8453"` causes: `No network/scheme registered for x402 version: 2 which comply with the payment requirements`.

**Fix:** Register the scheme for BOTH:
```typescript
.register("base" as any, evmScheme)       // matches server 402 shorthand
.register("eip155:8453" as any, evmScheme) // future-proof for CAIP-2
```

This applies to Phases 2 and 3 as well — the server-side route config uses shorthand (`"base"`) so any client-side scheme registration must include shorthand. The old migration plan note saying "Network: 'base' → 'eip155:8453'" was WRONG — the client must match the server's emitted format.

## Actual Key API Changes (verified against @x402/fetch 2.12.0 types)
- `wrapFetchWithPayment(fetch, wallet, max)` (3 args) → `wrapFetchWithPayment(fetch, x402Client)` (2 args)
- `x402Client` is a builder: `new x402Client().register(network, scheme).registerPolicy(fn)`
- `ExactEvmScheme` from `@x402/evm` takes a viem walletClient extended with `publicActions`
- Max amount safety via `.registerPolicy((_v, reqs) => reqs.filter(r => BigInt(r.maxAmountRequired) <= MAX))`
- `x402HTTPClient` is a wrapper around `x402Client` — for basic use, pass `x402Client` directly to `wrapFetchWithPayment`
- `paymentMiddleware(payTo, routes, facilitator)` → `paymentMiddleware({ payTo, routes, facilitator })` (Phase 2/3)

## Phase 1 Status
- Canary migrated to @x402/fetch + @x402/evm ✅
- Manual trigger endpoint added: `POST /api/admin/x402/canary-status` ... actually `POST /x402/canary-trigger` (admin-gated)
- First production run failed: network mismatch (registered "eip155:8453", server emits "base") — fixed
- Fix deployed: register both "base" and "eip155:8453" — awaiting production canary success confirmation

## Key Risks (still valid for Phases 2/3)
- hybridPaymentMiddleware header extraction may conflict with @x402/express req augmentation
- facilitatorUrl double-injection: x402ResponseEnricher already injects it; verify @x402/express doesn't add a second one
- req.paymentAlreadyVerified bypass flag must still work with new middleware

## Full Plan Location
.local/x402-migration-plan.md (complete phased plan with code examples)
