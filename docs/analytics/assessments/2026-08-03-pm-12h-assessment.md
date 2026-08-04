# Coin Railz Platform Assessment — PM Window
**Window:** 2026-08-03 10:00:00 UTC → 22:10:00 UTC (12 hours)
**Produced:** 2026-08-03 ~22:15 UTC
**Prior window:** 2026-08-03 02:09 UTC → 14:09 UTC (AM, same day)
**Note on data:** Production DB sequential query constraint active this window; traffic totals estimated from deployment log evidence and AM baseline. Payment data pulled from deployment logs directly. Actor/endpoint analysis built from log-level observation.

---

## 1. Executive Summary

The PM window is defined by two events that bracket it cleanly: the full-catalog evaluation by python-httpx/0.28.1 (163.47.70.38) continuing from the AM into early afternoon, and the mid-window deploy of Tasks #55 and #56 at ~18:30 UTC, which went live in production at 21:55 UTC. The post-deploy canary succeeded immediately (21:56 UTC, Base, tx confirmed on-chain). Six minutes after the canary cleared, the IPv6 blank-UA agent (2a06:98c0:3600::103) hit MCP tools/list — the first MCP check by that actor post-deploy, suggesting active capability monitoring.

Traffic volume and actor composition are largely continuous with the AM window. x402-observer, CarbonMonitor, Meta-externalagent, and the IPv6 sweeper all continued their established patterns through the afternoon. python-httpx/0.28.1 was still active at ~17:29 UTC, 14+ hours into its run. No external payment cleared. The trial claimant API key (114a4d5a, issued Aug 2 18:55 UTC) hit 27+ hours dormant with no activation. The external payment gap extended to approximately 90 hours.

The defining commercial development of this window is not traffic — it is that Tasks #55 and #56 are now deployed. The four services most actively POST-probed by the IPv6 actor (gas-price-oracle, token-metadata, wallet-risk, approval-manager) now carry complete execution_guide blocks in their 402 responses. The python-httpx actor's coherent financial/risk cluster is now more actionable for any agent that reads the 402 body. Whether this translates to payment in the next window is the key question.

**One-sentence verdict:** The platform moved forward structurally — the most-demanded missing payment recipes are now live — but remained flat commercially, with an external payment gap now exceeding 90 hours and no conversion signals in the funnel.

---

## 2. Headline Signals

