---
name: A2A outreach wave 5 — June 16 2026
description: Wave 5 outreach findings — confirmed live agents, directory targets, error patterns
---

## What was learned

### Confirmed live A2A endpoints (real HTTP 2xx)
- **solved.earth/api/a2a** — Public registry of 3,053 agents with `register_agent` skill. Registration request sent June 16. Probe confirmed: /.well-known/agent.json 200, /api/a2a functional.
- **agent-tools.cloud/a2a** — x402 service discovery directory. Catalog manifest sent June 16. Has `search_x402_services`, `recommend_paid_service` skills.

### How DB endpoint resolution works
`a2aOutreachService.ts` line 1394: priority is `metadata.url` > `metadata.a2aEndpoint` > `agent.url`. Agent card's `url` field (the JSON-RPC endpoint) must be stored in `metadata.url` — NOT in the root `url` column which is the discovery origin URL.

### Error patterns this wave
- **503**: NomadArbiter (syndiode.de + syndiode.com) — both domains offline June 16; retry next wave
- **500**: Modal agents (Code Agent, Data Agent, etc.) — likely strict JSON-RPC schema validation or auth required; deprioritize
- **405**: Clawdia (vercel.app) + XRPL AI Referee — path resolution tried 6 paths, all 405; these may need auth headers
- **404**: The Operator, Nexara — stale endpoints, consider marking unreachable

### DB ordering fix
`getVerifiedAgentsForOutreach()` now has `.orderBy(desc(discoveredAgents.score))` before `.limit()`. Without it, DB returns arbitrary rows and JS sort only applies within that arbitrary pool, causing high-score priority agents to miss the limit window.

### What NOT to do
- Do NOT use `agent.url` as the A2A send target — it's the discovery origin (e.g. `https://solved.earth`), not the RPC endpoint (e.g. `https://solved.earth/api/a2a`)
- Waggle.zone has no A2A endpoint at any standard path — it's a crawler, not an agent; remove from A2A targets

**Why:** solved.earth and agent-tools.cloud are registry/directory agents — getting listed is distribution to thousands of downstream agents, not just one-to-one outreach.
