# Coin Railz Analytical Tools Reference

This document lists all analytical tools, database tables, API endpoints, and queries available for monitoring platform activity, revenue, and agent discovery.

## Database Tables for Analytics

### Core Payment & Interaction Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `x402_payments` | Completed x402 USDC/USDT payments | id, agent_id, amount, status, wallet_address, network, created_at |
| `x402_interactions` | All x402 service requests (402 challenges, payments, completions) | service_id, event_type, interaction_type, user_agent, ip_address, wallet_address, offer_tracking_id, retry_count, latency_ms, created_at |
| `x402_payment_intents` | Payment intent ledger for replay protection | status, amount, service_name, tx_hash, created_at |
| `payment_intent_tracking` | Fire-and-forget payment intent logs | status, request_id |

### Discovery & Analytics Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `x402_discovery_metrics` | Daily discovery statistics | date, total_payment_requests, unique_wallets, completed_payments, total_revenue |
| `api_usage_tracking` | General API usage logs | client_id, api_endpoint, response_time, price_paid, user_agent |
| `discovered_agents` | Agents found via discovery engine | name, wallet_address, protocol, discovery_source, discovered_at |
| `discovery_runs` | Discovery engine run logs | source, status, agents_found |
| `microservice_metrics` | Service-level performance metrics | service_id, response_time, success_rate |

### SDK Transaction Logging (NEW - Jan 2026)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sdk_transactions` | All SDK payment events from @coinrailz/agent-payments NPM & coinrailz Python | transaction_id, api_key_hash, transaction_type, status, amount, fee, net_amount, to_address, network, blockchain_tx_hash, created_at |

**SDK Transaction Types:**
- `send` - Direct USDC payment via SDK
- `invoice` - Invoice creation for payment collection
- `balance` - Balance check request

**Example SDK Analytics Queries:**
```sql
-- Daily SDK transaction volume
SELECT DATE(created_at) as date, 
       COUNT(*) as transactions,
       SUM(CAST(amount AS NUMERIC)) as total_volume,
       SUM(CAST(fee AS NUMERIC)) as total_fees
FROM sdk_transactions 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Top SDK users by volume
SELECT api_key_hash, 
       COUNT(*) as tx_count,
       SUM(CAST(amount AS NUMERIC)) as total_volume
FROM sdk_transactions
GROUP BY api_key_hash
ORDER BY total_volume DESC LIMIT 10;
```

### Endpoint Hit Tracking (NEW - Jan 2026)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `endpoint_hits` | All x402/IoT endpoint visits from outreach campaigns | endpoint, endpoint_type, resource_id, ip_hash, user_agent, wallet_address, method, status_code, response_time_ms, campaign_id, tracking_id, created_at |

**Endpoint Hit Tracking** captures all visits to x402 and IoT endpoints, specifically designed to track responses from the on-chain outreach campaign (68 unique wallets contacted).

**Example Hit Tracking Queries:**
```sql
-- Daily hit summary (last 7 days)
SELECT DATE(created_at) as date,
       COUNT(*) as total_hits,
       COUNT(DISTINCT ip_hash) as unique_visitors,
       COUNT(DISTINCT user_agent) as unique_agents
FROM endpoint_hits
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- AI agent identification (look for GPT, Claude, Eliza in user agents)
SELECT user_agent, COUNT(*) as hits, MAX(created_at) as last_seen
FROM endpoint_hits
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_agent
ORDER BY hits DESC LIMIT 20;

-- Track which endpoints are getting hit
SELECT endpoint, endpoint_type, COUNT(*) as hits,
       AVG(response_time_ms) as avg_response_ms
FROM endpoint_hits
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint, endpoint_type
ORDER BY hits DESC;

-- Campaign attribution (if tracking_id present)
SELECT tracking_id, COUNT(*) as hits, COUNT(DISTINCT wallet_address) as unique_wallets
FROM endpoint_hits
WHERE tracking_id IS NOT NULL
GROUP BY tracking_id;
```

