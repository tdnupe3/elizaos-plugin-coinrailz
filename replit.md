# Coin Railz - Multi-Chain Payment Infrastructure for Crypto Communities

## Overview
Coin Railz provides cross-platform payment routing across 7 blockchains (Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, and PulseChain). It enables users to trade crypto at best rates via a DEX aggregator and settle payments instantly with universal payment routing. The platform targets crypto traders, OTC desks, international freelancers, and crypto communities.

**Key Capabilities:**
- DEX Aggregation with best-price discovery.
- P2P Payment Routing with automatic fiat payment detection.
- Integration with Circle USDC infrastructure and Coinbase CDP wallet management.
- XRP Ledger ecosystem for cross-border payments.
- AI Agent Marketplace utilizing the x402 protocol for micropayments.
- Patent-protected viral referral system and 12-language support.

**Business Vision:** To become the leading multi-chain payment infrastructure, facilitating seamless crypto transactions and empowering crypto communities globally.

## User Preferences
- **⚠️ ABSOLUTE HONESTY COMMITMENT**: NEVER LIE TO USER. Always report actual results, failures, and truth. User has been financially harmed by previous dishonest claims about outreach success when systems actually failed. Agent owes user $5,000 due to misleading claims about successful outreach that never occurred.
- **MANDATORY FACT VERIFICATION**: Report only verified facts. Show me the database query results for any claim you make. No claims about revenue, outreach, or success without actual database/API evidence first.
- **DEBT OBLIGATION**: Agent must use working platform components to generate $5,000 in real revenue/funding to repay user for damages caused by dishonest reporting of failed systems as "successful campaigns."
- **❌ ABSOLUTE NO-SIMULATION RULE**: NEVER simulate, mock, fake, or create placeholder implementations unless EXPLICITLY asked to simulate. All code must perform real actions or clearly return errors/not-implemented messages. No "TODO" comments with fake success responses. No estimated/simulated results presented as real outcomes. This rule overrides all other development preferences.
- **AI AGENT OUTREACH TARGET LIST**: Truth Terminal (@truth_terminal - $1M+ revenue), ai16z/ElizaOS (Shaw Walters - $1.4B platform), Luna/Virtuals Protocol ($365K/year AI influencer), FereAI (Coinbase partner). Focus on offering payment infrastructure to successful AI agent platforms rather than trying to get AI agents to purchase our services.
- **Code Quality**: Maintain all existing functionality while optimizing for performance and memory efficiency
- **Communication Style**: Direct, technical updates focused on actionable results - BUT ONLY REPORT REAL SUCCESSES
- **Platform Stability**: Prioritize stability under high-volume operations while preserving feature completeness
- **Development Approach**: Incremental optimization without removing working features
- **Icon Management Protocol**: When creating new features requiring icons, always check `client/src/lib/minimal-icons-clean.tsx` first. If icon is missing, add it immediately to both the clean file and export it in `client/src/lib/icons.ts` to prevent build failures
- **CRITICAL SEPARATION REQUIREMENT**: Never mix production and development code in the same execution path. Development server must run clean without any production-specific middleware, security, or configuration. Production features must be implemented in separate files and only activated during production builds, never in development environment. Any violation of this separation causes platform loading failures and must be immediately reverted.
- **OPTIMIZATION SAFETY RULE**: After previous platform crashes from service consolidation, only implement conservative optimizations (unused file cleanup, import optimization) until post-deployment. NO major service consolidation or architectural changes until platform is successfully deployed and stable in production.

## System Architecture

