---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Rule
Migrate in 3 phases: canary job first (low risk), then x402GatedRoutes.ts (medium), then x402MicroserviceRoutesV2.ts (high/last). Never do phases 2 and 3 in the same deploy.

**Why:** x402 is now governed by the x402 Foundation (coinbase/x402 is now a dev fork). The @x402/* scoped packages are the canonical standard. Old packages still work but should be migrated to unlock SettlementOverrides (usage-based IoT billing) and stay ecosystem-listed.

## Key API Changes
- `paymentMiddleware(payTo, routes, facilitator)` → `paymentMiddleware({ payTo, routes, facilitator })`
- `facilitator` from `@coinbase/x402` → `new Facilitator({ url: getFacilitatorUrl() })` from `@x402/core`
- `wrapFetchWithPayment(fetch, wallet, max)` → `wrapFetchWithPayment(fetch, new x402HTTPClient({ wallet, maxAmount }))`
- Network: `"base"` legacy → `"eip155:8453"` CAIP-2 (NETWORK_CAIP2 constants in facilitatorHelper already correct)

## Key Risks
- hybridPaymentMiddleware header extraction may conflict with @x402/express req augmentation
- facilitatorUrl double-injection: x402ResponseEnricher already injects it; verify @x402/express doesn't add a second one
- req.paymentAlreadyVerified bypass flag must still work with new middleware

## Full Plan Location
.local/x402-migration-plan.md (complete phased plan with code examples)

## Current State (May 2026)
- @x402/* packages all installed at 2.12.0 but UNUSED in production
- Production uses: x402-express@0.7.1, x402-fetch@0.7.3, @coinbase/x402@0.7.1
- Canary: 9 consecutive successes — solid baseline before migration