### Additional Tracking Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `api_integration_logs` | External API integration activity | |
| `customer_download_logs` | Customer download tracking | |
| `delivery_security_logs` | Security event logging | |
| `outreach_logs` | Outreach campaign tracking | |
| `solana_wallet_analytics` | Solana-specific wallet analytics | |
| `free_credits_claim_log` | Free credit claims tracking | |
| `pending_crypto_payment_requests` | Pending payment requests | |

## x402_interactions Table (Primary Analytics Source)

This is the most important table for tracking x402 activity. Full schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key |
| `service_id` | varchar(100) | Service identifier (e.g., 'ping', 'trade-signals') |
| `wallet_address` | varchar(255) | Paying wallet address (when available) |
| `ip_address` | varchar(50) | Visitor IP address |
| `user_agent` | text | Client user agent string |
| `request_path` | varchar(500) | Full request path |
| `request_method` | varchar(10) | HTTP method |
| `response_status` | integer | HTTP response status code |
| `paid` | boolean | Whether payment was made |
| `amount` | numeric(20,6) | Payment amount |
| `interaction_type` | varchar(20) | Type: view, attempt, payment, error |
| `event_type` | varchar | Event: `challenge-issued`, `payment-verified`, `authorized`, `solana-payment`, `request-complete`, `landing-view`, `api-key-payment`, `error` |
| `service_name` | varchar | Human-readable service name |
| `x402_client_header` | varchar | Client identification header |
| `referer` | varchar | Traffic source |
| `challenge_payload` | jsonb | Full 402 challenge payload |
| `latency_ms` | integer | Response time in milliseconds |
| `retry_count` | integer | Number of retry attempts |
| `payment_received` | boolean | Whether payment was received |
| `payment_amount` | numeric(18,6) | Payment amount received |
| `error_message` | text | Error details if any |
| `metadata` | jsonb | Additional metadata |
| `offer_tracking_id` | varchar | Outreach attribution tracking ID |
| `created_at` | timestamp | Record creation time |

## API Endpoints for Analytics

### x402 Analytics Routes (`/api/x402-analytics`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/x402-analytics/interactions/:wallet` | GET | Get interaction history for a specific wallet |
| `/api/x402-analytics/service/:serviceId` | GET | Get analytics for a specific service (query: ?days=30) |
| `/api/x402-analytics/hot-leads` | GET | Get agents with multiple interactions but no purchases (query: ?minInteractions=3) |
| `/api/x402-analytics/attribution/:wallet` | GET | Get outreach attribution for a wallet |

### General Analytics Routes (`/api/analytics`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/admin-stats` | GET | Comprehensive platform analytics (requires X-Admin-Key header) |
| `/api/analytics/revenue-breakdown` | GET | Revenue breakdown by currency and status |

### Discovery Verification Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/x402.json` | GET | x402 protocol discovery manifest (35 endpoints) |
| `/.well-known/agent.json` | GET | A2A protocol agent card |
| `/.well-known/agent-card.json` | GET | A2A v0.3 compliant agent card (35 skills) |
| `/.well-known/agent-instructions.json` | GET | Machine-readable onboarding guide for AI agents (wallet setup, payment methods, quickstart) |
| `/api/discovery/resources` | GET | Bazaar catalog (41 services) |
| `/mcp/services` | GET | MCP service discovery |
| `/x402/catalog` | GET | Full x402 service catalog |
| `/x402/payment-docs` | GET | Payment documentation for agents |

### Monitoring Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/health` | GET | Platform health metrics |
| `/x402/payment-status` | GET | Current payment status and recent payments |

## Middleware & Tracking Services

### x402TrackingMiddleware
Location: `server/middleware/x402TrackingMiddleware.ts`

