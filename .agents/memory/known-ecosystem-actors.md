---
name: Known recurring actors — ecosystem monitors
description: Profiles of all recurring non-human actors hitting the x402 platform — what they are, what they do, and how to classify them in assessments.
---

## Persistent Validators

**163.47.70.38** — python-httpx/0.28.1 | ASN AS38195 Superloop (AUSTRALIA) PTY LTD | Sydney/Central Coast NSW
- Runs continuously, ~816 hits/12h window, 33 services
- compliance-consultation polled at GENUINE 2× rate (46 hits vs 23 for all other services per window)
- The 2× rate is intrinsic validator behavior — NOT a manifest duplication artifact
- KNOWN_SLUGS fix (Jul 15 2026) confirmed: removing /service/ prefix entries did NOT change the ratio
- Has never paid. 6+ weeks continuous. $5.00 service = highest-value unresolved actor
- Cannot be directly contacted from IP alone — Superloop enterprise customer, PTR record lookup recommended
**Why it matters:** Longest-running, highest-frequency validator; specifically targets compliance-consultation

**2.208.198.190** — x402-observer/1.0 (+https://x402.fuchss.app/trust) | trust scorer
- ~294-320 hits/12h window, ~49 services per cycle
- POST-based (not GET) — actually submits to service endpoints, scores trust/uptime
- Stable presence since early tracking began
**Why it matters:** Trust score feeds into ecosystem routing decisions

## Cloudflare Sweeper

**2a06:98c0:3600::103** (blank UA) — Cloudflare Worker
- Progressively expanded: 31 svcs (Jul 13) → 65 svcs (Jul 14) → 71 svcs (Jul 14-15) → stable at 71
- ~188-210 hits/12h window
- Expansion driven by autonomousDiscoveryService.ts sitemap additions — picks up new paths each cycle
- Appears to have reached steady state at 71 services as of Jul 15 2026
**Why it matters:** Discovery infrastructure sweeper; coverage = how many services are discoverable

## Paying Actors (GCP Cron Agents)

**34.96.60.141** (prev 34.96.45.38) — node UA | AS15169 Google LLC (GCP)
- Pays first-call every ~6 hours on a cron schedule
- IP rotates within 34.96.0.0/16 GCP block — same operator confirmed by schedule consistency
- Full x402 dance on each payment (HEAD→GET→POST→authorized→verified)
- Has never paid anything other than first-call ($0.05)
- Interpreted as SLA reliability monitor for a downstream registry/marketplace

**136.124.32.47** — node UA | AS396982 Google LLC (GCP, Council Bluffs Iowa)
- FIRST APPEARED Jul 15 2026 — brand new actor, paid on day 1
- Pays first-call every ~6 hours (02:22 and 08:22 UTC on first day)
- Same exact x402 dance as 34.96.60.141 — independent GCP instance, likely same ecosystem/registry
- Two independent 6h cron payers = first-call listed in a registry that drives automated validator setup
**Why it matters:** First confirmed case of inbound automated adoption from registry ecosystem

## x402 Ecosystem Healthbots

**3.84.52.67** — x402-healthbot/1.0 (+https://decixa.ai/bot) | AWS
- decixa.ai health monitor — targeted cross-category scans (6 services per visit)
- Categories covered: DeFi, prediction markets, trading signals, compliance, satellite data
- Absence in a window is normal (multi-day cycle); return = active evaluation
- Now probing satellite vertical (weather-imagery, air-quality, vegetation) as of Jul 15 2026
**Why it matters:** Decixa.ai is an x402 ecosystem aggregator/trust layer; listing there drives validator setup

**54.242.209.200** (prev 52.90.218.93, 3.227.20.101) — ScoutScore-HealthCheck/1.0 or ScoutScore-FidelityCheck/1.0 | AWS (distributed)
- Three different AWS IPs across three windows — confirms distributed pipeline
- Alternates between HealthCheck (HEAD, uptime) and FidelityCheck (GET+OPTIONS, content integrity)
- Pattern so far: HealthCheck (window 2) → FidelityCheck (window 3) → HealthCheck (window 4)
- Targets token-metadata exclusively
- Staged scoring pipeline: Discovery → Health → Fidelity → TrustScore → Integration
**Why it matters:** ScoutScore vetting pipeline — passing all stages leads to trusted provider listing

## A2A Registry Monitors

**170.9.237.30** — DoppelOps-AgentPlane-SecurityScan/1.0 + LivenessCheck/1.0 | agentplane.doppelops.com
- Entered CONTINUOUS MONITORING mode Jul 15 2026 (12 hits in 12h, was 4 hits in 40min prior window)
- Alternates SecurityScan and LivenessCheck on ~60 min cycle, all 200
- All hits to A2A endpoint (/a2a/v1/message/send)
- Triggered by AgentsCensusBot fix → proper 200 catalog → census recorded → AgentPlane discovered
**Why it matters:** AgentPlane production monitoring = Coin Railz on their active registry listing

**75.74.247.10** — AgentsCensusBot/0.1 (+https://github.com/joshkeding/agents; agent-highway census)
- Hourly census, every hour, all 200 since empty-POST fix deployed Jul 14 2026
- Fix: handleMessageSend returns 200 catalog summary on empty POST instead of 400
**Why it matters:** agent-highway indexes based on census responses — hourly 200 = continuous indexing

**107.174.178.57** — agent-tools.cloud-crawler/0.1
- Crawled A2A endpoint once (confirmed indexed Jul 15 2026)
- agent-tools.cloud is an agent directory/marketplace

## SEO / Competitive Intelligence (New Jul 15 2026)

**185.191.171.x, 85.208.96.x** — SemrushBot/7~bl | Semrush
- First appeared Jul 15 2026 (7 hits, 5 IPs)
- Semrush $2B SEO/competitive intelligence platform — crawls for their API analytics and backlink database
- Indicates Coin Railz crossed a visibility threshold (backlink count or directory mentions)

## Depleted / Dormant

**74.220.48.244** — python-httpx/0.28.1 | depleted USDC wallet
- Continues to POST/probe but wallet is empty — do NOT flag as diagnostic mystery

**165.162.47.179** — node | post-shortlist dormancy
- Hit decay: 89 → 17 → 2 → 0 over 4 windows
- Interpreted as: broad discovery → shortlisting → internal development phase
- Monitor for burst return (= production deployment signal)

**79.137.72.94** — node | depleted wallet, known
