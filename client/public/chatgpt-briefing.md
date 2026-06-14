# COIN RAILZ — STRATEGIC UPDATE BRIEFING
**Date: June 13, 2026 | Follow-up to your Strategic Opportunities Report**

This updates you on everything verified, completed, confirmed, or changed since your original audit. Treat everything below as superseding or supplementing your prior findings where they conflict.

---

## What your report got right — now confirmed with data

**Bazaar discoverability: you were correct, and we now know exactly why.**

We ran a full technical investigation. Coinbase Bazaar is a curated directory — it requires Coinbase to manually register providers. It is NOT a permissionless index that self-populates from settlements.

We tested this directly: we spent $6.87 USDC making 14 successful CDP-facilitated settlements across our routes via Bazaar's /settle endpoint. All 14 confirmed on-chain. We have production logs showing Google Cloud Node.js Agent IPs hitting each of our endpoints within milliseconds of each settlement — Bazaar's crawler verified our services are live and responding correctly. Despite all of this, searching `?payTo=0xa4bbe37f...` returns `partialResults: false` — a definitive "not in catalog" response. The roughly 20 providers that consistently appear in Bazaar's search are a fixed, manually-curated set.

**Conclusion:** Our 402 format is technically correct — x402Version 2, CAIP-2 network, `resource` field, `extensions.bazaar` metadata, CDP facilitator URL — everything Bazaar's docs require is present. The gap is not technical. Getting listed in Bazaar requires a business/partnership step with Coinbase directly.

---

## What has been fixed and completed since your report

### Security remediation — all complete, deployed

- Removed a hardcoded GitHub PAT from source code
- Fixed broken AES encryption: `createCipher` (deprecated, zero-IV) replaced with `createCipheriv` with proper random IV; `v2:` prefix added to new ciphertext, legacy fallback for existing encrypted rows
- Same fix applied to the AES-256-GCM path
- JWT middleware now throws at startup in production if JWT_SECRET is missing — fail-fast instead of silently degrading
- Eight CVE-affected dependencies bumped: drizzle-orm 0.39.1→0.45.2, node-forge 1.3.1→1.4.0, @modelcontextprotocol/sdk 1.22.0→1.26.0, elliptic →6.6.1, jws →3.2.3, fast-xml-parser →4.5.5, protobufjs →7.5.5, path-to-regexp 0.1.12→0.1.13

### Canary payment infrastructure — rebuilt correctly

The canary health-check system had a critical flaw your report prompted us to investigate: the wallet that receives all x402 revenue was also the wallet making the canary payments. The same private key was both `payTo` (recipient) and the canary buyer — so every 6-hour canary was a self-payment, paying itself. These 171 self-payments appeared in the database as successful organic transactions, inflating our revenue figures.

Fixed:
- Canary now originates from a separate buyer wallet (X402_BUYER_PRIVATE_KEY) with a different address than the platform wallet
- Added `is_canary` boolean column to `x402_payment_intents` table
- All 4 payment recording code paths (EVM and Solana) now automatically detect the canary payer address and tag the record — no headers, no trust required
- 171 historical canary records retroactively tagged in the DB
- Auto-top-up added: before each canary run, checks buyer wallet USDC balance; if below $0.20, transfers $2.00 from the platform wallet (which receives revenue) to the buyer wallet — funds ~40 future runs, canary never silently fails due to empty wallet

Latest canary verification: tx `0xcb1694031b0cdf5b4cf266b628277041c48d1a888cc7b506b2faf56723018815` (June 13, 2026 23:25 UTC) — verifiable on Basescan. Each 402 challenge body now includes this as `confidenceMetrics.lastVerifiedPayment` with a direct Basescan link so any agent can independently verify settlement works before paying.

### ElizaOS plugin — merged and live

`elizaos-plugin-coinrailz` v2.2.1 published on npm. PR #8382 merged into elizaOS/eliza develop branch on June 10, 2026. Any AI agent built on ElizaOS/Eliza now has native access to Coin Railz x402 payment infrastructure via the plugin registry.

### Yield vault — live on mainnet

