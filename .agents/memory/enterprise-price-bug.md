---
name: Enterprise GET discovery price bug — fixed Aug 15 2026
description: GET /x402/{enterprise-slug} was returning 100x inflated prices; root cause, fix, discovery surface audit, and BD baseline.
---

# Enterprise GET Discovery Price Bug (fixed Aug 15 2026)

## What was wrong
server/routes/x402MicroserviceRoutesV2.ts had an `enterpriseDirectEndpoints` array with hardcoded price strings:
- compliance-consultation: "$500" (should be $5.00)
- smart-contract-audit: "$1000" (should be $10.00)
- payment-processing: "$50" (should be $0.50)

The GET handler computed: `const priceInMicro = parseFloat(service.price.replace('$', '')) * 1000000`

This put 500,000,000 in maxAmountRequired for compliance-consultation instead of 5,000,000. POST routes correctly used SERVICE_PRICING_MICRO.

Also found: all 3 services were absent from the awi.json `capabilities[]` hardcoded array (wellKnownRoutes.ts), making them invisible to AWI crawlers. Handler JSDoc comments and profit console.log calculations in ComplianceConsultantHandler, SmartContractAuditHandler, and PaymentProcessorHandler also showed old prices.

## All surfaces fixed (Aug 15 2026)
1. GET handler — `SERVICE_PRICING_MICRO[slug]` replaces hardcoded strings (cannot drift)
2. `maxAmountRequiredUSD` — derived from computed priceInMicro
3. awi.json capabilities[] — 3 entries added (22→25); prices $5.00/$10.00/$0.50
4. Handler JSDoc + profit console.logs — updated in ComplianceConsultantHandler, SmartContractAuditHandler, PaymentProcessorHandler

## BD baseline (dev snapshot, same schema as prod)
From x402_interactions as of Aug 15 2026:
| Service | Hits | Unique IPs | Ever paid | First seen |
|---|---|---|---|---|
| compliance-consultation | 4,796 | 305 | 2 | Dec 7 2025 |
| payment-processing | 2,070 | 204 | 1 | Nov 24 2025 |
| smart-contract-audit | 1,927 | 157 | 1 | Nov 22 2025 |

Payments from x402_payment_intents: compliance-consultation (2 paid, Feb 7 2026), smart-contract-audit (1 paid, Feb 7 2026), payment-processing (0). The 3 payments in Feb 2026 suggest real demand exists — they converted before the price bug fully suppressed them.

**Why:** SERVICE_PRICING_MICRO is the canonical source; POST payment verification already used it. GET discovery must match or agents get rejected when they try to pay.

## Pattern to watch
If any future GET handler builds a 402 body with a hardcoded price string instead of SERVICE_PRICING_MICRO, the same bug will recur. The correct pattern is always:
```ts
const priceInMicro = SERVICE_PRICING_MICRO[slug as keyof typeof SERVICE_PRICING_MICRO];
```
Also run: `curl /.well-known/awi.json | python3 -c "import sys,json; d=json.load(sys.stdin); print([c['id'] for c in d['capabilities']])"` after adding any new enterprise service to confirm it appears.
