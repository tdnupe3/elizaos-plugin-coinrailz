# Coin Railz - Multi-Chain Payment Infrastructure for Crypto Communities

## Overview
Coin Railz provides cross-platform payment routing across 7 blockchains (Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, and PulseChain). It enables users to trade crypto at best rates via a DEX aggregator and settle payments instantly with universal payment routing. The platform targets crypto traders, OTC desks, international freelancers, and crypto communities.

**Key Capabilities:**
- DEX Aggregation with best-price discovery across 7 chains.
- P2P Payment Routing with automatic fiat payment detection (Zelle/PayPal/Venmo/Cash App).
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
- **DEPLOYMENT FIX (Dec 2025)**: Replit autoscale sets `REPLIT_DEPLOYMENT=1` during BOTH build AND runtime. The `server/buildModeDetection.ts` now only disables background services when `REPLIT_DEPLOYMENT=1` is combined with actual build tooling (esbuild, vite build). This prevents health check timeouts during production deployment. Also, `AgentDiscoveryService` uses deferred initialization - heavy work runs AFTER server listens to ensure port opens immediately.
- **x402-FETCH COMPATIBILITY FIX (Dec 17, 2025)**: Root cause of ZERO PAYMENTS despite 767 agent requests was identified: x402-fetch v0.7.3 uses Zod validation that only accepts legacy network names ("base", "polygon") but rejects V2 CAIP-2 format ("eip155:8453"). Fix: All 402 responses now include DUAL network format: `network: "base"` (legacy for x402-fetch compatibility) + `x402Network: "eip155:8453"` (V2 spec compliance). Files updated: `x402MicroserviceRoutesV2.ts`, `x402GatedRoutes.ts`, `paymentOrchestrator.ts`.
- **NEON DEPLOYMENT FIX (Dec 17, 2025)**: Deployment failed because REPLIT_DEPLOYMENT can be "true" (not just "1") during Promote phase. Fix: Normalize deployment flag check in `server/db.ts` and `server/buildModeDetection.ts` to accept both "1" and "true" values. This ensures Neon uses HTTP fetch mode (not WebSocket) in production autoscale environments.
- **HEALTH CHECK FIX (Dec 17, 2025)**: Deployment failed because root `/` endpoint was intercepted by x402 paywall middleware returning 402 instead of 200. Fix: Added `/healthz` endpoint and root `/` health check handler BEFORE all middleware in `server/index.ts`. These respond immediately with HTTP 200 to pass Replit autoscale health checks.
- **GPT IN-CHAT CREDIT PURCHASE (Dec 18, 2025)**: Added 3 new endpoints for purchasing credits directly in ChatGPT: `/api/gpt/credits/packages`, `/api/gpt/credits/create-session`, `/api/gpt/credits/status`. Uses in-memory session cache for tracking payment status. **⚠️ SCALING NOTE**: Current implementation uses in-memory `gptSessionCache` - works fine for single instance but requires Redis migration before enabling Replit autoscale or multi-instance deployment. Sessions are short-lived (60 sec) so this is not urgent but must be addressed before horizontal scaling.

## System Architecture

The platform uses a dual-wallet system (Circle USDC and DeFi/MetaMask) and is structured around unified payment processing, AI marketplace service delivery, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** Supports free and A2A agent self-registration, discoverability via `.well-known/agent-card.json`, and autonomous customer journeys. It uses the x402 protocol for HTTP 402-based payments with USDC on Base Chain, including real Coinbase CDP wallet creation and Alchemy RPC verification. A prepaid credits system (Stripe + USDC/USDT) increases conversion. ERC-8004 Blockchain Identity on Base mainnet is used for AI agent identities and on-chain reputation.
- **Authentication:** Integrates Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL-backed session management.
- **UI/UX:** Clean visual branding, intuitive onboarding, instant swap interfaces, and guided funding widgets. A simplified consumer interface separates complex institutional features.
- **Internationalization:** Supports 12 languages.
- **Financial Infrastructure:** Designed for business bank accounts, ACH processing, and float capital management with a USDC-first approach.
- **Performance:** Optimized icon system, reduced dependencies, high-performance caching, and connection pooling.
- **Security:** Strict authentication, user data isolation, Bearer tokens, multi-tier rate limiting, input validation, session security, malware detection, cents-based arithmetic, and AES-256-GCM encryption.
- **Blockchain Integration:** Multi-chain support for USDC (Ethereum, Polygon, Base, Arbitrum, BNB Chain) and integration with DEX aggregators. Comprehensive XRP Ledger ecosystem for trading, wallet management, and cross-border payments.
- **Compliance:** Integrated KYC/AML with incentive dashboards and progressive KYC.
- **Data Monetization:** APIs for crypto flow intelligence, AI marketplace analytics, and viral referral analytics.
- **Bot-Optimized API Layer:** DUAL EXECUTION MODEL for DEX swaps - both server-executed (Coinbase CDP for convenience) and client-executed (1inch API + MetaMask for non-custodial control). Endpoints: `/api/bot/dex/quote` (pricing), `/api/bot/dex/swap` (server-executed), `/api/bot/dex/prepare` (client-executed transaction calldata), `/api/bot/gas` (real-time gas prices across all chains). Bot documentation portal at `/bots` explains both execution models with code examples. Real-time intelligence feed (`/api/bot/intel`) using CoinGecko API for trending tokens and market data. Features Zod validation, rate limiting (30-100 req/min), token symbol-to-address resolution, and anonymous access.
- **x402 Microservices**: Platform offers 38 production-ready x402 microservices across 10 categories: Discovery/Testing (1), Trading Intelligence (14), Execution & Infrastructure (4), Premium (3), Real Estate (3), Banking/Finance (3), Trading/Investment (3), Market Intelligence (3), Prediction Markets (4), and Traditional Markets (2 - stock-sentiment, forex-sentiment at $0.40 each using free data sources: Yahoo Finance for equities, ECB/Frankfurter for forex). Each service registered via `createPaymentOrchestrator` wrapper with both GET and POST 402 challenge responses. Compatible with Coinbase Bazaar, x402scan, and A2A discovery bots.
- **Discovery Engine**: A multi-layer discovery engine with 9 active methods (e.g., domain heuristics, x402 GET/POST probing, Coinbase Bazaar API crawling, ERC-8004 NFT registry scanning, GitHub scanning) for identifying AI agents.
- **Payment Intent Ledger**: Implemented a durable payment intent ledger with state transitions (PENDING → SUCCEEDED/ALLOW_RETRY) for payment replay protection. Includes strict Base64 JSON payload input validation and environment variable checks.

## Proven Conversion Flow (December 2025 Data)
Based on analysis of actual paying agents (34.172.232.11), the successful conversion path is:
1. **Discovery via Google** - Googlebot crawled x402 endpoints, agent found us in search/index
2. **5-day evaluation period** - Agent explored services Nov 22-26 using curl, then `AutonomousAI/1.0`
3. **Free tier test** - Used free `token-metadata` service first to build trust
4. **First payment** - Immediately paid for `ping` service after free trial worked
5. **Return customer** - Came back Dec 4 specifically for `prediction-market-odds` (real use case)

**Key Insight:** Free tier (`gas-price-oracle`, `token-metadata`) is critical for building trust. Agents test free services before committing real USDC. The path is: Discovery → Exploration → Free trial → Trust → Payment → Retention.

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