Features:
- Fingerprints visitors by IP + user-agent + service
- Tracks retry behavior (agents that hit 402, then return with payment)
- Records `offer_tracking_id` from URL parameters for attribution
- Logs all challenge/payment/completion events
- Measures latency for each request

### x402InteractionTracker Service
Location: `server/services/x402InteractionTracker.ts`

Methods:
- `getAgentInteractionHistory(wallet)` - Get all interactions for a wallet
- `getServiceAnalytics(serviceId, days)` - Get service performance metrics
- `getHotLeads(minInteractions, excludePaid)` - Find potential customers
- `getOutreachAttribution(wallet)` - Get conversion attribution

### usageAnalyticsMiddleware
Location: `server/middleware/usageAnalyticsMiddleware.ts`

Features:
- General API usage tracking
- SDK detection
- Usage statistics aggregation

## Common Analytics Queries

### 1. Revenue Summary (Payment Intents)
```sql
SELECT status, COUNT(*) as count, SUM(amount) as total_amount
FROM x402_payment_intents
GROUP BY status
ORDER BY count DESC;
```

### 2. Service Popularity (Last 7 Days)
```sql
SELECT service_id, event_type, COUNT(*) as count, MAX(created_at) as last_seen
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY service_id, event_type
ORDER BY count DESC
LIMIT 20;
```

### 3. Discovery Bot Activity
```sql
SELECT DISTINCT 
  SUBSTRING(user_agent, 1, 60) as agent,
  COUNT(*) as hits,
  MAX(created_at) as last_seen
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY SUBSTRING(user_agent, 1, 60)
ORDER BY last_seen DESC
LIMIT 15;
```

### 4. Unique IP Analysis
```sql
SELECT 
  ip_address,
  COUNT(*) as hits,
  COUNT(DISTINCT service_id) as services_accessed,
  MAX(created_at) as last_seen
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY hits DESC;
```

### 5. External vs Internal Traffic
```sql
SELECT 
  CASE 
    WHEN ip_address IN ('127.0.0.1', '10.81.5.166') THEN 'internal'
    ELSE 'external'
  END as traffic_type,
  COUNT(*) as requests,
  COUNT(DISTINCT ip_address) as unique_ips
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1;
```

### 6. Conversion Funnel Analysis
```sql
-- PAYMENT FUNNEL ONLY — exclude landing-view (GET page views) and internal traffic
SELECT 
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT wallet_address) as unique_wallets
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type != 'landing-view'          -- exclude SEO/browser page views
  AND ip_address NOT LIKE '10.%'            -- exclude internal
  AND ip_address != '127.0.0.1'
  AND request_method != 'OPTIONS'
GROUP BY event_type
ORDER BY count DESC;

-- LANDING PAGE VIEWS ONLY (separate signal — browser/SEO traffic to GET endpoints)
SELECT
  service_id,
  COUNT(*) as page_views,
  COUNT(DISTINCT ip_address) as unique_visitors
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type = 'landing-view'
GROUP BY service_id
ORDER BY page_views DESC;
```

### 7. Offer Tracking Attribution
```sql
SELECT 
  offer_tracking_id,
  COUNT(*) as interactions,
  SUM(CASE WHEN paid THEN 1 ELSE 0 END) as conversions,
  SUM(payment_amount) as revenue
FROM x402_interactions
WHERE offer_tracking_id IS NOT NULL
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY offer_tracking_id
ORDER BY revenue DESC NULLS LAST;
```

### 8. Client Type Breakdown
```sql
SELECT 
  CASE 
    WHEN user_agent ILIKE '%curl%' THEN 'curl'
    WHEN user_agent ILIKE '%python%' THEN 'python-requests'
    WHEN user_agent ILIKE '%node%' OR user_agent ILIKE '%axios%' THEN 'nodejs'
    WHEN user_agent ILIKE '%x402%' THEN 'x402-client'
    WHEN user_agent ILIKE '%Go-http%' THEN 'golang'
    WHEN user_agent ILIKE '%bot%' OR user_agent ILIKE '%crawler%' THEN 'bot/crawler'
    WHEN user_agent ILIKE '%mozilla%' OR user_agent ILIKE '%chrome%' THEN 'browser'
    ELSE 'other'
  END as client_type,
  COUNT(*) as requests,
  COUNT(DISTINCT ip_address) as unique_ips
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY requests DESC;
```

