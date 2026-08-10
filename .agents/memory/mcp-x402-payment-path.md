---
name: MCP x402 payment path
description: How MCP tools/call 402 responses work, security rules, and known edge cases
---

## The rule
MCP 402 responses must emit a machine-readable `PAYMENT-REQUIRED` header (base64 x402 v2 JSON) so x402-fetch / CF Agents SDK can auto-pay and retry. Both `POST /mcp` (streamable) and `POST /mcp/tools/call` (static) must be consistent.

## Implementation: `buildMcpX402Payload` in `mcpDeliveryRoutes.ts`
- Single source of truth for both the JSON body (`x402Version`, `accepts`, `error`, `jsonrpc`, `id`, `details`) and the `PAYMENT-REQUIRED` header
- **Base USDC only** — USDT has no EIP-3009 support (`supportsEIP3009:false`); Solana path untested. Expand only after per-network E2E tests.
- `accepts[].resource` = the MCP endpoint URL (`/mcp` or `/mcp/tools/call`), NOT the internal `/x402/...` path. Clients retry the MCP URL.
- `BASE_URL = process.env.PUBLIC_URL || (REPLIT_DEPLOYMENT==='1' ? 'https://coinrailz.com' : 'http://localhost:5000')` — the old subagent commit had BOTH branches as `coinrailz.com`, breaking dev resource URLs.

## X-Forwarded-Resource security rule (paymentOrchestrator.ts)
The orchestrator reads `X-Forwarded-Resource` to set the correct `resource` in internally-generated 402s (so MCP proxied calls show `/mcp/...` not `/x402/...`).
**Only trust from localhost** (`socketAddr === '127.0.0.1' || '::1' || '::ffff:127.0.0.1'`) AND only if the URL path is exactly `/mcp` or `/mcp/tools/call`. External callers cannot inject arbitrary resource URLs.

## Upstream hoisting branch
When upstream `/x402/...` returns x402 v2 body (`x402Version===2 && Array.isArray(accepts)`):
- Rewrite every `accepts[].resource` to the MCP endpoint URL BEFORE encoding into `PAYMENT-REQUIRED` header
- Return the rewritten accepts in both the body and the header
- Set `X-Payment-Price`, `X-Payment-Network` headers too

Fallback when upstream 402 is NOT x402 v2 format (e.g. payment-failure 402 from orchestrator after bad X-PAYMENT):
- Call `buildMcpX402Payload` + `setMcp402Headers` to still emit a machine-readable `PAYMENT-REQUIRED` header
- Body remains JSON-RPC error format — acceptable, client still gets the payment challenge in the header

## Known edge case
Bad X-PAYMENT (wrong-length tx hash) causes orchestrator to do 10 retries × 3s per chain × 2 chains ≈ 80s before returning its payment-failure 402. The hoisting condition fails (orchestrator failure 402 ≠ x402 v2 challenge format), fallback fires. PAYMENT-REQUIRED is set on fallback. Body is JSON-RPC error — acceptable for this rare case.

**Why:** The orchestrator's payment-failure 402 is a diagnostic message, not a fresh challenge. It doesn't include `x402Version:2` + `accepts[]` at the top level. The fallback catches this correctly.
