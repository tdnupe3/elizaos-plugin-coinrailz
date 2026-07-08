---
name: Registry submissions — status
description: Status of all agent/MCP registry submissions for Coin Railz as of July 2026
---

## Completed Registrations (as of July 8, 2026)

| Registry | Status | Details |
|---|---|---|
| **Smithery** | ✅ Live | `travis-kellogg1/coinrailz-mcp` — 96/100 score, SUCCESS in 5s, 99.36% uptime |
| **a2aregistry.org** | ✅ Live | id=`0136e410-6621-4f8b-bba7-8ea58fc46db7`; 66 skills; auto-crawls agent-card every 30min |
| **mcp.so** | ✅ Live | Name: `coin-railz`, Title: "Coin Railz", Author: Travis Kellogg, Type: server, Status: created — submitted 2026-07-08 |
| **a2a-registry.org (GlobalA2ARegistry)** | ✅ Live | Published (github_verified) via `github.com/tdnupe3/coinrailz-agent` (agent-card.json, 66 services); also a "Website Agent" entry for `com.coinrailz` in Draft |

## GitHub Repo for a2a-registry.org

- Repo: https://github.com/tdnupe3/coinrailz-agent
- Contains: `agent-card.json` (all 66 services, built from live /x402/catalog) + README
- Source type: GitHub (github_verified badge)
- Pushed via GitHub API using token for user `tdnupe3`

**Why:** a2a-registry.org requires either DNS TXT verification (slow, GoDaddy) or a GitHub repo with agent-card.json at root. GitHub path gave immediate `github_verified` badge without DNS changes.

**How to apply:** If agent-card.json needs updating, re-run the Python push script in bash using `tdnupe3` token from git remote URL; SHA must be fetched first for the PUT update to succeed.

## Agent Plane (agentplane.doppelops.com)

Listed indirectly via Smithery feed — Agent Plane is read-only (query-only resolver); A2A endpoint rejects inbound messages; no direct submission possible.
