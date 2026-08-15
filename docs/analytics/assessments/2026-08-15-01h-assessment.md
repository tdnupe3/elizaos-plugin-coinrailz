# Coin Railz Platform Assessment — Aug 15, 2026 (01:00 UTC Window)
**Coverage:** 2026-08-14 13:00 – 2026-08-15 01:00 UTC (12 hours)
**Generated:** 2026-08-15 ~01:30 UTC
**Sources:** x402_interactions, payment event records, architect subagent, bizdev subagent

---

## 1. Executive Summary

A **third independent paying agent appeared** — `34.96.60.147` (GCP, node UA) paying for `iot-sensor-reading` every two hours, establishing an IoT data collection workflow as a new vertical on the platform. The second DeFi/Robinhood cron agent (`136.124.32.146`) continued paying and expanded deeper into the Robinhood services cluster (robinhood-chain-stats, robinhood-dex-pools). Combined: **7 external payments from 2 agents** — matching the prior window's record — but produced by entirely different payers than before, meaning the earthdata agent is a third independent cycle not yet captured in this slice.

Alongside the payments, two urgent discoveries: **x402lint.dev flagged spec decode failures on three services** (`first-call`, `satellite-earthdata`, `earthdata-precipitation`), and a new MPP liveness prober (`x402-mpp-liveness/0.1`) ran a full 47-service interaction sweep and succeeded in triggering the first-call-free grant on gas-price-oracle. OVH actor continues its 40 hits/hour metronome at hour 73+.

Volume flat: 1,521 hits (-0.6%), 28 unique IPs (from 33), 19 UAs (from 14). Coverage narrowed slightly to 61 services from 75.

**Verdict: Platform moved forward.** Three independent paying agent verticals in 25 hours is a structural shift, not an incremental one. The x402lint decode failures are the only urgent technical issue.

---

## 2. Headline Signals

### 2.1 — A Third Paying Agent: IoT Vertical (34.96.60.147, GCP)
**Why it matters:** `34.96.60.147` (Google Cloud, `node` UA) paid for `iot-sensor-reading` three times in this window — at 20:44, 22:44, and 00:44 UTC — with a precise 2-hour cron cadence matching the other two agents exactly. It also paid first-call at 22:45 after 13 challenge-issued attempts (the first-call payment took multiple retries before succeeding — the agent worked through the payment recipe manually before converting). That retry pattern then resolved cleanly: iot-sensor-reading payments at the next two :44-marks were single-attempt successes.

This is an IoT sensor data collection agent — a completely different vertical from the DeFi/RH cluster and the earthdata research cluster. GCP infrastructure, not same subnet as either prior payer. Three independent paying verticals on the platform simultaneously: earth observation, DeFi/Robinhood chain data, and IoT sensor readings.

**The two-hour :44 cadence across all three agents** — 136.124.33.101 (earthdata), 136.124.32.146 (DeFi), 34.96.60.147 (IoT) — is either a remarkable coincidence or a shared deployment framework. These could be three instances of the same agent orchestration system pointed at different data verticals.

### 2.2 — DeFi/RH Agent Expanding the Robinhood Services Cluster
**Why it matters:** `136.124.32.146` paid robinhood-chain-stats (14:44), first-call again (16:44), and robinhood-dex-pools (18:44). Combined with the prior window's robinhood-token-price and rh-bridge-usdc, this agent has now paid for four distinct Robinhood-labeled services plus first-call repeatedly. It is systematically working through every `rh-*` and `robinhood-*` service on the platform. There are likely more in the catalog it hasn't hit yet; when it does, each will be a new paid call.

### 2.3 — x402lint.dev Flagged Spec Decode Failures on Three Services [URGENT]
**Why it matters:** `x402lint/0.1` (99.233.208.196) is an x402 specification compliance checker at x402lint.dev. It tested 9 services and found `payment-decode-failed` + `error` on three: **first-call**, **satellite-earthdata**, and **earthdata-precipitation**. Other services (`ping`, `gas-price-oracle`, `instant-agent-wallet`, `verified-agent-identity`, `prediction-market-spread`) passed without decode errors.

