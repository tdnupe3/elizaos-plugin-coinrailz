---
name: /x402/discovery/resources endpoint
description: Why this sub-path exists and what it returns — distinct from /x402/discovery catalog
---

## Rule
`GET /x402/discovery/resources` is a distinct endpoint from `GET /x402/discovery`.
Both must remain live. Do NOT collapse them into a redirect.

**Why:** The IPv6 agent (2a06:98c0:3600::103 — Cloudflare worker) explicitly requests BOTH paths in the same sweep cycle. It hits /x402/discovery (full catalog, descriptions, tags) AND then /x402/discovery/resources (compact payment-execution schema). Confirmed via production DB `original_url` field across 20+ sessions since July 15 2026.

## Schema (/x402/discovery/resources)
- `x402Version: 2`, `kind: "resource-list"`, `generatedAt`, `totalResources`
- `links: { discovery, catalog, paymentManifest }`
- `paymentDefaults: { network (CAIP-2), asset, assetAddress, payTo, facilitatorUrl, decimals }`
- `resources[]`: `{ id, resource (absolute URL), path, method, priceMicro, priceUsd, network, asset, payTo, category, firstCallFree }`

## /x402/discovery must advertise /resources
The discovery response includes `resourcesUrl` and `links.resources` pointing to this endpoint so HATEOAS agents find it from the catalog.

**How to apply:** When adding new services, no extra work needed — /resources is generated from `getCanonicalServices()` dynamically. Cache-Control: public, max-age=300.
