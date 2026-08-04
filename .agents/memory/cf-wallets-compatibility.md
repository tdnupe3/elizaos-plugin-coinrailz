---
name: Cloudflare Wallets compatibility
description: Architecture decisions and gotchas for CF Wallets x402 integration — header spec, security constraints, eligibility design
---

# Cloudflare Wallets Compatibility

## What CF Wallets are
Launched August 4, 2026. x402-native wallet for AI agents using the Coinbase CDP facilitator (`api.cdp.coinbase.com/platform/v2/x402`) — the same one Coin Railz already accepts. Also launched `cloudflare.id` (agent identity) and a "Monetization Gateway."

## CF agent HTTP header spec — UNCONFIRMED
Guessed header names: `cloudflare-agent-id`, `cf-agent-id`, `x-cloudflare-agent-id`. As of Aug 4, 2026, Cloudflare's docs (developers.cloudflare.com/agents/) 404 on wallet/identity pages. The CF agents SDK source uses:
- `"cloudflare.agents.agent.id"` — WebSocket message field (NOT an HTTP header)
- `x-cf-agents-subagent-url` — sub-agent routing header
No confirmed HTTP header for CF Wallet identity exists yet.

**Why:** CF Wallets documentation was not published alongside the product launch. Do not trust guessed header names for eligibility or security decisions.

## Critical security constraint: no first-call-free bypass via CF headers
**Do NOT use cfAgentId as the eligibility key for first-call-free.** The DB query in `isEligibleForFirstCallFree` matches `WHERE ip=<ip> AND user_agent=<ua>`. If eligibilityUA is set to `cloudflare-agent:<id>` but the DB record stores the original userAgent, the lookup always finds nothing → agent appears eligible every time → replay attack.

**Rule:** cfAgentId is logged for attribution only. Eligibility always uses the original `userAgent`. Cache key must stay `${ipAddress}:${userAgent}` throughout.

## How to apply
- Detection: read `cloudflare-agent-id` / `cf-agent-id` / `x-cloudflare-agent-id` headers (soft detection, no verification)
- Logging: `console.log` the cfAgentId for attribution; add to interaction metadata
- Eligibility: pass original `userAgent` to `isEligibleForFirstCallFree`, never the synthetic `cloudflare-agent:` key
- Cache: always `${ipAddress}:${userAgent?.substring(0,50) || 'none'}` — no CF-specific key variant

## Guidance accuracy rules
- `FIRST_CALL_FREE_SERVICES = ["gas-price-oracle", "token-metadata"]` — NOT first-call
- `cloudflarePath` in goldenPath for first-call MUST say "costs $0.05 USDC, handled automatically by CF Wallet"
- `cloudflarePath` in buildExecutionGuide MAY say first-call-free available on gas-price-oracle/token-metadata
- Never claim first-call-free for /x402/first-call

## Deployment status (as of Aug 4, 2026)
- All changes in dev only; production deploy pending user sign-off (task #75)
- cloudflare-gateway worker code-complete but not deployed (needs CLOUDFLARE_API_TOKEN)
- agent-tools.cloud: already listed as `coinrailz-com-scan` (auto-discovered)
