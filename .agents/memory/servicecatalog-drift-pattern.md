---
name: ServiceCatalogService drift pattern
description: serviceCatalogService.ts is a 4th required file when adding x402 services — missing entries cause /mcp/services count to diverge from canonical
---

## Rule
When adding a new x402 service, `server/services/serviceCatalogService.ts` is a **required 4th file** alongside the 3-file checklist in `x402-service-registration.md`. Omitting it causes `/mcp/services` (the human-readable catalog) to show a lower count than `POST /mcp` tools/list and the OpenAPI spec.

## Why
`serviceCatalogService.ts` is a manually maintained singleton that backs:
- `GET /mcp/services` (catalog endpoint)
- `getRecommendedServices()` (cross-sell in 402 responses)
- A2A semantic routing via `matchServices()` in serviceCatalogService

`POST /mcp` tools/list uses `getCanonicalServices()` from `server/utils/serviceCount.ts`, which reads the OpenAPI spec directly. These two sources are independent — adding to one does not update the other.

## How to apply
After completing the 3-file checklist (pricing.ts + x402MicroserviceRoutesV2.ts + openapi-x402-services.json), add the service entry to the `rawCatalog` array in `serviceCatalogService.ts` before the closing `];` (currently near line 932). Use `getCanonicalPrice(entry.id)` for pricing — it is applied automatically by the `.map()` after rawCatalog is defined.

**Verification:** After restart, `GET /mcp/services` total and `POST /mcp tools/list` count must both equal the OpenAPI path count.

## Gap discovered
Jul 20 2026: `instant-api-key`, `robinhood-token-price`, `robinhood-dex-pools`, `robinhood-chain-stats` were in pricing.ts + OpenAPI + KNOWN_SLUGS but missing from serviceCatalogService.ts, causing /mcp/services to show 72 vs 76.
