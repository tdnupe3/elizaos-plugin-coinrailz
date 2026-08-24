---
name: Public healthz ingress behavior
description: Public /healthz is intercepted before Express; use /readyz for external readiness checks.
---

`/readyz` is the official external readiness probe. The application serves
`/healthz` locally, but the public Google Frontend returns its own HTML 404
before the request reaches Express.

**Why:** Reordering or rewriting the application health route cannot repair an
ingress-reserved/intercepted path. An app-level change would create misleading
local success while production monitors still fail.

**How to apply:** Configure external readiness checks against `/readyz`; use
`/health` for a post-start liveness check. Only revisit `/healthz` after an
ingress/deployment configuration change, then verify both public domains return
application JSON rather than a Google Frontend response.