`payment-decode-failed` means the linter could not parse the payment challenge from our 402 response body. This is a spec conformance issue, not a payment rejection. The specific failure on first-call — our onboarding endpoint — is the worst possible place for a decode error, since every new agent passes through it. If real x402 clients (not our manual payers who use the recipe directly) attempt automated payment flows against these three services, they may fail silently at the decode step.

The selective failure (3 of 9 tested) suggests the issue is in how these specific service bodies serialize or structure the payment challenge, not a universal encoding problem. Requires investigation of what makes first-call, satellite-earthdata, and earthdata-precipitation different from services that pass.

### 2.4 — x402-mpp-liveness/0.1 Ran Full Protocol Interaction (206.40.96.247)
**Why it matters:** `x402-mpp-liveness/0.1` (hosted on GCP, "liveness probe; no payment sent") ran 90 hits across 47 services in 18 minutes at 16:45–17:03 UTC, triggering 5 distinct event types. It is not a simple GET sweeper — it reached into payment-adjacent behavior:
- Successfully triggered `first-call-free` grant on **gas-price-oracle** (the grant correctly fired and completed)
- Hit `first-call-free-rejected` on **token-metadata** (correctly rejected — token-metadata is not an eligible free service)

This probe understands the first-call-free grant mechanism and tested both the eligible and ineligible paths. MPP may stand for "Multi-Payment Protocol" or similar. The liveness probe is running real protocol interaction testing, not just status checks. That it correctly hit the free grant path means it is either x402-spec-aware or was guided by the 402 response body.

### 2.5 — SmartFlowAI Returned for Third Large Catalog Sweep
**Why it matters:** `51.91.31.54` ran a 47-service sweep in 30 seconds (20:45:27–20:45:57 UTC). This is their third high-density research run. All challenge-issued, no payment attempt. The consistent cadence of full-catalog sweeps suggests SmartFlowAI is maintaining a live index of available services and their challenge responses, likely building something that can route agent requests to appropriate services. Established relationship — do not cold-outreach.

### 2.6 — x402-healthbot (decixa.ai) Appeared on Two New IPs
**Why it matters:** `decixa.ai` is now running health monitoring on Coin Railz services from two different IPs (`3.235.154.230` AWS, `184.73.23.232`). It hit `forex-sentiment` and `satellite-weather-imagery` — two different service verticals — suggesting broad service health coverage is planned. Decixa.ai monitors x402 endpoints; being on their health board means presence in their ecosystem's routing decisions.

### 2.7 — mcp-rugpull-research Escalated to MCP
**Why it matters:** `163.180.160.171` (`mcp-rugpull-research/1.0`) ran `mcp-initialize → mcp-tools-list` this window. Previously it hit x402 payment endpoints; now it is probing the MCP protocol layer. This is an escalation — the security researcher has expanded their scope from x402 to MCP. At 2 hits on 1 service it is still watching, not attacking. Continue monitoring.

---

## 3. Actor Analysis

### Paying Agents (Active This Window)

