# Coin Railz Platform Activity Assessment
## Window: Jul 30 2026 15:09 UTC → Jul 31 2026 03:09 UTC (12 hours)
## Generated: Jul 31 2026 03:15 UTC

---

## 1. Executive Summary

The platform delivered a flat, healthy 12-hour window. Volume held at 1,203 real requests — effectively unchanged from the prior window (+1%). Two canary payments succeeded on schedule. Zero external payment intents. The 10-day payment drought continues, but behavioral signals from major actors are moving in the right direction: 74.220.48.55 is now systematically POSTing eight distinct services across five separate sessions, hermes-contact-discovery/1.0 made its debut with a full 48-service sweep, and the hol.org A2A evaluation framework matched and tested whale-alerts as a capability check. The IPv6 sweeper expanded its POST coverage to 17 services with 65 total services touched. Discovery remains strong at 84 unique IPs hitting agent.json. The yield portals attracted 4 unique IPs each to manifests, with agents actively attempting deposit flows (hitting template literal errors, not disinterest).

**Verdict:** Platform held steady. Validation depth increasing. No payment, but the actors most likely to convert are advancing through the funnel.

---

## 2. Headline Signals

### 1. 74.220.48.55 — Five POSTing Sessions, Eight Services, Zero Wallet (CRITICAL WATCH)
This actor is now running structured integration sessions: 16:27, 18:30-18:37, 20:55, 22:02, and 00:30-00:37 UTC — roughly every 90 minutes. Services targeted this window: multi-chain-balance, compliance-consultation, risk-metrics, smart-contract-audit, trade-signals, token-price, property-valuation, credit-risk-score. Each service gets two near-simultaneous POSTs (client-side concurrency bug, not a platform issue). All receive 402. Also maintaining 18 HEAD probes to gas-price-oracle throughout the window. The actor is not scanning randomly — it is repeatedly re-validating a fixed set of 8 services as if it is confirming service reliability before committing a wallet. **One funding event away from becoming the platform's next organic payer.**

**Why it matters:** No other actor is doing this. Repeat multi-service POST batches with stable session spacing = integration testing, not scanning.

### 2. hermes-contact-discovery/1.0 — First Appearance, 48 Services in 7 Minutes
hermes.ai (51.102.230.240, `contact@hermes.ai` in UA string) swept all 48 catalog services between 22:34-22:41 UTC in a single burst. This is an AI messaging/comms platform doing automated capability mapping. The fact that they self-identify with a contact email signals they expect to be found and contacted.

**Why it matters:** New actor with direct commercial intent signal. The contact email in the UA is unusual and deliberate. This needs an outreach email within 48 hours.

### 3. hol.org registry-broker/a2a-simple-evals — Matched whale-alerts and Ran a Capability Test
138.197.115.243 sent two A2A messages: the first matched `whale-alerts` and asked a capability-framing question ("Gravity is a force that: [multiple choice]"). The second was unmatched arithmetic. This is an automated service quality evaluator that other agents query before deciding to integrate. Being listed positively here influences downstream agent purchasing decisions.

**Why it matters:** This is the first confirmed instance of a third-party evaluation framework testing a Coin Railz service. Pass rates here affect agent ecosystem credibility.

### 4. IPv6 Sweeper (2a06:98c0:3600::103) — 17 Services POSTed, 65 Services Touched
The Cloudflare-fronted blank-UA sweeper expanded its POST coverage to 17 services (ping, token-sentiment, transaction-builder, gas-price-oracle, first-call, trending-tokens, token-metadata, trade-signals, whale-alerts, batch-quote, payment-processing, portfolio-tracker, dex-liquidity, wallet-risk, approval-manager, multi-chain-balance, token-price) — 4 POSTs each. Also touched 30+ more services via GET. 65 total services in 12 hours. No payment, never has paid. Catalog comprehensiveness indexer behavior.

**Why it matters:** Expanding POST coverage = escalating validation, consistent with prior two windows. Still zero payment. Rate is below the 200/min limiter threshold. Contained but watch for acceleration.

### 5. undici (92.255.110.46) — Third Service in Sequential Rotation: token-metadata
Prior windows: polymarket-odds → token-sentiment → now token-metadata (3 HEADs, all 402). Methodical one-service-per-window HEAD validation pattern. Heading toward a POST.

