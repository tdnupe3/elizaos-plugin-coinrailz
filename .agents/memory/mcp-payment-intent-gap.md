---
name: MCP payment-intent gap
description: MCP payments don't write to x402_payment_intents; wallet_address is NULL in x402_interactions
---

# MCP payment-intent gap (open task #106)

## The gap
MCP payments (via `/mcp` or `/mcp/tools/call`) go through `server/routes/mcpDeliveryRoutes.ts`, which:
- Records `x402_interactions` rows but with `wallet_address = NULL` and `payment_amount = NULL`
- Does NOT write to `x402_payment_intents` (the revenue ledger)
- The `trackMcpEvent()` function at `:88-158` builds the tracker payload but never extracts payer identity

Result: MCP-originated revenue is invisible in payment analytics and dashboards. `getAgentInteractionHistory()` and `getHotLeads()` (x402InteractionTracker.ts:103-171) depend on `wallet_address` — MCP conversions can't be attributed.

**Why:** MCP adapter forwards X-PAYMENT to the upstream `/x402` service. The upstream orchestrator may write to `x402_payment_intents` for the upstream call, but the MCP layer never captures payer identity or correlates to the intent.

## Fix approach
- In `trackMcpEvent()` (mcpDeliveryRoutes.ts:122-157): decode payer wallet from incoming X-PAYMENT payload and set `walletAddress`, `paymentAmount` when payment is accepted
- Do NOT add `x402TrackingMiddleware` to `/mcp` — explicitly avoided at `:20-24` to prevent duplicate rows
- Optionally: create a pending x402_payment_intents row before forwarding, update on upstream response
- Add idempotency to prevent duplicate intent rows on MCP retries

## Priority
P1 — analytics blind spot for any MCP-originated conversions. Upgrade to P0 only if x402_payment_intents is used for settlement or balance enforcement (currently analytics-only).