### 9. Period-over-Period Comparison
```sql
-- Exclude landing-view, OPTIONS, and internal IPs for clean payment-funnel comparison
SELECT 
  CASE 
    WHEN created_at >= NOW() - INTERVAL '6 hours' THEN 'last_6_hours'
    ELSE 'previous_6_hours'
  END as period,
  COUNT(*) as interactions,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT service_id) as services,
  SUM(CASE WHEN event_type = 'challenge-issued' THEN 1 ELSE 0 END) as challenges,
  SUM(CASE WHEN event_type IN ('payment-verified','authorized','solana-payment') THEN 1 ELSE 0 END) as payments,
  SUM(CASE WHEN event_type = 'landing-view' THEN 1 ELSE 0 END) as page_views
FROM x402_interactions
WHERE created_at >= NOW() - INTERVAL '12 hours'
  AND event_type != 'landing-view'          -- keep landing-view out of the main funnel row count
  AND ip_address NOT LIKE '10.%'
  AND ip_address != '127.0.0.1'
  AND request_method != 'OPTIONS'
GROUP BY 1
ORDER BY period DESC;
```

### 10. New Agents Discovered
```sql
SELECT 
  source,
  COUNT(*) as new_agents,
  MAX(discovered_at) as latest
FROM discovered_agents
WHERE discovered_at >= NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY new_agents DESC;
```

## Log Files & Patterns

### Server Logs
- `/tmp/logs/Start_application_*.log` - Main server activity

### Key Log Patterns to Grep
```bash
# Discovery bot activity
grep "X402-Discovery" /tmp/logs/Start_application_*.log

# Payment attempts
grep "x402 Funnel" /tmp/logs/Start_application_*.log

# Facilitator URL verification
grep "facilitatorUrl" /tmp/logs/Start_application_*.log

# 402 challenge responses
grep "challenge-issued" /tmp/logs/Start_application_*.log

# Offer tracking
grep "TRACKING MW ENTRY" /tmp/logs/Start_application_*.log

# Conversions
grep "CONVERSION" /tmp/logs/Start_application_*.log
```

## Key User Agents to Monitor

| User Agent | Description |
|------------|-------------|
| `X402-Discovery-HealthCheck/2.0` | Coinbase Bazaar discovery crawler |
| `zauthx402-agent/1.0` | Zauth x402 autonomous agent |
| `x402-autonomous-agent/1.0` | Generic x402 autonomous agent |
| `python-httpx/*` | Python-based AI agents |
| `node-fetch/*` | Node.js-based AI agents |
| `axios/*` | JavaScript HTTP clients |
| `curl/*` | Manual testing or simple bots |

## Offer Tracking for Attribution

To track conversions from outreach campaigns:

1. **Add tracking ID to links:**
   ```
   https://coinrailz.com/x402/ping?offer_tracking=CAMPAIGN_2024_01
   ```

2. **System automatically records:**
   - All interactions with that tracking ID
   - Conversions (successful payments)
   - Revenue attributed to each campaign

3. **Query attribution:**
   ```bash
   curl "https://coinrailz.com/api/x402-analytics/attribution/0xWALLET_ADDRESS"
   ```

## Quick Health Check Commands

```bash
# Check discovery endpoints (production)
curl -s "https://coinrailz.com/.well-known/x402.json" | jq '.x402.facilitator'
curl -s "https://coinrailz.com/x402/ping" | jq '{x402Version, facilitatorUrl}'
curl -s "https://coinrailz.com/api/discovery/resources" | jq '.total'

# Check hot leads
curl -s "https://coinrailz.com/api/x402-analytics/hot-leads?minInteractions=2"

# Check service analytics
curl -s "https://coinrailz.com/api/x402-analytics/service/ping?days=7"
```

