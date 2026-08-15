---
name: Hardcoded prices in 402 body fixed
description: recommendedServices.priceUSD and firstCallFree.priceNormally now derive from shared/pricing.ts
---

# Hardcoded prices in 402 body — fixed

## What was wrong
Two files had hardcoded USD price string literals in 402 response body fields:

- `server/routes/x402GatedRoutes.ts:697-700` — `recommendedServices[].priceUSD` for ping/trade-signals/wallet-risk/instant-agent-wallet
- `server/middleware/paymentOrchestrator.ts:3593-3597` — same for gas-price-oracle/token-metadata/trade-signals/wallet-risk/agent-create-wallet
- `server/middleware/paymentOrchestrator.ts:3617` — `firstCallFree.priceNormally` hardcoded as `"$0.10"`
- `server/routes/x402GatedRoutes.ts:62-71` — local `SERVICE_PRICING` object (not imported from shared/pricing.ts; separate code path)

The `accepts[].maxAmountRequired` (machine-readable payment amount) was already dynamic. Only the human/agent-readable text fields were stale.

## What was fixed
- Added `formatUSD` and `getServicePriceUSD` to the imports in both files
- Replaced all hardcoded `"$X.XX"` literals with `formatUSD(SERVICE_PRICING_USD['service-id'])`
- `firstCallFree.priceNormally` now uses `formatUSD(getServicePriceUSD('gas-price-oracle'))`

## Remaining gap
`server/routes/x402GatedRoutes.ts:62-71` has a local `SERVICE_PRICING` object with independently duplicated values (uses `token-price-lookup` instead of canonical `token-price`). This feeds the legacy gated route's `accepts.price` fields. Not fixed in this pass — requires confirming whether the legacy route is still active.
