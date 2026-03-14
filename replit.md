# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is building a universal payment layer for the AI agent economy. It facilitates cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform offers a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. Its goal is to serve as the crypto-native counterpart to fiat-based agentic commerce protocols.

The platform also provides production-grade device payment infrastructure for IoT and DePIN networks, enabling AI agents to pay IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics, Weather Data, and Satellite Data, alongside a unified credits system for both AI agents and IoT devices.

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
Coin Railz operates with a USDC-first strategy, leveraging Coinbase CDP for wallet management, unified payment processing, an AI marketplace, and real-time revenue management.

**Core Architectural Patterns & Decisions:**
- **AI Agent Marketplace:** Utilizes the x402 protocol for HTTP 402 payments on Ethereum and Base, Coinbase CDP for wallet creation, and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities on Base.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL.
- **x402 Microservices**: 60 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`.
- **Golden Path Endpoint**: `POST /x402/first-call` serves as the canonical $0.05 USDC first-payment endpoint for AI agent onboarding, supporting EVM (Base, Ethereum) and Solana.
- **Discovery Engine**: A multi-layer mechanism with 9 active methods for identifying AI agents, including Coinbase Bazaar indexing.
- **Payment Intent Ledger**: A durable ledger ensuring state transitions and replay protection for payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator, with Dexter (x402.dexter.cash) as a fallback, processing ~50% of global daily x402 transactions. Solana integration specifies `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` with a payTo wallet and Dexter facilitator.
- **AI Inference Gateway**: An x402-protected pay-per-call LLM endpoint (`POST /x402/ai-inference`) supporting various GPT models via USDC on Base.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments.
- **Multi-chain Capability**: Supports payment acceptance and same-chain settlement on 8 chains.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrated with Stripe.
- **Farcaster Frame Integration**: Provides Farcaster Frame endpoints for 6 curated x402 services.
- **Cloudflare Worker Gateway**: A Cloudflare Worker template for x402 proxy.
- **MCP Payments Kit**: A single-call checkout endpoint for AI agents with Stripe (fiat), Credits, and x402 (on-chain USDC) payment methods, featuring ACID transactions, refund idempotency, and audit trails.
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents.
- **IoT Payments System**: Production-grade device payment infrastructure for IoT and DePIN networks, including account management, device registry with spending limits, a credits system, billable event metering, D2D transfers, non-custodial USDC on-chain transfers via CDP, and multi-chain support.
- **A2D (Agent-to-Device) x402 Payments**: Enables AI agents to pay IoT devices for data via x402, featuring device data products, strict payment verification, and replay protection.
- **Satellite Data Integration**: Production-grade x402-protected satellite data APIs connecting to NASA and ESA for 6 data products, including response caching.
- **IoT Vertical Landing Pages**: Specific landing pages for Fleet Telematics, Weather Data, Satellite Data, IoT Dashboard, and Credits Ledger Proof.
- **Prediction Markets Vertical**: Landing page covering 7 x402 endpoints across Kalshi and Polymarket.
- **Pilot Credits Purchase**: `/pilots/buy` with multi-payment support (Stripe card, multi-chain crypto USDC/USDT).
- **A2A Protocol Outreach System**: Autonomous outreach to AI agents using Google's A2A Protocol.
- **A2A Interactive Endpoint**: Full A2A 0.3.0 compliance at `/.well-known/agent-card.json` and interaction endpoint at `POST /a2a/v1/message/send`.
- **AP2 v0.1 Merchant Endpoint**: Google's Agent Payments Protocol implementation for discovery (`GET /ap2/v1/merchant`) and PaymentMandate handling (`POST /ap2/v1/merchant`), supporting X402 and CARD methods.
- **Unified Credits System**: Shared credits pool for both MCP (AI agents) and IoT devices with ACID transactions and audit trail.
- **On-Chain Payment Infrastructure (Multi-Token)**: Production-grade on-chain payment support for USDC and USDT across 4 mainnet chains (Ethereum, Base, Polygon, Arbitrum), including CDP wallet provisioning and credits-to-wallet withdrawal.
- **Atomic DB Transactions**: D2D on-chain transfers and withdrawals use `db.transaction()` for robust credit debit/rollback.
- **Async Topup Confirmation Job**: Background job for confirming on-chain topups with exponential backoff.
- **Enhanced Validation & Security**: Includes token support checks, platform wallet validation, unique `txHash` constraint, sender address filtering, amount tolerance enforcement, and exact token contract verification.
- **CDP v1 to v2 Migration**: Migration from `@coinbase/coinbase-sdk` (v1) to `@coinbase/cdp-sdk` (v2).
- **Coinbase Agentic Wallets Alignment**: AgentKit bumped to v0.10.3, with enhanced discovery manifests and 402 response enrichment.
- **Wallet Safety Layer**: Centralized wallet registry with address validation, blacklist enforcement, and dry-run defaults for all fund transfer scripts.
- **Wallet Whitelisting System**: DB-persisted whitelist for outbound fund transfers, preventing unauthorized fund drainage.
- **Transak Fiat On-Ramp**: White-label fiat-to-crypto purchase flow at `/buy` and `/buy-crypto` for USDC/USDT on 6 networks, featuring inline auth, real-time quotes, and HMAC-SHA256 webhook verification.
- **M2M Credits Purchase**: Unauthenticated machine-to-machine endpoint `POST /api/m2m/credits/purchase` — autonomous agents submit a Stripe PaymentMethod ID, server confirms the PaymentIntent, atomically adds credits and generates a `cr_live_` API key, returns the key in one response. No browser, no login, no crypto required. Tiers: $10/~200 calls, $25/~500 calls, $100/~2,000 calls. Status check at `GET /api/m2m/credits/purchase/:paymentIntentId`. Idempotency enforced via Stripe idempotency key + `paymentIntentTracking` unique constraint. Rate limited to 5 purchases/IP/hour. The M2M endpoint is surfaced in all discovery documents: `/.well-known/agent-instructions.json` (as recommended quickstart path), `/.well-known/agent-registration.json` (in `next.cardPaymentPath`), x402.json `challengeFlow`, and all 402 challenge bodies via `alternativePaymentMethods.apiKey.m2mPurchaseEndpoint`.

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, and transaction execution.
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** Standard for HTTP 402-based AI agent payments.
- **Stripe:** Credit/debit card payment processing and Agentic Commerce Protocol (ACP) integration.
- **PayPal:** Instant payment processing for credit topups.
- **PostgreSQL:** Database for session storage and core data persistence.
- **Telegram:** Hosting Mini-Apps and webhook for @coinrailz_bot.
- **OpenAI GPT Store:** Monetized Coin Railz GPT with custom actions.
- **Farcaster Frames:** For Farcaster Frame deployment.
- **Google's A2A Protocol:** For autonomous outreach to AI agents.
- **NASA GIBS:** Weather imagery data.
- **NASA FIRMS:** Fire alerts data.
- **ESA Copernicus OData Catalog:** Sentinel-1 SAR, Sentinel-2 L2A, Sentinel-5P TROPOMI data.
- **ESA WorldCover 2021 WMS:** Land use classification data.
- **OpenAQ:** Ground-level air quality measurements.
- **Kalshi:** Prediction market data.
- **Polymarket:** Prediction market data.
- **Transak:** White-label fiat-to-crypto on-ramp for USDC/USDT purchases.
- **MoonPay:** White-label fiat-to-crypto on-ramp (routes exist, pending API keys).
- **Dexter (dexter.cash):** Compatible x402 payment facilitator.
- **OpenAI API:** Powers AI Inference Gateway, smart contract audits, Telegram bot, and microservices.