---
name: Production vs Development Database
description: executeSql defaults to dev DB (snapshot from last publish). All platform assessments MUST use environment:"production".
---

# Production vs Development Database

## The Rule
ALL analytical queries for platform assessments MUST include `environment: "production"`.
The development database is a **snapshot from the last publish** — it does not update in real-time.

## Why This Matters
Failing to pass `environment: "production"` caused weeks of incorrect assessments:
- Canary appeared broken (dev DB stopped at row 171, prod DB had 202+ entries)
- Revenue appeared stale (dev showed $308 / 562 payments, prod had $309.84 / 596)
- Traffic appeared dead (dev showed 370 hits/2 IPs, prod showed 1,803 hits/64 IPs)

## How to Apply
Every `executeSql` call for health checks, revenue, canary, traffic, or payer analysis:
```javascript
await executeSql({ sqlQuery: `SELECT ...`, environment: "production" });
```

**Why:**
Replit maintains a separate production database for deployed apps. `executeSql` without `environment` defaults to `"development"`, which is a static snapshot. The production app writes to the production DB; only production queries reflect live state.

## What Dev DB IS Useful For
- Schema inspection (table structure, column names)
- Verifying migrations before deploy
- Code-level DB debugging in dev

## What Prod DB IS the Source of Truth For
- Revenue / payment intents / canary payments
- Traffic / x402 interactions
- API keys / credits / accounts
- Any live platform state
