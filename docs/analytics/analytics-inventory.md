# Coin Railz Analytics Inventory

> Internal reference for all analytics tables, metrics, and monitoring capabilities.
> Used for twice-daily platform health checks.

## CRITICAL: Paid Metric Rules

**NEVER use `response_status = 200` or `response_status = 402` as a paid proxy.**

`response_status = 200` catches OPTIONS/CORS preflight requests as false positives.
`response_status = 402` means a challenge was issued, NOT that payment happened.

**CORRECT paid metrics:**
```sql
-- Confirmed payments only
WHERE paid = true

-- Or via event type
WHERE event_type IN ('authorized', 'payment-verified', 'solana-payment')

-- ALWAYS exclude OPTIONS from funnel analysis
WHERE request_method != 'OPTIONS'
```

**Why this matters**: Every endpoint returns 200 to OPTIONS preflight requests (CORS requirement).
Probes like XGate-HealthCheck use OPTIONS, getting 200 back — NOT a payment. Past "paid hits"
counts that used response_status=200 were inflated by these CORS requests.

---

## Active Analytics Tables

### 1. `x402_interactions` - **PRIMARY TRAFFIC TRACKER**
**Purpose**: Logs every request to x402 microservice endpoints
**Data Captured**:
- `service_id`: Which service was requested
- `user_agent`: Bot/agent identification
- `ip_address`: Request origin
- `response_status`: HTTP response (200, 402, etc.)
- `paid`: BOOLEAN — the only reliable paid signal
- `event_type`: 'challenge-issued', 'authorized', 'payment-verified', 'solana-payment'
- `request_method`: GET/HEAD/POST/OPTIONS
- `created_at`: Timestamp

**Use Cases**:
- Traffic analysis by date/agent/service
- Identify discovery bots vs real customers
- Monitor service popularity
- Funnel analysis: challenges → payments

**Query Examples**:
```sql
-- Daily traffic (real requests only — no OPTIONS CORS noise)
SELECT DATE(created_at), COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid
FROM x402_interactions GROUP BY 1 ORDER BY 1 DESC;

-- Top user agents (real traffic only)
SELECT user_agent, COUNT(*) as hits, COUNT(*) FILTER (WHERE paid = true) as paid
FROM x402_interactions
WHERE request_method != 'OPTIONS'
GROUP BY 1 ORDER BY 2 DESC;

-- Service popularity (corrected)
SELECT service_id, COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid
FROM x402_interactions GROUP BY 1 ORDER BY 2 DESC;

-- External traffic only (no internal IPs)
SELECT * FROM x402_interactions
WHERE ip_address NOT LIKE '10.%' AND ip_address != '127.0.0.1'
  AND request_method != 'OPTIONS'
ORDER BY created_at DESC LIMIT 50;
```

---

### 2. `x402_payment_intents` - **REVENUE LEDGER**
**Purpose**: Durable record of every on-chain payment attempt and settlement
**Data Captured**:
- `tx_hash`: On-chain transaction hash (unique)
- `payer`: Wallet address of payer
- `amount`: USDC amount paid
- `status`: PENDING / SUCCEEDED / FAILED
- `network`: eip155:8453 (Base), eip155:1 (Ethereum), solana:5eykt4...
- `service_name`: Which service was paid for
- `succeeded_at`: Settlement timestamp

**AUTHORITATIVE revenue source** — use this, not x402_interactions, for revenue reporting.

**Query Examples**:
```sql
-- All-time revenue by payer
SELECT payer, network, COUNT(*) as intents, ROUND(SUM(amount), 4) as total_usdc,
  MIN(created_at) as first_payment, MAX(succeeded_at) as last_payment
FROM x402_payment_intents WHERE status = 'SUCCEEDED'
GROUP BY payer, network ORDER BY last_payment DESC;

-- Revenue by day (last 30 days)
SELECT DATE(created_at) as day,
  COUNT(*) FILTER (WHERE status = 'SUCCEEDED') as paid,
  ROUND(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 4) as revenue_usdc
FROM x402_payment_intents
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;

-- All-time totals
SELECT COUNT(*) FILTER (WHERE status = 'SUCCEEDED') as total_paid,
  ROUND(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 4) as total_usdc,
  COUNT(DISTINCT payer) FILTER (WHERE status = 'SUCCEEDED') as distinct_payers,
  MAX(succeeded_at) FILTER (WHERE status = 'SUCCEEDED') as last_payment
FROM x402_payment_intents;
```

---

