# Coin Railz Business Development Report #15
**Date:** June 15, 2026 (12h window, 01:00–13:00 UTC)
**Subject:** First Canary Failure | $10.15 Payer Returns as Scout | 3 Human Browser Visitors | New Discovery Gaps
**Architect Verdict:** ⚠️ CONDITIONAL PASS — Core platform stable. One material reliability warning (first-ever canary failure). No regression from recent changes.

---

## Executive Summary

The platform's overnight window produced three findings that each warrant a distinct response. First: the canary payment failed at 09:21 UTC — the first failure on record. The platform itself did not go down; the failure was in the payment authorization client path (RPC parameterization), not the endpoint. Second: IP 74.220.48.244 — the wallet that paid $10.15 across 21 services on June 12 — returned and swept **46 services in 3.5 hours without paying a single call**. They have shifted from buyer to systematic probe mode. Third: three real human beings with browser fingerprints hit specific service pages (weather data, trade signals, wallet risk) and bounced at the 402 wall. These are the first organic human impressions outside of known crawlers.

---

## 1. Canary Rail — ⚠️ First Failure on Record

| Time (UTC) | Status | Notes |
|---|---|---|
| Jun 15 03:21 | ✅ succeeded | 0x65b3c47f... |
| Jun 15 09:21 | ❌ **failed** | First failure ever recorded |

**Error:** `Payment authorization failed: Missing or invalid parameters. Double check you have provided the correct parameters. URL: https://mainnet.base.org Request body: {"method...` *(truncated in DB)*

**Architect's read:** This is a **medium-severity warning, not a catastrophe.** The failure occurred in the canary *buyer* path (the client that constructs and submits the payment), not in the platform's endpoint or verification logic. Evidence: no `authorized` or `payment-verified` events appeared in `x402_interactions` for that run, and no failed row appeared in `x402_payment_intents` — meaning the payment was never submitted on-chain. This is a CDP wallet/RPC parameter edge case, not an endpoint outage. The 03:21 run succeeded cleanly.

**Why it matters:** The canary is the primary rail health signal. One failure creates ambiguity — the next run will tell us whether this was transient or recurring. Watch the 15:21 UTC run carefully.

**Recommended hardening (architect):** Capture full RPC error payload in canary logs, add auto-retry on parameter class failures, alert on any second consecutive failure.

---

## 2. THE BIGGEST STORY — 74.220.48.244 Returns as a Scout

**June 12 (last session):** Paid $10.15 across 21 services. Buyer mode.
**June 15 (this session):** Swept 46 services, 154 hits, **$0 paid.** Scout mode.

### What They Did This Time

03:09–06:33 UTC — 3.5 hours, 154 interactions across 46 distinct services:

`agent-create-wallet, approval-manager, arbitrage-scanner, batch-quote, compliance-check, compliance-consultation, construction-progress, contract-scan, correlation-matrix, credit-risk-score, dex-liquidity, forex-sentiment, fraud-detection, gas-price-oracle, instant-agent-wallet, lease-analysis, multi-chain-balance, ping, polymarket-events, polymarket-odds, polymarket-search, portfolio-optimization, portfolio-tracker, prediction-market-odds, property-valuation, risk-metrics, satellite-air-quality, satellite-fire-alerts, satellite-flood-detection, satellite-land-use, satellite-vegetation, satellite-weather-imagery, seamless-chain-bridge, sentiment-analysis, stock-sentiment, token-metadata, token-price, token-sentiment, trade-signals, trading-signal, transaction-builder, trending-tokens, verified-agent-identity, wallet-risk, whale-alerts`

This is 46/60 services — 77% of the catalog — in one session. Critically: every interaction was a `challenge-issued` 402. No `authorized`, no `payment-verified`, no `payment-intents` rows. They were **not attempting payment**. They were mapping challenge responses.

### Why Did They Stop Paying?

The architect's assessment: they shifted from "capability verification" (June 12 — paying to confirm services return valid data) to "schema/availability indexing" (June 15 — collecting 402 challenge metadata without buying execution). This is consistent with building a **service registry or routing table** — they verified the services work on June 12, and are now cataloging the challenge specifications for each one.

**This is not a lost customer.** This is a customer in a different phase of integration work. They need to know what payment parameters each service requires before they can automate payment across the full catalog. The 3-service pattern on June 12 → 21 services → now 46 services suggests progressive catalog expansion.

