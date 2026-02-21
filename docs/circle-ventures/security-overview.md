# Coin Railz — Security & Key Management Overview

**Prepared for Circle Ventures**
**February 2026**

---

## 1. Current Security Posture

Coin Railz is a pre-audit, pre-SOC2 platform with production security controls implemented across payment verification, wallet management, and fund transfer operations. This document provides an honest assessment of current security measures and a roadmap for institutional-grade compliance.

---

## 2. Payment Verification Security

### 2.1 x402 Payment Verification

The payment orchestrator (`server/middleware/paymentOrchestrator.ts`) implements multi-layer verification:

| Control | Implementation |
|---------|---------------|
| Transaction receipt confirmation | Up to 10 retries with 3-second intervals (30-second window) for RPC indexing lag |
| USDC contract validation | Per-chain USDC contract address verification — rejects payments to wrong token contracts |
| Amount tolerance enforcement | Verifies payment amount meets or exceeds service price |
| Sender address extraction | Records payer address for audit trail |
| Multi-format parsing | Handles raw tx hashes, EIP-712 signatures, Coinbase facilitator payloads (MessagePack + gzip), and Base64 payloads |

### 2.2 Replay Protection

| Control | Implementation |
|---------|---------------|
| Unique transaction hash constraint | `txHash` column in payment intent ledger has database-level unique constraint |
| State machine | Payment intents follow PENDING → CONFIRMING → SUCCEEDED / FAILED transitions; no re-entry from terminal states |
| Expiration enforcement | Payment intents have `expires_at` timestamps; expired intents cannot be completed |

### 2.3 Hybrid Facilitator Security

| Control | Implementation |
|---------|---------------|
| Primary facilitator | Coinbase CDP facilitator (institutional-grade) |
| Fallback facilitator | x402.org facilitator (community standard) |
| Dynamic selection | System selects available facilitator without hard dependency on either |

---

## 3. Wallet Security

### 3.1 Wallet Whitelisting System

All outbound fund transfers are protected by a database-persisted wallet whitelist (`server/services/coinbaseCDPService.ts`):

| Control | Implementation |
|---------|---------------|
| Whitelist enforcement | Every `sendTransaction`, `sendUSDC`, `sendToken`, and `sweepDepositWallet` call validates destination against whitelist before execution |
| Blacklist | Known compromised or inaccessible wallets are permanently blocked (e.g., CDP_LOST wallet with $39.35 locked) |
| Ephemeral wallet protection | CDP-created ephemeral wallets blocked from receiving transfers until explicitly whitelisted |
| Admin-only whitelisting | New wallets require explicit approval with `approvedBy` attribution and reason logging |
| Cache with TTL | Whitelist cached for 60 seconds to balance performance with security |

### 3.2 Wallet Safety Layer

| Control | Implementation |
|---------|---------------|
| Centralized wallet registry | All platform wallets registered with labels and validation |
| Address validation | Format and checksum validation before any transfer |
| Dry-run default | Fund transfer scripts default to dry-run mode; require explicit confirmation for live execution |
| Transfer logging | All fund movements logged with wallet labels, amounts, and context |

### 3.3 Key Management Model

| Component | Current Approach |
|-----------|-----------------|
| Wallet key custody | Coinbase CDP Server Wallets (v2) — keys managed by Coinbase infrastructure |
| Key storage | CDP API keys stored as encrypted environment secrets (Replit Secrets) |
| Access control | Single-operator access (founder only) |
| Key rotation | Manual; planned for automated rotation post-hire |

**Current custody model**: Coinbase CDP manages private keys through their Server Wallet v2 infrastructure. Coin Railz does not hold or manage raw private keys directly. This provides institutional-grade key management through Coinbase's infrastructure without requiring an in-house HSM or MPC implementation.

**Limitation**: Single-operator key access. This is a known risk that will be addressed with the security hire (see Team & Hiring Plan).

---

## 4. Application Security

### 4.1 Input Validation

| Control | Implementation |
|---------|---------------|
| Request validation | Zod schema validation on all API inputs |
| Payment header parsing | Strict format validation with explicit rejection of malformed headers |
| Amount verification | Integer arithmetic for micro-USDC amounts (avoids floating-point precision issues) |

### 4.2 Authentication Methods

The payment orchestrator supports 6 authentication/payment methods, evaluated in sequence:

