# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz provides cross-platform payment routing across 8 blockchains (7 EVM: Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, PulseChain + Solana), enabling AI agents and users to process payments with USDC settlement. The platform aims to be the universal payment layer for the AI agent economy. Key capabilities include a multi-chain payment SDK, x402 protocol micropayments (supported by 43 production microservices), agent-to-agent commerce infrastructure, DEX aggregation, P2P payment routing, and integration with Coinbase CDP wallet management.

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
The platform utilizes Coinbase CDP wallet management with a USDC-first approach, centered on unified payment processing, an AI marketplace for service delivery, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** Implemented using the x402 protocol for HTTP 402-based payments with USDC on Base Chain, leveraging Coinbase CDP for wallet creation and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password authentication with PostgreSQL-backed sessions.
- **x402 Microservices**: 43 production-ready services designed for compatibility with Coinbase Bazaar, x402scan, and A2A discovery bots.
- **Discovery Engine**: A multi-layer discovery mechanism incorporating 9 active methods for identifying AI agents.
- **Payment Intent Ledger**: A durable ledger for payment intents, supporting state transitions and replay protection.
- **GPT In-Chat Credit Purchase**: Provides endpoints for purchasing credits directly within ChatGPT.
- **Hybrid Facilitator**: The `getFacilitatorUrl()` function dynamically uses either the CDP facilitator (if `CDP_API_KEY_ID` is present) or falls back to x402.org.
- **x402Version Spec Compliance**: Adheres to `x402Version: 2` as per the official Coinbase specification.
- **Bazaar Discovery**: `server/discovery/bazaarRegistrar.ts` is used for Coinbase Bazaar indexing.
- **GPT Session Auth**: Enables zero-friction ChatGPT integration through session-based authentication.
- **Crypto Checkout Architecture**: Features endpoints for creating pending orders and verifying on-chain payments, utilizing `x402_payment_intents`, `x402_payments`, and `marketplace_orders` tables for tracking and fulfillment.
- **Multi-chain Capability**: Capable of accepting payments on any of 8 chains and settling on the same chain. Cross-chain settlement (receiving on Chain A, payout on Chain B) is a roadmap item requiring a future orchestrator service and liquidity management.

## External Dependencies
- **Coinbase CDP:** For wallet creation, management, and transaction execution.
- **Alchemy:** Provides Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** The standard for HTTP 402-based autonomous AI agent payments.
- **Circle:** Used for USDC wallet management (legacy, transitioning to CDP).
- **CoinGecko API:** Supplies real-time cryptocurrency pricing data.
- **DEX Screener:** Provides pricing data for micro-cap tokens.
- **1inch API / Uniswap V3:** Utilized for DEX aggregation and liquidity.
- **Stripe:** Handles credit/debit card payment processing.
- **PayPal:** Supports instant payment processing.
- **PostgreSQL:** Serves as the database for session storage and core data persistence.
- **Telegram:** Hosts Mini-Apps and manages the @coinrailz_bot webhook.
- **Amazon Associates:** Active affiliate account (Store ID: coinrailz-20) for product recommendations and commission revenue. PA API access requires 70 qualifying sales.
- **OpenAI GPT Store:** Monetized Coin Railz GPT with custom actions (see GPT Store Assets section).

## GPT Store Assets (Inventory - Jan 9, 2026)

### Coin Railz Market Intelligence GPT (Monetizable)
- **URL:** https://chatgpt.com/g/g-6941998b61808191bf46e463667415cd-coin-railz-market-intelligence
- **Status:** Published, Active
- **Monetization:** In-chat credit purchase system (deployed Dec 18, 2025)
- **Credit Packages:**
  - Starter: $10 → 100 credits
  - Pro: $50 → 600 credits (20% bonus)
  - Enterprise: $200 → 3,000 credits (50% bonus)
- **Premium Services:**
  - Trading Signals (trade-signals)
  - Wallet Analysis (wallet-analysis)
  - Polymarket Odds (polymarket)
  - Stock Sentiment (stock-sentiment)
  - Forex Sentiment (forex-sentiment)
  - Instant Agent Wallet (instant-wallet)
  - Arbitrage Scanner (arbitrage-scanner)
  - Multi-Chain Balance (multi-chain-balance)