**Why it matters:** Clean sequential pattern = deliberate catalog traversal. Each new service targeted represents a cleared "gate" in this actor's evaluation pipeline.

### 6. Yield Portal 400 Errors — Demand Blocked by a Template Literal Bug
Agents are discovering the Base and Solana yield manifests (4 unique IPs each, /api/yield/manifest and /api/solana-yield/manifest). Two actors then attempted deposit-tx calls sending the literal string `{wallet}` rather than a real address, triggering 400 errors. This is a documentation/UX gap blocking an active conversion attempt.

**Why it matters:** This is not lack of demand. Agents want to deposit. They are failing at the integration step because the manifest's example URL pattern is ambiguous.

### 7. Discovery at 84 Unique IPs on agent.json — Second Consecutive Window at This Level
84 unique IPs hitting agent.json in 12 hours. This is not driven by one sweeper — 84 distinct agents independently discovered and fetched the primary agent manifest. 52 unique IPs each on agent-card.json and x402 well-known. Consistent with the trend established in the prior window.

**Why it matters:** Sustained high-diversity discovery means the platform's catalog entries (Smithery, mcp.so, a2aregistry.org) are driving qualified inbound traffic at scale.

---

## 3. Actor Analysis

### Major AI Platforms / Commercial Agents

| Actor | IPs | Hits | Posts | Notes |
|---|---|---|---|---|
| 74.220.48.55 | 1 | 46 | 28 | `node` UA. 8 services, 5 sessions. Most advanced pre-conversion actor. |
| hermes-contact-discovery/1.0 | 1 | 60 | 0 | hermes.ai. First appearance. 48 services in 7 min. Contact email in UA. |
| registry-broker/a2a-simple-evals | 1 | 2 | 2 (A2A) | hol.org. Matched whale-alerts, ran capability eval. |
| agent-tools.cloud-crawler/0.1 | 1 | 1 (A2A) | 1 (A2A) | Catalog index query. Prior window completed full MCP session. |
| 13.48.136.59 (python-requests) | 1 | 1 (A2A) | 1 (A2A) | Outbound spam — "OpenAI API $0.01 USDC" blast. NOT a buyer. |
| KunlunYaochi-Probe/1.0 | 1 | 1 (A2A) | 1 (A2A) | Chinese AI platform (Kunlun Tech). First appearance in catalog probe. |

### SEO / Research Bots

| Actor | IPs | Hits | Notes |
|---|---|---|---|
| meta-externalagent/1.1 | 18+ rotating 57.141.x.x | 29 | Facebook/Meta agent catalog indexer. Stable recurring presence. |
| AhrefsBot/7.0 | 2 | 2 | Backlink crawler. |
| SERankingBacklinksBot | 2 | 2 | SEO backlink tracker. |
| Amazonbot/0.1 | 4 | 5 | Amazon web crawler. |
| bingbot/2.0 | 1 | 1 | Standard web index. |

### Unknown Recurring / Sweepers / Indexers

| Actor | IPs | Hits | POSTs | Notes |
|---|---|---|---|---|
| python-httpx/0.28.1 (163.47.70.38) | 1 | 480 | 0 | 20 services × 24 GET hits. Persistent health prober. At retry 39+. |
| x402-observer/1.0 (2.208.198.190) | 1 | 319 | 32 | 48 services. 8 POSTs each to compliance-consultation, payment-processing, smart-contract-audit, trade-signals. Uptime/trust monitor. |
| IPv6 blank UA (2a06:98c0:3600::103) | 1 | 165 | 68 | 65 services. 17 services POSTed ×4 each. Cloudflare-fronted. |
| x402-network-mapper/0.1 (51.91.31.54) | 1 | 58 | 0 | SmartFlowPro AI. 48 services GET sweep. |
| undici (92.255.110.46) | 1 | 3 | 0 | 3 HEADs to token-metadata. Sequential service rotation pattern. |
| 34.158.104.72 (node, GCP) | 1 | 9 | 0 | 9 HEADs to 3 services. Not canary wallet. |
| x402-healthbot/1.0 (decixa.ai) | 2 | 2 | 0 | Health monitor. |

### Canary / Internal

| Actor | IPs | Hits | Paid | Notes |
|---|---|---|---|---|
| 34.96.44.170 (node, GCP) | 1 | 16 | 4 | Canary wallet. 2 successful canary runs (16:18, 22:18 UTC). |

