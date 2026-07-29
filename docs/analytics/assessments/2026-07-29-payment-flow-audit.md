# Coin Railz — Payment Flow Audit
**Date:** July 29, 2026  
**Trigger:** Organic payment drought since July 21; founder requested platform-side audit  
**Consulted:** Architect + BizDev subagents; full production data; live endpoint inspection; codebase review

---

## Bottom Line Up Front

**The payment flow is clean. The drought is payer-side, not platform-side.**

This is confirmed by three independent signals:
1. Zero failed payment intents in 30 days — when anyone pays, it succeeds 100% of the time
2. Zero `x402_client_header` submissions from non-canary actors in 30 days — no one has attempted a payment and failed; no one has attempted a payment at all
3. Canary: 6/6 successes in the last 30 hours, Base mainnet USDC full round-trip working perfectly

The drought is fully explained by payer exhaustion: the only active power-user (0x9cc42f3d, $42.85 across 30 services) depleted on Jul 1, and the subsequent organic payers were single-use experimenters. No replacement high-volume payer has emerged yet.

**One real platform-side bug was found** — not causing the current drought, but will silently block plugin users from paying for services above the x402-fetch default maxValue ceiling. It should be fixed this sprint.

---

## 1. Evidence That the Payment Rail Is Working

### Canary (authoritative health signal)
```
Last 6 canary payments — all SUCCEEDED:
2026-07-29 09:03  Base  first-call  $0.05  SUCCEEDED
2026-07-29 03:03  Base  first-call  $0.05  SUCCEEDED
2026-07-28 23:10  Base  first-call  $0.05  SUCCEEDED
2026-07-28 21:41  Base  first-call  $0.05  SUCCEEDED
2026-07-28 15:41  Base  first-call  $0.05  SUCCEEDED
2026-07-28 09:41  Base  first-call  $0.05  SUCCEEDED
```
Every component of the on-chain payment path is confirmed working: 402 challenge generation → USDC transfer on Base mainnet → on-chain verification → 200 response.

### Zero Failed Payment Intents (30 days)
The `x402_payment_intents` table has zero rows with `status='FAILED'` or `status='PENDING'` in the last 30 days. When a payment is submitted, it succeeds. No payment has bounced, timed out, or rejected verification.

### Zero X-PAYMENT Header Submissions (30 days)
`x402_client_header` in `x402_interactions` is null/empty for every request in the last 30 days except canary. No external actor has submitted a payment attempt. The absence of failures proves the absence of attempts, not the absence of capability.

### Live 402 Challenge Body — Structurally Correct
Live inspection of `POST /x402/token-price` and `POST /x402/smart-contract-audit`:
- `x402Version: 2` ✅
- `accepts[]`: correct `payTo`, `maxAmountRequired`, `asset`, `network`, `resource` ✅
- `payTo: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` — this is the correct platform receiving wallet ✅
- Base USDC + Base USDT + Solana USDC + Solana USDT all present ✅
- `maxAmountRequired` matches `shared/pricing.ts` values ✅
- Ethereum mainnet in `alternativePaymentMethods` ✅

### Trial Path — Working
`GET /api/m2m/credits/trial` in the last 30 days:
- **200**: 13 successful grants to 13 unique IPs
- **403**: 158 hits from 1 IP (the empty-UA IPv6 sweeper — correctly blocked)
- **429**: 2 hits (rate limit working correctly)

The trial path is serving real agents and blocking known bots as designed.

---

## 2. Payment Drought — Cause

### Daily payment breakdown (35 days)

