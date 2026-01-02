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

## 🎯 ARCHITECTURE SNAPSHOT (January 2, 2026)

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

### On-Chain Revenue Analysis (Jan 2, 2026)

| Category | Transfers | Amount | Status |
|----------|-----------|--------|--------|
| Internal testing (0x2f5134...) | 20 | ~$19.55 USDC | ⚠️ Test funds |
| Unknown/External wallets | 30 | ~$40+ | ❓ Investigating |
| Potentially real revenue | 2 wallets | ~$37 | Needs verification |

**Notable external transfers:**
- 0x92ca4cef... → 23 transfers, ~$23 USDC (Nov-Dec)
- 0x0a2854... → 1 transfer, $14.87 USDT (Dec 14)

### SDK Distribution

| Package | Platform | Status |
|---------|----------|--------|
| @coinrailz/agent-payments | NPM | ✅ Published |
| coinrailz | PyPI | ✅ Published |
| Docker image | Docker Hub | ✅ Available |

### What Needs Work 🔧

| Component | Issue | Priority |
|-----------|-------|----------|
| **AI Agent Marketplace UI** | Needs fixing/polish | HIGH - Next task |
| **Cross-chain settlement** | Requires orchestrator (2-3 weeks) | ROADMAP |
| **Database transaction logging** | SDK payments not logged to DB | MEDIUM |
| **External revenue verification** | Confirm if 0x92ca4c is real user | MEDIUM |

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