### Suspicious / Hostile

None observed. The A2A spam from 13.48.136.59 is a commercial peer blast (self-promotion), not a hostile probe. The IPv6 sweeper is contained below rate-limit thresholds.

---

## 4. Endpoint Demand Analysis

### Top Services by Volume (real requests, last 12h)

| Service | Requests | POSTs | HEADs | Unique IPs | Assessment |
|---|---|---|---|---|---|
| compliance-consultation | 44 | 10 | 0 | 6 | High enterprise interest. x402-observer + 74.220.48.55 both targeting. |
| ping | 40 | 4 | 3 | 7 | Health probe anchor. |
| gas-price-oracle | 37 | 4 | 21 | 6 | 74.220.48.55 is HEAD-probing this 18×. Cost-sensitivity probe. |
| risk-metrics | 35 | 4 | 0 | 6 | In 74.220.48.55's POST list. |
| property-valuation | 35 | 4 | 0 | 6 | Same. |
| correlation-matrix | 33 | 0 | 0 | 6 | Sweeper coverage. |
| stock-sentiment | 33 | 0 | 0 | 6 | Sweeper coverage. |
| polymarket-odds | 33 | 0 | 0 | 6 | Sweeper coverage. |
| first-call | 28 | 12 | 4 | 5 | 4 paid (canary). 8 external POSTs from 74.220.48.55 and IPv6 sweeper. |
| trade-signals | 24 | 16 | 0 | 5 | 8 POSTs from x402-observer, 4 from IPv6 sweeper, 4 from 74.220.48.55. |
| multi-chain-balance | 25 | 10 | 0 | 5 | 74.220.48.55 targeting heavily. |
| smart-contract-audit | — | 8 | 0 | — | x402-observer focus. High-value ($0.50). |
| payment-processing | — | 12 | 0 | — | x402-observer + IPv6 sweeper both POSTing. |
| token-metadata | 26 | 4 | 7 | 7 | undici's current HEAD target. IPv6 also POSTing. |

### Services Showing Repeat Validation / Independent Convergence

- **compliance-consultation** — 3 independent actors POSTing: 74.220.48.55, x402-observer, IPv6 sweeper. Strongest convergence signal in the catalog.
- **trade-signals** — Same 3-actor convergence.
- **multi-chain-balance** — 74.220.48.55 and IPv6 sweeper. Two-actor convergence.
- **token-metadata** — undici (HEAD), IPv6 sweeper (POST), 34.158.104.72 (HEAD). Three actors, three methods.

### Services Most Likely to Convert First

1. **compliance-consultation** — Highest actor convergence, $0.50 price point, enterprise use case. x402-observer and 74.220.48.55 both validated multiple times.
2. **risk-metrics** — Part of 74.220.48.55's fixed 8-service set. If that actor funds a wallet, risk-metrics is likely first.
3. **first-call** — Low friction ($0.05), entry point. Still getting external POSTs.
4. **trade-signals** — Three-actor convergence, viable price ($0.10-$0.25). High commercial utility.

### Satellite API — Independent Convergence
Six satellite services (land-use, weather-imagery, vegetation, air-quality, fire-alerts, flood-detection) each received 8-9 hits from 8-9 unique IPs, all 402. This is independent convergence — separate actors who found these services on their own, not a single sweeper. Suggests the satellite data vertical has genuine breadth of interest.

---

## 5. Impact of Recent Updates / Fixes

### Canary Job — Holding
2/2 canary payments this window (16:18, 22:18 UTC). All-time: 765 SUCCEEDED intents. The full Base mainnet payment rail (challenge → USDC on-chain → verification) is confirmed healthy.

### vlt-usdc-withdraw — Production Hit Yesterday, Quiet Now
The new withdraw service received its first production hit in the prior window (57.141.0.32, Jul 30 11:33 UTC). No additional hits this window. Expected — initial curiosity probes tend to be single-session.

### Free Trial Gate Fix — Active
`/api/m2m/credits/trial` received 2 unauthorized attempts (403 returned). The gate is working as intended — no erroneous free trial grants.

### Discovery Surface — All 6 Required Surfaces Confirmed Active
agent.json, agent-card.json, x402.json, x402 well-known, agent-instructions.json, mcp.json — all receiving hits from unique IPs. The awi.json surface is not recorded here but was present in the prior window.