1. **Bundle Subscription** — Pre-purchased service bundles (database-verified)
2. **First-Call-Free** — IP + UserAgent eligibility check with 30-day window
3. **GPT Session Auth** — OpenAI GPT Store session verification
4. **API Key Auth** — `X-API-KEY` or `Bearer cr_live_*` header validation
5. **Credits Service** — Pre-purchased balance with ACID debit transactions
6. **On-Chain USDC Payment** — x402 protocol payment verification

### 4.3 Database Security

| Control | Implementation |
|---------|---------------|
| Atomic transactions | `db.transaction()` for all fund movements (credits, D2D transfers, withdrawals) |
| Unique constraints | Transaction hashes, order IDs, and idempotency keys enforce uniqueness |
| Parameterized queries | Drizzle ORM prevents SQL injection |
| Secret management | Database credentials stored in encrypted environment variables |

---

## 5. Infrastructure Security

### 5.1 Current Infrastructure

| Component | Provider | Security Model |
|-----------|----------|---------------|
| Application hosting | Replit | Managed container isolation |
| Database | Neon PostgreSQL | TLS-encrypted connections, managed backups |
| Wallet operations | Coinbase CDP | Institutional-grade key management |
| Blockchain RPC | Alchemy | API key authenticated, rate limited |
| Fiat on-ramp | Transak | HMAC-SHA256 webhook verification |
| DNS/SSL | Replit managed | Automatic TLS certificate provisioning |

### 5.2 Network Security

| Control | Implementation |
|---------|---------------|
| HTTPS enforcement | All endpoints served over TLS |
| Webhook verification | HMAC-SHA256 signature verification for Stripe and Transak webhooks |
| Rate limiting | Per-IP rate limiting on sensitive endpoints |
| CORS configuration | Restricted to known origins |

---

## 6. Audit Status

### 6.1 Current State (Honest Disclosure)

| Area | Status |
|------|--------|
| External code audit | **Not yet conducted** |
| Penetration testing | **Not yet conducted** |
| SOC2 certification | **Not started** |
| Internal security review | Founder-conducted code review only |
| Bug bounty program | **Not established** |

### 6.2 Security Incidents

No security incidents have occurred to date. No funds have been lost through security breaches. One wallet ($39.35) was lost due to an operational error (CDP wallet key management issue), which is now blacklisted to prevent further interaction.

---

## 7. SOC2 Roadmap

### Phase 1: Foundation (Months 1–3 post-funding)

| Milestone | Description |
|-----------|-------------|
| Hire security-focused developer | Dedicated cybersecurity expertise |
| Access control policy | Multi-user access with role-based permissions |
| Key rotation automation | Automated CDP API key and secret rotation |
| Logging and monitoring | Centralized audit logging for all sensitive operations |
| Incident response plan | Documented procedures for security events |

### Phase 2: Audit Preparation (Months 4–6)

| Milestone | Description |
|-----------|-------------|
| External code audit | Third-party review of payment verification and wallet management code |
| Penetration testing | External pentest of production infrastructure |
| Controls inventory | Document all security controls against SOC2 Trust Service Criteria |
| Policy documentation | Information security policy, acceptable use, data classification |

### Phase 3: SOC2 Engagement (Months 7–12)

| Milestone | Description |
|-----------|-------------|
| SOC2 Type I readiness assessment | Gap analysis against Trust Service Criteria |
| Remediation | Address gaps identified in readiness assessment |
| SOC2 Type I audit (target) | Point-in-time assessment of controls design |
| SOC2 Type II observation period | Begin 3–6 month observation window |

**Estimated timeline to SOC2 Type I**: 9–12 months post-funding
**Estimated cost**: $50,000–$100,000 (audit firm + tooling + remediation)

---

## 8. Immediate Security Priorities (Pre-Audit)

1. **Multi-operator access**: Eliminate single-operator risk by adding authorized personnel
2. **Automated key rotation**: CDP API keys and database credentials on scheduled rotation
3. **Comprehensive audit logging**: Centralized, immutable logs for all payment and wallet operations
4. **Wallet backup procedures**: Documented recovery procedures for all platform wallets
5. **Dependency scanning**: Automated vulnerability scanning for npm dependencies

---

*This document represents an honest assessment of current security controls. Coin Railz acknowledges pre-audit status and is committed to institutional-grade security compliance as the platform scales.*
