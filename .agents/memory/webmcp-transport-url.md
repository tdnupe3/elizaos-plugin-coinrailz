---
name: webmcp.json transport URL
description: webmcp.json must advertise /mcp (JSON-RPC 2.0 transport), not /mcp/services (catalog). Strict MCP clients fail silently if pointed at the catalog.
---

## Rule
`/.well-known/webmcp.json` → `mcpServers.coinrailz.url` must be `${baseUrl}/mcp`, NOT `${baseUrl}/mcp/services`.

## Why
- `POST /mcp` is the JSON-RPC 2.0 transport (handles `initialize`, `tools/list`, `tools/call`) — this is what MCP clients connect to.
- `GET /mcp/services` is a human-readable service catalog (returns JSON array of services). It is NOT a JSON-RPC endpoint.
- Strict MCP clients (Claude Desktop, Cursor, Robinhood-connected agents) send `{"jsonrpc":"2.0","method":"initialize"}` to the URL in webmcp.json. If that URL is `/mcp/services`, they get a catalog payload instead of a proper JSON-RPC response and fail silently or skip the server.

## How to apply
In `server/routes/wellKnownRoutes.ts`, the `mcpServers.coinrailz` block:
- `url`: `${baseUrl}/mcp` ← JSON-RPC transport
- `endpoints.serviceList`: `${baseUrl}/mcp/services` ← catalog (still useful for humans/browsers)

The catalog URL remains valid and referenced in the `endpoints` object — it is just not the primary connection URL.

## Fixed
Jul 20 2026: triggered by Robinhood AI agent MCP announcement. Architect review identified the mismatch. One-line fix in wellKnownRoutes.ts.
