---
name: x402-fetch maxValue ceiling
description: wrapFetchWithPayment has a conservative default maxValue that silently blocks services above ~$0.10; must be set explicitly in plugin and SDK quickstart
---

## Rule
Always pass an explicit `maxValue` when calling `wrapFetchWithPayment`. The default in `x402-fetch` v0.7.x is conservative (believed ~$0.10 in USDC micro-units), which silently blocks any service priced above that threshold with the error "Payment amount exceeds the configured maximum".

```typescript
// WRONG — will fail silently for services > default maxValue
const x402Fetch = wrapFetchWithPayment(fetch, walletClient);

// CORRECT — covers the full catalog including smart-contract-audit ($10.00)
const x402Fetch = wrapFetchWithPayment(fetch, walletClient, {
  maxValue: BigInt(10 * 10 ** 6)  // $10.00 in USDC 6-decimal micro-units
});
```

**Why:** Discovered during Jul 2026 payment drought audit. The plugin's `x402Client.ts` already had a catch block for `"exceeds maximum"` errors — evidence the bug was known but never fixed upstream. The SDK quickstart snippet in `paymentOrchestrator.ts` also showed the unconfigured call, which would mislead any developer copying it.

**How to apply:**
- Any code that calls `wrapFetchWithPayment` must include `maxValue`
- The SDK quickstart snippet embedded in 402 bodies (`paymentOrchestrator.ts`) must show `maxValue`
- The ElizaOS plugin type declaration (`src/types/x402-fetch.d.ts`) already accepts `options?: Record<string, any>` — no type changes needed
- Both `x402-fetch` (v0.7.x, plugin) and `@x402/fetch` (v2.x, main app) have this parameter — check both call sites when updating