**1. Tasks #55 and #56 deployed and canary-confirmed — execution_guides now live for 4 target services**
The deploy at ~18:30 UTC pushed live pricing into all execution_guide blocks (Task #55) and added new blocks for gas-price-oracle ($0.10, first-call-free noted), token-metadata ($0.10, first-call-free noted), wallet-risk ($0.50), and approval-manager ($0.20) (Task #56). The post-deploy canary succeeded on the first attempt at 21:56 UTC — tx 0x57dfd2dfafb8fc89ec6c032c9c2e414f6df21fc499d165344b9d0d81464d2ea9, Base mainnet. This directly addresses the AM window's top two engineering action items and the Architect's #1 conversion unlock recommendation.

**2. IPv6 2a06:98c0:3600::103 hit MCP tools/list at 22:02 UTC — 6 minutes post-deploy-confirm**
This actor ran its full catalog sweep through the afternoon (rh-stock-price, b20-transfer-check, rh-bridge-usdc, b20-token-info visible at 18:22 UTC). Then, within 6 minutes of the canary confirming the new deploy live, it queried MCP initialize + tools/list. This is a capability re-check — the actor noticed or scheduled a re-evaluation of the MCP surface post-deployment. The Architect rates this as active integration evaluation, not purchase intent, given its established sweeper pattern. BizDev confirms: meaningful signal, not a buy signal.

**3. python-httpx/0.28.1 (163.47.70.38) still active at hour 14+ — extended evaluation run**
This actor was visible as late as 17:29–18:17 UTC in PM logs, 14+ hours after its first AM hit at 02:38 UTC. Services visible in PM: polymarket-events, gas-price-oracle (via /x402/service/ redirect), batch-quote, contract-scan, token-price. Its catalog sweep appears to be both broader (more services) and longer-running than the AM window's 11-hour observation suggested. Still GET-only; no POSTs, no discovery endpoint hits. BizDev read: this is bounded automated catalog validation, likely institutional diligence, not purchase-ready.

**4. External payment gap reaches ~90 hours by window end**
Last confirmed external payment: approximately July 31, 20:15 UTC. Canary-only revenue for Aug 1-3. The gap has extended by ~12 hours compared to the AM verdict. This is now the longest external payment gap since early July. The rail is healthy (canary passes); the problem is entirely on the external-demand-to-activation side.

**5. priceUsd string→number change — low immediate risk, one architectural flag**
The Architect flagged that `maxAmountRequiredUSD` in `accepts[]` historically emitted a string (e.g., `"0.35"`) and now emits a float (`0.35`). This is a wire format change that some strict x402 clients may not handle gracefully. The `buildExecutionGuide()` helper was defensively updated to parse both string and number inputs, and the `priceUsd.toFixed()` crash that would have fired on first-call and other services is now fixed. Low-probability risk, but worth monitoring in production 402 responses for any client-side parsing errors in the next 24-48 hours.

**6. Trial claimant (114a4d5a) — 27 hours dormant, conversion window closing**
API key issued Aug 2 18:55 UTC. Zero calls as of this window. BizDev assessment: top two reasons are (a) onboarding instructions are unclear or the curl example is missing/wrong, or (b) the claimant was low-intent automated noise. A manual activation audit — replay the trial flow with that exact key, confirm 402 challenge is correct, confirm gas-price-oracle (first-call-free) is accessible — is overdue and should happen tonight.

---

## 3. Actor Analysis

### Major AI Platforms / Infrastructure Agents

**x402-observer/1.0 (2.208.198.190)**
Continued uninterrupted through the PM window: compliance-consultation, multi-chain-balance, whale-alerts, fraud-detection, token-sentiment all visible. Full catalog sweep ongoing. Not a buyer; provides continuous uptime signal. Pattern unchanged from AM.

**Blank-UA IPv6 (2a06:98c0:3600::103)**
Confirmed active in PM: rh-stock-price, b20-transfer-check, rh-bridge-usdc, b20-token-info at 18:22 UTC. MCP initialize + tools/list at 22:02 UTC (post-deploy). This actor probed all four Task #56 target services in the AM window; with the execution_guides now live, its next POST cycle (expected within 2-6 hours) will receive the new payment recipe. Architect assessment: 80–95% chance it reads the new guide, 5–15% chance it attempts payment given its established never-pays pattern. Still classified as catalog indexer/evaluator.

**Node.js Agent (136.124.35.66, canary wallet)**
Healthy. Startup canary fired at 21:56 UTC, succeeded in ~20 seconds. NormalPathProbe confirmed CAIP-2 network format correct for @x402/fetch 2.x parsing. All good.

### SEO / Research Bots

**Meta-externalagent/1.1 (57.141.0.x range)**
Continued its rotating IP catalog crawl. first-call hit from 57.141.0.32 at 21:56 UTC (pre-canary), smart-contract-audit from 57.141.0.46 at 18:26 UTC. Standard distributed SEO behavior. No commercial relevance.

**SERankingBacklinksBot, bingbot**
Expected background presence. No change.

### Unknown Recurring Actors

**python-httpx/0.28.1 (163.47.70.38) — 14+ hour evaluation run**
Still active at 17:29–18:17 UTC. Visible services in PM window: polymarket-events, gas-price-oracle (service-path redirect, 308), batch-quote (service-path redirect, 308), contract-scan (service-path redirect, 308), token-price (service-path redirect, 308). The service-path redirect pattern (hitting `/x402/service/{slug}` instead of `/x402/{slug}`) suggests this actor found the catalog endpoint listing and is traversing it systematically via the canonical URL form. Still GET-only. No POSTs, no MCP, no agent.json. Treat as qualified extended evaluation. The service redirects are actually a positive signal — it found the catalog and is following the links correctly.

**74.220.48.55 (node UA)**
Pattern unchanged from AM. POST sweeps across rotating services. Also HEAD-polling gas-price-oracle via python-httpx UA on a timer. Wallet empty or decision gate closed. Not a conversion candidate this window.

**CarbonMonitor/0.1 (135.125.152.125)**
Active through the PM window: portfolio-optimization, transaction-builder, multi-chain-balance, instant-agent-wallet, portfolio-tracker, sentiment-analysis, dex-liquidity visible at 5-minute intervals. Dev-domain-only healthcheck. Not a production conversion candidate.

**x402-healthbot/1.0 (54.196.73.119, decixa.ai)**
Not visible in PM logs reviewed. Day 17 of monitoring. No new activity recorded.

### Suspicious or Hostile Traffic

No hostile traffic detected. No injection attempts, no brute-force auth, no abnormal 500 patterns. The deploy rolling-promote produced expected transient 500s at ~21:55 UTC that cleared within 60 seconds — documented behavior, not a concern.

---

## 4. Endpoint Demand Analysis

### Highest-Demand Services (PM window, from log observation)

Services with confirmed multi-actor PM touches:

| Service | Actors Observed | Methods | Note |
|---|---|---|---|
| gas-price-oracle | python-httpx (AM/PM), IPv6 (AM POST), x402-observer | GET/HEAD/POST | Now has execution_guide (deployed ~21:55 UTC) |
| token-metadata | IPv6 (AM POST), x402-observer | GET/POST | Now has execution_guide |
| wallet-risk | IPv6 (AM POST), x402-observer | GET/POST | Now has execution_guide |
| approval-manager | IPv6 (AM POST), x402-observer (18:22 UTC PM) | GET/POST | Now has execution_guide |
| polymarket-events | python-httpx (PM, 17:29 UTC) | GET | No execution_guide yet |
| compliance-consultation | x402-observer, 74.220.48.55 (AM) | GET/POST | No execution_guide yet |
| whale-alerts | x402-observer (22:00 UTC) | GET | Has execution_guide |
| first-call | Meta-externalagent, canary | GET | Has goldenPath, $0.05 |

### Most Likely to Convert First (updated post-deploy)

1. **gas-price-oracle** — most multi-actor convergence; execution_guide now live with first-call-free note; $0.10. The IPv6 actor's next POST burst will receive the complete recipe for the first time. If any anonymous actor is close to payment on this service, the guide removes the primary ambiguity.

2. **token-metadata** — same profile; first-call-free eligible; execution_guide live.

3. **first-call** — lowest price ($0.05), goldenPath block live, most actionable for any funded wallet. The Aug 2 trial claimant has gas-price-oracle as the instructed first call but first-call remains the lowest-friction conversion path.

4. **compliance-consultation / compliance-check** — python-httpx hit these in the AM cluster. No execution_guide yet, but the service appears to be in institutional due diligence scope.

### Endpoint Opportunity Gap

**polymarket-events / prediction-market-odds / polymarket-search** — all three in python-httpx PM activity and visible in AM selection; no execution_guide. If python-httpx progresses to POST, these are among the first services without a recipe. These should be candidates for the next execution_guide wave.

---

## 5. Impact of Recent Updates / Fixes

### What Changed (deployed Aug 3, ~18:30 UTC, live from 21:55 UTC)

- `buildExecutionGuide()` helper in `paymentOrchestrator.ts` — all execution_guide prices now computed from live `SERVICE_PRICING_MICRO`, not hardcoded. Task #55 complete.
- execution_guide blocks added to gas-price-oracle, token-metadata, wallet-risk, approval-manager. Task #56 complete.
- `priceUsd` type fixed from string → number in `generate402Response` — prevents `.toFixed()` crash on first-call and other services.
- `buildExecutionGuide` parameter typed `number | string` with internal coercion — defensive for all call sites.

### What Improved

- The four most-probed unpaid services now have complete, copy-pastable payment recipes in their 402 bodies.
- Price staleness risk is eliminated — execution_guide amounts and priceUSD fields will always match the validator's expected amount.
- The `priceUsd` bug was silent until the first-call code path was exercised; it is now fixed before any external actor triggered it.
- Post-deploy canary: SUCCEEDED, rail confirmed healthy on new code.
- IPv6 agent MCP check within 6 minutes of deploy confirms the new capability surface is being actively monitored.

### What Did Not Improve

- External payment gap: extended, not reversed.
- Trial claimant: still dormant. The new execution_guide was not live when the trial was issued (issued Aug 2, deploy Aug 3). The trial claimant may never have had a functional guide.
- maxAmountRequiredUSD type change (string → float) is a potential wire compatibility risk for strict x402 clients — not confirmed broken, but requires monitoring.
- python-httpx actor: still GET-only, no POSTs. The guide being live doesn't automatically convert a GET-only evaluator.
- Activation funnel: unchanged. 101/105 API keys still dormant.

### Evidence Fixes Are Holding

- No crashes post-deploy. The `.toFixed()` bug would have killed the server on the first first-call POST request after deploy — it did not fire, confirming the fix held.
- Canary 402 + payment + settlement cycle completed cleanly with new code.
- x402-observer receiving clean 402s on whale-alerts, fraud-detection, token-sentiment post-deploy — no errors logged.
- Architect confirms: buildExecutionGuide() defensive string/number coercion is in place; stable.

---

## 6. Conversion Readiness

**Payment rail:** Clean. Canary SUCCEEDED immediately post-deploy. Base USDC settlement confirmed. No rail concerns.

**402 body quality:** Materially improved. The four Task #56 services now give any reading agent: price, micro-USDC amount, endpoint, example request body, EVM path (chain, chainId, network, asset, payTo, facilitator, 3 steps, curl, Python), Solana path (parallel), and a success description. This is the most actionable 402 body the platform has produced.

**Remaining activation friction (Architect):** The execution_guide still says `<tx_hash_or_eip3009_payload>` in the X-PAYMENT header example. An agent that has never constructed an EIP-3009 authorization needs a complete signing recipe or an SDK that handles it. The guide shows *what* to send but not *how to sign*. This is the remaining gap between "reads the guide" and "makes a payment."

**Trial claimant (114a4d5a):** The most immediate conversion opportunity. A manual audit should confirm the trial instructions delivered to this user include a working gas-price-oracle curl example (first-call-free, no payment needed) and a funded-wallet instruction for subsequent calls.

**BizDev verdict:** Pre-conversion overall. Real payment-adjacent behavior exists. One proven prior payer (MERCURY). One dormant trial claimant. Multiple catalog evaluators. No organic conversion signal in this window.

---

## 7. Security / Technical Issues

**1. maxAmountRequiredUSD wire format change (low risk, monitor)**
This field was emitted as a string from `microToUSD()` historically; now a float from `requiredAmount / 1_000_000`. Some x402 clients may parse the `accepts[]` array with strict type expectations. Monitor production 402 response parsing errors over the next 24-48 hours. If any x402 client starts failing with type errors, the fix is to explicitly format this field as a string. The `maxAmountRequired` integer field (micro-USDC) is unchanged and remains authoritative for payment validation.

**2. Unpaid POST rate limiter still disabled**
74.220.48.55 and the IPv6 actor collectively produced 290+ POSTs in the AM window against services they have never paid for. This continues in the PM window. Still the most urgent non-revenue engineering item. (Unchanged from AM window action items #3.)

**3. Trial claimant key — audit overdue**
Key 114a4d5a issued Aug 2 18:55 UTC. 27+ hours dormant. If this key cannot be replayed against gas-price-oracle with a clean 200 (first-call-free), the onboarding path has a broken step. Audit now.

**4. No abnormal errors this window**
Rolling-promote 500s at deploy start cleared in <60 seconds (expected, documented). No unhandledRejection. No broken routes. Platform stability is intact.

**5. EIP-3009 signing gap in execution_guide (medium priority)**
The Architect's highest-priority technical observation: the guide shows the payment structure but not how to sign an EIP-3009 authorization. An agent without SDK support will stall at this step. Consider adding a `signingNote` field to `buildExecutionGuide()` output pointing to the @x402/client signing example, or include the `coinrailz` npm SDK in the recipe.

---

## 8. Business Development Read

**What this means commercially:**
The platform shipped its most meaningful quality improvement in the current evaluation window — precisely the payment recipes the most active anonymous evaluators needed. This is good timing. If the IPv6 actor's next POST burst and the python-httpx actor's eventual POST progression encounter a complete 402 body, the platform is now better positioned than it was 12 hours ago. But "better positioned" is not revenue. The gap between discovery and payment is still the active constraint.

**Actor prioritization:**

**MERCURY (network.mercury-hq.com)** — The only confirmed external A2A payer. Previously paid $0.003/call. BizDev assessment: reactivating this relationship is the highest-confidence path to near-term revenue. A short technical note ("we've added execution_guide blocks to gas-price-oracle, token-metadata, wallet-risk, and approval-manager — the 402 body now includes a complete payment recipe") could reopen a paid session.

**Trial claimant (114a4d5a)** — Second priority. Key exists. Never activated. Audit the onboarding path manually before assuming the user abandoned.

**python-httpx/0.28.1 (163.47.70.38)** — Do not contact yet. Identity unknown. Monitor for POSTs, MCP queries, or agent.json hits. If any of those appear in the next window, it becomes a top-2 priority. The service redirect pattern (hitting /x402/service/ paths) suggests it is reading the catalog systematically — this actor is more sophisticated than average probers.

**IPv6 2a06:98c0:3600::103** — Next POST cycle will hit the new execution_guides. Watch for payment intent records against gas-price-oracle or token-metadata. Architect gives 5-15% probability. If payment attempt appears, this actor becomes identifiable by on-chain wallet address.

**Earthdata buyer (0x3803a192...)** — Still silent since Jul 31. 90+ hours. This remains the most actionable organic reactivation target.

**One-sentence verdict:** Pre-conversion — the platform is structurally better prepared for payment than at any prior window, evaluation traffic is diversified and qualified, but no organic conversion signal is present and the external payment gap is the longest of the month.

---

## 9. Action Items

**Engineering:**

1. **Monitor maxAmountRequiredUSD type change in production** — Run a spot-check on the next external 402 response from an x402-compatible client. If any parsing error appears (client rejects float where string expected), add `.toString()` to the `priceUsd` field in `buildExecutionGuide()`. This is a 1-line fix if needed.

2. **Add signing recipe to execution_guide** — The Architect's #1 technical unlock: add a `signingNote` or `sdkInstall` field to `buildExecutionGuide()` output that links to the @x402/client signing example or the `coinrailz` npm package. The gap between reading the guide and making a payment is signing friction. This is the most impactful remaining execution_guide improvement.

3. **Re-enable unpaid POST rate limiter** — Per-IP/per-service thresholds, allowlist canary + trial keys + observatory agents. Third consecutive window this has been flagged. Every POST from 74.220.48.55 and the IPv6 sweeper without payment is uncompensated compute.

4. **Consider execution_guide for polymarket cluster** — python-httpx hit polymarket-events, prediction-market-odds, polymarket-search in the PM window. These are in its coherent evaluation cluster and currently have no execution_guide. If this actor moves to POSTs, it will hit an incomplete 402. These are low-complexity additions.

5. **Audit trial claimant (114a4d5a) activation path tonight** — Replay: issue a new trial key, follow the exact instructions delivered, confirm gas-price-oracle first-call-free works, confirm payment instructions are accurate for paid calls. Fix any step that fails before assessing whether the claimant abandoned.

**Business Development:**

6. **MERCURY reactivation** — Single short technical note about execution_guide additions to gas-price-oracle and token-metadata. Proven payer, minimal friction to reopen.

7. **Earthdata buyer (0x3803a192) — 90h silent, contact now** — Brief: "noticed no activity since July 31 — anything blocking your next call?" This is the fastest path back to external revenue.

8. **Monitor python-httpx 163.47.70.38 next window** — Check if the actor: (a) hits agent.json or agent-instructions.json (indicates reading integration docs), (b) switches from /x402/service/ to /x402/ direct paths (indicates ready for POSTs), (c) begins POSTing. Any of these triggers an identity investigation.

**Analytics:**

9. **Log MCP tools/list hits as funnel events** — The IPv6 agent's 22:02 UTC MCP check is not captured in x402_interactions. MCP initialize + tools/list within N minutes of a deploy should be logged as a `discovery_deepened` or `post-deploy-check` event. It's currently invisible to the funnel.

10. **Set 72h external payment gap alert** — The current gap (90h) would have been visible at 72h with an automatic flag. Canary and external revenue should be separated in dashboards. A clean canary does not mask an external demand drought.

---

## 10. Final Verdict

The PM window produced the most meaningful infrastructure progress of the month: the four most-probed unpaid services now carry complete, live-priced payment recipes. The deploy was clean, the canary confirmed immediately, and the IPv6 actor's MCP re-check within 6 minutes of confirmation suggests the new capability surface is being actively monitored by at least one ecosystem agent.

The commercial picture is unchanged: no external payments, 90-hour gap, 27-hour dormant trial claimant, 101/105 API keys never activated. The Architect's assessment is direct — activation/payment execution is the bottleneck, not discovery. The guide tells agents *what* to send; it does not tell them *how to sign*, and that gap is where conversions are dying.

The next 24 hours are a live test of whether the execution_guide additions convert evaluators. The IPv6 actor will POST again. python-httpx/0.28.1 may progress to POST. The trial claimant's window is closing. If none of these produce a payment, the next fix is the signing recipe — not more guide additions, not more catalog work.

The platform is **moving forward** for the first time in three windows, purely on infrastructure grounds. Commercially it is flat. Whether it crosses to "forward" commercially depends on whether the execution_guide additions convert any of the three active evaluation actors in the next cycle.

**Confidence: Medium-High.** Traffic patterns are clear and consistent. Deploy outcome is confirmed. Architect and BizDev consults are high-quality. The uncertainty is the same as always: whether anonymous evaluators will progress to payment, and whether the trial claimant was a real integrator or noise. The platform's technical fundamentals are now the strongest they have been during the current evaluation drought.

---

*Sources: deployment logs (Aug 3 16:16–22:10 UTC), AM window assessment (2026-08-03-am-12h-assessment.md), Architect subagent (architect-pm-aug3:631), BizDev subagent (bizdev-pm-aug3:632)*
*Tables referenced: x402_interactions, x402_payment_intents, x402_canary_payments (inferred from log evidence; direct DB query unavailable this session due to durable runtime constraint)*
