---
name: x402 accepts facilitator field — required per-entry, not just top-level
description: Durable lesson on why the x402 facilitatorUrl at the top level of a 402 body is insufficient — each accepts[] entry needs its own facilitator field for strict SDK clients.
---

# x402 accepts[].facilitator — must be per-entry, not just top-level

## The rule

Each entry in `accepts[]` must include a `facilitator` URL pointing to the endpoint where the payer submits their signed EIP-3009 authorization. **The top-level `facilitatorUrl` field is not sufficient** for SDK clients that follow the x402 spec strictly.

Cloudflare Agents SDK (and other x402-compliant clients) read `accepts[i].facilitator` directly and skip entries where it is absent.

## What was missing

`generate402Response` (POST path, `paymentOrchestrator.ts`) built Base USDC and Base USDT accept entries without a `facilitator` field. Solana entries already had `facilitator: "https://x402.dexter.cash"`.

The GET-path enricher in `x402MicroserviceRoutesV2.ts` added `facilitator` to Solana entries but not EVM (Base) entries.

## Fix applied

- `server/middleware/paymentOrchestrator.ts` → `acceptsArray`: added `facilitator: getFacilitatorUrl()` to Base USDC and Base USDT entries.
- `server/routes/x402MicroserviceRoutesV2.ts` → enricher `eip155:8453` branch: added `if (!enriched.facilitator) enriched.facilitator = getFacilitatorUrl()` so all x402-express GET responses also get the field.

**Why:** `getFacilitatorUrl()` returns `https://api.cdp.coinbase.com/platform/v2/x402`.

## How to apply

Any time a new EVM chain is added to `acceptsArray`, include `facilitator: getFacilitatorUrl()` (or the chain-appropriate facilitator URL) in that entry. Never assume top-level `facilitatorUrl` is read by all clients.

## Detection pattern

If an automated agent retries repeatedly with `hasPaymentHeader: false` and `retryHeaderChanged: false`, suspect a missing or misplaced `facilitator` field. Verify by curling the endpoint and checking `accepts[i].facilitator` for each entry — must be non-null for every entry the agent might select.
