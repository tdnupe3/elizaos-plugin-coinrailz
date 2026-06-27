---
name: Async Express middleware safety
description: Express 4 does not catch async middleware throws; pattern required to prevent process death
---

## The rule
Every `async` function used as Express 4 middleware MUST wrap its body in `try { ... } catch (err) { next(err) }` (or `res.status(500).json(...)`).

**Why:** Express 4 does NOT automatically catch rejected promises from async middleware. An uncaught rejection propagates as `unhandledRejection`. After `markStartupComplete()` is called in this codebase, any `unhandledRejection` triggers `process.exit(1)`. The server dies silently — the connection is closed mid-request (curl exit code 52 = empty reply), not a 500.

## Symptom pattern
- `curl guide → 200` (route without auth works)
- `curl register-recipient → 000` (route with async auth middleware → process exits)
- `curl health (after) → 000` (server is dead)

The server crash looks like a startup problem but is actually triggered by the first authenticated request.

## Required pattern
```typescript
async function requireSomeAuth(req: any, res: Response, next: NextFunction): Promise<void> {
  try {
    const [row] = await db.select()...;
    if (!row) { res.status(401).json({...}); return; }
    req.userId = row.id;
    next();
  } catch (err: any) {
    console.error('[auth] middleware error:', err?.message);
    res.status(503).json({ error: 'Auth service temporarily unavailable', retry: true });
    // DO NOT call next(err) if headers already sent
  }
}
```

## How to apply
- Audit every `async function` passed directly as Express middleware (2nd or 3rd argument to `router.get/post/use`)
- Any DB query inside middleware = must have try-catch
- Express 5 (when adopted) fixes this automatically — but this codebase is Express 4.21.2
