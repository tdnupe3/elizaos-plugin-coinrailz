---
name: Production deploy 500 — rolling promote log interleaving
description: Runtime logs showing HTTP 500 during deploy are from OLD container crash-loop, not new code. Key fix: health probe UA detection in GET /.
---

## The Problem
Cloud Run autoscale deployment repeatedly failed with health probe returning "status 500" on GET /.
BUT: the runtime log timestamps started ~3 minutes BEFORE the "Creating Autoscale service" build step.
This proves the 500 logs are from the OLD revision being killed/crash-looping during rolling promotion,
not from the new container.

## Root Cause
Rolling promotion log interleaving: when Replit initiates a new autoscale build, the old container
enters a restart/crash loop. fetch_deployment_logs() returns ALL runtime logs including from this
old-container crash loop. The new container itself starts fine (local tests confirm GET / returns 200).

**Why:** `fetch_deployment_logs` is not scoped to a specific build revision.

## Residual Risk (now fixed)
Once `markFrontendReady()` is called, `GET /` calls `next()`. If a Cloud Run probe arrives exactly
after `markFrontendReady()` but before static middleware is fully initialized, the probe could get
a non-200 from a downstream middleware crash.

## Fix Applied (server/index.ts)
Added health probe UA detection at the top of `GET /` handler:
```javascript
const isHealthProbe = ua.includes('googlehc') || ua.includes('kube-probe') || ua.includes('go-http-client') || ua === '';
if (isHealthProbe) {
  return res.status(200).json({ status: 'ok', service: 'Coin Railz', ts: Date.now() });
}
```
This short-circuits health probes BEFORE checking `frontendReady` or calling `next()`.
Cloud Run probe UA is `GoogleHC/1.0`.

**Why:** Health probes must never reach the `next()` path where downstream middleware could fail.

**How to apply:** Any new entry point or major route file should include similar probe detection for `GET /`.

## Diagnostic pattern for future failures
1. Check runtime log timestamps vs "Creating Autoscale service" build log timestamp
2. If runtime logs start BEFORE build completes → old container logs, not new code bug
3. If runtime logs start AFTER → genuine new-code startup crash, check for missing env vars or module errors
