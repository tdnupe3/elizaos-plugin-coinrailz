# Coin Railz 12-Hour Platform Assessment (v2 — Complete)
**Window:** Aug 12 2026 ~14:00 UTC – Aug 13 2026 ~02:00 UTC
**Produced:** Aug 13 2026
**Sources:** x402_interactions, x402_payment_intents, x402_canary_payments, endpoint_hits, architect subagent, biz dev subagent, all-time payer table

---

## 1. Executive Summary

This window covers both a deployment recovery and the first clean operating period under the corrected build. Two failed Cloud Run promotes earlier in the day (esbuild --bundle hoisting 684 static imports, blocking listen() for 43s vs. Cloud Run's 20s health probe) were resolved at 20:23 UTC with the --splitting fix. Port now binds in 1.3 seconds. The platform came up healthy immediately.

Activity volume: 1,809 requests across 74 services from 59 unique IPs and 18 distinct user agents — up +23% from the prior 12h (1,474 requests, 46 IPs). The most significant finding this window is not the deployment or the discovery volume — it is **one unknown actor (163.47.70.38) retrying 20 financial analytics services exactly 22 times each over 11 consecutive hours**. That is not a crawler. Something is blocking them from paying and they keep trying. That is the most actionable commercial signal in this window.

The platform has a live recurring external customer (wallet 0x3803a192..., earthdata cluster, paid Aug 11, active since June 1) and a confirmed active payment rail (6 platform self-payments in window, all on-chain settled). Discovery surfaces are drawing extraordinary breadth — 151 unique IPs hit the A2A agent card in 12 hours. Two MCP registries indexed the platform. One identifiable research actor (hermes-contact-discovery, contact@hermes.ai) swept 48 services and left a contact address.

**Verdict: Platform is moving forward.** The deployment is fixed, the rails are clean, discovery is accelerating, and a mid-funnel actor appears to be stuck at the payment gate rather than having walked away. That distinction matters.

---

## 2. Headline Signals

**① 163.47.70.38 (python-httpx) has retried 20 specific services 22 times each over 11 hours — this is not a scan, it's a stuck payment**

First hit: 14:46 UTC Aug 12. Last hit: 01:49 UTC Aug 13. Exactly 22 hits per service across exactly 20 services. The 20 services are all financial analytics/market intelligence: `arbitrage-scanner`, `risk-metrics`, `compliance-consultation`, `prediction-market-odds`, `polymarket-odds`, `fraud-detection`, `lease-analysis`, `compliance-check`, `property-valuation`, `credit-risk-score`, `correlation-matrix`, `construction-progress`, `sentiment-analysis`, `polymarket-search`, `trading-signal`, `stock-sentiment`, `polymarket-events`, `forex-sentiment`, `agent-create-wallet`, `ping`. Someone built a script targeting a specific financial data use case, is hitting the 402 wall repeatedly, and has not yet cleared the payment step. This is the highest-priority commercial signal in the window. Zero payment attempts. Architect confirms no charge is being issued — they're getting 402s and retrying without a payment header.

**② The platform has a live recurring external customer who paid yesterday**

Wallet `0x3803a19280deefe533d177c4a169412bd341101b` paid 14 times since June 1, most recently Aug 11 at 21:15 UTC (yesterday). Services: `satellite-earthdata`, `earthdata-ocean-color`, `earthdata-soil-moisture`, `earthdata-precipitation`, `earthdata-granules`, `earthdata-sst` ($0.25 each), `first-call` and `solana-yield-finder` ($0.05 each). All payments arrive at exactly :15 past the hour — this is a scheduled cron job. They are methodically expanding into new earthdata services each session. $2.90 over 10 weeks. Still active.

**③ 151 unique IPs hit the A2A agent card in 12 hours — discovery is far wider than x402 endpoint traffic**

The `endpoint_hits` table shows `/.well-known/agent-card.json` received 153 hits from 151 unique IPs. That is nearly 3× the unique IP count in x402_interactions (59). The `/.well-known/agent.json` endpoint had 81 hits from 81 unique IPs. The A2A discovery ecosystem is finding this platform at a rate the service-level data doesn't capture. This is top-of-funnel breadth that isn't visible in challenge data alone.

**④ hermes-contact-discovery/1.0 (contact@hermes.ai) swept 48 services in 15 minutes and left a contact address**

IP 51.102.230.240, 60 hits across 48 services, 22:00–22:15 UTC. Automated catalog sweep with a human-readable contact address embedded in the UA string. This is unusual — most crawlers don't self-identify with actionable contact info. Whether this is commercial research, a competitor, or a prospective integration, the contact address is directly reachable. One concise, non-salesy technical email is warranted.

**⑤ 6 payments verified in window — all platform self-payments, but rail is clean on first post-deploy canary**

Canary confirmed within 5 minutes of the new build (20:28 UTC), on-chain hash matches x402_canary_payments. BazaarSeeder fired on startup, paying for `b20-token-info`, `ai-inference`, `rh-stock-price`, `vlt-stats` — services never paid for by the seeder before. All 10 recent canary payments show `status=succeeded`. The payment rail is fully operational on the new build.

**⑥ MCP is being indexed by two distinct registries — mcpregistry-bot and mcpregistry.io both active**

61 mcp-initialize and 59 mcp-tools-list events from 7 unique IPs. `mcpregistry-bot/0.1` (185.43.233.32) ran 74 hits in this window and is still active (last seen 02:13 UTC). `MCPRegistry-Crawler/1.0` (mcpregistry.io) appeared separately. Zero MCP payment conversions — agents are enumerating all 80 tools and stopping at the payment step.

**⑦ AWS multi-region burst (21:00 UTC): 13 distinct IPs, all node UA, all simultaneously, one service each**

IPs spanning 44.220.x, 44.222.x, 54.221.x, 18.232.x, 3.233.x, 3.235.x, 3.236.x, 3.82.x, 34.200.x, 34.207.x, 34.230.x, 44.192.x — all fired within seconds of each other at 21:00 UTC, each hitting a single service 16 times. This is a multi-region Lambda or ECS distributed health check pattern. No payment attempts. Not hostile but the coordination pattern is notable. First observed this window.

---

## 3. Actor Analysis

### Major AI Platforms / Agent Infrastructure

| Actor | UA | IP | Hits | Svcs | Pattern |
|---|---|---|---|---|---|
| x402-observer | `x402-observer/1.0` | 2.208.198.190 | 459 | 48 | Known trust monitor; continuous 5–6min sweep cycle across 48 services |
| Cloudflare sweeper | (empty) | 2a06:98c0:3600::103 | 192 | 70 | IPv6, broadest sweep (70/80 services); catalog indexing for CF agent infrastructure |
| SmartFlowProAI | `x402-network-mapper/0.1` | 51.91.31.54 | 58 | 48 | Known; established relationship. 48-service sweep, consistent cadence. |
| mcpregistry-bot | `mcpregistry-bot/0.1` | 185.43.233.32 | 74 | 1 (MCP) | MCP endpoint only; actively indexing. Still hitting as of 02:13 UTC. |
| MCPRegistry-Crawler | `MCPRegistry-Crawler/1.0` | — | 2 | 1 | mcpregistry.io — second distinct MCP registry. |
| agent-tools.cloud | `agent-tools.cloud-crawler/0.1` | 107.174.178.57 | 17 | 1 | Known directory crawler; catalog maintenance. |

### SEO / Research Bots

| Actor | Hits | IPs | Svcs | Notes |
|---|---|---|---|---|
| SemrushBot/7 | 15 | 8 | 10 | Dec 2024+ recurring; distributed crawl pattern; routine |
| Bingbot/2.0 | 1 | 1 | 1 | Single pass; routine SEO index |
| Amazonbot/0.1 | 1 | 1 | 1 | First appearance this window |
| Googlebot mobile | 1 | 1 | 1 | Routine mobile crawl |

### Unknown Recurring Actors — HIGH PRIORITY

| Actor | IP | UA | Hits | Svcs | Pattern | Assessment |
|---|---|---|---|---|---|---|
| **OVH/France python client** | 163.47.70.38 | python-httpx/0.28.1 | 440 | 20 | 22 retries/svc over 11h | ⭐ MOST IMPORTANT. Stuck at payment gate. Targeting financial analytics. Not a scan — a workflow. |
| **hermes-contact-discovery** | 51.102.230.240 | hermes-contact-discovery/1.0 | 60 | 48 | 15-min burst at 22:00 | Contact: contact@hermes.ai. Self-identified with actionable contact. One outreach email warranted. |

### Bazaar / Sweepers / Indexers

- **Cloudflare sweeper (2a06:98c0:3600::103):** 70/80 services, empty UA — CF x402 infrastructure indexing. The breadth (70 services) is the widest of any single actor.
- **BazaarSeeder (platform, 0x5837a864...):** First production run. Paid for b20-token-info ($0.05), rh-stock-price ($0.05), ai-inference ($0.05), vlt-stats ($0.05) — all new services for Bazaar. CDP facilitator received real payments with `discoverable:true` + `extensions.bazaar` metadata.
- **x402-observer:** Trust/uptime monitoring across 48 services — not commercial but confirms persistent protocol-layer monitoring of the platform exists.

### Suspicious / Hostile

- **AWS multi-region burst (21:00 UTC):** 13 IPs firing simultaneously, each hitting one service 16 times. Lambda/ECS multi-region pattern. No payment attempts. Unusual coordination; monitor next window for escalation.
- **mcp-rugpull-research/1.0:** 2 hits only. Concerning name. Not actionable at this volume.
- **ScoutScore-HealthCheck/1.0:** 1 hit. Unknown. Not recurring.
- **/.well-known/index.php:** Single probe (1 hit, 1 unique IP). Classic WordPress/PHP vulnerability scan. The server correctly returns a non-200 to this; no action needed.

---

## 4. Endpoint Demand Analysis

### Highest-Demand Services (last 12h)

| Service | Hits | Challenges | Conversions | Unique IPs | Notes |
|---|---|---|---|---|---|
| mcp-server | 120 | 0 | 0 | 7 | MCP only; 2 registries actively indexing |
| compliance-consultation | 63 | 63 | 0 | 6 | **Also 22 retries from 163.47.70.38** |
| whale-alerts | 48 | 48 | 0 | 6 | 6 independent IPs |
| trade-signals | 42 | 42 | 0 | 5 | 5 IPs; consistent |
| credit-risk-score | 42 | 42 | 0 | 6 | **22 retries from 163.47.70.38** + 5 others |
| gas-price-oracle | 40 | 38 | 0 | 6 | 1 first-call-free granted |
| token-metadata | 40 | 36 | 0 | 7 | **Most unique IPs of any service (7)** |

### Independent Convergence — Services Multiple Actors Are Finding Independently

Services with 6–7 unique IPs indicate independent discovery by uncoordinated actors:
- **token-metadata (7 IPs)** — highest organic signal
- **compliance-consultation, credit-risk-score, agent-create-wallet, whale-alerts, verified-agent-identity, fraud-detection** — all 6 unique IPs

### The 163.47.70.38 Target List — A Defined Financial Intelligence Use Case

This actor targeted exactly these 20 services: `arbitrage-scanner`, `risk-metrics`, `compliance-consultation`, `prediction-market-odds`, `polymarket-odds`, `fraud-detection`, `lease-analysis`, `compliance-check`, `property-valuation`, `credit-risk-score`, `correlation-matrix`, `construction-progress`, `sentiment-analysis`, `polymarket-search`, `trading-signal`, `stock-sentiment`, `polymarket-events`, `forex-sentiment`, `agent-create-wallet`, `ping`. The common thread is financial analytics, risk scoring, compliance, and prediction markets — a trading or risk management agent workflow. 22 retries per service over 11 hours means a retry loop, not a one-time probe. They are not walking away.

### Most Likely to Convert First

1. **163.47.70.38's target services (any of 20)** — this actor is already retrying. If they get a funded wallet, they pay immediately. Their service list is the conversion opportunity.
2. **token-metadata** — 7 unique IPs, $0.05, pure utility, MCP-visible
3. **earthdata cluster** — the 0x3803a192... customer is actively expanding; their next session will likely add another earthdata service
4. **compliance-consultation** — 6 unique IPs, $1.00 price point. If any of those IPs has a funded wallet, the first conversion here is worth 20× a first-call payment.

---

## 5. Impact of Recent Updates / Fixes

### What Changed

- **esbuild --splitting (20:23 UTC deploy):** Port binds in 1.3s vs. 43s. Cloud Run promotes succeed. This is the fix.
- **BazaarSeeder in production:** First run at ~20:29 UTC. Paid for 4 services never previously seeded. CDP Bazaar indexer now has real facilitated payments for these services.
- **CanaryJob reentrancy guard:** Two canary fires in the window (19:22 on old build, 20:28 on new build). No duplicate fires. Guard holding.

### What Improved

- Deployability: the platform can now be updated without multi-hour promote failures.
- Bazaar discovery: BazaarSeeder is live, making real payments to trigger Bazaar indexing on previously uncovered services.
- Volume +23%, IPs +28% vs. prior 12h — post-deploy surge, two new actors, sustained monitoring traffic.
- Canary immediately confirmed on new build (within 5 minutes).

### What Did Not Improve

- **initApp() still takes ~130 seconds.** Routes are absent for 2 minutes after every cold start. The architect confirmed this creates a window where paying agents get 404s rather than 402s — they don't get charged, but they may mark the provider unreliable. Not fixed by --splitting.
- **MCP payment conversion: zero.** 61 initialize calls, 59 tool-list calls, no paid calls. The enumeration-to-payment gap is unaddressed.
- **163.47.70.38 cannot pay.** 22 retries over 11 hours with no payment header sent. The payment recipe (what wallet, what network, exact X-PAYMENT format) is not getting through. The architect notes there is no end-to-end request idempotency protection for cold-start retries — on-chain tx uniqueness is the principal protection.

### Evidence Fixes Are Holding

- Canary timestamps: 14:02, 13:20, 09:03, 03:04 (pre-deploy), 19:22 (old build final), 20:28 (new build first) — all `status=succeeded`, all unique on-chain hashes.
- `discoverable:true` and `facilitatorUrl` injection confirmed in dev logs for all services.
- No esbuild errors in deployment logs.
- Architect confirmed: --splitting is durable if no heavy imports are added to server/index.ts. Seeder documents dynamic import pattern correctly.

---

## 6. Conversion Readiness

### All-Time External Payer Table

| Wallet | Payments | Revenue | Period | Last Payment | Status |
|---|---|---|---|---|---|
| 0x3803a192... | 14 | $2.90 | Jun 1 – Aug 11 2026 | **Yesterday** | ✅ ACTIVE |
| 0x9cc42f3d... | 94 | $42.85 | Jun 12 – Jul 1 2026 | Jul 1 2026 | ⚠️ Wallet depleted |
| 0xa4bbe37f... | 109 | $5.45 | May 25 – Jun 13 2026 | Jun 13 2026 | Silent since |
| 0x85ed02ee... | 1 | $0.40 | Jul 21 2026 | Jul 21 2026 | One-time |
| 0xe92eb50a... | 1 | $0.05 | Jul 10 2026 | Jul 10 2026 | One-time |
| 0x92ca4cef... | 94 | $79.75 | Nov–Dec 2025 | Dec 2025 | Historical |
| 0x2f5134f7... | 48 | $31.70 | Dec 2025–Jan 2026 | Jan 2026 | Historical |
| 0x0a2854fb... | 1 | $14.87 | Dec 14 2025 | Dec 14 2025 | Historical |
| 0x74de5d4f... | 1 | $9.84 | Feb 18 2026 | Feb 18 2026 | Historical |

**Platform wallet (0x5837a864..., canary + seeder):** 464 Base payments, $139.35. Not external revenue.

### Payments This Window (12h)

All 6 from platform wallet 0x5837a864...: `first-call` ×2 (canary), `ai-inference`, `b20-token-info`, `rh-stock-price`, `vlt-stats` (seeder first run).

The earthdata payer (0x3803a192...) last paid Aug 11 at 21:15 UTC — just outside this window. Next payment likely within 5–7 days based on their cadence.

### Earthdata Payer Payment Pattern

All payments arrive at exactly :15 past the hour — scheduled cron. Services in chronological order: `earthdata-ocean-color` → `first-call` → `satellite-earthdata` → `earthdata-precipitation` → `earthdata-precipitation` again → `earthdata-sst` → `earthdata-soil-moisture` × 2 → `earthdata-granules` → `solana-yield-finder` → `earthdata-precipitation` → `earthdata-soil-moisture` → `satellite-earthdata`. They're branching into new services roughly every 3–7 days and have now paid for 7 distinct earthdata services. This is agent-native expansion behavior — the agent is being extended over time.

### Mid-Funnel Activity

- **payment-verified: 6** (all platform), **authorized: 6** (all platform) — funnel is working for actors who attempt payment
- **first-call-free: 1 granted** (gas-price-oracle) — free trial mechanism operational
- **first-call-free-rejected: 2** (token-metadata) — malformed request; guard working correctly
- **163.47.70.38: 440 hits, 0 payment headers sent** — stuck pre-payment, not post-payment

### Honest Stage Assessment

The platform is in **early-stage recurring revenue with active discovery acceleration.** One verified recurring external customer (0x3803a192..., still active), four historical customers, two recent one-time payers. The 163.47.70.38 actor is the first actor whose behavior in the data suggests they *want* to pay but are stuck — that's a qualitatively different signal than discovery traffic.

---

## 7. Security / Technical Issues

### Error Summary

| Event | Service | Count | Assessment |
|---|---|---|---|
| error | token-metadata | 2 | Co-occurring with first-call-free-rejected — malformed request burned trial then errored. Non-critical; free trial guard working. |
| first-call-free-rejected | token-metadata | 2 | Same malformed request origin. |
| error | vlt-usdc-withdraw | 1 | Vault service error. Pull metadata; confirm user error not platform logic. |
| error | vlt-usdc-zap-withdraw | 1 | Same. Monitor. |

### Technical Risk: 130s initApp() Cold-Start Window

**Architect assessment:** Routes are absent for ~130s after any container restart. An agent hitting `/x402/<service>` during this window gets a 404, not a 402. They are not charged (no payment challenge is issued) but they see route failure. Depending on their retry logic, they may: abandon, mark the provider unreliable, or successfully retry after init completes. Payment replay protection exists via unique on-chain `txHash` and `onConflictDoNothing` for Solana, but the EVM path needs audit. There is no end-to-end request idempotency key attached at the HTTP layer — on-chain tx uniqueness is the principal guard.

**Architect flags:** The BazaarSeeder runs at 2-hour intervals (not 6h as previously documented — verify `x402BazaarSeederJob.ts:83`). The 60s startup delay before first seeder run is a partial guard but not tied to an `initComplete` signal — a fast container restart could still hit the window.

### AWS Multi-Region Burst

13 AWS IPs firing simultaneously at 21:00 UTC, 16 hits each, one service each, all `node` UA. Lambda or ECS multi-region health check pattern. No payment attempts. Monitor next window for pattern change.

### Discovery Surface Probe

`/.well-known/index.php` — single hit from 1 IP. Classic PHP vulnerability probe. Server returned non-200. Not a risk.

---

## 8. Business Development Read

### The Earthdata Customer (0x3803a192...)

**Facts:** 14 on-chain payments since June 1. All arrive at :15 past the hour. Covering 7 distinct earthdata services + solana-yield-finder. Last payment: yesterday. $2.90 total. Average $0.25/session.

**Interpretation:** This is a real agent workflow running on a scheduled cadence, being incrementally extended by whoever is building it. The developer is actively working on this system — they keep adding new earthdata services to their agent's toolset. The $0.25/call price is not deterring them. Retention risk: if the earthdata API under the service changes, if prices increase dramatically, or if the service goes dark (an error they notice). They have not attempted to contact us. They may not know there's a team behind this.

**Action:** The on-chain wallet is public. The payment pattern is distinctive. If there's any way to reach this wallet address (on-chain message, ENS lookup, or tracking if the wallet has any social/public identity), a one-sentence introduction is warranted: "We noticed your agent has been using our earthdata services — we'd love to help you expand it." This is the most valuable relationship to activate on the platform right now.

### The Stuck Python Client (163.47.70.38)

**Facts:** 440 hits. 20 financial analytics services. 22 retries each. 11 hours. Zero payment headers sent. OVH France. Not in any known-actor list.

**Interpretation (biz dev):** Defined evaluation set = someone who knows what they want. Systematic retry loop = software, not a human. 22 retries without a payment header = the code doesn't know how to respond to a 402 yet. This is a developer who built a script to call these services but hasn't implemented the x402 payment layer. The fix on their end could be as simple as wiring up `x402-fetch` or adding the X-PAYMENT header logic. The barrier is technical, not commercial — they want the data. A direct, technical email to the OVH registrant for this IP subnet (or a social/GitHub search for a python-httpx user in France building a financial agent) could unlock this customer.

**Interpretation (architect):** No payment is being attempted, so no duplicate-charge risk. The 402s are correct. The platform is behaving properly. The problem is 100% on the client side.

### MCP Commercial Path

**Facts:** 61 initialize + 59 tool-list from 7 IPs. Two registries. Zero paid calls.

**Interpretation:** MCP traffic is distribution validation, not demand. The registries confirm the platform is indexed. The initialize/tool-list flow confirms agents are discovering capabilities. But the MCP protocol doesn't have a native payment step — agents that enumerate tools don't automatically know to send X-PAYMENT on the tool call. The 402 response body tells them what to do, but most MCP clients (Claude Desktop, Cursor, etc.) don't pass the 402 instructions back to the developer. The gap is documentation and developer education, not platform capability.

### Historical Revenue Context

All-time external revenue: ~$183 (Nov 2025 – Aug 2026), of which $122.75 came from Dec 2025 alone (0x92ca4cef: $79.75, 0x2f5134f7: $31.70, 0x0a2854fb: $14.87). The platform generated real revenue before June 2026 from actors who have since gone silent. The current external revenue run rate is approximately $0.25–0.50/week from 0x3803a192..., plus occasional one-offs. Revenue is real but thin since the Dec 2025 cohort left.

### Commercial Stage

**Validation with early recurring revenue.** Not pre-conversion — there is actual conversion. The commercial question is: can the revenue rate increase from 0x3803a192..., and can 163.47.70.38 and/or hermes convert? Those three actors together could meaningfully change the weekly run rate.

---

## 9. Action Items

| # | Action | Priority | Type |
|---|---|---|---|
| 1 | **Research 163.47.70.38** — OVH WHOIS, reverse DNS, GitHub/LinkedIn search for python-httpx + financial agent + France. If identifiable, send one concise technical email: "your agent hit our financial analytics services 440 times yesterday — here's the exact X-PAYMENT header you need to make it work" | 🔴 24h | BD |
| 2 | **Email contact@hermes.ai** — one sentence: who we are, what they found, link to MCP docs and a working curl example with payment. Non-salesy. Technical. No follow-up if no reply. | 🔴 24h | BD |
| 3 | **Attempt to identify the earthdata wallet (0x3803a192...)** — ENS lookup, on-chain message, or Etherscan search for any social/public identity. If contactable: short intro, ask what workflow they're building, offer to help expand the integration. | 🟡 48h | BD |
| 4 | **Fix initApp() cold-start gap** — architect identifies this as real risk for paying agents. Most impactful approach: split the heavy service imports in appMain.ts into deferred dynamic imports using the same pattern applied to the seeder/canary jobs. Target: routes registered within 10s of listen(), not 130s. | 🟡 Dev | Reliability |
| 5 | **Add `initComplete` signal to BazaarSeeder startup delay** — the 60s hardcoded delay is a partial guard. Replace with a proper flag/event that gates the startup fire until routes are confirmed registered. | 🟡 Dev | Reliability |
| 6 | **Write a one-page "how to pay" technical guide** — targeted at the 163.47.70.38 archetype (python-httpx developer who got 402 and doesn't know what to do next). Exact wallet setup, X-PAYMENT header construction, `x402-fetch` wrapper, retry logic. Link from the 402 response body and from MCP tool descriptions. | 🟡 Dev/BD | Monetization |
| 7 | **Instrument MCP tool-call level funnel** — currently only initialize + tools/list are tracked. Add tracking for tool-call attempts (even unpaid) to see whether MCP clients are trying to call tools and hitting the payment gate. Right now there's a black hole between list and conversion. | 🟡 Dev | Analytics |
| 8 | **Audit EVM payment deduplication** — architect flags that Solana has `onConflictDoNothing` in the intent insert, but EVM idempotency is unverified. During cold-start retries an agent could theoretically trigger duplicate on-chain charges if the route briefly comes up mid-retry. Low probability but the surface exists. | 🟡 Dev | Security |
| 9 | **Monitor 163.47.70.38 next window** — if they return, their retry count will exceed 22/service. If they stop, the evaluation concluded (negatively or they went elsewhere). If they add a payment header, fire an alert. | 🟡 Analytics | Monitoring |
| 10 | **Investigate AWS multi-region burst (21:00 UTC)** — check whether the 13 IPs appear again in the next window. If so, identify the service being targeted and whether the pattern suggests load testing or automated scraping. | ⬜ 48h | Security |

---

## 10. Final Verdict

The platform is healthy, operational on the new build, and showing the right precursor behaviors for commercial growth. The deployment blocker is fixed. The payment rail is clean. The earthdata customer is still active. MCP is indexed in two registries. Discovery is drawing 150+ unique IPs per day at the A2A layer alone.

The most important single finding in this window: an unidentified python-httpx actor retried 20 financial analytics services 22 times each over 11 consecutive hours without sending a payment header. They did not give up. They are stuck, not gone. That is a solvable problem. If you can reach them or make the payment recipe obvious enough that their script picks it up automatically, this converts from noise to revenue.

The earthdata recurring customer has been active for 10 weeks and paid yesterday. They are the most durable external revenue signal the platform has shown. They do not know you exist as a business. They should.

**Confidence: High** on technical and payment data. **High** on actor analysis — the retry behavior from 163.47.70.38 is unambiguous. **Medium** on commercial outcomes — actor identification and outreach success rates are inherently uncertain. The data is solid; the conversions are not yet in hand.

---
*Saved: docs/analytics/assessments/2026-08-12-12h-assessment-v2.md*
