---
name: x402 Foundation migration plan
description: Details on migrating from old x402-express/x402-fetch packages to the @x402/* foundation-canonical packages
---

## Verified Architecture (May 2026) — Read This First

**x402GatedRoutes.ts** — NOT MOUNTED. Deprecated in appMain.ts line 1057. Edits here have zero runtime effect.

**x402MicroserviceRoutesV2.ts** — THE LIVE ROUTER. Mounted at `/x402` in appMain.ts line 1062. All 60+ services live here. `createPaymentOrchestrator` handles ALL payment gating.

**x402CanaryJob.ts** — Migrated to `@x402/fetch` 2.x (May 2026). Uses new 2-arg `wrapFetchWithPayment(fetch, x402Client)` with `ExactEvmScheme` and `registerPolicy` for payment cap. No special headers needed — default 402 path now emits CAIP-2.

**paymentOrchestrator.ts** — The real payment engine. No dependency on x402-express at all.

## CAIP-2 Network Format — Critical Decision (May 2026)

**Rule: All 402 challenges must emit `network: "eip155:8453"` (CAIP-2). Never `"base"` shorthand.**

**Why:** `@x402/fetch` 2.x performs exact string matching on the `network` field against registered scheme keys. There is no alias map from `"base"` → `"eip155:8453"`. A client registered with `.register('eip155:8453', ...)` receiving `network: "base"` throws "No network/scheme registered" and cannot pay. Verified by architect with live runtime repro.

**How to apply:** Any new 402 response object or payment requirement in x402MicroserviceRoutesV2.ts must use `network: "eip155:8453"`, not `"base"`. The enricher middleware at the network normalization block (~line 1842) enforces this for all traffic. The `x402-fetch 0.7.3` shorthand requirement is NOT a constraint in @x402/fetch 2.x.

**Solana exception:** Solana keeps `network: "solana"` shorthand — do not change until confirmed safe with @x402/fetch 2.x Solana scheme.

## Canary Job @x402/fetch 2.x API

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const evmSigner = {
  address: account.address,            // account = privateKeyToAccount(keyHex)
  signTypedData: (args: any) => walletClient.signTypedData(args),
  readContract: (args: any) => publicClient.readContract(args),
  estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
  getTransactionCount: (args: any) => publicClient.getTransactionCount(args),
};
const client = new x402Client()
  .register('eip155:8453', new ExactEvmScheme(evmSigner))
  .registerPolicy((_version, reqs) =>
    reqs.filter(r => {
      try { return BigInt(r.maxAmountRequired) <= MAX_PAYMENT_MICRO; }
      catch { return false; }
    })
  );
const x402Fetch = wrapFetchWithPayment(fetch, client);
// No special headers needed — default path emits CAIP-2
```

**CRITICAL GOTCHA:** Do NOT use `toClientEvmSigner(walletClient)`. Viem `WalletClient` stores address at `account.address`, not `.address`. Result: `address=undefined` → "Address 'undefined' is invalid". Construct `evmSigner` manually as above. `registerPolicy` replaces old 3rd-arg max-payment cap.

## Normal-Path Probe (added May 2026)

Every canary cycle now runs `runNormalPathProbe()` first — a free HEAD+GET check that reads the default 402 challenge and asserts `network === "eip155:8453"`. Logs ✅ or ❌. No USDC spent. Catches any regression where the default path drifts back to shorthand.

## elizaos-plugin-coinrailz

`elizaos-plugin-coinrailz/package.json` retains its own `x402-fetch@^0.6.0`. That is a fully independent package with its own node_modules. Do not touch it during root package migrations.

## x402Routes Config Object

The big `x402Routes` object in x402MicroserviceRoutesV2.ts uses legacy format (`price`, `network`, `config`). Consumed ONLY by `generate402ResponseForGet()` for Bazaar discovery — NOT an @x402/express RouteConfig. Leave as-is.

## Migration Completion Record (May 2026)

1. ✅ Dead legacy imports removed from x402MicroserviceRoutesV2.ts
2. ✅ Regression check passed — 402 body contract identical
3. ✅ CAIP-2 enforced on all traffic (gate removed, default path fixed)
4. ✅ x402CanaryJob.ts migrated to @x402/fetch 2.x
5. ✅ Normal-path probe added to canary job
6. ✅ 3 consecutive prod canary successes confirmed (May 26 2026)
7. ✅ `x402-fetch` removed from root package.json