**The failure mode:** There is no "how to automate payments at scale" resource visible in their discovery path. They figured out how to pay manually on June 12. Building automated routing across 46 services requires reading 46 distinct 402 challenge bodies — which is exactly what they did. A catalog-level payment manifest (structured data describing all service IDs, networks, amounts, and payment addresses in one document) would cut this friction.

---

## 3. Human Browser Visitors — 4 Organic Impressions

Four IPs with real browser fingerprints hit specific service endpoints this window:

| IP | Browser | Service Attempted | Status |
|---|---|---|---|
| 37.18.121.14 | Windows / Edge 135 | `weather-station-data` | 402 issued |
| 46.243.227.221 | Linux / Chrome 129 | `trade-signals` | 402 issued |
| 37.230.196.199 | Mac / Chrome 135 | `wallet-risk` | 402 issued |
| 66.249.64.169 | GoogleOther (crawler) | `satellite-earthdata` | 402 issued |

Three of these are genuine human browsers (Windows/Edge, Linux/Chrome, Mac/Chrome) landing on specific service pages and hitting the 402 wall. These are not crawlers — they navigated to specific endpoints, not to the root or discovery surfaces.

**Architect's read:** "Weak-but-real lead signals, not strong demand." Treat as top-of-funnel organic curiosity. Each bounced after one 402 — they did not retry, did not submit payment, did not follow up. This is consistent with someone following a link from a directory or search result, landing on a service page, and leaving when they see the payment requirement.

**What this means for BD:** These people exist. They found specific services through some external channel. We don't know where they came from (no referrer data). The two most actionable things: (1) what does the service page look like when a human lands on it? Does it explain what the service does and how to pay? (2) The `weather-station-data` and `wallet-risk` hits are both from Western European IPs — there may be a specific community or directory driving this traffic.

---

## 4. New Discovery Endpoint Gaps

Two probes returned **404** this window, flagging compatibility gaps:

| Endpoint | Requestor | Result | Meaning |
|---|---|---|---|
| `/.well-known/did.json` | Windows Chrome 124 | 404 | Decentralized Identity standard — DID documents |
| `/.well-known/ucp-manifest.json` | Windows Chrome 124 | 404 | Universal Capability/Consent Manifest |
| `/.well-known/pricing.json` | Meta-externalagent | **200** | ✅ Live and indexed |

The same Windows Chrome 124 scanner probed both missing endpoints in a single session — this is a compatibility auditor checking standard web identity/capability manifests. The `did.json` is the W3C DID Core standard (decentralized identity document). The `ucp-manifest.json` appears to be a capability/consent manifest used by some agent frameworks.

**Meta continues to expand its pricing manifest indexing.** The `pricing.json` fetch from Meta's crawler (successful 200) means their catalog engine has now indexed Coin Railz's pricing data. This is three consecutive reports with Meta expanding their coverage — they are systematically building a payment-provider index.

**Architect recommendation:** Ship minimal `did.json` and `ucp-manifest.json` stubs to reduce compatibility 404s and improve registry trust signals.

---

## 5. Traffic Profile — 12h Breakdown

| Hour (UTC) | Real Requests | Unique IPs | Services Hit | Paid |
|---|---|---|---|---|
| 01:00 | 76 | 6 | 24 | 0 |
| 02:00 | 88 | 4 | 8 | 0 |
| **03:00** | **111** | 4 | **46** | 2 |
| **04:00** | **93** | 5 | **46** | 0 |
| 05:00 | 34 | 2 | 16 | 0 |
| 06:00 | 24 | 3 | 15 | 0 |
| 07:00 | 9 | 4 | 6 | 0 |
| 08:00 | 2 | 2 | 2 | 0 |
| 09:00 | 60 | 4 | 32 | 0 |
| 10:00 | 7 | 5 | 5 | 0 |
| 11:00 | 3 | 2 | 3 | 0 |
| 13:00 | 7 | 1 | 7 | 0 |

**Total: 514 real requests.** The 03:00–04:00 spike is the 74.220.48.244 catalog sweep. Outside that, the window is quiet — the overnight/early-morning UTC timing suggests 74.220.48.244 is running automated infrastructure from a US or South American timezone (UTC-5 to UTC-9 would place this at 10pm–11pm local time, consistent with a scheduled overnight job).

### Active User Agents

