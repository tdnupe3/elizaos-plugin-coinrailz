---
name: Production bootstrap isolation
description: Why production health checks are served outside the main application's event loop.
---

Serve deployment health checks from a lightweight parent process and initialize the full application on an internal port. Proxy traffic only after the child reports ready; exit if the child exits or misses a bounded readiness deadline.

**Why:** In Replit Autoscale, evaluating the large production bundle can block the child event loop for over 150 seconds even though the same artifact initializes quickly in development. Binding the application socket early does not help if the event loop cannot answer the promote probe.

**How to apply:** Keep `/` and `/healthz` terminal 200 in the bootstrap during child startup, return 503 plus `Retry-After` for application routes, open `/readyz` after core paid routes are mounted, defer optional imports, and preserve sanitized HTTP/WebSocket proxying.