## Monitoring Checklist

When asked to "use all analytical tools" or perform daily checks:
1. Run `refresh_all_logs` to get latest server activity
2. Query `x402_interactions` for recent service requests
3. Query `x402_payment_intents` for payment data
4. **Query `endpoint_hits` for outreach campaign responses**
5. **Query `endpoint_hits` WHERE endpoint_type='discovery' for manifest fetches** (NEW - Jan 31 2026)
6. **Query `endpoint_hits` WHERE endpoint_type='a2a' for A2A interaction data** (NEW - Mar 1 2026)
7. Check unique user agents for new discovery bots or AI agents
8. Verify discovery endpoints are responding correctly
9. Check for any error patterns in logs
10. Use `/api/x402-analytics/hot-leads` to find potential customers
11. Compare period-over-period metrics for trends

### Important Metric Clarifications

- **`event_type = 'landing-view'`** (added Mar 10 2026): Logged when a GET request to an x402 service endpoint returns a non-402, non-error response (typically 200 HTML). This covers browser visits, Googlebot crawls, and SEO page views. These are **never payment events** — the x402 payment flow is POST-only. Always exclude `event_type = 'landing-view'` from conversion funnel analysis. Query page views separately if needed.

- **`event_type = 'request-complete'`**: A POST that completed successfully without payment verification (e.g., a service returning 200 without an `x-payment` header being processed). Distinct from `landing-view` (which is GET). Both are non-revenue events.

- **first-call endpoint GET vs POST**: `/x402/first-call` has both a GET handler (returns HTML landing page → `landing-view`) and a POST handler (payment flow → `challenge-issued` → `payment-verified`). Always filter by `request_method = 'POST'` when analyzing first-call payment funnel. A `landing-view` on first-call is Googlebot or a browser visiting the SEO page.

- **`retry_count` in `x402_interactions`** = number of times the **same IP fingerprint** returned to the **same endpoint**. It is NOT a payment retry counter. High retry_count = a bot probing us repeatedly on a cron schedule, not a payment integration failing. Evidence: 775 retry events in 24h had paid=FALSE, error_message=NULL, payment_amount=NULL across all of them — zero payment was ever attempted on any retry event (confirmed Mar 1 2026).

- **GCP IP ranges 34.x.x.x / 35.x.x.x** running python-httpx on ~15-30 min cron schedules are catalog monitoring bots, not paying agents in an evaluation loop.

### Quick Hit Tracking Check (Run Daily)
```sql
-- Check for new AI agent visits from outreach campaign
SELECT 
  COUNT(*) as total_hits,
  COUNT(DISTINCT ip_hash) as unique_visitors,
  COUNT(DISTINCT user_agent) as unique_agents,
  COUNT(DISTINCT wallet_address) FILTER (WHERE wallet_address IS NOT NULL) as wallets_seen
FROM endpoint_hits
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Identify AI agent user agents (key targets)
SELECT user_agent, COUNT(*) as hits
FROM endpoint_hits
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (user_agent ILIKE '%gpt%' OR user_agent ILIKE '%claude%' 
       OR user_agent ILIKE '%eliza%' OR user_agent ILIKE '%agent%'
       OR user_agent ILIKE '%bot%' OR user_agent ILIKE '%ai%')
GROUP BY user_agent ORDER BY hits DESC;
```

