---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Verified Architecture (May 2026) — Read This First

**x402GatedRoutes.ts** — NOT MOUNTED. Deprecated in appMain.ts line 1057. Edits here have zero runtime effect. Now migrated to @x402/express 2.x (harmless, irrelevant).

**x402MicroserviceRoutesV2.ts** — THE LIVE ROUTER. Mounted at `/x402` in appMain.ts line 1062. All 60+ services live here. `createPaymentOrchestrator` handles ALL payment gating — `x402Middleware` was already removed from every route. Old `paymentMiddleware` import was dead code.

**x402CanaryJob.ts** — Migrated to `@x402/fetch` 2.x (May 2026). Uses new 2-arg `wrapFetchWithPayment(fetch, x402Client)` with `ExactEvmScheme` and `registerPolicy` for payment cap. Canary sends `X-X402-Canary: true` header to trigger CAIP-2 challenge path.

**paymentOrchestrator.ts** — The real payment engine. No dependency on x402-express at all.

## Migration Status (May 2026) — COMPLETE

### Server Side — COMPLETE
- `x402MicroserviceRoutesV2.ts`: Dead imports (`x402-express`, `@coinbase/x402`) and dead `x402Middleware` instantiation removed. Regression checks passed — 402 body contract identical.
- `x402GatedRoutes.ts`: Migrated to @x402/express 2.x (new RouteConfig format, x402ResourceServer, ExactEvmScheme). File is unmounted so zero runtime impact.

### Canary Client — COMPLETE
- `x402CanaryJob.ts` migrated to `@x402/fetch` 2.x.
- Network format mismatch resolved via canary-only CAIP-2 toggle (Option A).

## Canary-Only CAIP-2 Toggle (Option A) — How It Works

**Problem:** orchestrator emits `network:"base"` shorthand in 402 challenges. `@x402/fetch` 2.x `ExactEvmScheme` requires CAIP-2 `"eip155:8453"`. Incompatible.

**Solution:** Surgical header-gated bypass in `x402MicroserviceRoutesV2.ts` router.use() at the network normalization block (~line 1842):
```typescript
const canaryHeader = req.headers['x-x402-canary'];
const isCanaryRequest = Array.isArray(canaryHeader) ? canaryHeader[0] === 'true' : canaryHeader === 'true';
enriched.network = isCanaryRequest ? 'eip155:8453' : 'base';
```
- Normal traffic: `network="base"` (x402-fetch 0.7.x compatibility preserved)
- Canary traffic: `network="eip155:8453"` (CAIP-2, required by @x402/fetch 2.x)
- `x402Network` stays `"eip155:8453"` in both paths — no change there

**CRITICAL:** The normalization is in `x402MicroserviceRoutesV2.ts` router.use() — NOT in `x402ResponseEnricher.ts`. The enricher is only used in the deprecated/unmounted `x402GatedRoutes.ts`. The live router has its own res.json wrapper.

## Canary Job @x402/fetch 2.x API

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const evmSigner = toClientEvmSigner(walletClient);  // walletClient = viem createWalletClient(...)
const client = new x402Client()
  .register('eip155:8453', new ExactEvmScheme(evmSigner))
  .registerPolicy((_version, reqs) =>
    reqs.filter(r => {
      try { return BigInt(r.maxAmountRequired) <= MAX_PAYMENT_MICRO; }
      catch { return false; }
    })
  );
const x402Fetch = wrapFetchWithPayment(fetch, client);
// Request must include "X-X402-Canary": "true" header to get CAIP-2 challenge
```

**Why — CRITICAL GOTCHA:** Do NOT use `toClientEvmSigner(walletClient)`. It reads `signer.address` directly, but viem `WalletClient` stores the address at `account.address`, not `.address`. Result: `address=undefined` → viem throws "Address 'undefined' is invalid" inside `ExactEvmScheme.createPaymentPayload()`. Construct ClientEvmSigner manually:
```typescript
const evmSigner = {
  address: account.address,            // account = privateKeyToAccount(keyHex)
  signTypedData: (args: any) => walletClient.signTypedData(args),
};
```
`registerPolicy` replaces the old 3rd-arg max-payment cap.

## x402Routes Config Object — Do NOT Convert

The big `x402Routes` object in x402MicroserviceRoutesV2.ts uses old format (`price`, `network`, `config`). It is consumed ONLY by `generate402ResponseForGet()` for Bazaar discovery responses — it is NOT an @x402/express RouteConfig. Leave it as-is.

## Remaining Steps

1. ✅ Remove dead legacy imports/instantiation in x402MicroserviceRoutesV2.ts — DONE
2. ✅ Regression check: first-call + core endpoints still return correct 402 — PASSED
3. ✅ Canary-only CAIP-2 toggle implemented and tested — DONE
4. ✅ x402CanaryJob.ts migrated to @x402/fetch 2.x — DONE
5. ✅ 3 consecutive canary successes confirmed in prod (May 26 2026):
   - tx 0xbc6b5a341e2024ba026163f96f8fdaab7b50d0f92c6d054ae76f99c810059f98
   - tx 0x1c273394e21b53bbeaf322293846d98f84cd910045d9acbbada0dc87ac205b51
   - tx 0xf84fe1180c994244653a25f2244ef0e67a20b4c431dd751e62b5bf967bff1f61
6. ✅ `x402-fetch` removed from root package.json — MIGRATION COMPLETE
7. Note: `elizaos-plugin-coinrailz/package.json` retains its own `x402-fetch@^0.6.0` — that is a separate package, do not touch it.
