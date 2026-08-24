# Coin Railz MCP protocol contract

## Endpoint and transport

Use the streamable HTTP JSON-RPC transport at `POST /mcp`.

1. Call `initialize`.
2. Send `notifications/initialized`.
3. Call `tools/list`.
4. Call a listed `coinrailz_*` tool with `tools/call`.

A read-only catalog is also available at `GET /mcp/services`, and a
REST-style tool-call endpoint is available at `POST /mcp/tools/call`.

## Supported JSON-RPC methods

- `initialize`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- `notifications/*`

`server/discover` is **not** an MCP method. When it is requested, the server
returns JSON-RPC `-32601` with this supported-method list and catalog guidance.

## Payment flow

Tool calls without credentials return HTTP `402` and a `PAYMENT-REQUIRED`
header. Retry the exact tool call with either:

- `PAYMENT-SIGNATURE` for x402 v2, or
- `X-PAYMENT` for legacy x402 clients, or
- `X-API-KEY` / `Authorization: Bearer` for prepaid credits.

The MCP telemetry funnel records initialize, tool listing, a 402 challenge,
payment proof presentation, payment rejection when applicable, and successful
verified-and-delivered calls. Payment proof values are never recorded.