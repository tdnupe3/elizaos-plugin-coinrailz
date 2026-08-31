# Coin Railz MCP protocol contract

## Endpoint and transport

Use the streamable HTTP JSON-RPC transport at `POST /mcp`. The root MCP
transport is POST-only: `GET /mcp` and `DELETE /mcp` return HTTP `405` with
`Allow: POST` rather than falling through to the website frontend. A
read-only tool catalog remains available separately at `GET /mcp/tools/list`.

Current clients can call `server/discover` first, then call `tools/list` and
`tools/call`. Coin Railz also remains compatible with legacy clients that use
`initialize` followed by `notifications/initialized`.

For MCP `2026-07-28` requests, send matching
`MCP-Protocol-Version`, `Mcp-Method`, and request `_meta` protocol-version
values. Coin Railz advertises `2026-07-28` and retains the legacy
`2025-11-25` and `2024-11-05` revisions.

A read-only catalog is also available at `GET /mcp/services`, and a
REST-style tool-call endpoint is available at `POST /mcp/tools/call`.

## Supported JSON-RPC methods

- `server/discover`
- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- `notifications/*`

`server/discover` returns supported versions, capabilities, server identity,
instructions, and public cache hints. Unsupported versions return HTTP `400`
with JSON-RPC code `-32022`; mismatched mirrored transport metadata returns
HTTP `400` with code `-32020`; unknown methods return HTTP `404` with code
`-32601`.

Accepted notifications return HTTP `202` with an empty body.

## Payment flow

Tool calls without credentials return HTTP `402` and a `PAYMENT-REQUIRED`
header. Retry the exact tool call with either:

- `PAYMENT-SIGNATURE` for x402 v2, or
- `X-PAYMENT` for legacy x402 clients, or
- `X-API-KEY` / `Authorization: Bearer` for prepaid credits.

The MCP telemetry funnel records initialize, tool listing, a 402 challenge,
payment proof presentation, payment rejection when applicable, and successful
verified-and-delivered calls. Payment proof values are never recorded.