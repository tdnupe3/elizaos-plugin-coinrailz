---
name: MCP 2026 server discovery
description: Current MCP discovery requirement that supersedes older lifecycle assumptions.
---

MCP specification version 2026-07-28 requires servers to implement `server/discover`. Do not reject it on the assumption that clients must begin only with `initialize` and `tools/list`.

**Why:** The protocol changed. A current external client repeatedly invoked `server/discover`, while the server's older response explicitly claimed the method did not exist. That creates a compatibility loop for current clients.

**How to apply:** When upgrading or validating MCP interoperability, implement discovery and protocol negotiation coherently against the current specification. Keep the fix client-neutral rather than adding user-agent-specific behavior.