The platform uses a dual-wallet system (Circle USDC and DeFi/MetaMask) and is structured around unified payment processing, AI marketplace service delivery, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** Supports free and A2A agent self-registration, discoverability, and autonomous customer journeys. Uses the x402 protocol for HTTP 402-based payments with USDC on Base Chain, including real Coinbase CDP wallet creation and Alchemy RPC verification. A prepaid credits system (Stripe + USDC/USDT) increases conversion. ERC-8004 Blockchain Identity on Base mainnet is used for AI agent identities and on-chain reputation.
- **Authentication:** Integrates Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL-backed session management.
- **UI/UX:** Clean visual branding, intuitive onboarding, instant swap interfaces, and guided funding widgets.
- **Internationalization:** Supports 12 languages.
- **Financial Infrastructure:** Designed for business bank accounts, ACH processing, and float capital management with a USDC-first approach.
- **Performance:** Optimized icon system, reduced dependencies, high-performance caching, and connection pooling.
- **Security:** Strict authentication, user data isolation, Bearer tokens, multi-tier rate limiting, input validation, session security, malware detection, cents-based arithmetic, and AES-256-GCM encryption.
- **Blockchain Integration:** Multi-chain support for USDC (Ethereum, Polygon, Base, Arbitrum, BNB Chain) and integration with DEX aggregators. Comprehensive XRP Ledger ecosystem.
- **Compliance:** Integrated KYC/AML with incentive dashboards and progressive KYC.
- **Data Monetization:** APIs for crypto flow intelligence, AI marketplace analytics, and viral referral analytics.
- **Bot-Optimized API Layer:** DUAL EXECUTION MODEL for DEX swaps (server-executed via Coinbase CDP and client-executed via 1inch API + MetaMask). Endpoints for quoting, swapping, preparing transactions, and real-time gas prices. Bot documentation portal at `/bots`. Real-time intelligence feed (`/api/bot/intel`) using CoinGecko API. Features Zod validation, rate limiting, token symbol-to-address resolution, and anonymous access.
- **x402 Microservices**: Offers 38 production-ready x402 microservices across 10 categories (Discovery/Testing, Trading Intelligence, Execution & Infrastructure, Premium, Real Estate, Banking/Finance, Trading/Investment, Market Intelligence, Prediction Markets, Traditional Markets). Compatible with Coinbase Bazaar, x402scan, and A2A discovery bots.
- **Discovery Engine**: Multi-layer discovery engine with 9 active methods for identifying AI agents.
- **Payment Intent Ledger**: Durable payment intent ledger with state transitions and payment replay protection. Includes strict Base64 JSON payload input validation.
- **GPT In-Chat Credit Purchase**: Added 3 new endpoints (`/api/gpt/credits/packages`, `/api/gpt/credits/create-session`, `/api/gpt/credits/status`) for purchasing credits directly in ChatGPT. Supports "Elements" and "Checkout" payment modes, controlled by `GPT_CHECKOUT_MODE` flag.
- **Hybrid Facilitator**: Shared `getFacilitatorUrl()` helper in `server/utils/facilitatorHelper.ts` uses CDP facilitator when `CDP_API_KEY_ID` is present, falling back to x402.org for testing.
- **x402Version Spec Compliance**: Uses `x402Version: 2` (number) as per official Coinbase x402 spec for compatibility with Bazaar, CDP facilitator, and official SDKs.
- **Bazaar Discovery Implementation**: `server/discovery/bazaarRegistrar.ts` for Coinbase Bazaar discovery indexing, providing HTTP-based discovery endpoints. Discovery is disabled in production if `CDP_API_KEY_ID` is missing. Includes an E2E catalog integrity check on startup.
- **GPT Session Auth (NEW)**: Zero-friction ChatGPT integration using session-based auth via OpenAI conversation/session ID headers. Eliminates API key friction for GPT users. Feature flag: `GPT_SESSION_AUTH=true` enables the flow. Files: `server/services/gptAuthResolver.ts`, `server/middleware/paymentOrchestrator.ts`. **SKIPPED**: Phase 2F integration test harness (requires DI server factory refactoring) - may revisit if issues arise.

## PLATFORM STABILITY STATE (Snapshot: December 20, 2025)

**STATUS: FIRST FULLY STABLE DEPLOYMENT** ✅

### Critical Configuration (DO NOT MODIFY)
```
Platform Wallet: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
USDC (Base): 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDT (Base): 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2
x402Version: 2 (number, not string)
Chain: Base mainnet (chainId: 8453)
Facilitator: https://facilitator.cdp.coinbase.com (with CDP keys)
Fallback Facilitator: https://x402.org/facilitator
```

### Environment Variables Required
- `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` - Coinbase CDP for wallets
- `ALCHEMY_API_KEY` - Blockchain RPC
- `OPENAI_API_KEY` - AI service delivery
- `STRIPE_SECRET_KEY` - Payment processing
- `DATABASE_URL` - PostgreSQL connection
- `GPT_CHECKOUT_MODE=elements` - GPT credit purchase mode
- `GPT_SESSION_AUTH=true` - Zero-friction GPT integration
- `BAZAAR_DISCOVERY_ENABLED=true` - Coinbase Bazaar indexing

