# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is building a universal payment layer for the AI agent economy, facilitating cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform provides a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. It aims to be the crypto-native complement to fiat-based agentic commerce protocols.

The platform also offers production-grade device payment infrastructure for IoT and DePIN networks, enabling AI agents to pay IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics and Weather Data verticals, alongside a unified credits system for both AI agents and IoT devices.

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
Coin Railz utilizes a USDC-first strategy, leveraging Coinbase CDP for wallet management, unified payment processing, an AI marketplace, and real-time revenue management.

**Core Architectural Patterns & Decisions:**
- **AI Agent Marketplace:** Uses the x402 protocol for HTTP 402 payments on Base Chain, Coinbase CDP for wallet creation, and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL as the backend.
- **x402 Microservices**: 44 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`.
- **Discovery Engine**: Multi-layer mechanism with 9 active methods for identifying AI agents, including Coinbase Bazaar indexing. (Feb 2026: `extensions.bazaar` injected into all 402 responses via x402ResponseEnricher for facilitator indexing. Top-level `resource` and `extensions` added for x402scan V2 compliance. **CRITICAL**: All 402 response changes must be additive only — never remove legacy fields (`networkLegacy`, `discoverable`, `accepts[].extensions.bazaar`, `paymentInstructions`, `facilitatorUrl`, etc.) as other discovery methods depend on them.)
- **Payment Intent Ledger**: Durable ledger for state transitions and replay protection of payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator if available, otherwise falls back to x402.org for payment processing.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, tracked with `x402_payment_intents`, `x402_payments`, and `marketplace_orders` tables.
- **Multi-chain Capability**: Supports payment acceptance on 8 chains with same-chain settlement.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrating with Stripe for digital product fulfillment.
- **Farcaster Frame Integration**: Provides Farcaster Frame endpoints exposing 6 curated x402 services.
- **Cloudflare Worker Gateway**: A Cloudflare Worker template for x402 proxy.
- **MCP Payments Kit v1.5.0**: Single-call checkout endpoint for AI agents with three payment methods: Stripe (fiat), Credits (pre-purchased balance), and x402 (on-chain USDC). Features include multi-wallet lookup, true ACID transactions, refund idempotency, rate limiting, and a full audit trail.
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents.
- **IoT Payments System v1.1.0**: Production-grade device payment infrastructure for IoT and DePIN networks, featuring:
  - Account management and device registry with spending limits.
  - Credits system (v1.1) with volume pricing.
  - Billable event metering.
  - D2D transfers with fee extraction.
  - Non-custodial USDC on-chain transfers via CDP.
  - Stripe and PayPal for credit topups.
  - Multi-chain support (Base, Ethereum, Polygon, Arbitrum, Solana).
  - Full audit trail (`iot_billable_events`, `iot_transfers`, `iot_topups`).
  - API Routes: `/api/iot/*`.
  - SDK: `@coinrailz/iot-payments` npm package.
- **A2D (Agent-to-Device) x402 Payments v1.1.0**: Enables AI agents to pay IoT devices for data via x402 protocol, featuring:
  - Device data products with multi-chain support.
  - x402-protected endpoints requiring HTTP 402 payment verification.
  - Strict payment verification and replay protection.
  - Short-lived access tokens for data retrieval.
  - Seller credits for device owners.
  - Product discovery via catalog.
  - API Routes: `/api/iot/products/*`, `/api/iot/data/*`, `/api/iot/catalog`, `/api/iot/sales/*`.
- **Satellite Data Integration v1.0.0**: Production-grade x402-protected satellite data APIs powered by NASA Earthdata and ESA Copernicus:
  - 6 Data Products: Fire Alerts ($0.05), Weather Imagery ($0.02), Vegetation Health ($0.10/km²), Flood Detection ($0.08), Air Quality ($0.05), Land Use ($0.15/km²).
  - Data Sources: NASA GIBS, FIRMS, MODIS, Landsat; ESA Sentinel-1/2/5P (pending configuration).
  - x402 Payment Verification: Uses hybridPaymentMiddleware for proper payment validation.
  - Demo Mode: Environment-gated via SATELLITE_DEMO_MODE or NODE_ENV.
  - API Routes: `/api/satellite/*` (catalog, status, layers, fire-alerts, weather-imagery, vegetation, flood-detection, air-quality, land-use).
  - Landing Page: `/satellite` with space-themed UI, product showcase, and API reference.
  - Strategic positioning: "Powered by NASA & ESA" for fundraising appeal with 100% margin on free data.
- **IoT Vertical Landing Pages**: `/fleet` (Fleet Telematics), `/weather` (Weather Data), `/satellite` (Satellite Data), `/iot/dashboard` (IoT Dashboard), `/credits/proof` (Credits Ledger Proof).
- **IoT Partner & Sales Tools**: `/partners` (Partner Program), `/integrate` (Integration Guide), `/admin/pilots` (Pilot Tracking CRM), `/case-studies` (Case Studies).
- **IoT Operations & Onboarding**: `/iot` (IoT Hub), `/iot/analytics` (Analytics Dashboard), `/pilot/onboard` (Pilot Onboarding).
- **Pilot Credits Purchase**: `/pilots/buy` with multi-payment support:
  - Tiers: Starter ($500), Growth ($1000), Enterprise ($2500).
  - Card payments via Stripe checkout with webhook crediting.
  - Crypto payments: USDC/USDT on Base, Polygon, Arbitrum (multi-chain for DePIN networks).
  - API Routes: `/api/stripe/pilot-credits/*` (create checkout, crypto-intent, crypto-status, confirm).
  - Background Job: `PilotCreditsConfirmationJob` polls pending crypto payments every 5 minutes.
- **A2A Protocol Outreach System**: Autonomous outreach to AI agents using Google's A2A Protocol, with registry sync, prioritization, rate limiting, and pipeline tracking.
- **Unified Credits System v1.0.1**: Shared credits pool for both MCP (AI agents) and IoT devices with ACID transactions, audit trail, and security features. Includes Credits Proof View and Dispute Handling.
- **On-Chain Payment Infrastructure v1.1.0 (Multi-Token)**: Production-grade on-chain payment support for USDC and USDT across 4 mainnet chains (Ethereum, Base, Polygon, Arbitrum). Includes multi-token methods in CDP service, `usdc_onchain` and `usdt_onchain` payment methods, CDP wallet provisioning, credits-to-wallet withdrawal, and on-chain topup.
- **Atomic DB Transactions**: D2D on-chain transfers and withdrawals use `db.transaction()` for robust credit debit/rollback patterns.
- **Async Topup Confirmation Job**: Background job for confirming on-chain topups with exponential backoff and state machine.
- **Enhanced Validation & Security**: Includes token support checks, platform wallet validation, unique `txHash` constraint, sender address filtering, amount tolerance enforcement, and exact token contract verification.
- **Demo Data Isolation**: `isDemo` flag for `iot_accounts` and `iot_device_registry` tables to separate demo data from production metrics.
- **CDP v1 to v2 Migration**: Migration from `@coinbase/coinbase-sdk` (v1) to `@coinbase/cdp-sdk` (v2) for shared wallet operations.
- **Production Hardening**: Stripe webhook handles IoT payment topups.
- **DEV_LITE_MODE**: Development optimization for Vite HMR stability. Skips heavy service initialization (Discord bot, XMTP client, outreach orchestrators) in development. Set `DEV_FULL_SERVICES=true` to enable all services. Key files: `server/buildModeDetection.ts`, `server/services/automatedOutreach.ts`, `server/services/realAgentOutreach.ts`, `server/services/xmtpMessagingService.ts`.
- **Landing Page IoT Section**: Homepage now includes IoT/Satellite data value proposition with navigation links to `/satellite`, `/fleet`, `/weather`, `/iot` and pilot credits CTA.
- **EVM Payment Verification Retry (Feb 2026)**: `verifyTransactionPayment` in `hybridPaymentMiddleware.ts` now polls for transaction receipt up to 10 times with 3-second delays (30s total). This fixed the ~50% PAYMENT_VERIFICATION_FAILED rate caused by RPC indexing lag when @x402/fetch sends payment hash before receipt availability. 30s covers multiple blocks on all supported chains (Base ~2s, Ethereum ~12s, Polygon ~2s, Arbitrum <1s).
- **Wallet Safety Layer (Feb 2026)**: All fund transfer scripts use centralized wallet registry (`scripts/lib/walletRegistry.ts`) with address validation, blacklist enforcement, dry-run by default (requires `CONFIRM_TRANSFER=true`), and labeled wallet summaries. Prevents accidental transfers to wrong addresses. Key addresses: Platform (0xa4bBE37f...), Buyer Test (0x5837A864...), CDP_LOST/blacklisted (0x6341B240...).
- **Wallet Whitelisting System (Feb 2026)**: DB-persisted whitelist (`whitelisted_wallets` table) for outbound fund transfers. All `sendTransaction`, `sendUSDC`, `sendToken`, `sweepDepositWallet` methods check the whitelist before executing. Wallets must be explicitly approved before the platform can send funds to them. This prevents fund loss if hacked/compromised agents or bots try to drain platform wallets. Functions: `whitelistWallet()`, `removeWhitelist()`, `getWhitelistedWallets()` in `server/services/coinbaseCDPService.ts`. Cache TTL: 60s. **SECURITY NOTE**: If an attacker compromises an agent and calls wallet creation, the platform will NOT send funds to the new wallet until it's manually whitelisted — this is by design as a critical anti-drain measure.

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