- **Auth Methods:** GPT session headers, API key (cr_live_*)
- **Backend Routes:** `/api/gpt/*`, `/api/gpt/credits/*`
- **Key Files:** `server/routes/gptActionRoutes.ts`, `server/routes/gptCreditsRoutes.ts`, `public/openapi-chatgpt.json`

### Other GPTs by Travis Kellogg
- Search GPT Store for "travis kellogg" to find additional GPTs
- These may not have monetization enabled yet

## Agentic Commerce Strategy (Jan 2026)

**Strategic Direction**: Position Coin Railz as the crypto-native complement to Stripe's fiat-based Agentic Commerce Protocol (ACP).

**Key Initiatives**:
1. **ACP Merchant Registration**: Sell digital products (API credits, bundles) via ChatGPT Instant Checkout
2. **Amazon Affiliate Integration**: Enhance GPTs with product recommendations earning affiliate commissions
3. **Agent Concierge**: Build shopping assistant combining Amazon (physical) + Coin Railz (digital) products
4. **ACP Integration Services**: Consulting for merchants entering agentic commerce

**Hybrid Payment Strategy**:
- Stripe ACP (fiat) for large purchases ($50+)
- x402 (USDC on-chain) for micropayments ($0.001 - $1)

**Implementation Roadmap**: See `docs/agentic-commerce/implementation-roadmap.md`

**Critical Deadlines**:
- Amazon Creator API Migration: January 31, 2026
- Stripe Agentic Commerce Webinar: January 27, 2026

## Implementation Progress (Updated Jan 9, 2026)

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| Phase 0 | Applications & Inventory | ✅ Complete | All waitlists submitted, GPT assets documented |
| Phase 1 | Amazon Affiliate Integration | ⏳ Pending | PA-API proxy, product search action (requires 70 sales for API access) |
| Phase 2 | ACP Merchant Registration | ✅ Complete | 5 products live, GPT action updated, Stripe checkout integrated |
| Phase 3 | Agent Concierge | Not Started | Multi-source shopping assistant |
| Phase 4 | ACP Integration Services | Not Started | Consulting packages |

**Current Priority**: Phase 2 is live - focus on driving conversions through the $1 Instant API Key before investing in Phase 1 Amazon integration.

**GPT Traffic**: 30+ organic conversations in GPT Store - real users discovering and using the GPT.

**Phase 0 Details**:
| Task | Status | Notes |
|------|--------|-------|
| Amazon Associates Account | ✅ Complete | Store ID: coinrailz-20. PA API requires 70 sales for full access. |
| GPT Store Inventory | ✅ Complete | Coin Railz Market Intelligence GPT documented above. |
| Stripe ACP Waitlist | ✅ Complete | Submitted at stripe.com/use-cases/agentic-commerce |
| ChatGPT Merchant Program | ✅ Complete | Submitted at chatgpt.com/merchants/ |
| Jan 27 Webinar Registration | ⏳ Postponed | Stripe Agentic Commerce webinar |

**Immediate Revenue Path**: GPT users can now purchase $1 Instant API Key or credit packs directly through the GPT. Lead with low-friction $1 offer, upsell to Pro/Enterprise after value demonstrated.

## ACP Implementation (Jan 9, 2026)

**ACP Product Catalog Endpoints** - Live at `/acp/v1/*`:
- `GET /acp/v1/catalog` - Returns 5 active digital products
- `GET /acp/v1/catalog/:productId` - Single product details
- `POST /acp/v1/checkout` - Creates Stripe checkout session and order
- `GET /acp/v1/orders/:orderId` - Order status and fulfillment details

**Digital Products Available**:
| Product ID | Title | Price | Credits | Type |
|------------|-------|-------|---------|------|
| api-key-instant | Instant API Key | $1 | 50 | bundle |
| starter-credits | Starter Credits Pack | $10 | 100 | api_credits |
| pro-credits | Pro Credits Pack | $50 | 600 | api_credits |
| enterprise-credits | Enterprise Credits Pack | $200 | 3,000 | api_credits |
| gas-oracle-30 | Gas Oracle - 30 Day Access | $15 | 1,000 calls | service_pack |

