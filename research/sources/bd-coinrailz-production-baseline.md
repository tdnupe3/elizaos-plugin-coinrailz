# Coin Railz Production Baseline for Grok Bot BD

**Query date:** August 29, 2026  
**Environment:** Production read replica  
**Purpose:** Establish the commercial baseline for evaluating Grok Bot as a channel.

## Revenue ledger: prior 30 days

The authoritative `x402_payment_intents` ledger contained:

- 10 successful non-canary payment intents
- $2.30 USDC in non-canary volume
- 2 distinct non-canary payers
- Most recent non-canary success: August 26, 2026

Query rule:

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'SUCCEEDED') AS succeeded_intents,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 0), 4) AS usdc,
  COUNT(DISTINCT payer) FILTER (WHERE status = 'SUCCEEDED') AS payers,
  MAX(succeeded_at) FILTER (WHERE status = 'SUCCEEDED') AS last_success
FROM x402_payment_intents
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND (is_canary = false OR is_canary IS NULL);
```

## MCP funnel: prior 30 days

The `x402_interactions` table contained:

- 3,544 MCP events from 30 IPs
- 1,576 `mcp-initialize` events
- 1,486 `mcp-tools-list` events
- 481 unsupported or unknown method events
- 0 `mcp-x402-authorized` or `mcp-api-key-authorized` paid deliveries

These events demonstrate discovery and protocol interaction, not commercial conversion.

## Diligence-service payment evidence: prior 90 days

The non-canary successful payment ledger included:

| Service | Successful intents | USDC | Distinct payers |
|---|---:|---:|---:|
| Wallet Risk Analysis | 4 | $2.00 | 1 |
| Portfolio Tracker | 3 | $1.50 | 1 |
| Token Metadata | 5 | $0.50 | 1 |
| Token Approval Manager | 4 | $0.80 | 1 |
| Multi-Chain Gas Oracle | 3 | $0.30 | 1 |

This is evidence that the component services have received external payments. It is not evidence that the combined diligence workflow has demand: most rows came from one payer, and none was attributed to Grok or delivered through MCP.

## Grok attribution: prior 30 days

No `x402_interactions` row matched Grok, xAI, Cursor, or Grok Bot in:

- `user_agent`
- `x402_client_header`
- serialized `metadata`

This is no affirmative evidence of Grok-originated traffic. It is not proof of absence because browser clients can use generic user agents and current MCP tracking does not preserve a reliable client name.

## Other channel signals

- `conversion_funnel_events`: 1,751 `well_known` first contacts, 38 EVM first-call events from 3 wallets, 10 direct trial claims, and 1 API-key first-call event in the prior 30 days.
- `sdk_installs`: 2 browser records, 2 total requests, and 0 conversions in the prior 7 days.
- `a2a_interactions`: 414 events from 34 IPs in the prior 30 days, with 50 matched requests. A2A events are not evidence of Grok demand.

## Interpretation rule

Use `x402_payment_intents` for revenue. Do not treat MCP initialization, tool listing, discovery, trials, challenges, A2A requests, HTTP 200 responses, or canary activity as customer conversion.