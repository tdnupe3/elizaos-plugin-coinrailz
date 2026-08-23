---
name: OpenAI lazy init pattern
description: Module-level new OpenAI() crashes dev server if key absent; use lazy getter instead
---

# OpenAI Lazy Init Rule

**Rule:** Never instantiate `new OpenAI(...)` at module scope. Always use a lazy getter.

**Pattern:**
```ts
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}
```

**Why:** OpenAI SDK v4+ throws `Missing credentials` on `new OpenAI({ apiKey: '' })` even with `|| ''` fallback. Module-level init runs at import time — if ANY file in the import chain has a module-level OpenAI init and the key is absent, the entire server fails to start (initApp throws before routes register, markAppReady() never fires, all /x402/* return 503).

**How to apply:** Any new file that uses OpenAI must use the lazy getter. Files already fixed: common.ts, openAIServiceDelivery.ts, rwaNavOracleService.ts, microservices.ts, telegramMiniAppRoutes.ts.

# getPublicBaseUrl(req) inside createPaymentOrchestrator

**Rule:** Inside `createPaymentOrchestrator` middleware, use `getPublicBaseUrl(req)` — never a bare `baseUrl` variable. The `baseUrl` variable only exists inside `generate402Response()`.

**Why:** Caused a `ReferenceError: baseUrl is not defined` crash on every malformed X-PAYMENT header after the decode-failure retry hints were added. Crash was caught by unhandledRejection handler → process.exit.
