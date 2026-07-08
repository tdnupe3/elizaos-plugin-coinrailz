---
name: Agent Plane — read-only resolver, submit via Smithery
description: Agent Plane (agentplane.doppelops.com) cannot receive inbound A2A messages; listing requires Smithery or another of their 16 source feeds.
---

## What Agent Plane Is
- Trust resolver + agent directory, 49,835 endpoints indexed across 16 source feeds
- Only 47 "payment_declared" endpoints in entire index; only 15 "payment_observed"
- Coin Railz is almost certainly one of the 15 payment_observed (verified on-chain history)
- DoppelOps GitHub org exists but has no public repos or public contact

## Why Direct A2A Outreach Fails
- Their A2A endpoint (`https://agentplane.doppelops.com/a2a`) is QUERY-ONLY
- Always returns `error -32602: "agentplane.discover requires query text or metadata.query"`
- It exposes `agentplane.discover` and `agentplane.endpoint` MCP/A2A skills for searching, not accepting submissions
- MCP endpoint at `https://agentplane.doppelops.com/mcp` has same behavior

## How to Get Listed
Coin Railz must appear in one of their 16 source feeds. The accessible ones:
1. **Smithery** (`smithery.ai`) — submit at smithery.ai/new; Agent Plane auto-ingests from Smithery
2. **a2aregistry.org** — 135 A2A agents listed, free registration
3. **www.a2a-registry.org** — community-driven, GoDaddy ANS-backed
4. **mcp.so** — simple form, 20,000+ servers

## What Was Done
- `buildServerCard()` in `server/routes/wellKnownRoutes.ts` updated to Smithery-compatible format:
  - `serverInfo: { name, version }` wrapper (required by Smithery schema)
  - All 66 tools enumerated from `getCanonicalServices()` (always in sync)
  - `transport: { type: "streamable-http", endpoint: baseUrl+"/mcp" }`
  - `authentication: { required: false }`
  - `resources: []`, `prompts: []`
- Served at `/.well-known/mcp/server-card.json` and `/.well-known/server-card.json`
- MCP `POST /mcp` endpoint (mcpDeliveryRoutes.ts) already handles `initialize` + `tools/list` + `tools/call` correctly — Smithery scanner can auto-scan without needing the static card

## Submission URLs (Manual Steps for User)
- Smithery: https://smithery.ai/new → enter `https://coinrailz.com/mcp`
- a2aregistry.org: https://a2aregistry.org (register A2A agent card URL)
- a2a-registry.org: https://www.a2a-registry.org/auth/signup
- mcp.so: https://mcp.so/submit → Name: "Coin Railz", URL: `https://coinrailz.com/mcp`
- glama.ai: https://glama.ai/mcp/servers → submit
- punkpeye/awesome-mcp-servers: GitHub PR to add Coin Railz to the list

**Why:** Agent Plane ran automated liveness+security probes on Coin Railz's A2A endpoint (not targeted diligence) — but Coin Railz is NOT in their index. Smithery listing → Agent Plane auto-index.
