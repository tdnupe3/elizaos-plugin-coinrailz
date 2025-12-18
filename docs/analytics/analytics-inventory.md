# Coin Railz Analytics Inventory

> Internal reference for all analytics tables, metrics, and monitoring capabilities.

## Active Analytics Tables

### 1. `x402_interactions` - **PRIMARY TRAFFIC TRACKER**
**Purpose**: Logs every request to x402 microservice endpoints
**Data Captured**:
- `service_id`: Which service was requested
- `user_agent`: Bot/agent identification
- `ip_address`: Request origin
- `response_status`: HTTP response (200, 402, etc.)
- `created_at`: Timestamp

**Use Cases**:
- Traffic analysis by date/agent/service
- Identify discovery bots vs real customers
- Monitor service popularity

**Query Examples**:
```sql
-- Daily traffic summary
SELECT DATE(created_at), COUNT(*) FROM x402_interactions GROUP BY 1 ORDER BY 1 DESC;

-- Top user agents
SELECT user_agent, COUNT(*) FROM x402_interactions GROUP BY 1 ORDER BY 2 DESC;

-- Service popularity
SELECT service_id, COUNT(*) FROM x402_interactions GROUP BY 1 ORDER BY 2 DESC;
```

---

### 2. `microservice_metrics` - **SERVICE-LEVEL STATS**
**Purpose**: Aggregated metrics per service
**Data Captured**:
- `service_id`: Service identifier
- `date`: Aggregation date
- `total_requests`: Request count
- `successful_requests`: 200 responses
- `failed_requests`: Error responses
- `total_revenue`: Revenue generated
- `avg_response_time`: Performance metric

**Use Cases**:
- Service health monitoring
- Revenue tracking per service
- Performance optimization

---

### 3. `discovery_runs` - **AGENT DISCOVERY TRACKING**
**Purpose**: Logs scheduled discovery runs that find new agents
**Data Captured**:
- `run_type`: scheduled/manual
- `status`: completed/failed/running
- `total_raw`: Raw agents found
- `total_unique`: Deduplicated count
- `new_agents`: New discoveries
- `updated_agents`: Existing agent updates
- `duration_ms`: Run performance

**Current Performance** (Last 7 days):
- Runs twice daily (6am/6pm, 12am/12pm)
- ~181 agents crawled per run
- 5-35 new agents per run
- 150-170 updates per run

---

### 4. `discovered_agents` - **AGENT DATABASE**
**Purpose**: Master list of discovered AI agents
**Data Captured**:
- `url`: Agent endpoint URL
- `source`: Discovery source
- `wallet`: Payment wallet if known
- `status`: Agent status
- `capabilities`: What the agent can do
- `xmtp_address`: XMTP messaging capability

**Stats**: 1,092 agents discovered (5 with wallets)

---

### 5. `gpt_purchase_sessions` - **CHATGPT PAYMENT FUNNEL**
**Purpose**: Track GPT credit purchase flow
**Data Captured**:
- `id`: Session ID (used in /pay/{id} URL)
- `stripe_payment_intent_id`: Stripe reference
- `user_id`: GPT user identifier
- `package_name`: starter/pro/enterprise
- `amount`: USD amount
- `credits`: Credits purchased
- `status`: pending/completed/expired
- `api_key`: Generated API key

**Current Funnel**:
- 20 total sessions
- 3 completed (15% conversion)
- 17 pending (exploration)
- 1 expired

---

### 6. `credits_accounts` - **USER CREDIT BALANCES**
**Purpose**: Track prepaid credit balances
**Current**: 3 accounts, 76 total credits

---

### 7. `api_keys` - **API KEY REGISTRY**
**Purpose**: Track issued API keys
**Data**: 2 keys generated (Dec 18)

---

## Dormant/Underutilized Tables

### `api_usage_tracking` - **EMPTY**
**Intended Purpose**: Per-request API usage billing
**Status**: Schema exists, no data
**Recommendation**: Implement tracking in API middleware

### `api_integration_logs` - **EMPTY**
**Intended Purpose**: External API call logging
**Status**: Schema exists, no data
**Recommendation**: Add logging for outbound API calls

### `x402_discovery_metrics` - **STALE**
**Status**: Only 1 record from Nov 1, 2025
**Recommendation**: Add daily aggregation job

### `payment_intent_tracking` - **EMPTY**
**Intended Purpose**: Stripe payment intent lifecycle
**Status**: Schema exists, no data
**Recommendation**: Populate from Stripe webhooks

---

## Analytics Gaps Identified

### 1. External Traffic Attribution
**Gap**: Can't distinguish x402scan, Coinbase Bazaar, or other registry traffic
**Solution**: Parse user-agent strings more granularly; add referrer tracking

### 2. Per-User API Usage
**Gap**: No tracking of API key usage per request
**Solution**: Implement middleware to log api_usage_tracking

### 3. Stripe Reconciliation
**Gap**: No automated payment-to-credit reconciliation logging
**Solution**: Webhook logging to payment_intent_tracking

### 4. Crawler Fingerprinting
**Gap**: Many requests from internal IPs (10.81.x.x) - may be Replit infrastructure
**Solution**: Add X-Forwarded-For parsing for real client IP

### 5. Conversion Funnel Analytics
**Gap**: No cohort analysis of discovery→trial→payment
**Solution**: Add session-based tracking across touchpoints

---

## Key Insights from Current Data

### Traffic Composition (Last 7 Days)
- **~80% internal IPs** (10.81.x.x, 127.0.0.1) - Replit infrastructure
- **~20% external** - Real discovery bots and agents
- **Top external visitors**: 34.21.25.81 (105 req), 34.48.208.54 (71 req)

### Agent User-Agents
| Agent | Total Requests | Last Seen | Status |
|-------|---------------|-----------|--------|
| python-httpx/0.28.1 | 2,195 | Dec 15 | Evaluation complete |
| zauthx402-agent/1.0 | 1,020 | Dec 16 | Evaluation complete |
| curl | 287 | Dec 17 | Active (testing) |
| GPTBot (OpenAI) | 61 | Dec 17 | NEW - Indexing |
| X402-Discovery-HealthCheck | 36 | Dec 18 | Active |

### No Traffic From (Yet)
- x402scan crawler
- Coinbase Bazaar indexer
- AgentKit discovery

---

## Recommended Monitoring Dashboard

### Daily Checks
1. `SELECT COUNT(*) FROM x402_interactions WHERE created_at > NOW() - INTERVAL '24 hours'`
2. Check `discovery_runs` for failed runs
3. Review `gpt_purchase_sessions` for new completions

### Weekly Analysis
1. User-agent trends
2. Service popularity shifts
3. Conversion funnel metrics
4. New agent discoveries

### Alerts to Implement
- Discovery run failures
- Zero external traffic days
- Payment webhook failures
- High error rate on services

---

## Quick Reference Queries

```sql
-- Today's traffic
SELECT COUNT(*) FROM x402_interactions WHERE DATE(created_at) = CURRENT_DATE;

-- Pending GPT payments
SELECT COUNT(*) FROM gpt_purchase_sessions WHERE status = 'pending';

-- Latest discovery run
SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT 1;

-- Service revenue
SELECT service_id, SUM(total_revenue) FROM microservice_metrics GROUP BY 1 ORDER BY 2 DESC;

-- External IP traffic only
SELECT * FROM x402_interactions 
WHERE ip_address NOT LIKE '10.%' AND ip_address != '127.0.0.1'
ORDER BY created_at DESC LIMIT 50;
```

---

*Last Updated: December 18, 2025*
