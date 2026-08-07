---
name: New x402 service registration — 3-file checklist
description: All files that must be updated when adding a new x402 service; missing any causes count/discovery drift
---

# New x402 service registration — required file checklist

**Why:** Multiple incidents where subagents added a service to routes + pricing but missed discovery surfaces, causing service_count drift and missing catalog entries.

## Required files (all 5 must be updated)

1. **`shared/pricing.ts`** — add to `ServiceName` union + `MICRO` price map + `USD` price map
2. **`server/routes/x402MicroserviceRoutesV2.ts`** — import service function + `router.get()` discovery + `router.post()` handler + add to `KNOWN_SLUGS` array
3. **`public/openapi-x402-services.json`** — add path entry under `/x402/{slug}`; this is the canonical source for `getCanonicalServiceCount()` and all `service_count` surfaces
4. **`server/services/serviceCatalogService.ts`** — add catalog entry (drives `/mcp/services` count + A2A routing visibility)
5. **`server/services/a2aOutreachService.ts`** — update hardcoded `service_count` literals to current count

## How to apply

Run after every merge that adds or removes services:
- Count paths in `public/openapi-x402-services.json`: `grep -c '"/x402/' public/openapi-x402-services.json`
- Confirm it matches `curl /api/vlt-usdc/stats` → `service_count` field in live response
- Update `a2aOutreachService.ts` hardcoded literals to match

## Common drift pattern

Subagents completing tasks #88/#89 missed `public/openapi-x402-services.json` entirely, leaving `service_count: 79` instead of 80 after adding `vlt-usdc-zap-withdraw`. Caught during e2e testing via `GET /.well-known/x402.json`.