USDC yield vault v2.1 deployed on Base mainnet at `0x86e2508ca`, routing through Morpho. A separate Solana USDC yield portal is live via Kamino v1 with real APY data (3.49% APY, $118M TVL confirmed from live on-chain reads).

---

## Accurate organic payment metrics — now clean

The previous revenue figures were inflated by 171 self-payments. Actual clean numbers as of June 13, 2026:

| Metric | Value |
|--------|-------|
| Organic transactions (real external agents) | **290** |
| Organic revenue (USDC) | **$154.44** |
| First organic transaction | November 27, 2025 |
| Most recent organic transaction | June 13, 2026 23:15 UTC |

**Top 10 services by organic revenue:**

| Service | Transactions | Revenue (USDC) | Avg/tx |
|---------|-------------|----------------|--------|
| ping | 10 | $17.12 | $1.71 |
| portfolio-optimization | 7 | $14.00 | $2.00 |
| instant-agent-wallet | 11 | $11.00 | $1.00 |
| gas-price-oracle | 9 | $10.64 | $1.18 |
| arbitrage-scanner | 8 | $10.00 | $1.25 |
| verified-agent-identity | 2 | $10.00 | $5.00 |
| construction-progress | 5 | $7.50 | $1.50 |
| lease-analysis | 6 | $6.00 | $1.00 |
| first-call | 111 | $5.55 | $0.05 |
| credit-risk-score | 4 | $5.00 | $1.25 |

**Key finding:** On June 1, 2026, unknown external wallet `0x3803a192...` paid $0.25 for `earthdata-ocean-color` and $0.05 for `first-call` unprompted. This was not us, not a test. A real agent found and paid for our services.

---

## What your report identified that remains unresolved

**Service count inconsistency** — still live. Your report flagged 63/65/66 disagreement. Current state: 60 services in the x402 catalog, 64 in the discovery resources endpoint, 73 in the x402.json well-known file. No fix deployed yet. Next infrastructure priority.

**Price range inconsistency** — still live. OpenAPI spec says $0.05–$0.25; A2A card says $0.05–$10.00; AP2 says $0.10–$10.00. Root cause: no single source of truth generating all manifests.

**Facilitator reference inconsistency** — still live. OpenAPI x-payment-info still points to `https://x402.org/facilitator`; A2A and AP2 correctly reference CDP. AP2 endpoint still advertises `ap2Version: 0.1` while v0.2 is released.

**Cross-protocol publishing** — not yet executed. We expose x402, MPP, A2A, AP2, WebMCP, AWI, OpenAPI, and MCP surfaces. But there is no single canonical declaration model generating synchronized manifests. This is the correct next infrastructure investment.

---

## Questions we need strategic input on

**1. Bazaar: what is the actual registration path for independent sellers?**

Technical compliance is confirmed. Crawler verification is confirmed. CDP settlements on-chain are confirmed. Still not in the catalog. Is the path a direct outreach to Coinbase DevRel? A formal partner application? Or does Bazaar's search index legitimately accumulate over a multi-week window of settlement history that we just haven't waited out yet? Is there a Bazaar seller registration form we are missing?

**2. Canonical service count — what is the right governance architecture?**

Your recommendation to derive every manifest from one canonical source is correct. What is the right implementation: a single JSON config at deploy time that generates the x402 catalog, OpenAPI spec, A2A card, AP2 merchant endpoint, WebMCP manifest, and AWI manifest? Or a proper registry service with a versioned API that all surfaces call? What have you seen work in practice for teams operating multiple protocol surfaces simultaneously?

**3. ChatGPT/OpenAI distribution — what is the realistic path for an API-resource seller in Q3 2026?**

Your report said Instant Checkout is approved-partner-only for retail/product merchants, and our natural fit is "MCP/x402/MPP seller behind agents, not retailer in front of consumers." Given: (a) our ElizaOS plugin is now merged into the develop branch, (b) Coinbase for Agents says x402 support is "coming soon," (c) Cloudflare Workers natively support x402 and MPP — what are the highest-leverage specific distribution surfaces for Q3 2026 for an independent API resource seller with 60 live x402 services and no VC backing?

**4. Pricing — are we mispriced across the catalog?**