### 3. `x402_canary_payments` - **PAYMENT RAIL HEALTH MONITOR**
**Purpose**: Records every automated canary payment fired by the 6-hour canary job.
Every successful row = the full Base mainnet payment rail (challenge → USDC on-chain → verification) confirmed working.
**Data Captured**:
- `network`: always 'base' (mainnet)
- `status`: 'succeeded' / 'failed'
- `amount_usd`: always $0.05
- `tx_hash`: on-chain transaction hash
- `service`: always 'first-call'
- `created_at`: timestamp

**This is the #1 health signal. Check it first.**

```sql
-- Last 10 canary payments — should all be 'succeeded'
SELECT network, status, amount_usd, tx_hash, created_at
FROM x402_canary_payments
ORDER BY created_at DESC LIMIT 10;
```

---

### 4. `endpoint_hits` - **ALL ENDPOINT TRAFFIC**
**Purpose**: Logs every request to any platform endpoint (discovery, x402, API, trial, etc.)
**Data Captured**:
- `endpoint`: path hit
- `method`: GET/HEAD/POST
- `endpoint_type`: 'discovery', 'x402', 'trial', etc.
- `ip_hash`: hashed IP (not raw IP)
- `status_code`: HTTP response
- `response_time_ms`: latency
- `user_agent`, `referer`, `wallet_address`
- `created_at`

**Use Cases**: Discovery surface health, raw endpoint traffic, latency monitoring

```sql
-- Discovery endpoints last 24h (unique IPs = cold discovery signal)
SELECT endpoint, COUNT(*) as hits, COUNT(DISTINCT ip_hash) as unique_ips,
  AVG(response_time_ms) as avg_ms
FROM endpoint_hits
WHERE endpoint_type = 'discovery' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint ORDER BY hits DESC;

-- Full traffic last 12h by type
SELECT endpoint_type, COUNT(*) as hits, COUNT(DISTINCT ip_hash) as unique_ips
FROM endpoint_hits
WHERE created_at > NOW() - INTERVAL '12 hours'
GROUP BY endpoint_type ORDER BY hits DESC;
```

---

### 5. `microservice_metrics` - **SERVICE-LEVEL DAILY ROLLUP**
**Purpose**: Aggregated daily metrics per service
**Data Captured**:
- `service_id`, `date`, `total_requests`, `successful_requests`, `failed_requests`
- `total_revenue`, `avg_response_time`

**Note**: Currently only populates for `first-call`. For all other services, use `x402_interactions` directly.

---

### 6. `discovery_runs` - **AGENT DISCOVERY TRACKING**
**Purpose**: Logs agent discovery runs
**Data Captured**:
- `run_type`: scheduled/manual
- `status`: completed/failed/running
- `total_raw`, `total_unique`, `new_agents`, `updated_agents`, `duration_ms`

**Note**: Scheduled runs were intentionally disabled in December 2025. Discovery is run manually only.
Last manual run: Feb 13 2026 — found 127 new agents.

```sql
SELECT run_type, status, new_agents, duration_ms, started_at
FROM discovery_runs ORDER BY started_at DESC LIMIT 5;
```

---

### 7. `discovered_agents` - **AGENT DATABASE**
**Purpose**: Master list of discovered AI agents
**Data Captured**:
- `url`: Agent endpoint URL
- `source`: Discovery source (x402-bazaar, github, elizaos-registry, coinbase-cdp-wallet, etc.)
- `wallet`: Payment wallet if known
- `status`: new / verified / duplicate / pending-verification / registry_synced / warm_lead
- `capabilities`: What the agent can do
- `xmtp_address`: XMTP messaging capability
- `last_contact_at`: When outreach was last attempted

**Stats (Jun 9 2026)**:
- ~18,841 total agents
- 18,772 with status 'new'
- 35 registry_synced, 28 verified, 3 warm_lead
- Note: Most 'new' agents are indexers, crawlers, or registry entries — not directly contactable

**Outreach**: POST `/api/a2a-outreach/campaign` — triggers outreach to uncontacted agents.
Rate-limited to 1 req/5s, max 10 concurrent. Last campaign: Feb 13 2026 (10 agents).

---

### 8. `gpt_purchase_sessions` - **CHATGPT PAYMENT FUNNEL**
**Purpose**: Track GPT credit purchase flow
**Data Captured**:
- `id`: Session ID (used in /pay/{id} URL)
- `stripe_payment_intent_id`, `user_id`, `package_name`, `amount`, `credits`, `status`, `api_key`