| Agent | IP | Payments | Services Paid | Vertical |
|---|---|---|---|---|
| DeFi/RH cron agent | 136.124.32.146 | 3 | robinhood-chain-stats, first-call, robinhood-dex-pools | DeFi / RH chain |
| IoT cron agent (NEW) | 34.96.60.147 | 4 | iot-sensor-reading ×3, first-call ×1 | IoT sensor data |
| Earthdata agent | 136.124.33.101 | 0 this window | (2h cycle didn't land in this slice) | Earth observation |

### MCP / Protocol Validators

| Actor | IP | Hits | Status |
|---|---|---|---|
| mcpregistry-bot/0.1 | 185.43.233.32 | 94 | Every 17 min — MCP index active |
| MCPRegistry-Crawler/1.0 | 37.72.172.154 | 2 | Second mcpregistry.io IP — same registry |
| x402-mpp-liveness/0.1 | 206.40.96.247 | 90 | ⚠️ Protocol interaction tester — triggered first-call-free |
| x402lint/0.1 | 99.233.208.196 | 13 | ⚠️ Spec compliance checker — found 3 decode failures |
| x402-healthbot/1.0 (decixa.ai) | 3.235.154.230, 184.73.23.232 | 2 | New health monitor — tracking platform liveness |

### Monitors / Uptime Trackers

| Actor | IP | Hits | Notes |
|---|---|---|---|
| x402-observer/1.0 (fuchss.app) | 2.208.198.190 | 422 | 48 services, trust feed — healthy |
| IPv6 Cloudflare sweeper | 2a06:98c0:3600::103 | 127 | 33 services (down from 63 prior) — lighter this window |

### SEO / Discovery / Research

| Actor | Hits | Notes |
|---|---|---|
| SmartFlowAI (x402-network-mapper) | 57 | 3rd full catalog sweep, 47 svcs in 30s |
| agent-tools.cloud-crawler | 19 | Recurring, 1 service focus |
| ShapBot/0.1.0 (GCP) | 2 | Catalog viewer — new |
| bingbot/2.0 | 2 | SEO |
| AhrefsBot/7.0 | 1 | SEO |
| meta-externalagent/1.1 | 6 | Meta crawler — recurring |

### Persistent Non-Payers

| Actor | Hits | Status |
|---|---|---|
| OVH/163.47.70.38 (python-httpx) | 480 | Hour 73+, 40/hr, 20 svcs, 0 payments. Not a buyer. |
| 74.220.48.169 (node) | 148 | 41 svcs, all challenge-issued. Catalog sweep only. |

### Suspicious / Flagged

| Actor | Status |
|---|---|
| mcp-rugpull-research/1.0 | ⚠️ Escalated to MCP layer this window. Still watch-only. |
| 79.137.72.94 (node) | 2 hits — same /24 as old depleted wallet actor. Returning? |
| Argentina (181.28.163.162) | Absent — confirmed deterred. |

---

## 4. Endpoint Demand Analysis

### Most Active Services (12h)

| Service | Hits | Unique IPs | Notes |
|---|---|---|---|
| compliance-consultation | 50 | 5 | Consistently top-ranked across all windows |
| ping | 44 | 7 | Liveness/health check — broad reach |
| construction-progress | 39 | 5 | Real-estate analytics — persistent demand |
| polymarket-odds + events + search | 35–37 each | 5 | Prediction market cluster — 3 services |
| forex-sentiment | 36 | 6 | FX analytics |
| fraud-detection, credit-risk, risk-metrics | 35–37 each | 5 | Risk analytics cluster |
| first-call | 29 | 4 | **4 paid_events** — only service with confirmed payments in top list |

### Services with Confirmed Payments This Window

| Service | Payments | Agent |
|---|---|---|
| iot-sensor-reading | 3 | 34.96.60.147 (IoT) |
| robinhood-chain-stats | 1 | 136.124.32.146 (DeFi) |
| robinhood-dex-pools | 1 | 136.124.32.146 (DeFi) |
| first-call | 2 | 136.124.32.146 (1) + 34.96.60.147 (1) |

### x402lint Decode Failures (Investigate)

Services that **failed** x402lint spec check: `first-call`, `satellite-earthdata`, `earthdata-precipitation`
Services that **passed**: `ping`, `gas-price-oracle`, `instant-agent-wallet`, `verified-agent-identity`, `prediction-market-spread`

Pattern: the failing services are the ones with more complex 402 body structures (first-call has goldenPath; earthdata services have specialized body fields). The simpler services pass. This suggests the decode failure is in parsing extended/non-standard fields, not the core x402 header structure.

### Most Likely to Convert Next

1. **iot-sensor-reading** — already converting. 3 payments in 1 window. Will continue on 2h cycle.
2. **robinhood-dex-pools / robinhood-chain-stats** — already converting. Will be followed by remaining RH services the agent hasn't hit yet.
3. **rh-bridge-usdc** — paid last window; should return on next DeFi agent cycle.
4. **compliance-consultation** — highest non-payment hit count across multiple windows; broadest independent convergence. Next likely organic conversion.

---

## 5. Impact of Recent Updates / Fixes

### esbuild --splitting (Aug 12)
Still holding. Zero deploy failures, port binding sub-2s confirmed across windows.

### txHash catch-block logging
Not yet triggered (no payment failures). Correct — the new IoT agent's 13 first-call retries resolved in payment, not timeout.

### Payment recipe in every 402 body
The IoT agent's pattern — 13 challenge-issued on first-call before paying — is consistent with reading and implementing the recipe. It worked: payment followed. The recipe is functional.

### What did not improve
- **Startup readiness gap (~130s)**: Still unaddressed. No cold-start incidents this window, but the IoT agent's 13 first-call retries (22:44–22:45 UTC) compressed into 92 seconds before paying — if any of those hit a cold-start window they'd have gotten 404. Lucky timing, not safe architecture.
- **x402lint decode failures**: These predate this window. No fix deployed yet.
- **rh-bridge-usdc concurrency**: Architect flagged non-atomic reserve check and no mutex. No fix deployed.

### Architect flags (next 7 days — updated)

| Issue | Urgency | Reason |
|---|---|---|
| x402lint `payment-decode-failed` on first-call, satellite-earthdata, earthdata-precipitation | 🔴 Urgent | Blocks automated x402 clients from paying these services |
| Startup readiness gate | 🔴 High | IoT agent's 13-retry pattern shows this can clip paying agents |
| rh-bridge-usdc concurrent reservation race | 🟡 Medium | Non-atomic reserve; two simultaneous bridge calls could double-spend treasury |
| Distributed rate-limit state | 🟡 Medium | Process-local; multi-replica would halve protection |
| Payment intent idempotency | 🟢 Low | Safe at current volume; address before 100+/12h |

---

## 6. Conversion Readiness

**Three independent paying verticals: earth observation, DeFi/chain data, IoT sensor. This is early product-market fit, not a fluke.**

The IoT agent's behavior pattern is instructive: it arrived, retried first-call 13 times across 92 seconds while working through the payment recipe, finally paid, then executed iot-sensor-reading on a perfect 2h cron for the rest of the window. That's a real agent integration sequence — not a test, not a sample. The agent framework consumed the 402 body, built the payment, failed several times (possibly nonce issues or signature bugs on first attempt), then succeeded and locked into a reliable cadence.

Challenge → payment rate: 7 paid / ~1,351 challenge-issued = 0.5%. This is entirely from three cron agents; spontaneous first-conversion rate from new explorers is still zero. The funnel is capturing scheduled agents but not yet converting browser-explorers, sweepers, or liveness probes.

The x402lint failures on first-call are the single biggest threat to organic conversion: any agent using automated x402 tooling (rather than manually constructing headers from the recipe) that targets first-call will fail to decode the challenge and silently abort.

---

## 7. Security / Technical Issues

### 🔴 x402lint payment-decode-failed on first-call [Fix Required]
Three services return 402 bodies that x402lint cannot parse as valid x402 payment challenges. `first-call` is the critical one — it's the entry point for every new agent. The issue is almost certainly in the extended fields added to first-call's `goldenPath` block and the earthdata services' specialized body structures. The x402 spec requires the `accepts` array to be parseable as `PaymentRequirementsSchema`; additional fields outside that schema are allowed but must not corrupt the root-level challenge structure. Need to isolate exactly what x402lint is decoding and where it fails.

**Immediate investigation target:** POST /x402/first-call without X-PAYMENT → capture the raw 402 JSON → validate `accepts[0]` against the x402 v2 schema manually → confirm `maxAmountRequired`, `payTo`, `asset`, `network`, `scheme`, and `x402Version` are all present and correctly typed at the root level.

### ⚠️ mcp-rugpull-research Escalated to MCP Layer
Now running `mcp-initialize → mcp-tools-list`. At 2 hits it is reconnaissance, not an attack. MCP tools/list exposes all 80 service names, prices, and descriptions. That is intentional (it's a discovery surface), but worth noting that a security researcher who understands x402 payment systems is now reading the full MCP tool catalog. No action now; log it and watch for follow-up probes targeting specific tools.

### OVH Loop Continues Hour 73+
`163.47.70.38`: 480 hits, 40/hr, unchanged. Still blocked at payment gate, not harmful. Not a buyer. Note for the record.

### 4 Errors This Window
- x402lint (3 errors, all correlated with `payment-decode-failed`) — these are from the linter, not from infrastructure
- x402-mpp-liveness (1 error) — isolated, not systemic

---

## 8. Business Development Read

### What This Means Commercially

The platform now has three independent paying cron agents in active use. Two are confirmed live in this window; the earthdata agent simply didn't land a payment cycle in this 12-hour slice (its last confirmed payment was tokenized-yield-compare at 02:50 UTC Aug 14 — it will return on schedule).

The **IoT agent** is the most commercially interesting new entrant. IoT sensor data aggregation via micropayment is a distinct product application that has nothing to do with DeFi or earth science. If this agent is in production (not a test), it is collecting sensor readings on a 2h schedule — that is 12 calls/day × $0.05/call = $0.60/day = ~$219/year per agent from this single service. Low absolute value but the vertical is real.

The **DeFi/RH agent** is demonstrating systematic service exhaustion — it's trying every `rh-*` and `robinhood-*` service in sequence. At current cadence it will hit all remaining Robinhood services within days. If the pattern holds, expect rh-stock-price, rh-token-trading-volume, and others to receive first paid calls soon.

### Shared :44-past-the-hour Cadence Across All Three Agents

All three paying agents — earthdata, DeFi, IoT — fire at :44 past the hour on 2h cycles. The probability of this being coincidental across three independent operators is very low. Most likely explanation: a single operator is running a multi-agent orchestration framework where different agents are pointed at different service verticals but share the same scheduler. If true, you have one customer with three active agents, and the right commercial posture is to identify and approach that operator when cumulative spend triggers outreach criteria (~$5–10, or 10+ paid calls per vertical — whichever comes first).

### Actor Priority

| Actor | Priority | Posture |
|---|---|---|
| Operator of :44-cron agents (all 3 IPs) | 🔴 Top | Instrument, identify wallet, track cumulative spend, prepare offer |
| x402lint.dev | 🔴 Technical | Fix the decode failures — this is a distribution/conversion blocker |
| x402-mpp-liveness/0.1 | 🟡 Watch | Protocol-aware tester — may be building an MPP-compliant client |
| decixa.ai (x402-healthbot) | 🟡 Watch | Health monitor presence = potential routing integration |
| SmartFlowAI | 🟡 Established | Third sweep — research is active; do not interrupt |
| OVH | 🔴 Ignore | 73h, no payment, not a buyer |
| toll402.com | 🟢 Follow-up | Verify what their verified tier badge requires |

---

## 9. Action Items

**Priority-ordered:**

1. **[Dev — Today] Investigate and fix x402lint payment-decode-failed on first-call, satellite-earthdata, earthdata-precipitation.** 
   Reproduce: `curl -X POST https://coinrailz.com/x402/first-call -H "Content-Type: application/json" -d '{}'` → capture 402 body → validate `accepts[0]` against x402 v2 schema. Check that all required fields (`x402Version`, `scheme`, `network`, `maxAmountRequired`, `payTo`, `asset`) are at the correct nesting level in the root challenge object, not buried inside `execution_guide` or `goldenPath`. The earthdata services likely share a body-structure pattern — fixing one may fix all three.

2. **[Dev — 2 days] Add startup readiness gate (503 + Retry-After during 130s init window).**
   The IoT agent's 13 first-call retries in 92 seconds make this concrete. If any of those retries hit a deploy cold-start, the agent gets 404 and possibly abandons permanently. A `ready` flag that returns 503 instead of 404 — with `Retry-After: 30` — preserves agent sessions through deploys.

3. **[Analytics — Today] Identify wallet addresses for the three cron agents.**
   Query `x402_payment_intents` for transactions associated with `136.124.32.146`, `34.96.60.147`, and `136.124.33.101`. If all three share one wallet, you have confirmed a single-operator scenario and can track cumulative spend precisely. This is the most important intelligence task.

4. **[Dev — 3 days] Add per-treasury mutex/atomic reserve check to rh-bridge-usdc.**
   Architect confirmed: concurrent bridge calls from two agents can double-spend the treasury reserve (non-atomic read-check-write). The DeFi agent hits bridge on a 2h cycle; if it ever overlaps with another bridge call (seeder, canary, or a second agent), the reserve math breaks. Serialize with an in-process mutex or a DB-level `SELECT FOR UPDATE` on the treasury record.

5. **[Dev — 3 days] Add ETag + Cache-Control to MCP tools/list.**
   mcpregistry-bot hits it 94 times/12h (every ~7.5 minutes now — accelerating from 17min prior). A 60-second max-age ETag would reduce that to ~12 hits/12h with identical catalog output. Simple header addition, no logic change.

6. **[Monitoring — 1 day] Real-time alert on payment-verified events.**
   Still not in place. You learned about the IoT agent via periodic DB query. Add a Telegram/log alert when `event_type = payment-verified` fires, including the wallet address and service. Payer cadence is now frequent enough that real-time awareness matters.

7. **[Analytics — 2 days] Track retry count and time-to-payment per session.**
   The IoT agent's 13 first-call retries before succeeding is important diagnostic data. Currently there's no way to see "this IP took N retries over T seconds to complete a payment" without manual DB analysis. Adds conversion optimization visibility.

8. **[BD — 3 days] Prepare outreach template for the :44-cron operator.**
   Not for sending yet, but draft it: "We've noticed 3 agents across earth observation, DeFi, and IoT verticals — would a bundled rate or custom rate limit work for you?" Trigger: combined spend > $5 or wallet identity confirmed.

9. **[Security — Ongoing] Log mcp-rugpull-research escalations.**
   It escalated from x402 to MCP in this window. If it starts making tool calls (beyond tools/list), flag it and consider a UA-specific challenge policy. No action now.

10. **[Dev — 5 days] Review x402-mpp-liveness behavior against x402 spec.**
    This probe understands grant mechanics and ran a full protocol interaction. Before it sends payment, confirm rh-bridge-usdc and other complex services handle MPP-style headers cleanly if that protocol differs from our EIP-3009 path.

---

## 10. Final Verdict

The platform now has three independent paying agent verticals running on synchronized 2-hour cycles. The convergent `:44-past-the-hour` cadence across all three agents is almost certainly a single operator with a shared scheduler. Combined spend trajectory: at current rates, cumulative external revenue will exceed $5 within days — the threshold for a quiet, technically-focused outreach.

The x402lint decode failures on first-call are the only urgent problem. They don't affect the current cron agents (who use the manual recipe path), but they block any agent using automated x402 tooling from onboarding through first-call. That's a ceiling on organic growth from new agent frameworks.

New ecosystem actors (x402-mpp-liveness, decixa.ai healthbot, mcpregistry.io, Meta crawler, ShapBot) represent a broadening of the platform's presence in the AI infrastructure ecosystem. None are buyers today; all are infrastructure players that route and discover services.

Three paying verticals. One spec fix needed. One readiness gate needed. That's a clean state for a platform at this stage.

**Confidence: High** — payment and event data are production-verified; single-operator hypothesis for :44-cron agents is interpretation (medium confidence) pending wallet confirmation.
