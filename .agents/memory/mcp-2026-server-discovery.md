---
name: MCP 2026 server discovery
description: Current MCP discovery requirement that supersedes older lifecycle assumptions.
---

Current MCP requires `server/discover` and removes the legacy `initialize`/`initialized` handshake from the modern lane. Keep the endpoint dual-era so older clients can still use the legacy lifecycle.

**Why:** The protocol changed. A current external client repeatedly invoked `server/discover`, while the server's older response explicitly claimed the method did not exist. That creates a compatibility loop for current clients.

**How to apply:** Validate every version declaration as one negotiation contract, including legacy initialize fields. Keep discovery and transport behavior client-neutral rather than adding user-agent-specific branches.
