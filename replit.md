# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz provides cross-platform payment routing across 8 blockchains (7 EVM: Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, PulseChain + Solana), enabling AI agents and users to process payments with USDC settlement. The platform positions as the universal payment layer for the AI agent economy.

**Key Capabilities:**
- Multi-chain payment SDK (NPM, Python, Docker packages)
- x402 protocol micropayments (43 production microservices)
- Agent-to-agent commerce infrastructure
- DEX aggregation and P2P payment routing
- Integration with Coinbase CDP wallet management

**Business Vision:** Universal payment infrastructure for AI agent economy - neutral bridge across siloed ecosystems (ElizaOS, AgentKit, MCP, Virtuals).

---

## 🎯 ARCHITECTURE SNAPSHOT (January 3, 2026)

### What's Working ✅

| Component | Status | Verified By |
|-----------|--------|-------------|
| **Multi-chain payments (8 chains)** | ✅ Working | On-chain transactions visible |
| **Fee routing to platform wallet** | ✅ Verified | Architect review Jan 2, 2026 |
| **x402 microservices (43 services)** | ✅ Deployed | HTTP 402 responses functional |
| **SDK packages published** | ✅ Live | NPM: @coinrailz/agent-payments, PyPI: coinrailz |
| **Platform wallet receiving funds** | ✅ Verified | Alchemy API analysis shows 50+ transfers |
| **Invoice generation** | ✅ Working | Points to platform wallet |
| **Bazaar discovery integration** | ✅ Deployed | Coinbase discovery compatible |

### Fee Structure (Verified ✅)

```
Fee: 1.5% + $0.01 per transaction
Flow: Payer → Platform Wallet (gross) → Recipient (net)
Result: Fee retained by construction
```

**Two-step payment flow:**
1. Inbound: Payer sends FULL amount to `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`
2. Outbound: Platform forwards NET amount to recipient
3. Difference = Fee retained

### Platform Wallets

| Chain | Wallet Address | Status |
|-------|---------------|--------|
| EVM (All 7 chains) | `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` | ✅ Active |
| Solana | `Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k` | ✅ Active |

### On-Chain Revenue Analysis (Jan 3, 2026) - UPDATED

| Category | Transfers | Amount | Status |
|----------|-----------|--------|--------|
| 0x92ca4cef... | 64 | $32.35 USDC | ❓ Unknown external |
| 0x664630cd... | 23 | $15.26 USDC | ❓ Unknown external |
| 0x2f5134f7... (zauthx402-agent?) | 34 | ~$20 USDC | ⚠️ Likely external customer |
| 0xabe2e327... | 9 | $2.25 USDC | ❓ Unknown external |
| 0x8f7d6618... | 1 | $110 USDC | ❓ Unknown external |
| 0xd2e482f8... | 1 | $5 USDC | ❓ Unknown external |

**Current Wallet Balances (Jan 3, 2026):**
- Platform wallet (0xa4bbe37f...): **$51.98 USDC** ✅ ACCESSIBLE
- Legacy wallet (0x2f5134...): **$19.10 USDC** ⚠️ Potentially stuck

**SCAM TOKEN WARNING:**
- 0x8888888884f8b3a... sent 8888 tokens of "Telegram @TronVanity88_bot" - this is a SCAM airdrop, NOT real money ($0 value)

**zauthx402-agent Investigation (Jan 3, 2026):**
- First purchase: Dec 9, 2025 - bought `instant-agent-wallet` 18 times ($18)
- Hypothesis: External agent that created wallets via our service, uses them to pay for services
- Wallet 0x2f5134... is "legacy unsweepable" because created with old CDP credentials
- Business Development: Reach out to "Zauth" to verify ownership and convert to documented customer

