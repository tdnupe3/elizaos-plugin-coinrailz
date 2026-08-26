---
name: Coinbase CDP facilitator proof
description: A live, capped proof of the CDP facilitator settlement path and Coin Railz MCP delivery.
---

The Coinbase CDP x402 facilitator works for a standard x402 v2 EIP-3009 authorization, and Coin Railz accepts the facilitator-settled transaction hash for MCP tool delivery.

**Why:** On 2026-08-26, a fresh isolated Base wallet signed a v2 payment payload for MCP `coinrailz_ping`. An authenticated direct call to CDP's `/settle` returned success and an on-chain Base transaction. The confirmed USDC receipt transferred the exact service amount from buyer to platform. Retrying the identical MCP tool call with the returned raw transaction hash delivered a JSON-RPC success, and the production payment intent was `SUCCEEDED` and non-canary.

**How to apply:** Both local EIP-3009 execution and the CDP facilitator path are live and valid. Do not say a standard client automatically uses CDP: the default client-to-Coin Railz path is locally settled, while the CDP proof explicitly calls `/settle` then submits the settled hash. Any architecture cleanup must avoid executing both paths for one authorization.