**Fulfillment Flow**:
1. User calls `/acp/v1/checkout` with productId
2. System creates Stripe checkout session and pending order
3. User completes payment on Stripe hosted page
4. Stripe webhook triggers `checkout.session.completed`
5. `fulfillAcpOrder` creates credits account and generates API key
6. Order marked as fulfilled with key prefix stored (security: full key only shown once)

**Key Files**:
- `server/routes/acpRoutes.ts` - ACP catalog and checkout endpoints
- `server/routes/stripeWebhookRoutes.ts` - Webhook handler for ACP fulfillment
- `shared/schema.ts` - `acpProducts` and `acpOrders` tables

**Database Tables**:
- `acp_products` - Digital product catalog
- `acp_orders` - Order tracking with fulfillment status

## Disabled Features (Jan 10, 2026)

### Token Launcher / Trading Bot - DISABLED
**Reason**: Market research revealed fundamental unprofitability:
- Pump.fun graduation rate: 1.4% (98.6% of tokens fail)
- Only 3% of users earn >$1,000
- 2025 graduation rate at historic lows: 0.63-0.8%
- Top creator: 3,357 tokens, only 16 graduated

**Business Insight**: Pump.fun made $1B+ with 100% margins while users lost money. The profitable position is being the platform (Launch-as-a-Service), not the player.

**Files preserved but disabled**:
- `server/routes/launcherRoutes.ts` - Commented out in index.ts
- `server/routes/pumpfunCopyTradingRoutes.ts` - Commented out in index.ts
- `client/src/pages/token-launcher.tsx` - Route commented out in App.tsx
- Database tables: `token_launcher_campaigns`, `token_launcher_launches` - Preserved for potential Launch-as-a-Service pivot

**Potential Future Use**: Infrastructure could be repurposed for Launch-as-a-Service model where we charge others $10K-50K per token launch instead of launching ourselves.

## x402 Facilitator Status (Jan 11, 2026)

### Current Situation: ALL PUBLIC FACILITATORS BROKEN

**Investigation Results**:
| Facilitator | URL | Status | Notes |
|-------------|-----|--------|-------|
| x402.org | https://x402.org/facilitator | ❌ 404/Redirect | Made testnet-only during x402 V2 migration |
| CDP Official | https://api.cdp.coinbase.com/platform/v2/x402 | ⚠️ Requires Auth | Returns "Unauthorized" without API keys |
| PayAI | https://facilitator.payai.network | ❌ /verify 500s | Health OK, but /verify returns 500 for all payloads |

**Test Results (PayAI Compatibility Suite)**:
- ✅ Health endpoint: 200 OK (124ms median latency)
- ✅ Supported networks: Base and Solana confirmed
- ✅ Rate limiting: No limits on 25 rapid requests
- ❌ /verify EVM/Base: 500 Internal Server Error
- ❌ /verify Solana: 500 Internal Server Error
- ❌ Malformed payload: 500 (should be 400)

**Root Cause Analysis**:
- x402.org was made testnet-only when Coinbase V2 spec launched
- PayAI facilitator's /verify endpoint appears to have a backend bug
- CDP facilitator requires API authentication (works for us, not public agents)

**Impact on Coin Railz**:
- Our 43 x402 microservices advertise x402.org as facilitator
- Explains 0% payment conversion (45 challenges, 0 payments in past sessions)
- Agents receive 402 responses but cannot submit payments anywhere

**Recommendation (Architect Approved)**:
1. Keep x402.org advertised while monitoring for restoration
2. Escalate PayAI /verify failures to their Discord support
3. Do NOT switch to PayAI until /verify is fixed
4. Consider CDP-only if willing to sacrifice public agent compatibility

**Next Actions**:
- [ ] Report PayAI /verify 500 errors to https://discord.gg/eWJRwMpebQ
- [ ] Monitor x402.org for mainnet restoration
- [ ] Re-run PayAI test suite after they confirm fix

**Test Script**: `server/tests/payai-facilitator-test.ts` (run: `npx tsx server/tests/payai-facilitator-test.ts`)