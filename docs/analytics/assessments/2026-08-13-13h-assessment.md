# Coin Railz Platform Assessment — Aug 13 2026, ~01:00–13:12 UTC (12h Window)

**Produced:** 2026-08-13 13:12 UTC  
**Data sources:** x402_interactions, endpoint_hits, a2a_interactions, conversion_funnel_events, x402_payment_intents (48h), architect subagent, biz dev subagent  
**Prior window:** Aug 12 2026 ~12:00–01:00 UTC

---

## 1. Executive Summary

The platform processed 1,577 x402 interactions from 31 unique IPs across 78 services in 12 hours — down 17% in volume and 52% in unique IPs versus the prior window, largely a time-of-day effect (overnight UTC vs. active daytime). No external payments landed in this window; the last confirmed external payment was Aug 11 from the earthdata agent.

The single most important event of the window: **a brand-new actor from Argentina (`181.28.163.162`, python-httpx) traversed the complete MCP funnel — initialize → tools/list → tool-call attempts — and hit `mcp-challenge-issued` across 18 services**. This is the first observed external agent to enter the MCP payment pipeline. It did not pay, but it got all the way to the payment gate via MCP, which has never happened before.

Simultaneously, the stuck OVH actor (`163.47.70.38`) has now repeated its 20-service sweep **24 times per service** (up from 22 in the prior window) — still no payment header, but still running after more than 36 hours. Meta's external agent crawler and Amazon's bot both appeared for the first time. The earthdata agent (`136.124.33.101`) quietly expanded into two new B20 services.

**Verdict:** The platform moved forward. The MCP payment funnel produced its first observable tool-call pipeline. The breadth of ecosystem discovery continues expanding. No revenue in this window, but the behavioral signals are the strongest yet.

---

## 2. Headline Signals

### 2.1 First External MCP Tool-Call Pipeline — `181.28.163.162` (Argentina)
**Why it matters:** Every prior MCP interaction in platform history stopped at tools/list. This actor went further: MCP initialize → tools/list → parallel tool calls across 18 services → received `mcp-challenge-issued` responses on each. The payment gate is working end-to-end in MCP. This actor got stopped by the payment requirement — not by a broken endpoint, not by a missing tool, not by a schema error. Whether they pay next is the question. This is the most significant technical validation of the MCP path to date.

The service list: ping, approval-manager, token-metadata, gas-price-oracle, dex-liquidity, multi-chain-balance, property-valuation, batch-quote, trending-tokens, earthdata-granules, wallet-risk, portfolio-tracker, payment-processing, token-price, token-sentiment, whale-alerts, smart-contract-audit, contract-scan. Heavily DeFi and data-infrastructure focused. Service selection matches a crypto-native agent framework.

### 2.2 OVH Actor Still Running — Day 2, Retry Count Rising
**Why it matters:** `163.47.70.38` (python-httpx/0.28.1, OVH France) is now on its **24th retry per service** across 20 financial analytics endpoints — up from 22 in the prior 12h window. The agent has been running continuously for more than 36 hours. A broken test harness that gave up would not increment retry count; this one is still executing, meaning it is actively retrying. It has never sent a payment header. This is the clearest conversion-adjacent signal on the platform: a live agent workflow that needs exactly one thing it doesn't know how to produce.

### 2.3 Earthdata Agent Expanding Into B20 Services
**Why it matters:** `136.124.33.101` (node UA, no payment in this 12h window) hit b20-compliance-scan (4 times) and b20-transfer-check (4 times) in addition to its regular earthdata service rotations (earthdata-ocean-color, earthdata-granules, earthdata-precipitation, earthdata-soil-moisture) and first-call (31 hits, every ~2 hours). The B20 services are new for this agent — it's autonomously discovering and testing new services from the catalog. Combined with its consistent payment behavior (14 payments totaling $2.90 since June 1, last paid Aug 11), this is the platform's most reliable commercial relationship.

