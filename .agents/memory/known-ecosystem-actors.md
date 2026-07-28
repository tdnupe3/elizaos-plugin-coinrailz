---
name: Known recurring actors — ecosystem monitors
description: Profiles of all recurring non-human actors hitting the x402 platform — what they are, what they do, and how to classify them in assessments.
---

## Persistent Validators

**163.47.70.38** — python-httpx/0.28.1 | ASN AS38195 Superloop (AUSTRALIA) PTY LTD | Sydney/Central Coast NSW
- Runs continuously, 522–816 hits/12h window, 33 services
- compliance-consultation ratio: WAS genuine 2× (46 vs 23); NARROWED to ~1.1× (27 vs 24) in Window 5 (Jul 15–16 2026) after KNOWN_SLUGS fix took delayed effect over one full validator cycle
- Has never paid. 6+ weeks continuous. $5.00 service = highest-value unresolved actor
- PTR record: none. Superloop enterprise customer — cannot be identified further from IP alone
**Why it matters:** Longest-running, highest-frequency validator; ratio normalization may signal approach to payment test

**2.208.198.190** — x402-observer/1.0 (+https://x402.fuchss.app/trust) | trust scorer
- ~294-320 hits/12h window, ~49 services per cycle
- POST-based (not GET) — actually submits to service endpoints, scores trust/uptime
- Stable presence since early tracking began
**Why it matters:** Trust score feeds into ecosystem routing decisions

## Cloudflare Sweeper

**2a06:98c0:3600::103** (blank UA) — Cloudflare Worker
- Progressively expanded: 31 svcs (Jul 13) → 65 svcs (Jul 14) → 71 svcs (Jul 14–15) → contracted to 26 svcs (Window 5, Jul 15–16)
- ~128–210 hits/12h window; contraction to 26 svcs in Window 5 may be mid-cycle artifact — monitor
- Expansion driven by autonomousDiscoveryService.ts sitemap additions — picks up new paths each cycle
**Why it matters:** Discovery infrastructure sweeper; sharp contraction may indicate probe failures on some services — watch next window

## Paying Actors (GCP Cron Agents)

**34.96.60.141** (prev 34.96.45.38) — node UA | AS15169 Google LLC (GCP)
- Pays first-call every ~6 hours on a cron schedule
- IP rotates within 34.96.0.0/16 GCP block — same operator confirmed by schedule consistency
- Full x402 dance on each payment (HEAD→GET→POST→authorized→verified)
- Has never paid anything other than first-call ($0.05)
- Interpreted as SLA reliability monitor for a downstream registry/marketplace

**136.124.32.47** — node UA | AS396982 Google LLC (GCP, Council Bluffs Iowa)
- First appeared Jul 15 2026 — paid on day 1; completed 4 payments in first 24h: 02:22, 08:22, 14:22, 20:22 UTC (perfect 6h cadence, zero misses)
- Same exact x402 dance as 34.96.60.141 — HEAD→GET→POST→authorized→verified each cycle
- AgentPlane listing (confirmed Jul 15 2026) is probable acquisition source — appeared same day Coin Railz was confirmed listed
- PTR record: none (standard for GCP cron VMs)
- Two independent 6h cron payers = first-call listed in a registry that drives automated validator setup
**Why it matters:** First confirmed inbound automated adoption from registry listing; 4 on-chain payments in 24h = production deployment, not test

## x402 Peer Agents (Inbound A2A Introductions)

**13.48.136.59** — python-requests/2.34.1 | AWS eu-north-1 (Stockholm) | MetaVision DeFi Signals
    - Monitored Coin Railz silently for 7 days before first A2A intro (Jul 15 2026)
    - **Pitch history:** CVE Oracle ($0.10/call) → Jul 28 2026 PIVOTED to "Token analytics and DeFi metrics. Real-time price, volume, holders. 0.10 USDC/query"
    - New pitch competes directly with token-metadata, token-price, token-sentiment (not complementary)
    - Still routing to 'a2a-peer-offer' (unmatched), still returning 200 daily at ~00:26 UTC
    - Per editorial rules: do NOT pursue; background noise unless they send paying customers or purchase services

**94.162.62.98** — CarryLens | WIND TRE (Milan) | x402 peer ($0.01/call Base)
- Sent inbound A2A introduction Jul 13 2026; Coin Railz responded via outreach campaign Jul 15
- Processes 177 live perpetual markets; sees trading-signal + dex-liquidity as complementary
- Partnership path: data feed integration (Coin Railz macro signals → CarryLens screener UI) then cross-listing
- Responses route to POST /api/a2a/responses (processed by a2aOutreachService.processResponse())

## x402 Ecosystem Healthbots

**3.84.52.67** — x402-healthbot/1.0 (+https://decixa.ai/bot) | AWS
- decixa.ai health monitor — targeted cross-category scans (6 services per visit)
- Categories covered: DeFi, prediction markets, trading signals, compliance, satellite data
- Absence in a window is normal (multi-day cycle); return = active evaluation
- Now probing satellite vertical (weather-imagery, air-quality, vegetation) as of Jul 15 2026
**Why it matters:** Decixa.ai is an x402 ecosystem aggregator/trust layer; listing there drives validator setup

**145.132.103.179** — x402all-freshness/1.0 (+https://x402all.com/about) | unknown ASN
- First appeared Window 5 (Jul 15 2026 14:11–14:12 UTC) — 68 hits across 48 services in a 20-second parallel burst
- x402all.com maintains a freshness index of registered x402 services; they scan to verify 402 responses are live
- Appearance confirms Coin Railz is in an x402 registry that x402all monitors
- Absence in a window = normal (freshness scans likely weekly or triggered by registry updates)

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

**51.12.243.114** — MistralAI-User/1.0 (+https://docs.mistral.ai/robots) | Azure West Europe
- First appeared Window 5 (Jul 15 2026 18:05 UTC) — hit /a2a/v1 then /a2a/v1/message/send; both 200
- Mistral AI (~$6B valuation, Le Chat agent platform) — MistralAI-User UA = agent capability testing, not standard web crawl
- First major AI lab to touch the A2A endpoint directly (not just SEO crawl)

**172.59.155.90** — node UA | unknown ASN
- Hit /a2a/v1/message/send twice at 18:24–18:25 UTC Window 5 (Jul 15 2026); empty body; both returned 200 catalog
- Unidentified — needs WHOIS; timing proximity to outreach campaign (fired 14:40 UTC same day) could indicate inbound response probe

**75.102.33.77** — MERCURY-x402-fetch/1 | Mercury Web Fetch
- Appeared Window 5 (Jul 15 2026) with x402-payment UA — distinct from Mercury's A2A crawler
- This UA indicates Mercury is testing x402 payment flow (not just A2A protocol discovery)
- Mercury is a known x402 peer that pays $0.003/call; outreach sent Jul 15 via campaign

## SEO / Competitive Intelligence

**185.191.171.x, 85.208.96.x** — SemrushBot/7~bl | Semrush
- CORRECTION: Has been crawling since Dec 2024 (NOT new Jul 15 2026) — 8+ crawl waves across full catalog
- Waves: Dec 2024, Jan 2026, Feb 2026, Mar 2026, Apr 2026, May 2026, Jun 2026, Jul 2026 (ongoing)
- Coverage: virtually every service in the catalog has been hit across the 8 waves
- Most recent focus (Jul 2026): satellite-earthdata, earthdata-sst, earthdata-soil-moisture, compliance-consultation

**15.235.27.231** — AhrefsBot/7.0 | Ahrefs (OVH Montreal)
- First appeared Window 5 (Jul 15–16 2026), 1 hit
- Ahrefs: major SEO/backlink intelligence platform alongside Semrush

**157.55.39.57** — bingbot/2.0 | Microsoft Bing
- First appeared Window 5 (Jul 15–16 2026), 1 hit
- Third major search engine crawler (after GoogleOther + Bing)

## New / Unidentified High-Interest Actors

**152.55.176.124** — node UA | first appeared Jul 23 2026
- Executed full-catalog double-POST traversal: 77 services × 2 POSTs each, completed in ~1 hour (03:00–04:00 UTC)
- Drove the 254 req/hr spike that is the highest hourly rate logged this month
- No prior history. No payment yet. Pattern is consistent with pre-integration payload validation.
- T-48h watch: if no payment within 48h, investigate further / consider rate limiting
**Why it matters:** Full-catalog double-traversal is the closest behavioral precursor to first payment seen since 0x9cc42f3d's initial sessions

## Depleted / Dormant

**74.220.48.244** — python-httpx/0.28.1 | depleted USDC wallet (0x9cc42f3d)
- Continues to POST/probe but wallet is empty — do NOT flag as diagnostic mystery
- NOTE: sibling IP 74.220.48.169 (same /24) appeared Jul 23 2026 with node UA, 180 POSTs to 47 services

**74.220.48.169** — node UA | same /24 as 0x9cc42f3d depleted actor
- First confirmed Jul 23 2026 window: 180 POSTs, 47 services — significantly more aggressive than .244
- Targeted focus: whale-alerts (16), credit-risk-score (16), agent-create-wallet (14), construction-progress (14)
- Non-random — has specific service interest. High-probability payer if USDC wallet is refunded.

**165.162.47.179** — node | post-shortlist then returned
- Hit decay: 89 → 17 → 2 → 0 over 4 windows, then RETURNED Window 5 (Jul 15–16 2026): 16 hits, 8 services, 16:14–19:32 UTC
- Return probe is medium-depth (between original 42-svc broad and 10-svc shortlist) — consistent with engineering review cycle ending
- Architect estimate: 4–8 weeks from shortlist to production deployment; return suggests mid-cycle re-evaluation, not abandonment
- Monitor: if next window shows narrower probe or hits an execution endpoint (payment-processing, agent-create-wallet), that's imminent conversion

**79.137.72.94** — node | depleted wallet, known
