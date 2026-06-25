---
name: Analytics middleware blind spot — two fixes
description: usageAnalyticsMiddleware had two bugs causing microservice_requests to be useless. Both fixed Jun 25 2026.
---

## Bug 1: service_id always 'unknown'

`usageAnalyticsMiddleware` is registered as `router.use(usageAnalyticsMiddleware)` inside the x402 router
which is itself mounted at `/x402` in appMain.ts.

When Express calls middleware inside a mounted router, `req.path` is **stripped** of the mount prefix.
`/x402/trade-signals` arrives as `req.path = '/trade-signals'`.

The original `extractServiceId(req.path)` used regex `/\/x402\/([^\/]+)/` — never matched.
Every row in `microservice_requests` had `service_id = 'unknown'`.

**Fix:** Use `req.originalUrl` (retains full path `/x402/trade-signals`).
Updated regex: `/\/x402\/(?:service\/)?([^/?#]+)/` — also handles `/x402/service/:slug` aliases.

**Why:** `req.path` is always router-relative in Express sub-routers. `req.originalUrl` is always the full path from the client.

## Bug 2: Redirect and some POST responses never persisted

Original pattern overrode `res.send()` and `res.json()`. Express's `res.redirect()` calls `res.end()` internally — neither override fires. 308 redirects (the /service/ compatibility alias) and some response paths were silently dropped.

**Fix:** Replace `res.send`/`res.json` overrides with `res.on('finish', ...)`.
`finish` event fires for ALL response completions: json, send, redirect, end, pipe.

**Why:** `finish` is the definitive "response sent" signal in Node.js HTTP — independent of which method terminated the response.

## Impact
`microservice_requests` table was 100% corrupt with `service_id='unknown'` since creation.
x402-observer, 74.220.48.244 (primary paying customer), Cloudflare Worker POST activity were
invisible to all DB queries. After fix: verified `trade-signals` and `fraud-detection` stored correctly.

## How to apply
Any new analytics middleware that needs to capture all response types must use `res.on('finish')`.
Never use `res.send`/`res.json` overrides for logging — they miss redirect, SSE, and pipe responses.
