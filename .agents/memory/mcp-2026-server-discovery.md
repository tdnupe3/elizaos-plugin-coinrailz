---
name: MCP 2026 server discovery
description: Current MCP discovery requirement that supersedes older lifecycle assumptions.
---

MCP specification version 2026-07-28 requires servers to implement `server/discover` and removes the legacy `initialize`/`initialized` handshake from that modern lane. Do not reject it on the assumption that clients must begin only with `initialize` and `tools/list`.

**Why:** The protocol changed. A current external client repeatedly invoked `server/discover`, while the server's older response explicitly claimed the method did not exist. That creates a compatibility loop for current clients.

**How to apply:** Validate two separate lanes: modern 2026-07-28 (`server/discover` → per-request protocol selection → `tools/list` → tool call) and legacy MCP (`initialize`/`initialized` → `tools/list` → tool call). Advertise only versions actually supported, and keep the fix client-neutral rather than adding user-agent-specific behavior.