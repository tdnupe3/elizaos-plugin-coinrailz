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
| `event_type` | varchar | Event: challenge-issued, payment-verified, request-complete, api-key-payment |
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
SELECT 
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT wallet_address) as unique_wallets
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
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
SELECT 
  CASE 
    WHEN created_at >= NOW() - INTERVAL '6 hours' THEN 'last_6_hours'
    ELSE 'previous_6_hours'
  END as period,
  COUNT(*) as interactions,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT service_id) as services,
  SUM(CASE WHEN event_type = 'challenge-issued' THEN 1 ELSE 0 END) as challenges,
  SUM(CASE WHEN event_type = 'payment-verified' THEN 1 ELSE 0 END) as payments
FROM x402_interactions
WHERE created_at >= NOW() - INTERVAL '12 hours'
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

When asked to "use all analytical tools":
1. Run `refresh_all_logs` to get latest server activity
2. Query `x402_interactions` for recent service requests
3. Query `x402_payment_intents` for payment data
4. Check unique user agents for new discovery bots
5. Verify discovery endpoints are responding correctly
6. Check for any error patterns in logs
7. Use `/api/x402-analytics/hot-leads` to find potential customers
8. Compare period-over-period metrics for trends

---
Last Updated: December 20, 2025
