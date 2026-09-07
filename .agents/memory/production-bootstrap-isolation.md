---
name: Production bootstrap isolation
description: Why production health checks are served outside the main application's event loop.
---

Serve deployment health checks from a lightweight parent process and initialize the full application on an internal port. Proxy traffic only after the child reports ready; exit the parent if the child exits.

**Why:** In Replit Autoscale, evaluating the large production bundle can block the child event loop for over 150 seconds even though the same artifact initializes quickly in development. Binding the application socket early does not help if the event loop cannot answer the promote probe.

**How to apply:** Keep `/` and `/healthz` terminal 200 in the bootstrap during child startup, return 503 plus `Retry-After` for application routes, use `/readyz` to enable the proxy, and preserve HTTP upgrade forwarding for WebSockets.