---

### 9. `credits_accounts` - **USER CREDIT BALANCES**
**Purpose**: Track prepaid credit balances

**Stats (Jun 9 2026)**: 75 accounts, $795.70 total credits held, 70 accounts with positive balance

```sql
SELECT COUNT(*) as accounts, SUM(balance) as total_credits,
  COUNT(*) FILTER (WHERE balance > 0) as accounts_with_balance
FROM credits_accounts;
```

---

### 10. `credit_transactions` - **CREDIT LEDGER**
**Purpose**: Every credit purchase, spend, and trial grant
**Key columns**: `type`, `payment_method`, `amount`, `service_name`, `description`, `created_at`

```sql
SELECT type, payment_method, amount, service_name, description, created_at
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

### 11. `api_keys` - **API KEY REGISTRY**
**Purpose**: Track issued API keys
**Key columns**: `status`, `last_used_at`, `created_at`, `expires_at`, `allowed_services`, `rate_limit`
**⚠️ SCHEMA NOTE**: There is NO `is_active` column. Use `status = 'active'` (values: `'active'`, `'revoked'`, `'expired'`). There is NO `last_used` column — use `last_used_at`.

```sql
-- Snapshot: total by status, usage recency
SELECT status,
  COUNT(*) as total_keys,
  COUNT(CASE WHEN last_used_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as used_24h,
  COUNT(CASE WHEN last_used_at >= NOW() - INTERVAL '7 days' THEN 1 END) as used_7d,
  COUNT(CASE WHEN last_used_at IS NULL THEN 1 END) as never_used,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_24h
FROM api_keys GROUP BY status;

-- Dormancy buckets: active keys by last-use recency
SELECT
  CASE
    WHEN last_used_at IS NULL THEN 'never_used'
    WHEN last_used_at >= NOW() - INTERVAL '24 hours' THEN 'used_24h'
    WHEN last_used_at >= NOW() - INTERVAL '7 days' THEN 'used_7d'
    WHEN last_used_at >= NOW() - INTERVAL '30 days' THEN 'used_30d'
    ELSE 'dormant_30d_plus'
  END as usage_bucket,
  COUNT(*) as keys
FROM api_keys WHERE status = 'active' GROUP BY 1 ORDER BY 1;
```

---

### 12. `a2a_interactions` - **A2A + AP2 FUNNEL TRACKER**
**Purpose**: Logs every inbound request to `/a2a/v1/message/send` and `/ap2/v1/merchant`
**Data Captured**:
- `protocol`: 'a2a' or 'ap2'
- `matched`: boolean — whether a service was found
- `resource_id`: matched service ID
- `query_text`: raw query the agent sent (sliced to 2000 chars)
- `ip_address`, `user_agent`, `status_code`, `response_time_ms`, `created_at`

**Query Examples**:
```sql
-- Unmatched queries — what agents want that we don't have
SELECT query_text, COUNT(*) FROM a2a_interactions
WHERE matched = false AND query_text IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;

-- Match rate
SELECT protocol,
  COUNT(*) FILTER (WHERE matched) as matched,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE matched) / NULLIF(COUNT(*),0), 1) as pct
FROM a2a_interactions GROUP BY protocol;
```

---

### 13. `conversion_funnel_events` - **USER CONVERSION TRACKER**
**Purpose**: Tracks users/agents moving through acquisition funnel stages
**Key columns**: `stage`, `channel`, `wallet_address`, `credits_amount`, `created_at`
**Stages**: `first_contact` → `trial_claimed` → `first_x402_call` → `converted`

```sql
SELECT stage, channel, COUNT(*) as count,
  COUNT(DISTINCT wallet_address) as wallets,
  SUM(COALESCE(credits_amount, 0)) as credits_transacted
FROM conversion_funnel_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY stage, channel ORDER BY count DESC;
```

---

### 14. `sdk_installs` - **SDK ADOPTION TRACKER**
**Purpose**: Tracks SDK installations and free-trial usage
**Key columns**: `sdk_type`, `sdk_version`, `total_requests`, `free_calls_used`, `demo_key_issued`, `converted_to_paid`, `last_seen_at`

```sql
SELECT sdk_type, COUNT(*) as installs,
  SUM(total_requests) as total_requests,
  SUM(CASE WHEN converted_to_paid THEN 1 ELSE 0 END) as converted