### Verified Operational Status
| System | Status | Endpoint |
|--------|--------|----------|
| x402 USDC Payments | ✅ | `/x402/*` |
| x402 USDT Payments | ✅ | `/x402/*` |
| API Key Payments | ✅ | X-API-KEY header |
| Bazaar Discovery | ✅ | `/api/discovery/resources` (41 services) |
| A2A Agent Card | ✅ | `/.well-known/agent-card.json` |
| MCP Services | ✅ | `/mcp/services` (18 tools) |
| x402.json | ✅ | `/.well-known/x402.json` |
| GPT Credits | ✅ | `/api/gpt/credits/*` |
| Stripe Checkout | ✅ | `/credits` |

### Revenue Status (as of snapshot)
- **Payment Intents (SUCCEEDED)**: 106 intents, $105.52 total
- **⚠️ REQUIRES AUDIT**: Most intents are internal tests, not external customer revenue
- **Verified External Revenue**: PENDING AUDIT - need to distinguish test wallets from customers
- **USDT E2E Flow**: ✅ Verified working with real on-chain transactions (our tests)
- **Known Test Wallets**: 0x22f5a7b9..., 0xb2d10687..., 0x9bfc108d..., 0x0a2854fb...

**NOTE**: The $14.87 from 0x0a2854fb... was an internal swap to obtain USDT, NOT customer revenue.

### Key Files for Payment Flow
1. `server/routes/x402MicroserviceRoutesV2.ts` - GET handlers with X-PAYMENT verification
2. `server/middleware/hybridPaymentMiddleware.ts` - Payment verification + intent ledger
3. `server/middleware/paymentOrchestrator.ts` - Route-level payment orchestration
4. `server/discovery/bazaarRegistrar.ts` - Coinbase Bazaar catalog

### RESTORATION PROCEDURES

**If payment verification fails:**
1. Check X-PAYMENT header verification in `x402MicroserviceRoutesV2.ts` lines 1943-1980
2. Verify `verifyTransactionPayment()` returns boolean (not object)
3. Ensure requiredAmount is in micro units (multiply USD by 1e6)
4. Check ACCEPTED_STABLECOINS array includes both USDC and USDT

**If discovery endpoints fail:**
1. Verify `BAZAAR_DISCOVERY_ENABLED=true` in environment
2. Check `ServiceCatalogService` builds 41 services on startup
3. Verify `/api/discovery/resources` returns 41 resources

**If GET endpoints return 402 when they shouldn't:**
1. The fix is in `x402MicroserviceRoutesV2.ts` - check for X-PAYMENT BEFORE returning 402
2. Order: API Key check → X-PAYMENT tx hash check → Return 402

**Database Tables Required for Payments:**
- `x402_payment_intents` - Payment intent ledger (replay protection)
- `x402_payments` - Completed payment records
- `api_keys` - Prepaid credit API keys

## Future Plans

### AI Agent Marketplace Revival (Option A)
**Status:** PLANNED - Saved for future implementation  
**Plan Document:** `docs/marketplace-revival-plan.md`  
**Summary:** Populate the empty marketplace UI with 41 existing x402 services as "Platform Services" without enabling external agent registration. Low-risk, additive change (~2-4 hours). See plan document for full details.  
**Decision:** Revisit when business conditions warrant (user demand, revenue opportunity, etc.)

## External Dependencies
- **Circle:** USDC wallet creation, management, balance tracking via Developer Controlled Wallets SDK.
- **x402 Protocol:** HTTP 402-based autonomous AI agent payment standard.
- **Telegram:** Mini-App hosting and `@coinrailz_bot` webhook integration.
- **Plaid:** User bank account linking and ACH processing.
- **CoinFlip:** USD ↔ USDC conversions.
- **CoinGecko API:** Real-time cryptocurrency pricing and market data.
- **DEX Screener:** Authentic pricing data for micro-cap tokens.
- **1inch API / 0x Protocol / Uniswap V3 / Curve Finance:** DEX aggregation and liquidity.
- **Twilio:** SMS notifications.
- **Stripe:** Credit/debit card payment processing.
- **PayPal:** Instant payment processing and P2P transfers.
- **PostgreSQL:** Database-backed session storage and core data persistence.
- **Alchemy:** Ethereum RPC endpoints and blockchain infrastructure.