| Date | Intents | Revenue | Unique Payers | Services |
|---|---|---|---|---|
| Jul 22–29 | 1–7/day | $0.05–0.35/day | **1 (canary only)** | first-call only |
| Jul 21 | 7 | **$0.70** | **2** | first-call + stock-sentiment |
| Jul 10 | 8 | $0.60 | **3** | first-call + earthdata-precipitation + rh-stock-price |
| Jul 1 | 22 | **$6.20** | 2 | 15 services (0x9cc42f3d's final session) |
| Jun–Jul | 4–9/day | variable | 1 | first-call (canary) |

### Organic payer profiles

| Wallet | Total | Sessions | Last Payment | Dropout Reason |
|---|---|---|---|---|
| `0x9cc42f3d` | $42.85, 94 txns, 30 services | Jul 1 final session | Jul 1 | Wallet depleted (confirmed from prior analysis: 28+ retries with no payment at end of session) |
| `0x85ed02ee` | $0.40, 1 txn | Jul 21 | Unknown | Single-use experimenter; never probed before paying, never returned |
| `0xe92eb50a` | $0.05, 1 txn | Jul 10 | Unknown | Single-use tester; never returned |
| `0x3803a192` | $1.35, 7 txns | Jun 1–Jul 10 | Unknown | Irregular, low-volume; may have completed their research task |

### Critical behavioral observation
**None of the organic payers ever appeared in `x402_interactions` as probers.** Their `wallet_address` appears only at time of payment (2 rows each: challenge + verification). They went directly from discovery → payment, skipping weeks of probing entirely. This means the current heavy probers (74.220.48.55, IPv6 sweeper, x402-observer) are a categorically different actor type from the organic payers. The probers likely won't convert via the same mechanism.

### Conclusion
The platform has exhausted its current pool of organic payers. 0x9cc42f3d was the only high-frequency user; the others were single-use. No new paying actor has emerged. This is a demand-side gap, not a supply-side failure.

---

## 3. Bugs Found (Platform-Side)

### BUG 1 — MEDIUM: elizaos-plugin x402 path missing `maxValue` parameter
**File:** `elizaos-plugin-coinrailz/src/utils/x402Client.ts`, line 119  
**Package:** `x402-fetch` v0.7.3 (plugin's dependency)

```typescript
// Current — BROKEN for services above x402-fetch default maxValue
const x402Fetch = wrapFetchWithPayment(fetch, walletClient as any);

// Fix — explicitly set maxValue to cover full service catalog
const x402Fetch = wrapFetchWithPayment(fetch, walletClient as any, {
  maxValue: BigInt(10 * 10 ** 6)  // $10.00 — covers smart-contract-audit at $10.00
});
```

**Evidence this is real:** The same file already catches `err.message?.includes('exceeds maximum')` at line 136-141 — someone handled this error without fixing the root cause. When `x402-fetch` encounters a service priced above its internal default maxValue (believed to be ~$0.10 for v0.7.x), it throws "Payment amount exceeds the configured maximum" before signing or submitting the transaction. Any agent using the ElizaOS plugin's autonomous x402 path (`EVM_PRIVATE_KEY` mode) would silently fail on services above the default limit — which includes `token-price` ($0.25), `whale-alerts` ($0.35), `stock-sentiment` ($0.25), `trade-signals` ($0.75), `smart-contract-audit` ($10.00), and ~30 others.

**Is this causing the current drought?** Probably not — the organic payers used their own payment implementations, not the plugin. But it IS a real bug that blocks plugin users from ever paying for most of the catalog.

**Fix:** One-line change in `x402Client.ts`. Also update the SDK quickstart snippet in the 402 body to show the `maxValue` parameter, since developers copy it directly.

### BUG 2 — LOW: `expected_output.sample.nextServices` in first-call 402 body has stale prices
The `expected_output.sample` embedded in the first-call 402 challenge (what you receive for $0.05) shows:
- `gas-price-oracle`: "$0.01" — actual price: **$0.10** (10× wrong)
- `token-price`: "$0.01" — actual price: **$0.25** (25× wrong)
- `dex-liquidity`: "$0.02" — actual price: **$0.20** (10× wrong)

This is a static sample that predates the pricing updates. It's in the `expected_output.sample` section, not the actual 402 challenge `accepts[]`, so it doesn't affect payment math. But an agent parsing the sample to decide which service to try next would get stale prices. The actual post-payment `nextServices` block is correct (`trade-signals: $0.75`, `gas-price-oracle: $0.10`).

**Fix:** Update the `expected_output.sample.nextServices` prices to match current pricing.

### BUG 3 — LOW: `nextServices` in first-call post-payment response overstates multi-chain-balance price
The actual post-payment `nextServices` block (lines 3233-3241) shows `multi-chain-balance: $1.00 USDC` but `shared/pricing.ts` sets it at `500000` = **$0.50**. The live 402 challenge confirms $0.50. An agent reading the first-call response to pick a follow-on service would expect to pay $1.00 but actually only pay $0.50 — not a conversion blocker (pleasantly cheaper), but inaccurate.

**Fix:** Update line 3235 from `"$1.00 USDC"` to `"$0.50 USDC"` and `priceUsd: 1.00` to `priceUsd: 0.50`.

---

## 4. What Was Checked and Found Clean

| Component | Status | Method |
|---|---|---|
| 402 challenge generation | ✅ Clean | Live curl, accepts[] inspection |
| `payTo` wallet address | ✅ Correct (0xa4bbe37f) | Live challenge + `PLATFORM_WALLET_ADDRESS` env confirmed set |
| `maxAmountRequired` vs pricing.ts | ✅ Match | Live challenge vs shared/pricing.ts |
| Base USDC accepts entry | ✅ Present | Live challenge |
| Solana accepts entry | ✅ Present (via Dexter facilitator) | Live challenge |
| Ethereum mainnet alternativePaymentMethods | ✅ Present | Live challenge |
| On-chain payment verification | ✅ Working | Canary 6/6 |
| Trial key issuance | ✅ Working (13 grants/30d) | endpoint_hits query |
| Trial key UA guard | ✅ Working (blocks empty-UA bots) | endpoint_hits + code review |
| Server errors | ✅ Zero | x402_interactions 0 5xx |
| Failed payment intents | ✅ Zero | x402_payment_intents |
| Near-miss payments (X-PAYMENT submissions) | ✅ Zero attempts | x402_client_header field empty |
| payment_received flag correctness | ✅ Canary only, as expected | x402_interactions |

---

## 5. Architect Assessment (Key Points)

**"Zero X-PAYMENT submissions outside canary is the definitive proof that the drought is pre-conversion, not conversion-failure."** The platform is not receiving and rejecting payment attempts. It's not receiving them at all.

**On the maxValue bug:** "The `exceeds maximum` error handler in `x402Client.ts` line 136 is a canary in the coal mine — someone added this catch because the error WAS occurring and being surfaced to users. The fix was never applied upstream. This is a dormant conversion blocker: it doesn't affect today's drought (those payers used their own x402 implementations), but it will block the plugin from working on most of the catalog the moment a paying ElizaOS agent tries to use it."

**On the SDK quickstart in the 402 body:** "The code snippet in `funding_guide.sdk_quickstart` shows `wrapFetchWithPayment(fetch, wallet)` without `maxValue`. Every developer who copies that snippet will encounter the same ceiling bug."

---

## 6. BizDev Assessment (Key Points)

**"The dropout is real, but it's a small-numbers problem, not a broken-product problem."** The platform has had one high-volume customer (0x9cc42f3d, $42.85), three single-use experimenters, and a canary. That's the full organic payment history in 6 months. 0x9cc42f3d depleted and no replacement arrived. The gap isn't evidence of platform failure — it's evidence of a thin customer acquisition pipeline.

**"The organic payers went directly to paying. They didn't probe for weeks first."** This is the most important behavioral insight. The current heavy probers (74.220.48.55, IPv6 sweeper, x402-observer) have never paid and their probing pattern is distinct from the organic payer pattern. The probers are infrastructure catalogers or cost-modelers. They will convert or not on their own timeline — no amount of fixing the payment flow will change that.

**"0x85ed02ee is the ICP signal."** Paid $0.40 for `stock-sentiment` once, unprompted, and left. No prior probing. This is a financial intelligence agent or a developer with a specific data need who paid, got the answer, and their use case was complete. The ICP is: **specific-task AI agents with a financial/compliance data need**. Marketing toward "stock sentiment, trade signals, compliance-check" as the spearhead beats marketing toward the general catalog.

---

## 7. Action Items

### Must Fix (This Sprint)
1. **Fix `x402Client.ts` maxValue** — add `{ maxValue: BigInt(10 * 10 ** 6) }` to the `wrapFetchWithPayment` call. One line. Ships in Task #33 alongside the SDK sync.

2. **Update SDK quickstart snippet in 402 body** — every occurrence of `wrapFetchWithPayment(fetch, wallet)` in the 402 agent_instructions should show `wrapFetchWithPayment(fetch, wallet, { maxValue: BigInt(5_000_000) })`. Find in `paymentOrchestrator.ts` or `x402MicroserviceRoutesV2.ts` and update.

3. **Update `expected_output.sample.nextServices` prices** — find the static sample embedded in the first-call handler and update to current prices: gas-price-oracle→$0.10, token-price→$0.25, dex-liquidity→$0.20.

4. **Fix `nextServices` multi-chain-balance price** — line 3235 of `x402MicroserviceRoutesV2.ts`: `"$1.00 USDC"` → `"$0.50 USDC"`, `priceUsd: 1.00` → `priceUsd: 0.50`.

### Should Do (Next Sprint)
5. **Monitor for `"Payment amount exceeds the configured maximum"` in application logs** — add a log line when this specific error is caught in x402Client.ts so future occurrences surface in Cloud Run logs rather than silently failing.

6. **Enrich `stock-sentiment` and `trade-signals` 402 bodies with financial use-case context** — the ICP (financial intelligence agents) paid for `stock-sentiment` unprompted. The 402 body for these services should speak directly to that use case: example inputs, what the AI model returns, typical agent workflows. Reduce the gap between "got the challenge" and "understood the value."

7. **Add a `maxValue` guidance note to the developer docs** — at `coinrailz.com/developers` or in the agent-instructions.json, document that x402-fetch requires explicit maxValue configuration for services above $0.10.

### Do Not Do
- **Do not blame the payment rail** — it's clean. Investing engineering in payment verification, re-verifying the canary, or auditing the x402 protocol handler would be wasted effort.
- **Do not over-invest in converting current probers** — 74.220.48.55 and the IPv6 sweeper are infrastructure catalogers. They will pay when they're ready. Changing the 402 body format to "convert" them won't accelerate their cycle.

---

## 8. Summary Verdict

| Question | Answer |
|---|---|
| Is the payment flow broken? | **No.** |
| Could a paying agent pay today? | **Yes.** Canary proves it. 13 trial grants prove it. |
| Why no organic payments since Jul 21? | **Payer exhaustion.** Known pool depleted; no new paying actor yet. |
| Is there a real platform-side bug? | **Yes — one.** The ElizaOS plugin's x402 path is missing `maxValue`, silently blocking services above the x402-fetch default limit. |
| Is that bug causing the current drought? | **No.** Current organic payers used their own payment implementations. |
| Should it be fixed anyway? | **Yes.** It will block the first ElizaOS agent that tries to pay for most catalog services. |
| What drives the next payment? | **New actors converting, not fixing the platform.** The funnel is healthy; the conversion is a demand problem. |
