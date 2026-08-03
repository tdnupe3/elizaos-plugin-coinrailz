---
name: microToUSD returns string, not number
description: microToUSD() in shared/pricing.ts returns a formatted string. Using its result with .toFixed() or arithmetic causes a runtime TypeError.
---

## Rule

`microToUSD(n)` returns a **string** (e.g. `"0.35"`), not a number.  
Inside `generate402Response`, use `requiredAmount / 1_000_000` to get a number.  
Never pass `microToUSD()` output to any function expecting `number.toFixed()`.

**Why:** The function signature is `export function microToUSD(microAmount: number): string`. TypeScript did not catch the `.toFixed()` call because `priceUsd` was typed `any` inside `generate402Response`. The crash was silent until the specific code path was exercised (first-call POST triggered it; other services were tested before first-call in the same session).

**How to apply:** When you need a numeric USD value from a micro-USDC amount, always compute it as `requiredAmount / 1_000_000`. Reserve `microToUSD()` for display strings only.
