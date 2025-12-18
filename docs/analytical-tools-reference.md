# Coin Railz Analytical Tools Reference

This document lists all analytical tools and database queries available for monitoring platform activity, revenue, and agent discovery.

## Database Tables for Analytics

### Core Payment Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `x402_payments` | Completed x402 USDC payments | id, agent_id, amount, status, wallet_address, network, created_at |
| `x402_interactions` | All x402 service requests (402 challenges) | service_id, interaction_type, user_agent, ip_address, created_at |
| `x402_payment_intents` | Payment intent ledger for replay protection | status, amount, service_name |
| `payment_intent_tracking` | Fire-and-forget payment intent logs | status, request_id |

### Discovery & Analytics Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `x402_discovery_metrics` | Daily discovery statistics | date, total_payment_requests, unique_wallets, completed_payments, total_revenue |
| `api_usage_tracking` | General API usage logs | client_id, api_endpoint, response_time, price_paid, user_agent |
| `discovered_agents` | Agents found via discovery engine | name, wallet_address, protocol, discovery_source |

## Common Analytics Queries

### 1. Revenue Summary
```sql
SELECT status, COUNT(*) as count, SUM(amount) as total_amount
FROM x402_payments
GROUP BY status
ORDER BY count DESC;
```

### 2. Service Popularity (Last 7 Days)
```sql
SELECT service_id, interaction_type, COUNT(*) as count, MAX(created_at) as last_seen
FROM x402_interactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY service_id, interaction_type
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

### 4. Recent Completed Payments
```sql
SELECT id, agent_id, amount, currency, status, network, wallet_address, created_at
FROM x402_payments 
WHERE status = 'completed' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 5. Discovery Metrics History
```sql
SELECT * FROM x402_discovery_metrics ORDER BY date DESC LIMIT 30;
```

## API Endpoints for Analytics

### Internal Dashboard APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/x402-analytics/dashboard` | GET | Comprehensive x402 analytics dashboard |
| `/api/x402-analytics/funnel` | GET | Payment funnel metrics |
| `/x402/payment-status` | GET | Current payment status and recent payments |
| `/api/monitoring/health` | GET | Platform health metrics |

### Discovery Verification Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/x402.json` | GET | x402 protocol discovery manifest |
| `/.well-known/agent.json` | GET | A2A protocol agent card |
| `/.well-known/agent-card.json` | GET | A2A v0.3 compliant agent card |
| `/mcp/services` | GET | MCP service discovery (41 services) |
| `/x402/payment-docs` | GET | Payment documentation for agents |

## Log Files

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
```

## Key User Agents to Monitor

| User Agent | Description |
|------------|-------------|
| `X402-Discovery-HealthCheck/2.0` | Coinbase Bazaar discovery crawler |
| `zauthx402-agent/1.0` | Zauth x402 autonomous agent |
| `x402-autonomous-agent/1.0` | Generic x402 autonomous agent |
| `python-httpx/*` | Python-based AI agents |
| `curl/*` | Manual testing or simple bots |

## Revenue Tracking

### Total Revenue Query
```sql
SELECT 
  COUNT(*) as total_transactions,
  SUM(amount) as total_revenue_usdc
FROM x402_payments 
WHERE status = 'completed';
```

### Revenue by Service
```sql
SELECT 
  metadata->>'serviceName' as service,
  COUNT(*) as transactions,
  SUM(amount) as revenue
FROM x402_payments 
WHERE status = 'completed'
GROUP BY metadata->>'serviceName'
ORDER BY revenue DESC;
```

## Monitoring Checklist

When asked to "use all analytical tools":
1. Run `refresh_all_logs` to get latest server activity
2. Query `x402_interactions` for recent service requests
3. Query `x402_payments` for revenue data
4. Check unique user agents for new discovery bots
5. Verify discovery endpoints are responding correctly
6. Check for any error patterns in logs

## Quick Health Check Commands

```bash
# Check discovery endpoints (production)
curl -s "https://coinrailz.com/.well-known/x402.json" | jq '.x402.facilitator'
curl -s "https://coinrailz.com/x402/ping" | jq '.facilitatorUrl'
curl -s "https://coinrailz.com/mcp/services" | jq '.services | length'

# Check discovery endpoints (development)
curl -s "http://localhost:5000/.well-known/x402.json" | jq '.x402.facilitator'
```

---
Last Updated: December 18, 2025
