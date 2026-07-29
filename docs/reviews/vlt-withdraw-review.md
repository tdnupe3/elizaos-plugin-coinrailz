# Architect Review — vlt-usdc-withdraw + minShares fix

**Date:** 2026-07-29  
**Verdict:** APPROVED WITH NOTES — no blocking defects; ship current implementation.  
**Reviewer:** Architect subagent (evaluate_task, includeGitDiff: true)  
**Files reviewed:**
- `server/services/vltUsdcWithdrawService.ts`
- `server/services/vltUsdcDepositService.ts`
- `server/routes/x402MicroserviceRoutesV2.ts` (lines 6202–6260)

---

## 1. vltUsdcWithdrawService.ts — WARN

| Concern | Verdict | Notes |
|---|---|---|
| Calldata builder correctness | PASS | `redeem(shares, minVltOut, minUsdcOut, deadline, receiver)` ABI-encoded correctly with typed BigInt inputs and normalised receiver |
| BigInt arithmetic safety | PASS | Raw-token math stays BigInt end-to-end for floors; `Number(...)` coercions limited to estimation metadata only |
| Graceful degradation | PASS | RPC/DexScreener failures collapse cleanly to zero-fallback mins without throwing |
| Address normalisation | PASS with note | `getAddress(recipient.toLowerCase())` accepts all hex forms (lower/upper/checksummed) but intentionally bypasses checksum-typo detection for mixed-case inputs |
| 50/50 TVL split heuristic | **WARN** | Reasonable lightweight estimate, but can materially misestimate token mix during strong price displacement, potentially setting min-outs too high and causing redeem reverts |
| 20-min deadline | PASS | Appropriate for an unsigned calldata builder |
| `errorResult()` slippage literal `200` | PASS | Correct fix for the prior BigInt JSON serialization bug |

## 2. vltUsdcDepositService.ts — minShares fix — PASS

| Concern | Verdict | Notes |
|---|---|---|
| Fix implementation | PASS | `previewDeposit(vltRaw, usdcRaw) × 0.98` with `1n` floor correctly implemented |
| Fallback safety | PASS | `1n` fallback is meaningfully safer than `0n` (prevents zero-min mint acceptance path) |
| Error handling | PASS | try/catch degrades cleanly if `previewDeposit` reverts or is unavailable |

## 3. Route handler (x402MicroserviceRoutesV2.ts) — PASS

| Concern | Verdict | Notes |
|---|---|---|
| `sendWithdrawJson` BigInt replacer | PASS | Correct and recursive via `JSON.stringify` replacer |
| Double BigInt-safe serialization | PASS | Defensible; avoids audit-layer serialization faults and response crashes |
| Route is correctly free | PASS | Direct `router.post("/vlt-usdc-withdraw", ...)` — no `createPaymentOrchestrator` |

---

## Blocking Findings

**None identified.**

---

## Non-Blocking Notes

1. **Mixed-case checksum relaxation** — document in service JSDoc that intentional relaxation of EIP-55 checksum validation is by design (agents commonly send lowercase addresses).
2. **Heuristic min-out guardrail** — consider a conservative fallback strategy: if heuristic-derived mins diverge significantly from on-chain preview signals, downgrade to zero-fallback with a clear warning rather than potentially setting floors too high and causing vault reverts during price extremes.

---

## Security

No authz, injection, or secret-handling issues observed in scoped files.

---

## Recommendation

**Ship.** Address the heuristic guardrail in a follow-up as a resilience improvement, not a blocker.
