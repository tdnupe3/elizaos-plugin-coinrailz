# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is developing a universal payment layer for the AI agent economy, enabling cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform provides a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing, aiming to be the crypto-native complement to fiat-based agentic commerce protocols.

The platform also delivers production-grade device payment infrastructure for IoT and DePIN networks, allowing AI agents to pay IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics, Weather Data, and Satellite Data verticals, along with a unified credits system for both AI agents and IoT devices.

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
Coin Railz employs a USDC-first strategy, utilizing Coinbase CDP for wallet management, unified payment processing, an AI marketplace, and real-time revenue management.

**Core Architectural Patterns & Decisions:**
- **AI Agent Marketplace:** Leverages the x402 protocol for HTTP 402 payments on Ethereum and Base chains, Coinbase CDP for wallet creation, and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities (deployed on Base only).
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL as the backend.
- **x402 Microservices**: 60 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`.
- **Golden Path Endpoint v1.0**: `POST /x402/first-call` — canonical $0.05 USDC first-payment endpoint for AI agent onboarding. Accepts EVM (Base, Ethereum) and Solana. 402 challenge includes `goldenPath.paymentRecipe` with dual-track instructions (EVM via Coinbase CDP facilitator, Solana via Dexter). Returns sessionId, payment receipt, and 3 next-service templates with executable curl/python examples. Featured as first skill in `/.well-known/agent.json`, first in `agent-instructions.json` quickStart, and first entry in `/x402/catalog`. Per-IP rate limit: 10/hour. Analytics: auto-tracked via `x402_interactions` (service_id=`first-call`).
- **Discovery Engine**: Multi-layer mechanism with 9 active methods for identifying AI agents, including Coinbase Bazaar indexing. All 402 response changes must be additive only to maintain compatibility with existing discovery methods.
- **Payment Intent Ledger**: Durable ledger for state transitions and replay protection of payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator if available, with Dexter (x402.dexter.cash) as a second facilitator advertised in all discovery signals. Dexter processes ~50% of global daily x402 transactions. Seller registration at dexter.cash/facilitator required to activate routing. Dexter Solana integration: all 402 challenges advertise Solana USDC (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) with payTo wallet `BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8` and `facilitator: https://x402.dexter.cash`. Override via `DEXTER_SOLANA_WALLET` env var. @x402/svm installed for Solana ExactSvmScheme support.
- **AI Inference Gateway v1.0.0**: x402-protected pay-per-call LLM endpoint at `POST /x402/ai-inference`. Supports GPT-4o-mini ($0.05), GPT-4o ($0.25), GPT-4-turbo ($0.50) via USDC on Base. Returns 503 if OPENAI_API_KEY not set. First-call-free enabled. Requires `OPENAI_API_KEY` secret.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments.
- **Multi-chain Capability**: Supports payment acceptance on 8 chains with same-chain settlement.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrating with Stripe for digital product fulfillment.
- **Farcaster Frame Integration**: Provides Farcaster Frame endpoints exposing 6 curated x402 services.
- **Cloudflare Worker Gateway**: A Cloudflare Worker template for x402 proxy.
- **MCP Payments Kit v1.5.0**: Single-call checkout endpoint for AI agents with three payment methods: Stripe (fiat), Credits (pre-purchased balance), and x402 (on-chain USDC). Features multi-wallet lookup, true ACID transactions, refund idempotency, rate limiting, and a full audit trail.
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents.
- **IoT Payments System v1.1.0**: Production-grade device payment infrastructure for IoT and DePIN networks, including account management, device registry with spending limits, a credits system with volume pricing, billable event metering, D2D transfers with fee extraction, non-custodial USDC on-chain transfers via CDP, and multi-chain support (Base, Ethereum, Polygon, Arbitrum, Solana).
- **A2D (Agent-to-Device) x402 Payments v1.1.0**: Enables AI agents to pay IoT devices for data via x402 protocol, featuring device data products with multi-chain support, x402-protected endpoints, strict payment verification, replay protection, short-lived access tokens, seller credits, and product discovery.
- **Satellite Data Integration v2.0.0**: Production-grade x402-protected satellite data APIs connecting to NASA and ESA APIs for 6 data products (Fire Alerts, Weather Imagery, Vegetation Health, Flood Detection, Air Quality, Land Use). Includes response caching, provenance fields, and demo mode.
- **IoT Vertical Landing Pages**: `/fleet` (Fleet Telematics), `/weather` (Weather Data), `/satellite` (Satellite Data), `/iot/dashboard` (IoT Dashboard), `/credits/proof` (Credits Ledger Proof).
- **Prediction Markets Vertical**: `/predictions` landing page covering 7 x402 endpoints across Kalshi and Polymarket, with SEO optimization and wallet onboarding CTAs.
- **Pilot Credits Purchase**: `/pilots/buy` with multi-payment support (Stripe card, multi-chain crypto USDC/USDT).
- **A2A Protocol Outreach System**: Autonomous outreach to AI agents using Google's A2A Protocol, with registry sync, prioritization, rate limiting, and pipeline tracking.
- **A2A Interactive Endpoint v1.0.0**: Full A2A 0.3.0 compliance at `/.well-known/agent-card.json` + interaction endpoint at `POST /a2a/v1/message/send`.
- **AP2 v0.1 Merchant Endpoint**: Google's Agent Payments Protocol implementation at `GET /ap2/v1/merchant` (discovery card) + `POST /ap2/v1/merchant` (PaymentMandate handler). Accepts A2A JSON-RPC 2.0 format with `ap2.mandates.PaymentMandate` VDC data parts. Validates mandate TTL (5min), service ID, and amount tolerance (±20%). Two payment paths: (1) X402 — returns x402 payment instructions for Base + Solana; (2) CARD/VISA/MASTERCARD/AMEX/STRIPE — charges via Stripe, issues credits to agent account, returns API key for ongoing service access. Card flow: pm_ token → Stripe PaymentIntent → creditsService.addCredits() → creditsService.generateApiKey() → API key returned. No-token card mandates return checkout URL at /pilots/buy. Partners: Mastercard, Visa, Shopify, Coinbase, Stripe, Target, Walmart. x402 officially merged into AP2 reference implementation Dec 2025 (PR #121). AP2 advertised in `/.well-known/agent-card.json` under `ap2` capability block with both X402 and CARD methods. Implemented in `server/routes/ap2MerchantRoutes.ts`. Mandate authorization implemented: `user_authorization = "sha256:" + SHA-256(mandate_id|timestamp|amount|currency|method|service_id)` with timing-safe comparison and replay protection (in-memory Map, TTL-keyed by mandate_id). Full W3C VC ECDSA upgrade path documented for V1. Agent card `url` field now points to `/a2a/v1`. Required fields added: `defaultInputModes`, `defaultOutputModes`, `provider`, `documentationUrl`, `iconUrl`, `preferredTransport`. `capabilities.streaming` corrected to `false` (was inaccurate). Examples added to top 5 skills (gas-price-oracle, token-metadata, ping, dex-liquidity, polymarket-odds).
- **Unified Credits System v1.0.1**: Shared credits pool for both MCP (AI agents) and IoT devices with ACID transactions, audit trail, and security features.
- **On-Chain Payment Infrastructure v1.1.0 (Multi-Token)**: Production-grade on-chain payment support for USDC and USDT across 4 mainnet chains (Ethereum, Base, Polygon, Arbitrum), including multi-token methods in CDP service, CDP wallet provisioning, credits-to-wallet withdrawal, and on-chain topup.
- **Atomic DB Transactions**: D2D on-chain transfers and withdrawals use `db.transaction()` for robust credit debit/rollback patterns.
- **Async Topup Confirmation Job**: Background job for confirming on-chain topups with exponential backoff and state machine.
- **Enhanced Validation & Security**: Includes token support checks, platform wallet validation, unique `txHash` constraint, sender address filtering, amount tolerance enforcement, and exact token contract verification.
- **Demo Data Isolation**: `isDemo` flag for `iot_accounts` and `iot_device_registry` tables to separate demo data.
- **CDP v1 to v2 Migration**: Migration from `@coinbase/coinbase-sdk` (v1) to `@coinbase/cdp-sdk` (v2) for shared wallet operations.
- **Coinbase Agentic Wallets Alignment**: AgentKit bumped to v0.10.3. Discovery manifests enhanced with `agenticWallet` compatibility section advertising skills. 402 response enricher injects `extensions.agenticWallet`.
- **Production Hardening**: Stripe webhook handles IoT payment topups.
- **DEV_LITE_MODE**: Development optimization for Vite HMR stability by skipping heavy service initialization in development.
- **EVM Payment Verification Retry**: `verifyTransactionPayment` polls for transaction receipt up to 10 times with 3-second delays (30s total) to mitigate RPC indexing lag.
- **Wallet Safety Layer**: All fund transfer scripts use a centralized wallet registry with address validation, blacklist enforcement, dry-run by default, and labeled wallet summaries to prevent accidental transfers.
- **Wallet Whitelisting System**: A DB-persisted whitelist for outbound fund transfers. All `sendTransaction`, `sendUSDC`, `sendToken`, `sweepDepositWallet` methods check the whitelist before executing to prevent unauthorized fund drainage.
- **Transak Fiat On-Ramp v1.0.0**: White-label fiat-to-crypto purchase flow at `/buy` and `/buy-crypto`. Supports USDC/USDT on 6 networks (Ethereum, Base, Polygon, Arbitrum, Optimism, Tron). Features: $10-$2,500 transaction limits, 3% Coin Railz fee, inline auth (login/register on page), 4-step stepper UX, real-time quotes, EVM/Tron wallet validation, HMAC-SHA256 webhook verification, staging mode when API key not configured. Backend: `server/routes/transakOnrampRoutes.ts`. Frontend: `client/src/pages/BuyOnramp.tsx`. DB: `onramp_orders` table.

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
- **MoonPay:** White-label fiat-to-crypto on-ramp (API keys pending — set MOONPAY_PUBLISHABLE_KEY and MOONPAY_SECRET_KEY). Routes exist at `/api/onramp/moonpay/*` and return 503 until keys configured. MoonPay Agents compatible (native x402/Base/USDC).
- **Dexter (dexter.cash):** Compatible x402 payment facilitator advertised in all discovery signals. Processes ~50% of global daily x402 transactions. Seller registration at dexter.cash/facilitator required to activate routing.
- **OpenAI API:** Powers AI Inference Gateway (x402), smart contract audits, Telegram bot, and microservices. Requires `OPENAI_API_KEY` secret.