FROM sdk_installs
WHERE last_seen_at > NOW() - INTERVAL '7 days'
GROUP BY sdk_type;
```

---

## Real Revenue Picture (Jun 16 2026)

**All-time USDC: ~$279 across 466 payment intents from 14 distinct wallets**

**External (organic) revenue only — canary and internal excluded:**

| Payer | Network | Intents | USDC | Last Payment | Notes |
|---|---|---|---|---|---|
| 0x92ca4cef... | Base | 94 | $79.75 | Dec 22 2025 | |
| 0x2f5134f7... | Base | 48 | $31.70 | Jan 10 2026 | |
| 0x0a2854fb... | Base | 1 | $14.87 | Dec 14 2025 | |
| **0x9cc42f3d...** | **Base** | **21** | **$10.15** | **Jun 12 2026** | **NEW — paid 21 services in one session** |
| 0x74de5d4f... | Ethereum | 1 | $9.84 | Feb 18 2026 | |
| 0x6341b240... | Base | 4 | $0.70 | Jan 25 2026 | |
| 0x3803a192... | Base | 6 | $1.10 | Jun 13 2026 | Organic returner — earthdata specialist |
| Others (3 wallets) | Base | 3 | $0.75 | Dec 2025 | |
| Hgby7VEo6va... | Solana | 2 | $0.10 | Feb 27 2026 | Internal test |

**Internal canary/testing wallets (excluded from external totals):**

| Wallet | Intents | USDC | Notes |
|---|---|---|---|
| **0x5837a864...** | **176** | **$124.95** | **Active canary wallet — derived from X402_BUYER_PRIVATE_KEY. ALL payments internal.** |
| 0xa4bbe37f... | 109 | $5.45 | Secondary internal wallet (TK5 MetaMask, still funded ~$47 USDC). Stopped firing Jun 13 — was a legacy dev/test canary before X402_BUYER_PRIVATE_KEY canary job was formalized. is_canary=false in DB. |

> ⚠️ **CORRECTION from Jun 9 doc**: `0x5837a864` was incorrectly labeled "Largest external payer." It is and always has been the canary wallet (is_canary=true). No external payer has ever spent more than $10.15 in a single session.

**Last confirmed external (non-canary) payment: June 13, 2026** — wallet `0x3803a192...`, earthdata-precipitation $0.25.

**Most significant recent event: June 12, 2026** — new wallet `0x9cc42f3d...` paid for 21 different services in 15 minutes ($10.15 total). First external payer to broadly test the catalog in a single session.

**To get current totals at any check:**
```sql
SELECT COUNT(*) FILTER (WHERE status = 'SUCCEEDED') as total_paid,
  ROUND(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 4) as total_usdc,
  COUNT(DISTINCT payer) FILTER (WHERE status = 'SUCCEEDED') as distinct_payers,
  MAX(succeeded_at) FILTER (WHERE status = 'SUCCEEDED') as last_payment
FROM x402_payment_intents;
```

---

## Known Probe Agents (Not Revenue)

| Agent | Pattern | Paid | Notes |
|---|---|---|---|
| CarbonMonitor/0.1 (carbon-cashmere.de) | GET to 7 services continuously | Never | German fintech health monitor |
| python-httpx/0.28.1 | HEAD to ping/gas-price-oracle/token-metadata, every 15-30min | Never | Persistent prober |
| node | GET/HEAD across 44 services | Never (canary wallet only) | Canary job + external Node.js agents |
| XGate-HealthCheck/1.0 | OPTIONS preflight | Never (200 is CORS, not payment) | Do NOT count as paid |
| ScoutScore-FidelityCheck/1.0 | OPTIONS preflight | Never | All 200s were CORS |
| EntRoute-Probe/1.0 | POST /x402/ping every ~8h | Never yet | Cloudflare-fronted, POST = payment-aware |
| SERankingBacklinksBot | GET to instant-agent-wallet/transaction-builder | Never | SEO backlink crawler |
| meta-externalagent/1.1 | GET to 20-25 services, 18 rotating IPs | Never | Facebook/Meta agent catalog indexer |
| ari-indexer/1.0 (ari.dev) | GET to 8 services | Never | Agent Registry Index |
| x402-network-mapper/0.1 (SmartFlowPro AI) | GET to 4 services | Never | x402 ecosystem mapper |
| x402-healthbot/1.0 (decixa.ai) | GET to 2 services | Never | Decixa.ai health monitor |
| Dexter-Verifier/1.0 | GET /x402/ping | Never (probe only) | Dexter facilitator health check |
| 402.ad-probe/1.0 | Occasional GET | Never | x402 ecosystem probe |
| *(blank)* IPv6 2a06:98c0:3600::103 | Systematic GET catalog sweep → POST all services, ~2–4h cycle. Active Jun 10–present. | Never | Cloudflare-fronted, blank UA, parallel requests. Behaves like a catalog indexer (not a buyer). NOT a conversion candidate. |
| *(blank)* 79.137.72.94 | POST only (`node` UA). Alternates first-call and gas-price-oracle on ~3–5 day cycle. Active since Mar 8 2026. Recently hitting instant-api-key. | 7 free calls (gas-price-oracle, first-call-free). Never paid. | **Longest-running stuck prospect — 4 months, 962 hits, 30 services. Genuinely trying to pay (now targeting instant-api-key) but wallet appears unfunded.** |

---

## Dormant/Underutilized Tables

- `api_usage_tracking`: Per-request billing tracking — exists, no data populating currently (API key holders not making calls)
- `api_integration_logs`: Schema exists, no data
- `x402_discovery_metrics`: Only 3 rows total (Jan 2026, Nov 2025) — effectively dormant
- `payment_intent_tracking`: Stripe PI lifecycle tracking, implemented in stripeRoutes webhook
- `fast_revenue_records`: Schema exists, no data in recent windows

---

## Recommended Monitoring Queries

### Every Health Check (twice daily)
```sql
-- 1. Canary health — should all be 'succeeded'
SELECT network, status, amount_usd, tx_hash, created_at
FROM x402_canary_payments ORDER BY created_at DESC LIMIT 5;