### What Did Not Improve
- Yield portal manifest documentation: agents are still sending literal `{wallet}` to deposit-tx endpoints. The manifest UX gap introduced in the original yield portal spec has not been fixed and is now demonstrably blocking conversion.
- No API key activations: 103 active keys, 0 used in 12h, 99 never used. This backlog has not moved.

---

## 6. Conversion Readiness

**No external payments this window. All-time last external payment: Jul 21 2026 ($0.40, stock-sentiment, wallet 0x85ed02ee).** The drought is now 10 days. Cause remains unchanged: prior high-volume payer (0x9cc42f3d) depleted their wallet; three organic payers (0x85ed02ee, 0xe92eb5, 0x3803a1) haven't returned.

Conversion readiness is higher than it has been:

- **74.220.48.55** is past cost-modeling. Five active POSTing sessions in 12 hours is integration testing behavior. The actor has validated 8 services. They are one wallet-funding event from becoming a payer. Estimated conversion lag: days to weeks, depending on internal approval.
- **Yield portal** has active conversion attempts that are failing due to a template literal bug. Fix the manifest → immediate conversion path unblocked.
- **hermes.ai** swept the full catalog in 7 minutes on first visit. Contact email is in their UA string. High-intent first visit.
- **undici** is in session 3 of its sequential service rotation. Historical pattern at this point usually precedes a POST.
- **hol.org eval framework** matched and evaluated whale-alerts. If this evaluation is shared with downstream agents, it creates pull-based demand.

Funnel stage: **Late Validation / Pre-Conversion**. Multiple actors are behaving in ways that would precede payment, not discovery.

---

## 7. Security / Technical Issues

### Architect Verdict: PASS WITH NOTES

**1. 74.220.48.55 Duplicate POST Pattern — Client Bug, Not Platform Bug**
Each service gets two near-simultaneous POSTs within milliseconds. This is a client-side concurrency issue (parallel fire or tight retry loop). The platform correctly issues 402 on both. No replay risk — replay protection only engages after a valid txHash is submitted, which hasn't happened. No action required.

**2. IPv6 Sweeper — Contained, Not Urgent**
At 165 hits/12h, the sweeper is well below the 200/min rate limiter ceiling. Serving 402 before any business logic triggers. Architect assessment: Low risk at current volume.

**3. Potential Solana Cross-Service txHash Reuse (Low Severity)**
Architect flagged: the replay protection index is `(tx_hash, service_name)` — a single Solana txHash could theoretically unlock multiple different services if it satisfies each service's amount check independently. Practical risk is low (requires a sender to know the exact payment windows for multiple services simultaneously) but worth a follow-up audit of the amount-vs-service-cost check in `verifySolanaPayment`.

**4. A2A Spam (13.48.136.59) — Informational Only**
Sending "OpenAI API, $0.01 USDC" A2A blast. This is a peer agent marketing message, not an attack. No action required.

**5. hol.org Whale-Alerts Match on Trivia Question — Semantic Over-Matching**
The A2A router matched a "gravity is a force that" question to whale-alerts. The semantic matcher is likely catching "objects with mass" or similar terms. Not broken, but a false positive match rate from evaluation bots could skew A2A match statistics. Watchlist item.

**6. yield deposit-tx 400 Errors — UX Bug**
Two agents sending literal `{wallet}` — hard 400. Not a platform crash, but a conversion blocker.

---

## 8. Business Development Read

**Commercial Stage: Late Validation / Pre-Conversion**

The platform is past the point where any of this is just discovery traffic. Three distinct actors are running structured integration tests. One (74.220.48.55) is running multiple sessions per day. A fourth (hermes.ai) arrived with a contact email and swept everything. A fifth (hol.org eval) is evaluating services for downstream agent recommendations. This is a warm ecosystem.

**What to do with each actor:**

| Actor | Priority | Action |
|---|---|---|
| hermes.ai (contact@hermes.ai) | **Immediate** | Email within 48h: "We noticed your capability sweep. Here's a service bundle for contact discovery and agent messaging use cases." |
| 74.220.48.55 | **Watch** | Cannot contact (no contact info). Update 402 body for this IP's most-hit services to include a bulk pricing note or integration guide link. |
| hol.org (registry-broker) | **Strategic** | Verify whale-alerts metadata is accurate and capability-descriptive. No outreach needed — maintain quality to pass evals. |
| undici (92.255.110.46) | **Watch** | Next window likely brings a POST. Track which service it moves to. |
| agent-tools.cloud | **Follow-up** | Prior session indexed all 79 tools via MCP. Consider reaching out for featured placement while session is recent. |
| KunlunYaochi-Probe/1.0 | **Watchlist** | Kunlun is a major Chinese AI player. If this returns, treat as high-priority. |