### Discovery Manifest Tracking (NEW - Jan 31 2026)
```sql
-- Check how often agents are fetching discovery manifests
SELECT endpoint, resource_id, COUNT(*) as hits, 
       COUNT(DISTINCT ip_hash) as unique_visitors,
       MAX(created_at) as last_fetch
FROM endpoint_hits
WHERE endpoint_type = 'discovery'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint, resource_id
ORDER BY hits DESC;

-- Breakdown by manifest type
SELECT resource_id, COUNT(*) as fetches
FROM endpoint_hits
WHERE endpoint_type = 'discovery'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY resource_id;
-- Expected resource_ids: agent.json, x402.json, agent-card.json, agent-instructions.json
```

### A2A Interaction Tracking (NEW - Mar 1 2026)

The `/a2a/v1` endpoints now write to `endpoint_hits` with `endpoint_type = 'a2a'`. This covers:

| `resource_id` value | Meaning |
|---------------------|---------|
| `a2a-catalog` | GET /a2a/v1 — agent discovery summary fetched |
| `gas-price-oracle` (or any service id) | POST /a2a/v1/message/send — query matched a specific service |
| `a2a-no-match` | POST /a2a/v1/message/send — no keyword match found |
| `a2a-no-text` | POST /a2a/v1/message/send — request body had no text |

```sql
-- A2A interaction overview (last 24h)
SELECT resource_id, method, COUNT(*) as hits,
       COUNT(DISTINCT ip_hash) as unique_callers,
       ROUND(AVG(response_time_ms), 1) as avg_ms,
       MAX(created_at) as last_seen
FROM endpoint_hits
WHERE endpoint_type = 'a2a'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY resource_id, method
ORDER BY hits DESC;

-- A2A match rate (how often agents find a matching service)
SELECT 
  COUNT(*) FILTER (WHERE resource_id NOT IN ('a2a-catalog','a2a-no-match','a2a-no-text')) as matched,
  COUNT(*) FILTER (WHERE resource_id = 'a2a-no-match') as no_match,
  COUNT(*) FILTER (WHERE resource_id = 'a2a-catalog') as catalog_views,
  ROUND(100.0 * COUNT(*) FILTER (WHERE resource_id NOT IN ('a2a-catalog','a2a-no-match','a2a-no-text')) /
    NULLIF(COUNT(*) FILTER (WHERE method = 'POST'), 0), 1) as match_pct
FROM endpoint_hits
WHERE endpoint_type = 'a2a'
  AND created_at >= NOW() - INTERVAL '7 days';

-- Which services agents are asking about via A2A
SELECT resource_id as service_requested, COUNT(*) as times_asked,
       COUNT(DISTINCT ip_hash) as unique_agents
FROM endpoint_hits
WHERE endpoint_type = 'a2a'
  AND method = 'POST'
  AND resource_id NOT IN ('a2a-no-match','a2a-no-text')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY resource_id
ORDER BY times_asked DESC;

-- A2A user agent breakdown
SELECT SUBSTRING(user_agent, 1, 80) as agent, COUNT(*) as hits
FROM endpoint_hits
WHERE endpoint_type = 'a2a'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY SUBSTRING(user_agent, 1, 80)
ORDER BY hits DESC;
```

## Solana Payment Tracking (NEW - Feb 26, 2026)

Solana ExactSvmScheme payments are tracked in `x402_interactions` with dedicated event types. Unlike EVM payments, they do **not** write to `x402_payment_intents` (gap — see architect recommendation).

### Solana-Specific Event Types
| event_type | Meaning |
|------------|---------|
| `solana-payment` | On-chain Solana tx submitted and found via Helius RPC |
| `authorized` | Solana payment verified — balance increase confirmed at seller ATA |
| `error` (pre-Feb 26) | Broken: ATA parameter order bug caused all verifications to fail |