| Agent | Hits | Paid | IPs |
|---|---|---|---|
| CarbonMonitor/0.1 (carbon-cashmere.de) | 182 | 0 | 1 |
| node (74.220 sweep + canary) | 174 | 2 | 3 |
| blank agent | 102 | 0 | 1 |
| x402-healthbot (decixa.ai) | 20 | 0 | 1 |
| meta-externalagent/1.1 | 15 | 0 | 11 |
| CCBot/2.0 (Common Crawl) | 5 | 0 | 1 |
| undici | 4 | 0 | 1 |
| x402-network-mapper (SmartFlowPro) | 4 | 0 | 1 |
| Windows/Edge 135 | 2 | 0 | 1 |
| ari-indexer (ari.dev) | 2 | 0 | 1 |
| GoogleOther | 2 | 0 | 1 |

**New this window:** `undici` (4 hits, 1 IP) — Node.js native HTTP client, not the same as `node`. Distinct actor. Low hits, worth watching.

---

## 6. Supporting Signals

**Decixa.ai (32.192.196.86):** New IP, 19 services in 4:32 minutes (09:52–09:56 UTC). Included `solana-yield-finder` — confirming the DeFiLlama fix is now indexed in their health map. They are tracking the platform as healthy on that service.

**34.158.104.72 (GCP / likely Coinbase Bazaar):** 5 hits to `gas-price-oracle`, `ping`, `token-metadata`. Still active after 51+ days. Narrowing pattern (3 services) is consistent with late-stage evaluation — monitoring only the services they intend to list.

**Discovery surfaces:** 230 hits from 230 unique IPs across 15 endpoints. Perfect unique ratio again. Cold discovery traffic is stable at ~500/day.

**All-time revenue:** $279.34 USDC / 465 intents / 14 distinct payers. +$0.05 this window (canary, 03:21 run).

**Credits accounts:** 76 accounts, $800.70 total. No movement.

**API keys:** 83 active, 0 used in 12h, 0 used in 7 days. Dormant cohort unchanged.

**A2A/AP2:** 0 inbound interactions this window.

---

## Impact of Recent Changes — Continued Clean Read

| Change | Status |
|---|---|
| Security remediation | ✅ No regressions |
| Dialect → DeFiLlama fallback | ✅ Decixa now indexing solana-yield-finder as healthy |
| Production republish | ✅ No instability introduced |
| Canary | ⚠️ One failure at 09:21 — monitor next run |

---

## Priority Actions (in order of impact)

1. **Monitor the 15:21 UTC canary run** — if it succeeds, June 15 09:21 was transient. If it fails again, the canary needs immediate debugging (full RPC error capture, retry logic).

2. **74.220.48.244 re-engagement** — this actor has now paid $10.15 and run 200+ probe interactions. They are building something real. The missing piece is a payment manifest document that gives them all 46 service IDs, payment amounts, and payment addresses in a single structured file — so they don't need to collect 46 separate 402 challenge bodies. Creating `/x402/catalog.json` with this information is the highest-leverage conversion unlock for this specific actor.

3. **Human visitor landing page quality** — three real humans bounced at the 402 wall on weather, trade-signals, and wallet-risk. The question is what they saw when they got there. If the 402 response is just a JSON challenge body, they left with no idea what to do. A human-readable HTML response (or redirect to a docs page) for browser-based 402 hits would convert some of these.

4. **Ship `/.well-known/did.json` and `/.well-known/ucp-manifest.json` stubs** — reduce compatibility 404s for agent/registry auditors.

5. **Mercury email** — still ready to send.

---

## Platform Scorecard

| Metric | Value | vs. Report #14 |
|---|---|---|
| Canary success rate (last 9 runs) | 7/8 (1 failed) | ⚠️ First failure |
| All-time revenue | $279.34 USDC | +$0.05 (canary) |
| Discovery unique IPs/12h | 230 | → Stable |
| Active human browser visitors | 3 | 🆕 New signal |
| 74.220.48.244 session | 154 hits, $0 | Probe mode |
| Decixa catalog coverage | 46+ services | → Stable |
| Yield service errors | 0 | ✅ Clean |
| API keys active | 83 | → No movement |

---

*Report compiled by Platform Analytics + Architect Review*
*Architect verdict: CONDITIONAL PASS — Core stable, canary needs monitoring*
*Next check: After 15:21 UTC canary run*