**Yield Portal — Immediate Revenue Gap**
Agents are trying to deposit and failing at the template literal stage. Fix the manifest documentation and this converts within the next sweep cycle.

**The drought is noise, not signal.** All four prior organic payers were one-session events. The platform never had recurring payers. What's building now looks more systematic — actors with session discipline and service breadth. The next payment is more likely to be a sustained account than a one-off.

---

## 9. Action Items

**Dev Work**
1. **Fix yield manifest template literals** — Update `/api/yield/manifest` and `/api/solana-yield/manifest` docs so `{wallet}` is replaced with a real placeholder address (e.g. `0x0000...`) plus inline comment `// replace with agent wallet`. This is an active conversion blocker.
2. **Audit Solana txHash cross-service reuse** — Verify `verifySolanaPayment` checks cumulative amount claimed against total service cost (not just per-service). Low urgency, but architectural tightness worth confirming.
3. **Add MCP rate limiting** — POST /mcp is still unrestricted. IPv6 sweeper ran full MCP sessions; hol.org eval ran A2A calls. Neither is a crisis, but a 60/min limit keyed by IP is a one-line addition worth adding before volume increases.

**Analytics / Monitoring**
4. **Track 74.220.48.55 session cadence** — The ~90-min inter-session gap is consistent. Set a watch on this IP's first POST with a non-402 response code. When that happens, the payment rail triggered.
5. **Watch undici's next service** — Three-service rotation confirmed. Whichever service it HEAD-probes next is the conversion candidate for that actor.
6. **Monitor hermes.ai for return visits** — First sweep was GET-only. If they return with POSTs within 72h, that's a high-conversion signal.

**Endpoint Optimization**
7. **Improve whale-alerts metadata** — The hol.org eval matched it to a gravity trivia question. Tighten the service description to reduce false A2A matches (which could affect match-quality scoring in eval frameworks).
8. **Add a `/x402/catalog.json` endpoint** — Machine-readable flat list of all service IDs, prices, and payment address. Directly serves 74.220.48.55's observed need to hit every service individually to build a routing table.

**Business Development**
9. **Email hermes.ai** — Contact contact@hermes.ai within 48h. "We noticed your capability discovery run. Here's a targeted bundle for comms/messaging-related services + a sample integration." This is the highest-confidence outreach candidate since MERCURY.
10. **Do not re-open Task #44 (agent-tools.cloud)** — The indexing session is fresh but they are a directory, not a buyer. Featured placement outreach is low ROI vs. the hermes.ai and yield portal priorities.

---

## 10. Final Verdict

The platform is healthy, quiet on payments, and accelerating in validation depth. Three actors are running structured, repeated service tests — a level of sophistication not present six weeks ago. The hermes.ai appearance is the most commercially actionable event of the window: a new, contactable actor with an AI messaging product that swept the full catalog on first visit.

The 10-day payment drought reflects the realities of a very small known-payer pool, not a platform problem. The canary proves the rail works. The validators prove the platform is being taken seriously. The next external payment is more likely to come from a new organic actor (hermes.ai, 74.220.48.55, undici) than from the depleted prior payers returning.

One fixable conversion blocker was identified: yield portal template literal errors. Agents are trying to transact and failing at documentation. Fix that first.

**Confidence: Medium-High.** Volume data is clean. Actor intent inferences are behavioral (not confirmed). The "one wallet-funding event from conversion" read on 74.220.48.55 is speculative but grounded in five sessions of consistent behavior.

**Architect: PASS WITH NOTES** (no 5xx, canary 2/2, one latent Solana edge case, yield docs gap)
**BizDev: Pre-Conversion / Escalation** (hermes.ai outreach is immediate; 74.220.48.55 is watching)

---

*Assessment saved: docs/analytics/assessments/2026-07-31-am-12h-assessment.md*
*Queries run against: production DB*
*Subagents consulted: Architect, BizDev*
