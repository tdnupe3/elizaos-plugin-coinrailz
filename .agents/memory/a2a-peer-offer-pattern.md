---
name: A2A peer offer intent + routing fixes
description: peer_offer_x402 intent type, order-independent security patterns, a2a_interactions schema, and MetaVision as first known peer agent
---

## peer_offer_x402 intent type (added Jul 12 2026)

Detects agents advertising their own x402 service rather than requesting one.
Fires when message contains: USDC + price unit (`/query`, `/month`) + offer signal (`x402`, `free trial`, `mcp`, `api`).

**Why:** MetaVision CVE Oracle sent an A2A outreach containing USDC pricing details. Those payment tokens ("base", "usdc", "ethereum") caused keyword scoring to match `rh-bridge-usdc` — a completely wrong service. The classifier now short-circuits matchServices() entirely for peer offers and returns a mutual acknowledgment + CLAWPAY_V1 listing format.

**How to apply:** Check `classifyA2AIntent()` in `server/routes/a2aCoinRailzRoutes.ts`. Intent fires before all service_query logic. Logged as `peer_offer_x402` in a2a_interactions.

## Smart-contract-audit patterns — order-independent (fixed Jul 12 2026)

Old patterns required security keyword AFTER contract keyword in regex. Real messages often say "security scanning" before "smart contracts" — nothing fired.

**Fix:** Added CVE/NVD standalone boost (+22), reverse-order contract→secur pattern, widened proximity from 30→60 chars, `security.{0,20}scan|audit` variant.

**Why it matters:** smart-contract-audit is $5–10/call and actively being validated by Coinbase Bazaar. Wrong routing = missed conversion.

## MetaVision CVE Oracle — first known x402 peer agent outreach

- IP: 13.48.136.59, UA: python-requests/2.34.2
- Arrived Jul 11 2026 14:03 UTC via POST /a2a/v1/message/send
- Charges 0.10 USDC/query on Base, or $49/month
- Service: 355k+ NVD CVEs specialized in Ethereum/Solidity/smart contracts
- MCP endpoint: https://metavision.click/mcp
- Matched (incorrectly) to rh-bridge-usdc before fix; now correctly classified as peer_offer_x402

## a2a_interactions schema

All columns confirmed present in production:
`id, request_id, endpoint, protocol, query_text, matched, resource_id, status_code, response_time_ms, ip_address, user_agent, wallet_address, tracking_id, created_at`

**ip_address DOES exist.** Prior query failures showing START TRANSACTION/ROLLBACK were a code_execution sandbox issue, NOT a missing column.

## Assessment window correction

When running rolling 12h assessments, the 48h breakdown query is the reliable reference:
```sql
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY CASE WHEN ... INTERVAL '12 hours' THEN 'last_12h' WHEN ... '24 hours' THEN 'prev_12h' ...
```
The simple 24h last_12h/prior_12h split can miss organic payments that fall just outside the window boundary. Always check the 48h breakdown to avoid incorrectly reporting "zero organic" for a window that had payments.
