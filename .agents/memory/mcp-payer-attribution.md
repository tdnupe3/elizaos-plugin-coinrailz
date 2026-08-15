---
name: MCP payer attribution fixed
description: x402_interactions now captures wallet_address and payment_amount for MCP x402 payments
---

# MCP payer attribution — fixed

## What was fixed
`trackMcpEvent()` in `server/routes/mcpDeliveryRoutes.ts` now passes `walletAddress` and `paymentAmount` to `trackInteraction()` when an x402 payment succeeds via MCP.

## How it works
- `extractPayerFromXPayment(header: string): PayerInfo | null` helper parses the base64-encoded X-PAYMENT header after upstream confirms success (200)
- Extracts `payload.authorization.from` (EVM wallet address) and `payload.authorization.value / 1e6` (USD amount)
- Fully wrapped in try/catch — returns null on any failure, never affects the response path
- Only fires on x402 path (`!apiKey && x402Header`) — API-key calls return null

## Critical constraint: do NOT write x402_payment_intents from MCP
The upstream `/x402/` service already writes to `x402_payment_intents` when it processes the payment. If MCP also writes a row, it creates a duplicate (violates unique index on txHash+serviceName). Our fix only updates `x402_interactions` attribution.

## Remaining gap
API-key MCP calls still have no payer attribution — the API key maps to a user/wallet but we don't do the lookup in the MCP path. Low priority since API-key analytics are visible in the credits/subscription tables.

## Files changed
- `server/routes/mcpDeliveryRoutes.ts`: added helper, extended McpTrackParams, updated both success blocks (POST /mcp and POST /mcp/tools/call), and fixed the $0.10 price fallback to use `service.priceUsd`
