---
name: API route registration — pre-static required
description: New Express API routes must be registered before the Vite middleware or they return HTML instead of JSON.
---

## The Rule

Any new `app.use('/api/...', router)` call MUST be placed in the **pre-static block** of `server/appMain.ts`, approximately around line 3855–3865, BEFORE the call to `setupVite()` / `serveStatic()`.

## Why

`server/vite.ts` registers a wildcard catch-all:
```typescript
app.use("*", async (req, res, next) => { ... res.status(200).set({ "Content-Type": "text/html" }).end(page); });
```
This terminates ALL requests — including `/api/` routes — that haven't been matched before it in the middleware stack. Routes registered post-listen (after the server starts) end up after this wildcard and are permanently shadowed.

## How to Apply

Add new routes near line 3860 of `server/appMain.ts`, in this pattern:
```typescript
const myNewRoutes = await import('./routes/myNewRoutes.js').then(m => m.default);
app.use('/api/my-prefix', myNewRoutes);
console.log('✅ My routes registered (pre-static)');
```
The comment `(pre-static)` is conventional in this codebase and signals the correct location.

## Discovery

Found when yield portal routes returned HTML for `GET /api/yield/rates` despite `✅ Yield portal routes registered` appearing in logs. The route was in the post-listen block.