**Apple Discovery Signal:**
- Applebot (Apple's crawler) first crawled x402 endpoints on Jan 2, 2026 (14 hits, 9 unique IPs)
- User agent: `Applebot/0.1; +http://www.apple.com/go/applebot` - VERIFIED LEGITIMATE

### SDK Distribution

| Package | Platform | Status |
|---------|----------|--------|
| @coinrailz/agent-payments | NPM | ✅ Published |
| coinrailz | PyPI | ✅ Published |
| Docker image | Docker Hub | ✅ Available |

### What Needs Work 🔧

| Component | Issue | Priority |
|-----------|-------|----------|
| **Cross-chain settlement** | Requires orchestrator (2-3 weeks) | ROADMAP |
| **External revenue verification** | Confirm if 0x92ca4c is real user | MEDIUM |
| **Service delivery automation** | Background job queue for async services | LOW |

### Recently Fixed (Jan 3, 2026) ✅

| Component | Fix Applied |
|-----------|-------------|
| **AI Marketplace Route** | FIXED: `/ai-marketplace` was incorrectly rendering AI Agent Management instead of services marketplace. Now correctly shows 43 purchasable services. |
| **Wallet Creation Logging (GET path)** | FIXED: Legacy GET handler bypassed logging. Now both GET (API key) and POST (x402) paths log payer attribution. |
| **Crypto Checkout E2E Test** | VERIFIED: Full flow tested - service selection → customer info → crypto payment → instructions displayed with wallet address, amount, network. |
| **Wallet Creation Logging** | NEW: `agentWallets` and `agentWalletEvents` tables now track wallet creations with payer attribution (wallet address, IP, user agent, tx hash) |
| **Crypto Checkout for Marketplace** | USDC payment option added alongside Stripe. Payment method selector, on-chain verification via Alchemy |
| **AI Agent Marketplace UI** | Stats display fixed, 43 services visible, test button removed |
| **SDK Transaction Logging** | `sdk_transactions` table + logging function with hashed API keys |
| **Marketplace Stats API** | Null-safe handling, returns activeServices/platformServices correctly |
| **Checkout Flow** | sessionStorage cleanup after consumption |
| **Registration Lockdown** | External agent registration returns 403 REGISTRATION_CLOSED |

### Crypto Checkout Architecture (NEW)

**Endpoints:**
- `POST /api/ai-marketplace/crypto/create-pending-order` - Creates payment intent with USDC instructions
- `POST /api/ai-marketplace/crypto/verify-payment` - Verifies on-chain tx, creates marketplace order

**Payment Flow:**
1. User selects "Crypto" payment method in checkout
2. Backend creates intent in `x402_payment_intents` table with full metadata
3. Frontend shows payment instructions (address, amount, network)
4. User sends USDC from their wallet
5. User submits tx hash for verification
6. Backend verifies via Alchemy RPC, creates `marketplace_orders` entry, marks delivered

**Data Tables Used:**
- `x402_payment_intents` - Durable payment tracking
- `x402_payments` - Payment analytics logging
- `marketplace_orders` - Order fulfillment (same as Stripe)

### Architectural Clarifications

**Multi-chain vs Cross-chain:**
- ✅ **Multi-chain CAPABLE**: Accept payments on any of 8 chains, settle on same chain
- ⏳ **Cross-chain SETTLING**: Receive on Chain A, payout on Chain B - requires future infrastructure

**Missing for cross-chain:**
1. Settlement Orchestrator service
2. Payment routing metadata (sourceChain, destinationChain)
3. Escrow + delivery verification
4. Internal liquidity management

---

## User Preferences
- **⚠️ ABSOLUTE HONESTY COMMITMENT**: NEVER LIE TO USER. Always report actual results, failures, and truth. User has been financially harmed by previous dishonest claims about outreach success when systems actually failed.
- **MANDATORY FACT VERIFICATION**: Report only verified facts. Show database query results for any claim. No claims about revenue, outreach, or success without actual database/API evidence first.
- **❌ ABSOLUTE NO-SIMULATION RULE**: NEVER simulate, mock, fake, or create placeholder implementations unless EXPLICITLY asked. All code must perform real actions or return errors/not-implemented messages.
- **AI AGENT OUTREACH TARGET LIST**: Truth Terminal (@truth_terminal), ai16z/ElizaOS (Shaw Walters), Luna/Virtuals Protocol, FereAI (Coinbase partner). Focus on offering payment infrastructure to successful AI agent platforms.
- **Code Quality**: Maintain all existing functionality while optimizing for performance
- **Platform Stability**: Prioritize stability under high-volume operations
- **Icon Management Protocol**: Check `client/src/lib/minimal-icons-clean.tsx` first when adding icons
- **CRITICAL SEPARATION REQUIREMENT**: Never mix production and development code in same execution path
- **OPTIMIZATION SAFETY RULE**: Only conservative optimizations until post-deployment

## System Architecture

The platform uses Coinbase CDP wallet management with USDC-first approach, structured around unified payment processing, AI marketplace service delivery, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** x402 protocol for HTTP 402-based payments with USDC on Base Chain. Coinbase CDP wallet creation and Alchemy RPC verification. ERC-8004 Blockchain Identity for agent identities.
- **Authentication:** Coinbase OAuth, Replit OAuth, and email/password with PostgreSQL-backed sessions.
- **x402 Microservices**: 43 production-ready services across 10 categories. Compatible with Coinbase Bazaar, x402scan, and A2A discovery bots.
- **Discovery Engine**: Multi-layer discovery with 9 active methods for identifying AI agents.
- **Payment Intent Ledger**: Durable payment intent ledger with state transitions and replay protection.
- **GPT In-Chat Credit Purchase**: Endpoints for purchasing credits directly in ChatGPT.
- **Hybrid Facilitator**: `getFacilitatorUrl()` uses CDP facilitator when `CDP_API_KEY_ID` present, falls back to x402.org.
- **x402Version Spec Compliance**: Uses `x402Version: 2` (number) per official Coinbase spec.
- **Bazaar Discovery**: `server/discovery/bazaarRegistrar.ts` for Coinbase Bazaar indexing.
- **GPT Session Auth**: Zero-friction ChatGPT integration via session-based auth.

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, transaction execution
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure
- **x402 Protocol:** HTTP 402-based autonomous AI agent payment standard
- **Circle:** USDC wallet management (legacy, transitioning to CDP)
- **CoinGecko API:** Real-time cryptocurrency pricing
- **DEX Screener:** Pricing data for micro-cap tokens
- **1inch API / Uniswap V3:** DEX aggregation and liquidity
- **Stripe:** Credit/debit card payment processing
- **PayPal:** Instant payment processing
- **PostgreSQL:** Database-backed session storage and core data persistence
- **Telegram:** Mini-App hosting and @coinrailz_bot webhook

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| SDK Payment Routes | `server/routes/sdkPaymentsRoutes.ts` |
| x402 Microservices | `server/routes/x402MicroserviceRoutesV2.ts` |
| Coinbase CDP Service | `server/services/coinbaseCDPService.ts` |
| Solana Payments | `server/routes/sdkSolanaRoutes.ts` |
| Bazaar Discovery | `server/discovery/bazaarRegistrar.ts` |
| Database Schema | `shared/schema.ts` |
| Fee Sweep Service | `server/services/x402FundsSweepService.ts` |

## Recent Changes Log

| Date | Change | Status |
|------|--------|--------|
| Jan 2, 2026 | Architecture snapshot created | ✅ |
| Jan 2, 2026 | Fee routing verified correct | ✅ |
| Jan 2, 2026 | On-chain analytics run via Alchemy | ✅ |
| Dec 30, 2025 | SDK packages published | ✅ |
