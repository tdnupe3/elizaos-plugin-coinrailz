---
name: Discovery surface completeness checklist
description: Full list of surfaces requiring updates when new x402 services are added; catches surfaces missed by count-only grep
---

## Rule
When adding new x402 services, update ALL 6 surfaces. Count-only checks (grep for "69"/"72") miss hardcoded capability arrays.

## The 6 Surfaces

| Surface | File/Endpoint | How it updates |
|---|---|---|
| OpenAPI spec | `public/openapi-x402-services.json` | Manual — add path entry |
| x402/catalog | `x402MicroserviceRoutesV2.ts` KNOWN_SLUGS + `getCanonicalServices()` | Manual — add to both |
| agent-card skills | `wellKnownRoutes.ts` skills[] array (line ~3750) | Manual — hardcoded array |
| x402.json manifest | `wellKnownRoutes.ts` | Dynamic via `getCanonicalServiceCount()` ✅ |
| **awi.json capabilities** | `wellKnownRoutes.ts` capabilities[] array (line ~5516) | Manual — hardcoded array ⚠️ missed in previous sessions |
| Sitemap | `public/sitemap.xml` | Manual — add `<url>` entry |

## Why awi.json is the trap
`awi.json` description uses `getCanonicalServiceCount()` dynamically (count is correct), but the `capabilities[]` array inside it is hardcoded. A count-only check shows ✅ but the array is stale. Always grep for the new service ID in `capabilities` specifically.

**How to apply:** After any new service, run:
```bash
curl -s http://localhost:5000/.well-known/awi.json | python3 -c "import sys,json; d=json.load(sys.stdin); print([c['id'] for c in d.get('capabilities',[])])"
```
and confirm the new service IDs appear.
