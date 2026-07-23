---
name: A2A outreach delivery — ecosystem maturity problem
description: Why broadcast A2A outreach delivers 0% and what the correct strategy is
---

## The Core Finding (Jul 23 2026)

Ran two live campaigns + 4 direct sends to known agents. **Total delivered: 0 out of 100+ attempts.**

### Why every send fails
- ~30 agents: HTTP 500 — server crashing or erroring (Modal, generic cloud agents)
- ~8 agents: HTTP 405 — wrong path, agents moved their A2A route
- ~4 agents: HTTP 404 — endpoint deleted
- ~2 agents: ENOTFOUND — domain completely gone (e.g. agora402.fly.dev)
- Syndiode: HTTP 503 — Render free tier out of memory, paused
- MetaVision: JSON-RPC -32601 — MCP endpoint doesn't speak A2A message format
- CarryLens: ENOTFOUND — carrylens.io doesn't resolve
- Gonka: ECONNREFUSED — server offline
- MERCURY: Timeout — down or rate-limiting

### Root cause: ecosystem immaturity
The discovered_agents table has 31,026 entries but:
- 28,616 (92%) are x402-bazaar listings — Coinbase Bazaar service entries, NOT A2A agents
- The remaining ~2,400 "real" A2A agents are overwhelmingly hobbyist/dev projects on free hosting (Render, Fly.io, Modal) that go offline constantly
- Registries index agents once and never update — stale by the time we try to reach them

### Source quality breakdown (as of Jul 23 2026)
| Source | Count | Quality |
|---|---|---|
| x402-bazaar | 28,616 | ❌ Not A2A agents — service listings |
| github | 1,278 | ❌ Mostly inactive or wrong protocol |
| a2a-public-registry | 420 | ⚠️ Real agents but most endpoints are down |
| elizaos-registry | 377 | ⚠️ Real agents but many on free hosting |
| coinbase-cdp-wallet | 253 | ❌ Passive payment addresses, not messaging agents |
| a2aregistry-official | 46 | ✅ Best quality — curated, but still mostly offline |
| inbound-a2a | 2 | ✅✅ Highest quality — proved infrastructure by contacting us |
| manual-high-value | 4 | ✅✅ Manually verified |
| verified-a2a-targets | 2 | ✅✅ Confirmed working |

### The fix applied
Added `NOT source IN ('x402-bazaar', 'github')` to `getVerifiedAgentsForOutreach()` in `a2aOutreachService.ts`. Reduced junk from 92% to ~85% of pool — marginal improvement since the status filter was already excluding most bazaar entries.

### What actually works: the inbound model
**Do NOT invest further in broadcast A2A outreach.** The ecosystem is too immature.

The only reliably contactable agents are those that have already contacted US — because they proved working infrastructure by doing so. Focus:
1. Inbound agents that POST to our A2A endpoint — respond to them
2. Inbound x402 payers — they have funded wallets and active setups
3. Free endpoints (vlt-usdc-deposit, ping, first-call) let agents discover us on their own terms
4. MetaVision: can SEND to us but cannot RECEIVE — no A2A response path exists

**Why:** The agent ecosystem contact graph is fundamentally asymmetric right now — many agents can send but not receive. The publish-and-wait strategy works better than push outreach at this stage.
