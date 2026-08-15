---
name: Enterprise GET discovery price bug — fixed Aug 15 2026
description: GET /x402/{enterprise-slug} was returning 100x inflated prices; root cause and fix.
---

# Enterprise GET Discovery Price Bug (fixed Aug 15 2026)

## What was wrong
server/routes/x402MicroserviceRoutesV2.ts had an `enterpriseDirectEndpoints` array with hardcoded price strings:
- compliance-consultation: "$500" (should be $5.00)
- smart-contract-audit: "$1000" (should be $10.00)
- payment-processing: "$50" (should be $0.50)

The GET handler computed: `const priceInMicro = parseFloat(service.price.replace('$', '')) * 1000000`

This put 500,000,000 in maxAmountRequired for compliance-consultation instead of 5,000,000. POST routes correctly used SERVICE_PRICING_MICRO.

## Impact
Every agent doing GET discovery on these 3 services was quoted 100x the real price. Agents that tried to pay the real price ($5) got rejected. This blocked all compliance-consultation conversions (5 IPs validating it this window, 0 paid).

## Fix applied
1. Replaced hardcoded price strings with `$${microToUSD(SERVICE_PRICING_MICRO[slug])}` template literals
2. Changed line 3156 handler to use `SERVICE_PRICING_MICRO[service.slug as keyof typeof SERVICE_PRICING_MICRO]` — cannot drift
3. Fixed `maxAmountRequiredUSD` field to derive from priceInMicro

**Why:** SERVICE_PRICING_MICRO is the canonical source; POST payment verification already used it. GET discovery must match or agents get rejected when they try to pay.

## Pattern to watch
If any future GET handler builds a 402 body with a hardcoded price string instead of SERVICE_PRICING_MICRO, the same bug will recur. The correct pattern is always:
```ts
const priceInMicro = SERVICE_PRICING_MICRO[slug as keyof typeof SERVICE_PRICING_MICRO];
```
