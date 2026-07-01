---
name: Express percent-encoded route matching
description: router.all('/path%60') and router.all(/regex with %60/) don't reliably match incoming URLs with percent-encoded chars in Express 4 — use router.use() with explicit req.path check instead
---

## Rule
To match a route with percent-encoded characters (e.g. `%60` for backtick), use `router.use()` with an explicit `req.path` equality check — NOT `router.all('/path%60', ...)` or `router.all(/regex/, ...)`.

## Behavior observed
- `router.all('/gas-price-oracle%60', handler)` — does NOT fire; path-to-regexp v0.1.7 normalizes the encoded form before compiling the match regex, so it never equals the raw incoming path.
- `router.all(/^\/gas-price-oracle(?:%60|`)+$/, handler)` — also does NOT fire; same normalization problem applies to regex routes when the router is mounted on a sub-path.
- `router.use((req, res, next) => { if (req.path === '/gas-price-oracle%60') ... })` — WORKS. Express delivers `req.path` in the ENCODED form (`%60`, not the decoded backtick character) inside a mounted router.

## How to apply
```typescript
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/problem-path%60' || req.path === '/problem-path`') {
    return res.redirect(301, '/canonical-path');
  }
  next();
});
```
- Place BEFORE `router.use(trackingMiddleware)` so it fires before analytics/tracking.
- Include both the encoded and decoded forms in the check as a defensive fallback.
- Must force-restart the server (tsx hot-reload does NOT pick up changes to large route files reliably).

**Why:** Express 4 uses path-to-regexp v0.1.7. When a sub-router is mounted (e.g. `app.use('/x402', router)`), the framework strips the mount prefix and routes against the remainder. The path normalization applied during regex compilation causes percent-encoded literals in route strings to not match the raw `req.path` value, even though `req.path` itself still contains the encoded form.
