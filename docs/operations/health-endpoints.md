# Production health endpoints

## Current production probe contract

- **Readiness:** `GET /readyz`
  - Returns `503` with `Retry-After: 5` while application routes are still registering.
  - Returns `200` JSON with `ready: true` after the x402 and MCP routes are available.
  - This is the official external probe target.

- **Liveness:** `GET /health`
  - Returns `200` JSON from the running application after route registration.

## `/healthz` routing caveat

The deployed public Google Frontend currently intercepts `GET /healthz` and
returns its own HTML 404 before the request reaches Express. The application
does register an early `/healthz` handler, and the same handler succeeds on the
development origin, so changing application route order cannot correct the
public result.

Until the deployment ingress configuration can be changed, do not configure
external monitors to use `/healthz`. Use `/readyz` for readiness and `/health`
for a post-start liveness check. Any future ingress change must be externally
verified against both public domains with a cache-busting query parameter and
an `application/json` response assertion.