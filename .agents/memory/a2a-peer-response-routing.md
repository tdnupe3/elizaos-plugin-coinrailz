---
name: A2A peer response routing
description: Where inbound A2A replies from outreach targets (CarryLens, MetaVision, etc.) appear, and the campaign log table gap.
---

## Rule

Inbound A2A replies to Coin Railz outreach messages arrive at:
- **Route:** `POST /api/a2a/responses` (defined in `server/routes/a2aOutreachRoutes.ts`)
- **Handler:** `a2aOutreachService.processResponse()`
  - Matches by `taskId` → updates `a2a_outreach_logs` row
  - Sets `responseContent`, `taskStatus`, `responseIntent` (`interested` / `needs_info` / `declined`)
  - If `interested` → increments `successCount` in `discovered_agents`

## Known Traceability Gap

`a2a_outreach_logs` does **NOT** capture manual campaign sends fired via `POST /api/a2a-protocol/outreach/campaign`. Direct DB queries for campaign records return empty even after confirmed sends (19/50 confirmed via API response object). The API stats endpoint (`/api/a2a-protocol/outreach/stats?campaignId=...`) is the only reliable audit source for delivery counts.

**Why:** The manual campaign endpoint uses a separate code path from the automated orchestrator and appears to track in-memory or via a different table, not `a2a_outreach_logs`. Needs investigation before campaign effectiveness can be fully audited from DB.

## How to apply

- To check if CarryLens or MetaVision responded: query `a2a_outreach_logs` by `agent_url` + `responded_at IS NOT NULL`
- To audit campaign delivery count: use the stats API endpoint, not a DB query
- To see response intent classification: check `task_status` column (`interested`, `declined`, `needs_info`)
