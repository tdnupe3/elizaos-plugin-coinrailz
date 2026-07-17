---
name: MPP credential UA guard bypass
description: hasMppCredential bypass for free-tier UA check in paymentOrchestrator; PROTOCOL_MISMATCH 402 when MPP hits /x402/*
---

# MPP Credential — UA Guard Bypass

## The Rule
When `Authorization: Payment <credential>` is present on a `/x402/*` request, skip `isEligibleForFirstCallFree()` entirely and return a `PROTOCOL_MISMATCH` 402 with routing guidance instead.

**Why:** The UA guard inside `isEligibleForFirstCallFree()` only exists to block rotating-IP scanners from claiming free calls. An agent submitting an MPP credential is attempting to *pay*, not claim a freebie — the UA guard is irrelevant and misleading. Agents routed through Cloudflare Workers/WARP have their UA stripped by CF infrastructure, not because they're bad actors.

**How to apply:**
- `hasMppCredential = /^Payment\s+/.test(req.headers.authorization ?? '')`
- Condition: `if (!xPayment && !hasMppCredential && FIRST_CALL_FREE_SERVICES.includes(serviceName))`
- After free-tier block: `if (hasMppCredential && !xPayment)` → return PROTOCOL_MISMATCH 402

## What the PROTOCOL_MISMATCH 402 tells the agent
- Use `/mpp/<service>` with `Authorization: Payment` header, OR
- Send USDC on-chain then resubmit to `/x402/<service>` with `X-PAYMENT` header

## What stays protected
- Trial credits endpoint (`GET /api/m2m/credits/trial`) UA guard is **unchanged** — protects $5 free trial from no-UA scanners regardless of payment intent
- Replay protection, on-chain verification, and IP rate limiting all still apply on the paid paths

## Background
Cloudflare IPv6 agent 2a06:98c0:3600::103 triggered this — did a comprehensive 76-service catalog sweep on Jul 17 2026, issued MPP challenges on 5+ services, couldn't complete the handshake. Architect confirmed the fix was safe before implementation.
