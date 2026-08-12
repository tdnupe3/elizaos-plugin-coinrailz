# Discovery Submissions Guide

This folder contains ready-to-submit content for registering Coin Railz on external AI agent discovery platforms.

## Priority Order

### 1. A2A Registry (HIGHEST PRIORITY)
**Why:** This is the registry your own outreach system queries. Being listed here means other agents can find you programmatically.

**File:** `a2a-registry-submission.json`

**Steps:**
1. Go to https://github.com/prassanna-ravishankar/a2a-registry
2. Fork the repository
3. Create file `agents/coinrailz-payments.json` with the content from `a2a-registry-submission.json`
4. Submit Pull Request with title: "Add Coin Railz Payment Infrastructure"
5. Wait for CI validation (checks .well-known/agent-card.json)
6. Maintainers merge within days

**Verification:**
```bash
# After merge, verify listing
curl https://www.a2aregistry.org/registry.json | jq '.[] | select(.name | contains("Coin"))'
```

---

### 2. MCP Registry (HIGH PRIORITY)
**Why:** Claude and ChatGPT users browse this registry to find MCP tools.

**Files:** 
- `mcp-registry-submission.md` - Full instructions
- `mcp-server.json` - Server definition template

**Steps:**
1. Update npm package with `mcpName` field in package.json
2. Re-publish to npm with `npm publish`
3. Install mcp-publisher CLI (see instructions in mcp-registry-submission.md)
4. Run `mcp-publisher login` (GitHub auth)
5. Run `mcp-publisher publish` with the server.json

**Note:** The MCP Registry is in preview (launched Sept 2025). API v0.1 is frozen but may change.

---

### 3. AI Agents Directory (MEDIUM PRIORITY)
**Why:** 1,300+ agents listed. Human-browsable marketplace for discovery.

**File:** `ai-agents-directory-submission.md`

**Steps:**
1. Go to https://aiagentsdirectory.com
2. Find "Submit Agent" or similar button
3. Use content from `ai-agents-directory-submission.md`
4. Consider Premium Listing for visibility boost

---

## Status Tracking (Updated August 12, 2026)

| Platform | Status | Submitted | Listed | Notes |
|----------|--------|-----------|--------|-------|
| A2A Registry | ✅ LISTED | Nov 30, 2025 | Yes | PR #10 merged, coinrailz.json in repo |
| PulseMCP | ⏳ Submitted | Jan 2026 | Pending | User submitted, awaiting review |
| Official MCP Registry | ✅ LISTED | Jan 18, 2026 | Yes | io.github.tdnupe3/coinrailz v1.0.5 |
| AI Agents Directory | ❌ Not submitted | - | No | Web form at aiagentsdirectory.com |
| Coinbase Bazaar | ✅ Auto-indexed | N/A | Yes | Via x402 transactions |
| x402scan | ✅ Auto-indexed | N/A | Yes | Via on-chain payments |
| toll402.com | ⏳ Submitted | Aug 12, 2026 | Pending | MCP server with 80 tools; VERIFIED badge pending real paid call from TOLL402-Exact-Quote-Verifier |

---

## After Submission

1. **Monitor GitHub PRs** for feedback from maintainers
2. **Verify listings** once merged
3. **Update this README** with status
4. **Track traffic** from new discovery sources in analytics
