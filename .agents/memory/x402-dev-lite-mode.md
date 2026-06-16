---
name: x402 outreach campaign — DEV_LITE_MODE blocks routes
description: Campaign and outreach API routes are disabled in DEV_LITE_MODE; workarounds for development
---

## The Problem
In development, the app runs in `DEV_LITE_MODE` which skips registering:
- `AutomatedOutreachService`
- A2A outreach campaign routes (`POST /api/a2a-protocol/outreach/campaign`)
- Discord/Discovery/Outreach heavy services

Hitting `POST /api/a2a-protocol/outreach/campaign` in dev returns 404/HTML (caught by Vite catch-all).

**Why:** DEV_LITE_MODE was added to keep Vite HMR stable by not loading heavy services during development.

## Workarounds

### Option 1: Direct HTTP calls (fastest for testing single agents)
Fire A2A messages directly to confirmed agent endpoints from `code_execution`:
```js
await fetch("https://network.mercury-hq.com/a2a", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: "...", method: "message/send", params: { message: {...} } })
})
```

### Option 2: DEV_FULL_SERVICES=true
Restart the workflow with env var `DEV_FULL_SERVICES=true` set. This enables all services including outreach routes. Only do this when HMR instability is acceptable.

### Option 3: Production deployment
The outreach campaign fires normally in production. Deploy to run campaigns at scale.

## Vite SPA Route Timing Note
The Vite `app.use("*", ...)` catch-all is registered lazily during `setupVite()`. For ~30-60s after startup, SPA routes may return 404/HTML-but-broken. Wait for the "Post-listen initialization complete" log before testing frontend routes. Code-execution curl tests confirm HTTP 200 faster than the screenshot tool.
