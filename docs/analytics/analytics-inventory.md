# Coin Railz Analytics Inventory

> Internal reference for all analytics tables, metrics, and monitoring capabilities.

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
  MIN(created_at) as first_payment, MAX(created_at) as last_payment
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
  ROUND(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 4) as total_usdc
FROM x402_payment_intents;
```

---

### 3. `microservice_metrics` - **SERVICE-LEVEL STATS**
**Purpose**: Aggregated metrics per service
**Data Captured**:
- `service_id`, `date`, `total_requests`, `successful_requests`, `failed_requests`
- `total_revenue`, `avg_response_time`

---

### 4. `discovery_runs` - **AGENT DISCOVERY TRACKING**
**Purpose**: Logs scheduled discovery runs that find new agents
**Data Captured**:
- `run_type`: scheduled/manual
- `status`: completed/failed/running
- `total_raw`, `total_unique`, `new_agents`, `updated_agents`, `duration_ms`

**Current Performance** (as of Mar 2026):
- Last successful run: Feb 13 2026 (manual) — found 127 new agents
- Scheduled runs have been failing since Dec 21 2025 — needs investigation

---

### 5. `discovered_agents` - **AGENT DATABASE**
**Purpose**: Master list of discovered AI agents
**Data Captured**:
- `url`: Agent endpoint URL
- `source`: Discovery source (x402-bazaar, github, elizaos-registry, coinbase-cdp-wallet, etc.)
- `wallet`: Payment wallet if known
- `status`: new / verified / duplicate / pending-verification
- `capabilities`: What the agent can do
- `xmtp_address`: XMTP messaging capability
- `last_contact_at`: When outreach was last attempted

**Stats (Mar 6 2026)**:
- 4,213 total agents discovered
- 2,578 with wallets (payment-capable)
- 4,204 with status 'new' (never contacted)
- Top sources: x402-bazaar (2,439 w/ wallets), coinbase-cdp-wallet (129 w/ wallets), github (1,278 no wallets), elizaos-registry (241 no wallets)

**Outreach**: POST `/api/a2a-outreach/campaign` — triggers mass outreach to uncontacted agents.
Rate-limited to 1 req/5s, max 10 concurrent. Last campaign: Feb 13 2026 (10 agents, Circle prep).

---

### 6. `gpt_purchase_sessions` - **CHATGPT PAYMENT FUNNEL**
**Purpose**: Track GPT credit purchase flow
**Data Captured**:
- `id`: Session ID (used in /pay/{id} URL)
- `stripe_payment_intent_id`, `user_id`, `package_name`, `amount`, `credits`, `status`, `api_key`

---

### 7. `credits_accounts` - **USER CREDIT BALANCES**
**Purpose**: Track prepaid credit balances
**Current (Mar 2026)**: 14 accounts, ~487 total credits

---

### 8. `api_keys` - **API KEY REGISTRY**
**Purpose**: Track issued API keys

---

### 9. `a2a_interactions` - **A2A + AP2 FUNNEL TRACKER**
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
SELECT protocol, COUNT(*) FILTER (WHERE matched) as matched, COUNT(*) as total
FROM a2a_interactions GROUP BY protocol;
```

---

## Real Revenue Picture (Mar 6 2026)

**All-time USDC: $262.14 across 319 payment intents from 13 distinct wallets**

| Payer | Network | Intents | USDC | Last Payment |
|---|---|---|---|---|
| 0x92ca4cef... | Base | 92 | $79.40 | Dec 4 2025 |
| 0x5837a864... | Base (eip155:8453) | 165 | $124.40 | Feb 18 2026 |
| 0x2f5134f7... | Base + eip155:8453 | 48 | $31.70 | Jan 10 2026 |
| 0x0a2854fb... | Base | 1 | $14.87 | Dec 14 2025 |
| 0x74de5d4f... | Ethereum mainnet | 1 | $9.84 | Feb 18 2026 |
| Hgby7VEo6va... | Solana | 2 | $0.10 | Feb 27 2026 (internal test) |
| Others | Various | 10 | $1.83 | Various |

**Dry spell**: Last confirmed external payment Feb 18 2026. Feb 27 Solana payment = internal test (payer = our own platform wallet).

---

## Known Probe Agents (Not Revenue)

| Agent | Pattern | Paid | Notes |
|---|---|---|---|
| python-httpx/0.28.1 | HEAD to ping/gas-price-oracle/token-metadata, every 15-30min | Never | GCP IPs (34.x/35.x), 8+ IPs rotating |
| node | HEAD to same 3 services | Never | Same GCP IP pool, dual user-agent |
| XGate-HealthCheck/1.0 | OPTIONS preflight | Never (200 is CORS, not payment) | Do NOT count as paid |
| ScoutScore-FidelityCheck/1.0 | OPTIONS preflight | Never | All 200s were CORS |
| EntRoute-Probe/1.0 | POST /x402/ping every ~8h | Never yet | Cloudflare-fronted, POST = payment-aware |
| SERankingBacklinksBot | GET to instant-agent-wallet/transaction-builder | Never | SEO backlink crawler |
| Meta-externalagent/1.1 | GET to multiple services | Never | Facebook content categorization |
| Dexter-Verifier/1.0 | GET /x402/ping | Never (probe only) | Dexter facilitator health check |

---

## Dormant/Underutilized Tables

- `api_usage_tracking`: Per-request billing, implemented in CreditsService
- `api_integration_logs`: Schema exists, no data
- `x402_discovery_metrics`: Only 1 record from Nov 2025
- `payment_intent_tracking`: Stripe PI lifecycle, implemented in stripeRoutes webhook

---

## Recommended Monitoring Queries

### Daily Checks
```sql
-- Real traffic last 24h (CORRECTED)
SELECT COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid
FROM x402_interactions WHERE created_at > NOW() - INTERVAL '24 hours';

-- Any new payment intents?
SELECT * FROM x402_payment_intents WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;

-- New discovery run?
SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT 1;

-- New credit transactions?
SELECT * FROM credit_transactions WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Weekly Analysis
```sql
-- 7-day paid trend (CORRECTED — paid=true only)
SELECT DATE(created_at) as day,
  COUNT(*) FILTER (WHERE request_method != 'OPTIONS') as real_requests,
  COUNT(*) FILTER (WHERE paid = true) as confirmed_paid
FROM x402_interactions WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at) ORDER BY day DESC;

-- Revenue this week
SELECT DATE(created_at) as day, COUNT(*) as intents, ROUND(SUM(amount), 4) as usdc
FROM x402_payment_intents
WHERE status = 'SUCCEEDED' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Distinct external payers (from payment intents — authoritative)
SELECT DISTINCT payer, network FROM x402_payment_intents WHERE status = 'SUCCEEDED';
```

---

*Last Updated: March 6, 2026*
