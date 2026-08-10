---
name: MCP funnel tracking
description: How MCP request events are tracked in x402_interactions — event types, architecture rules, and challenge cache
---

## Rule
Every MCP request path writes a row to `x402_interactions` via `x402InteractionTracker.trackInteraction()` called directly from `mcpDeliveryRoutes.ts`.

**Why:** x402TrackingMiddleware is not mounted on /mcp routes. Without direct tracker calls, MCP events produce zero DB rows and the funnel is invisible.

**How to apply:** Call `trackMcpEvent()` at EVERY return point in mcpDeliveryRoutes.ts — including error, cache-hit, unknown-tool, and transport-error paths. Never add x402TrackingMiddleware to /mcp — that would create duplicate rows.

## Event types (event_type column)
| event_type | interaction_type | status | paid |
|---|---|---|---|
| mcp-initialize | view | 200 | false |
| mcp-tools-list | view | 200 | false |
| mcp-tools-list-error | error | 500 | false |
| mcp-challenge-issued | attempt | 402 | false |
| mcp-challenge-cache-hit | attempt | 402 | false |
| mcp-api-key-authorized | payment | 200 | true |
| mcp-x402-authorized | payment | 200 | true |
| mcp-upstream-hoisted | attempt | 402 | false |
| mcp-upstream-error | error | varies | false |
| mcp-transport-error | error | 500 | false |
| mcp-invalid-request | error | 400 | false |
| mcp-unknown-tool | error | 404 | false |
| mcp-unknown-method | error | 404 | false |

## Metadata fields (metadata jsonb column)
- `mcpMethod`: JSON-RPC method name or 'GET /mcp/tools/list'
- `toolName`: tool name from params (tools/call only)
- `authMode`: 'api-key' | 'bearer' | 'x402' | 'none' (distinguishes credential type without logging values)
- `hasPaymentHeader`: boolean only
- `mcpSessionId`: from X-MCP-Session-ID header
- `transport`: 'streamable-http'
- `upstreamStatus`: HTTP status from proxied /x402/* call
- `cacheAgeMs`: milliseconds since cache entry was built (cache-hit events only)

## Challenge cache
- In-process Map in mcpDeliveryRoutes.ts, TTL 90 seconds
- Keyed by `serviceId` for POST /mcp and `${serviceId}:tools-call` for POST /mcp/tools/call
- Cache hits tracked as `mcp-challenge-cache-hit` (separate event from `mcp-challenge-issued`)
- `X-MCP-Challenge-Cache: HIT` response header on cache hits
- Does NOT cover /x402/* routes — only MCP endpoints
- Eviction: setInterval every 5 min, also lazy expiry on read

## service_id conventions
- `mcp-server` for initialize, tools/list, invalid-request, unknown-method, unknown-tool (pre-dispatch)
- Actual service ID (e.g. `gas-price-oracle`) for tools/call events where service is resolved

## Verified (Aug 10 2026)
All 9 event types confirmed in x402_interactions after E2E tests. TypeScript clean.
