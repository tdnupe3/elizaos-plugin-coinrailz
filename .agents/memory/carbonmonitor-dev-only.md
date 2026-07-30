---
name: CarbonMonitor dev-only status
description: CarbonMonitor/0.1 (135.125.152.125) polls the Replit dev server only — it does not appear in production deployment logs as of Jul 30 2026.
---

# CarbonMonitor/0.1 — dev server only, not a production actor (as of Jul 30 2026)

## The rule
CarbonMonitor/0.1 (IP 135.125.152.125) appears in Replit dev workflow logs but is **absent from production deployment logs**. Do not treat it as a production conversion candidate until it appears in production logs.

**Why:** The dev workflow server (*.replit.dev domain) and the production server (coinrailz.com) are separate. Some crawlers and health-checkers probe the Replit dev domain and never reach production. CarbonMonitor is one of these — it polls 7 services every ~5 minutes in dev but has zero production hits as of this writing.

**How to apply:**
- When summarizing active actors, always cross-check whether the UA appears in deployment logs (production) vs. workflow logs (dev only).
- If CarbonMonitor appears in production deployment logs in a future session, it becomes a high-value watch candidate — note the timestamp and escalate to BizDev context.
- BizDev notes about "bundle pricing for 7-service polling" apply only once it is confirmed in production.