-- 2. Real traffic last 12h (OPTIONS excluded)
SELECT DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid,
  COUNT(DISTINCT ip_address) FILTER (WHERE request_method != 'OPTIONS') as unique_ips,
  COUNT(DISTINCT service_id) FILTER (WHERE request_method != 'OPTIONS') as services_hit
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '12 hours'
GROUP BY 1 ORDER BY 1 ASC;

-- 3. Any new payment intents? (authoritative revenue)
SELECT payer, network, service_name, amount, status, created_at
FROM x402_payment_intents
WHERE created_at > NOW() - INTERVAL '12 hours'
ORDER BY created_at DESC;

-- 4. New users / trial claims
SELECT type, payment_method, amount, description, created_at
FROM credit_transactions WHERE created_at > NOW() - INTERVAL '12 hours';

-- 5. API key activation (how many of 82 keys are being used)
SELECT status,
  COUNT(*) as total_keys,
  COUNT(CASE WHEN last_used_at >= NOW() - INTERVAL '12 hours' THEN 1 END) as used_12h,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '12 hours' THEN 1 END) as new_12h
FROM api_keys GROUP BY status;

-- 6. Discovery surface hits
SELECT endpoint, COUNT(*) as hits, COUNT(DISTINCT ip_hash) as unique_ips
FROM endpoint_hits
WHERE endpoint_type = 'discovery' AND created_at > NOW() - INTERVAL '12 hours'
GROUP BY endpoint ORDER BY hits DESC;

-- 7. User agents (real traffic, no OPTIONS)
SELECT user_agent, COUNT(*) as hits, COUNT(*) FILTER (WHERE paid = true) as paid,
  COUNT(DISTINCT ip_address) as unique_ips
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '12 hours' AND request_method != 'OPTIONS'
GROUP BY user_agent ORDER BY hits DESC LIMIT 15;
```

### Weekly Analysis
```sql
-- 7-day paid trend (CORRECTED — paid=true only)
SELECT DATE(created_at) as day,
  COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid
FROM x402_interactions WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at) ORDER BY day DESC;

-- Revenue this week (authoritative)
SELECT DATE(created_at) as day, COUNT(*) as intents, ROUND(SUM(amount), 4) as usdc
FROM x402_payment_intents
WHERE status = 'SUCCEEDED' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- All-time revenue snapshot
SELECT COUNT(*) FILTER (WHERE status = 'SUCCEEDED') as total_paid,
  ROUND(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 4) as total_usdc,
  COUNT(DISTINCT payer) FILTER (WHERE status = 'SUCCEEDED') as distinct_payers,
  MAX(succeeded_at) FILTER (WHERE status = 'SUCCEEDED') as last_payment
FROM x402_payment_intents;

-- Conversion funnel this week
SELECT stage, channel, COUNT(*) as count
FROM conversion_funnel_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY stage, channel ORDER BY count DESC;
```

---

*Last Updated: June 16, 2026*