### Solana Payment Analytics Queries
```sql
-- Solana payments confirmed in last 24h
SELECT service_id, event_type, 
       CAST(payment_amount AS NUMERIC) as amount_usdc,
       created_at
FROM x402_interactions
WHERE event_type IN ('solana-payment', 'authorized')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Solana payment conversion rate
SELECT 
  SUM(CASE WHEN event_type = 'challenge-issued' THEN 1 ELSE 0 END) as challenges,
  SUM(CASE WHEN event_type = 'solana-payment' THEN 1 ELSE 0 END) as solana_payments,
  SUM(CASE WHEN event_type = 'authorized' THEN 1 ELSE 0 END) as authorized,
  ROUND(100.0 * SUM(CASE WHEN event_type = 'authorized' THEN 1 ELSE 0 END) /
        NULLIF(SUM(CASE WHEN event_type = 'challenge-issued' THEN 1 ELSE 0 END), 0), 2) as conversion_pct
FROM x402_interactions
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### Known Seller Wallets (Solana)
| Wallet | Role | USDC ATA |
|--------|------|----------|
| `BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8` | MetaMask/Dexter seller (receiver) | `CEWim2A8q33kZfyzzqJky37nNt83dSKFdqcknP15h8jF` |
| `Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k` | Phantom (buyer/platform signing wallet) | — |

### Helius RPC
Production uses `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` for `getParsedTransaction`. Public RPC rate-limits at 429. `HELIUS_API_KEY` must be set (len=36).

### Critical Fix (Feb 26, 2026)
`getAssociatedTokenAddressSync(mint, owner, ...)` — mint is first, owner is second. Previous code had these swapped causing 100% Solana verification failures. Fixed in `getAllPlatformTokenAccounts()` in `server/middleware/paymentOrchestrator.ts`.

---
## Discovery Bot Glossary (Updated Mar 1, 2026)

New bots observed — add to monitoring:

| User Agent | Description | First Seen |
|------------|-------------|------------|
| `agentcash-discovery-registry-audit/0.1` | AgentCash discovery registry auditor — indexes our agent card + x402 manifest | Mar 1, 2026 |
| `agentcash-probe-audit/0.1` | AgentCash probe/audit crawler — appeared after A2A card republish | Mar 1, 2026 |
| `node` (bare) | Bespoke Node.js crawler using core http/https (no library UA). More sophisticated than node-fetch. 654 hits in first observed window. | Mar 1, 2026 |
| `Anthill` | Unknown — 1 hit observed. May return. Not in any known crawler registry. | Mar 1, 2026 |
| `ScoutScore-HealthCheck/1.0` | Unknown indexer/scout service probing endpoints | Feb 27, 2026 |
| `ScoutScore-FidelityCheck/1.0` | ScoutScore fidelity verification crawler | Feb 27, 2026 |
| `EntRoute-Probe/1.0` | Unknown routing/probe agent | Feb 27, 2026 |
| `XGate-HealthCheck/1.0` | Unknown gateway health checker — hits catalog, 3+ IPs. Monitor for cadence/depth changes. | Feb 26, 2026 |
| `meta-externalagent/1.1` | Facebook/Meta web crawler | Feb 27, 2026 |
| `X402-Discovery-HealthCheck/2.0` | Coinbase Bazaar discovery crawler | Jan 2026 |
| `Googlebot (mobile UA)` | Google crawler confirming `/x402/first-call` GET landing page — generates `landing-view` events, not payment events. Confirmed crawling Mar 10 2026 after Google Search Console indexing request. IP: 66.249.x.x | Mar 10, 2026 |
| Chinese mobile UAs (43.x, 101.x, 150.x) | Browser-style exploration of `/x402/`, `/x402/catalog`, `/x402/wallet/free` — different ASN from GCP cron bots, non-cron behavior. Weak discovery signal. Generates `landing-view` events. | Mar 10, 2026 |

### Discovery Manifest Volume (endpoint_hits)
At scale, check `/.well-known/x402`, `/.well-known/agent.json`, `/.well-known/agent-card.json`. In 24h post-republish (Feb 26-27): 532 fetches from 428 unique visitors to the x402 manifest, 165 fetches of agent.json from 162 unique visitors. This is top-of-funnel traction signal.

---
Last Updated: March 10, 2026