Clean data shows `ping` earns $1.71/tx average and `portfolio-optimization` earns $2.00/tx. The high-price services generate more absolute revenue per transaction than volume plays. `first-call` at $0.05 has 111 organic transactions but only $5.55 total revenue — it exists primarily as a trust/discovery signal. Does this suggest the $0.05–$0.25 tier is better treated as an acquisition/onboarding channel, with real monetization concentrated in $1–$5 specialist services? What pricing architecture have you seen work for machine-payment API catalogs, where agents are making programmatic decisions rather than humans evaluating value?

**5. AP2 v0.2 and Mastercard AP4M — which should we prioritize?**

AP2 v0.2 is released; we're on v0.1. Mastercard launched AP4M on June 10, 2026 with Coinbase, Cloudflare, Stripe, and Alchemy as initial supporters. Our architecture (x402, USDC, Base, CDP facilitator) overlaps with AP4M's stated infrastructure. Two questions: Is AP4M accessible to independent API sellers, or is it targeting enterprise/network/card-rail level participants? And is upgrading to AP2 v0.2 worth doing now given the broader manifest inconsistency problem hasn't been fixed at the source yet — or will fixing the inconsistency problem automatically require revisiting AP2 versioning anyway?

**6. Physical-world data as strategic wedge — how do we sharpen it?**

Your report flagged telematics, weather, satellite, and sensor data as the sharpest wedge because physical-world data is bursty, per-call, and time-sensitive — exactly the x402 profile. We have live: fleet telematics, weather station data, IoT sensor readings, IoT bulk export, NASA satellite granule search (Landsat, Sentinel, MODIS, VIIRS), SST, precipitation, soil moisture, fire alerts, vegetation, flood detection, air quality. Most of these are priced identically to our DeFi endpoints ($0.25/call). Should physical-world data be priced differently, packaged differently (subscriptions vs per-call), or distributed through different channels (Mastercard AP4M logistics examples, DePIN networks) than our AI/DeFi tools?

---

## Current platform surfaces for re-audit

All URLs from your original audit are live. Updated:

- `https://coinrailz.com/.well-known/x402.json` — 73 endpoints
- `https://coinrailz.com/api/discovery/resources` — 64 resources, full Bazaar metadata
- `https://coinrailz.com/openapi.json` — OpenAPI 3.1
- `https://coinrailz.com/.well-known/agent-card.json` — A2A 0.3.0
- `https://coinrailz.com/x402/catalog` — service catalog
- `https://coinrailz.com/mcp/tools/list` — MCP tool list
- `https://coinrailz.com/ap2/v1/merchant` — AP2 v0.1 merchant endpoint
- `https://coinrailz.com/.well-known/webmcp.json` — WebMCP manifest
- `https://coinrailz.com/.well-known/awi.json` — AWI manifest
- `https://coinrailz.com/.well-known/mcp-integration.json` — MCP integration guide

**Canary latest verified payment:** `0xcb1694031b0cdf5b4cf266b628277041c48d1a888cc7b506b2faf56723018815`
Verifiable at: `https://basescan.org/tx/0xcb1694031b0cdf5b4cf266b628277041c48d1a888cc7b506b2faf56723018815`

---

## Summary of what is now true vs. what was true at time of original audit

| Item | At time of audit | Now |
|------|-----------------|-----|
| Bazaar discoverability | Not indexed, cause unknown | Confirmed: requires manual Coinbase registration |
| Canary payments | Self-payments, corrupting analytics | Fixed: separate buyer wallet, is_canary column |
| Organic revenue figure | Inflated by ~37% (included self-pays) | Clean: $154.44 USDC, 290 transactions |
| Security vulnerabilities | Hardcoded creds, broken encryption, CVEs | All remediated and deployed |
| ElizaOS plugin | Not yet merged | PR #8382 merged June 10, 2026 |
| Yield vault | Not confirmed live | Live on Base mainnet + Solana |
| Service count consistency | 63/65/66 disagreement | Still unresolved — next priority |
| Manifest sync | Not from single source | Still unresolved — next priority |
| AP2 version | v0.1 | Still v0.1, v0.2 upgrade pending |
| On-chain payment proof | No public tx hash in 402 body | Now in every 402 challenge via canary |
