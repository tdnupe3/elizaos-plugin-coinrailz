---
name: Paid MCP settlement proof
description: Live proof that a standard x402 client can pay a production MCP tool call end to end.
---

A standard `@x402/fetch` v2 client can complete a paid production MCP `tools/call` request through Coin Railz.

**Why:** On 2026-08-30 America/Chicago time, an isolated funded test wallet called `coinrailz_ping` through the production MCP endpoint with a strict $0.25 USDC policy cap. The call returned JSON-RPC success and the tool result, the wallet balance fell by exactly $0.25, the Base receipt showed an exact USDC transfer to the platform wallet, and production telemetry recorded payment presented, authorized, verified, and delivered.

**How to apply:** Paid MCP delivery is no longer an unproven boundary. For future release validation, use one isolated-wallet call with an exact resource/asset/amount policy cap, then verify the HTTP result, wallet delta, on-chain receipt, payment intent, and MCP delivery events. Do not infer native payment capability for stock Claude or Grok clients from this proof.