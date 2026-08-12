---
name: esbuild splitting fix — fast startup
description: Root cause and fix for Cloud Run promote failures caused by esbuild bundling all static imports into a single file, blocking httpServer.listen() for 43s.
---

# esbuild --splitting: required for fast startup health checks

## The rule
The esbuild build command MUST include `--splitting`. Without it, the entire server
crashes Cloud Run's health check promote window.

**Why:** `--bundle` without `--splitting` inlines all transitively-imported local files
into a single `dist/index.js`. Their npm package imports (marked `--packages=external`)
get hoisted as **684 static ESM import statements** at the top of the 7MB bundle.
Node.js evaluates all 684 imports before any code runs — including `ethers` (which
triggers the `bigint: Failed to load bindings` warning) — causing a 43-second delay
before `httpServer.listen()` is ever called.

Cloud Run's health check probe times out at ~20 seconds, so the promote is rejected
at 20s even though the server eventually starts at 43s.

**How to apply:** Any time the build script is touched, verify it still contains `--splitting`:
```
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --splitting --outdir=dist
```

## What splitting does
With `--splitting`, esbuild preserves the dynamic `await import('./appMain.js')` in
`server/index.ts` as a true runtime dynamic import (resolves to `dist/appMain-HASH.js`).
The entry `dist/chunk-MICU22K7.js` (the actual server/index.ts code) has only 4 static imports:
express, http, path, fs — all load in milliseconds. Server binds in <1 second.

## Output layout (after splitting)
- `dist/index.js`: 270 bytes, re-exports from chunk files
- `dist/chunk-MICU22K7.js`: ~6.9KB, 4 static imports (express/http/path/fs)
- `dist/appMain-CV4MGTAK.js`: 190.5KB, loaded lazily after listen()
- 370+ other chunk files for routes, adapters, etc.

Deployment copies the entire `dist/` directory — all chunks are included.

## Startup sequence with splitting
1. Container start → Node loads 270-byte index.js → loads 6.9KB chunk → 4 lightweight imports
2. `httpServer.listen()` called → port 5000 bound in <1 second
3. Cloud Run health checks see 200 → promote accepted
4. `setTimeout(100ms)` → `await import('./appMain-HASH.js')` fires
5. Heavy packages load in background (30-150s) — server already promoted
6. Watchdog at 150s ensures `markFrontendReady()` is called if initApp() stalls