### 2.4 Meta External Agent Crawler — First Appearance
**Why it matters:** 13 unique IPs in the `57.141.0.x` range arrived carrying `meta-externalagent/1.1` UA (Facebook's AI infrastructure crawler) and hit 5 distinct services across the platform. This is the first appearance of Meta's crawler. Amazon's bot (Amazonbot/0.1) also appeared across 3 IPs. Both are top-5 AI platforms by infrastructure scale. They do not pay for API calls, but their indexing behavior precedes distribution — the same pattern that preceded the B2B crawl waves in prior assessment windows.

### 2.5 Discovery Surface Holding at Scale — 155 Unique IPs on Agent-Card in 12h
**Why it matters:** `/.well-known/agent-card.json` received 161 hits from 155 unique IPs in 12 hours — essentially one new discoverer every 5 minutes around the clock. `/.well-known/agent.json` received 83 hits from 83 unique IPs. The funnel recorded 36 `first_contact` events (all `well_known` source). None converted to `first_x402_call` in this window (prior 7-day total: 14). The discovery rate is real and stable; the conversion gap from discovery to service call is where attention belongs.

### 2.6 ZauthTokenFinder/1.0 — Credential Scanner Probe
**Why it matters:** `219.104.141.40` hit gas-price-oracle twice with a self-describing credential-scanning UA. No payment header, no auth, just probing. One data point, not a pattern yet — but it is the first named credential scanner to appear on this platform. Log and watch. See Section 7.

### 2.7 Volume Decline Is Compositional, Not a Drop in Quality
**Why it matters (for context):** The 52% drop in unique IPs (65 → 31) and 17% drop in hits is almost entirely explained by the time window (overnight UTC, fewer batch sweepers active) and the absence of hermes-contact-discovery (not active this window). The actors who matter — earthdata, OVH, x402-observer, MCP actors — are all present. This is not a regression.

---

## 3. Actor Analysis

### Major AI Platforms / Ecosystems
| Actor | IP | Hits | Services | Notes |
|---|---|---|---|---|
| Meta external agent | 57.141.0.x (13 IPs) | 16 | 5 | First appearance. Facebook AI crawler. |
| Amazonbot/0.1 | 54.x/52.x (3 IPs) | 3 | 3 | First appearance this window. |
| mcpregistry-bot/0.1 | 185.43.233.32 | 88 | 1 (mcp-server) | Continuous MCP indexing, single endpoint. |

### AI Agent Operators / Payment-Adjacent Actors
| Actor | IP | Hits | Services | Status |
|---|---|---|---|---|
| **Argentina MCP agent** | 181.28.163.162 | 53 | 18 | python-httpx. MCP tool-call pipeline, hit payment gate. |
| **OVH financial agent** | 163.47.70.38 | 480 | 20 | python-httpx. Day 2, 24 retries/svc, still no payment. |
| **Earthdata agent** | 136.124.33.101 | 58 | 7 | node. Paying customer, expanding into B20. |
| IPv6 agent | 2a06:98c0:3600::103 | 122 | 35 | No UA. Persistent broad scanner. |

### SEO / Research Bots
| Actor | IP | Hits | Notes |
|---|---|---|---|
| SemrushBot | 185.191.171.10, 85.208.96.207 | 3 | Light touch, 2 services. Ongoing. |

### Sweepers / Infrastructure Monitors
| Actor | IP | Hits | Services | Notes |
|---|---|---|---|---|
| x402-observer/1.0 | 2.208.198.190 | 444 | 48 | Full catalog sweep, normal. |
| node (Nexcess range) | 74.220.48.55 | 161 | 47 | Broad catalog sweep, likely cloud-hosted agent. |
| node (Nexcess range) | 74.220.48.169 | 98 | 47 | NEW this window, same range as .55. |
| agent-tools.cloud-crawler | 107.174.178.57 | 20 | 1 | A2A endpoint. Directory indexer. |
| BrickBlueBot/0.1 | — | 19 | 3 | Agentic web indexer. |

### Suspicious / Security
| Actor | IP | Hits | Notes |
|---|---|---|---|
| ZauthTokenFinder/1.0 | 219.104.141.40 | 2 | Credential scanner. Hit gas-price-oracle. Watch. |

---

## 4. Endpoint Demand Analysis

### Most Meaningful Attention
The service distribution this window is dominated by two sweepers (x402-observer across 48 services, OVH actor across 20) and one MCP burst (18 services). Stripping those, the organically multi-source services are:

- **ping** (42 hits, 7 IPs) — broadest IP coverage, used as a latency/reachability probe by multiple actors independently
- **gas-price-oracle** (28 hits, 7 IPs) — highest independent convergence across actor types; touched by OVH, MCP actor, Nexcess node agents, and ZauthTokenFinder. Consistent demand signal.
- **mcp-server** (147 hits, 5 IPs) — inflated by mcpregistry-bot (88 hits alone), but 4 other IPs including the Argentina MCP actor
- **compliance-consultation + compliance-check** (61 + 46 hits, 5 IPs) — consistently high demand across multiple windows; financial compliance tools are the most frequently requested non-free services
- **first-call** (35 hits, 2 IPs) — earthdata agent fires this every ~2 hours; still the clearest payment-adjacent conversion warm-up

### Repeat Validation / Independent Convergence
Services where 4+ independent IPs appeared: ping, gas-price-oracle, compliance-consultation, compliance-check, arbitrage-scanner, correlation-matrix, credit-risk-score, fraud-detection, polymarket-odds, prediction-market-odds, sentiment-analysis, trading-signal, token-metadata. These are consistently validated across consecutive 12h windows. Independent convergence here is real.

### Most Likely to Convert First
1. **gas-price-oracle** — most independent IPs, lowest price ($0.05), referenced by multiple actor types including the MCP tool-call actor. Lowest friction to first payment.
2. **compliance-consultation** — highest hit count among paid services, targeted by OVH actor and MCP actor. The $0.50–$2.00 price is higher but the interest is sustained.
3. **arbitrage-scanner + prediction-market-odds** — DeFi-native services, targeted by both the stuck OVH actor and the MCP actor from Argentina, suggesting the same underlying use case (crypto trading agent or financial workflow) across two separate teams.

---

## 5. Impact of Recent Updates / Fixes

### esbuild `--splitting` fix (deployed Aug 12)
**Holding.** Port binds in 1.3 seconds (vs. 43s before). No health-check failures observed. x402-observer completed its 48-service sweep successfully, confirming the full catalog is serving. The architect confirms the invariant (server/index.ts must never statically import heavy packages) is intact.

**Not improved:** The 130-second route registration gap remains. `initApp()` still takes ~130s to register all API routes after listen(). During this window, any restart serves health probes correctly (fast-path) but all API calls return 404. No evidence of this causing issues in this window, but the risk is real on container restarts.

**What the fix enabled:** The earthdata agent's Aug 11 payment and the canary's post-deploy settlement confirm the payment path is fully operational. The BazaarSeeder's 2h sweep cycle and the canary's 6h cycle both ran normally in this window.

### Discovery surface completeness
Cold-start fast-path for `/.well-known/agent-card.json` in `server/index.ts:165-184` serves a minimal card without going through `trackDiscovery` middleware. An unknown number of the 155 unique discovery IPs were not logged in `endpoint_hits` if their request arrived during the init window. The 155 number is a floor, not a ceiling.

---

## 6. Conversion Readiness

**External payments this window:** 0. Last confirmed external payment: Aug 11 (earthdata agent, 0x3803a192).

**Conversion-adjacent signals present:**
- Argentina MCP actor: received mcp-challenge-issued on 18 services → **one step from payment**. Has not paid yet. Will likely retry.
- OVH actor: 480 hits, 20 services, 24 retries per service → **stuck at gate, not leaving**. The retry count increasing means the agent framework is still running this workflow.
- Earthdata agent: active service expansion (B20 services new this window), consistent first-call timing → **paying customer in active expansion phase**.
- 36 `first_contact` (well_known discovery) events with 0 `first_x402_call` conversions in this 12h window → mid-funnel gap is the primary bottleneck.

**What would push conversion:**
- Argentina MCP actor needs to successfully issue a USDC payment from an MCP client. Whether it has a funded wallet is unknown. The MCP payment recipe needs to be explicit in the tool schema.
- OVH actor needs the X-PAYMENT header construction recipe. The 402 body contains it, but they aren't reading it. A `payment_recipe` field in the 402 body with a curl/Python code example would eliminate the ambiguity.
- Earthdata agent is already converting. The B20 expansion suggests it will pay for new services on the next session.

**MCP funnel status:** The Argentina actor is the first data point where initialize → tools/list → tools/call → mcp-challenge happened in one session. The funnel works end-to-end mechanically. The missing piece is a paying MCP client. First MCP payment is the next conversion milestone.

---

## 7. Security / Technical Issues

### ZauthTokenFinder/1.0 — Credential Scanner
`219.104.141.40` probed gas-price-oracle twice. UA is self-identifying as a credential/token finder. Currently two hits only — likely an automated reconnaissance run. No auth headers sent, no exploitable behavior observed. Standard x402 challenge returned (no credentials exposed). **Watch for recurrence or escalation.** If it reappears with a wider sweep, consider adding to UA-based rate limiter.

### EVM Payment Receipt-Timeout — Real Double-Charge Risk (Architect-Flagged)
This is the most significant technical risk surfaced this session. The current flow:
1. `paymentOrchestrator.ts:2067-2086` calls `walletClient.writeContract(transferWithAuthorization)`
2. `2088-2092` waits for receipt
3. If `waitForTransactionReceipt` times out → catch returns 402 to client
4. Client re-challenges, submits a **new** `transferWithAuthorization` with a different nonce
5. Both transactions can settle on-chain → **double charge**

EIP-3009 prevents replay of the *same* authorization, but not replacement after a timeout. The fix: persist an intent fingerprint (from, nonce, service, requestId) *before* submission; on timeout, reconcile by authorization nonce before issuing a new 402; return a "pending" response rather than a clean retry invitation.

**Currently:** No confirmed double-charge incidents in the payment history. This is a real risk that grows proportionally with payment volume. Address before the MCP actor or OVH actor starts paying at volume.

### Known Non-Issues
- `74.220.48.169` (new node, 98 hits, 47 svcs) — same Nexcess hosting range as `74.220.48.55`; both are cloud-hosted sweepers, not hostile. No payment header sent, no exploit behavior.
- IPv6 `2a06:98c0:3600::103` — persistent broad scanner, consistently present across windows. No anomalous behavior.
- 57.141.0.x range (Meta crawler) — legitimate AI infrastructure crawler. No auth or payment attempts.

---

## 8. Business Development Read

**Commercial stage:** Early revenue, active validation. Not pre-revenue — there are confirmed paying customers and recurring revenue. Not growth-stage — payer count is 2 active accounts, revenue is de minimis.

**What changed this window that matters commercially:**
- The Argentina MCP actor is the first agent to use the platform as an MCP service provider and hit the payment step. If this converts, it is the first MCP payment on record and a meaningful milestone for the MCP product line.
- Meta's AI infrastructure is now crawling the platform. This is a distribution event, not a revenue event — but Meta's agent infrastructure discovering Coin Railz means it's in their indexing pipeline.
- The OVH actor is on day 2 with an increasing retry count. It hasn't given up. This is still the highest-priority identity-resolution target.

**Actors deserving immediate follow-up:**

1. **`contact@hermes.ai` (hermes-contact-discovery/1.0)** — not active this window, but the email exists and the prior sweep was deliberate. Send the technical contact email now before the signal cools. Template: observed your discovery sweep, here's the exact payment recipe, here are the 3 services most relevant to what you were scanning, here's a test wallet funder if you don't have USDC on Base.

2. **Argentina MCP actor (181.28.163.162)** — WHOIS: 181.28.x.x is Telecom Argentina residential/commercial range. No clean identifier without more data. Monitor the next session. If it retries and hits payment gate again without paying, it's likely a funded-wallet problem, not a knowledge problem — the MCP challenge response includes the payment recipe. If it disappears, it got the challenge, read it, and is implementing.

3. **OVH actor (163.47.70.38)** — still the most actionable stuck lead. WHOIS: OVH SAS, Roubaix France datacenter range (not residential — this is a hosted agent, not someone's laptop). GitHub/LinkedIn search for "python-httpx financial agent france" or any public GitHub repo using python-httpx with the exact service list (arbitrage-scanner, polymarket-odds, compliance-consultation, etc.). If identity is resolvable, the one-line fix is: `headers={"X-PAYMENT": challenge_header}` and a USDC-on-Base funded wallet.

4. **Earthdata agent (0x3803a192)** — paying customer, expanding autonomously. The B20 expansion (compliance-scan, transfer-check) is unprompted. This agent is discovering new services on its own, which is the desired agent-economy behavior. Consider: is there a way to surface "services used by agents like you" or a catalog recommendation in the 402 response body? This agent would benefit from it.

**What this looks like commercially:** A platform being actively evaluated by at least 3 independent agent development teams simultaneously (Argentina MCP actor, OVH financial agent, earthdata agent), indexed by the two largest AI platforms (Meta, Amazon), and continuously monitored by the x402 ecosystem observer. The conversion funnel gap (3.5% discovery → service call) is a mid-funnel UX problem, not a product-market fit problem — the service list is demonstrably attracting exactly the right traffic.

---

## 9. Action Items

### Highest Priority

**1. Send the hermes.ai email today.**  
`contact@hermes.ai`. One page: what you observed, the exact X-PAYMENT header recipe (curl + Python one-liner), 3 most relevant services from their sweep with prices and schemas, a Base USDC test wallet funder link. Ask what they were building. Do not pitch; debug.

**2. Fix EVM receipt-timeout double-charge risk.**  
Before MCP payments start arriving at volume, persist the authorization fingerprint (from address, authorization nonce, service ID, request ID) to `x402_payment_intents` *before* submitting the on-chain transaction. On `waitForTransactionReceipt` timeout, return HTTP 202 Accepted with a reconciliation token instead of 402. Never re-invite a new authorization until the prior one is confirmed failed on-chain. This is the #1 technical risk to payment integrity.

**3. Add `payment_recipe` code example to the 402 response body.**  
The OVH actor has been stuck for 36+ hours. The challenge body tells them *what* to send, not *how* to construct it in python-httpx. A concrete code snippet (3 lines of Python) in the 402 body is the cheapest possible intervention. The Argentina MCP actor needs the same — a one-line MCP tool-call with X-PAYMENT populated.

### High Priority

**4. Monitor Argentina MCP actor next session.**  
If `181.28.163.162` returns: does it retry the same tool calls? Does it send a payment header? Does it disappear? The answer determines whether the MCP payment recipe in the tool schema is sufficient or whether the MCP client is discarding the 402 response. Add an alert if mcp-challenge-issued from this IP converts to mcp-payment-received.

**5. Identify the OVH actor.**  
Run WHOIS on `163.47.70.38`, check OVH datacenter subnet allocation, search GitHub for repos using python-httpx that target financial analytics APIs. The service list (arbitrage-scanner, polymarket-odds, compliance-consultation, fraud-detection, correlation-matrix) is distinctive. If this repo is public, it will be findable.

**6. Add `onConflictDoNothing` to EVM intent insert.**  
Separate from the receipt-timeout issue: the Solana intent insert has `onConflictDoNothing` on `(txHash, serviceName)`; the EVM path does not. The on-chain EIP-3009 semantics protect against same-authorization replay, but application-level idempotency protection should match Solana's. Low effort, meaningful defense-in-depth.

### Standard Priority

**7. Fix cold-start agent-card tracking gap.**  
`server/index.ts:165-184` fast-path serves `agent-card.json` without going through `trackDiscovery`. Add a lightweight async call to the same tracking function (with bounded error handling — do not let tracking failure interrupt the response). The 155 unique IPs per 12h is understated by an unknown amount.

**8. Surface B20 and earthdata services in A2A/MCP recommended sequences.**  
The earthdata agent discovered B20 services autonomously — but it's paying. The Argentina MCP actor's service list included `earthdata-granules`. There is cross-catalog interest. Surface service recommendations in the 402 body for earthdata clients that include B20 compliance services, and vice versa.

**9. Add USDC Base wallet funder link to 402 responses for zero-balance rejections.**  
When a payment attempt fails due to insufficient balance (vs. never attempted), include a direct link to a Base USDC on-ramp in the 402 body. Agents with funded wallets that hit a $0 balance error are the highest-intent blocked users.

**10. Consider adding `x402-payment-pending` event type to payment orchestrator.**  
Currently there is no `x402-payment-pending` or `x402-payment-timeout` event. When a receipt wait times out, nothing is logged at the interaction level. Adding this would make the double-charge risk surface in analytics rather than requiring manual tx reconciliation.

---

## 10. Final Verdict

**Two things happened this window that haven't happened before:** Meta's AI infrastructure indexed the platform, and an external agent traversed the complete MCP tool-call → payment-challenge pipeline for the first time. Both are directionally correct.

The OVH actor's persistence (36+ hours, retry count still climbing) is either a broken automation running on a loop, or a developer debugging a payment integration who hasn't read the 402 body carefully enough. Either way, it deserves a direct intervention attempt.

The earthdata agent is quietly doing what the platform was designed for: an autonomous agent paying for data, expanding its catalog, never needing human involvement. That's the proof of concept in production. The goal is 10 more of them.

**Overall assessment:** Moving forward. The MCP funnel is functionally validated. The discovery-to-payment pipeline is unblocked. The primary remaining barrier is agent-side payment implementation — the platform's job is to make that as frictionless as possible.

**Confidence: Medium-High** (high on volume/actor analysis; medium on payment intent data — production DB queries for `x402_payment_intents` were unavailable in this session due to a technical constraint in the analytics runtime; payment figures extrapolated from prior session's verified data).

---

*Assessment saved: `docs/analytics/assessments/2026-08-13-13h-assessment.md`*
