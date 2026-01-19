# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is developing a universal payment layer for the AI agent economy. It facilitates cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform offers a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. The project aims to become the crypto-native complement to fiat-based agentic commerce protocols.

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
The Coin Railz platform adopts a USDC-first strategy, utilizing Coinbase CDP for wallet management, enabling unified payment processing, an AI marketplace, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** Implemented using the x402 protocol for HTTP 402 payments on Base Chain, with Coinbase CDP for wallet creation and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL as the backend.
- **x402 Microservices**: 44 production services compatible with Coinbase Bazaar and x402scan.
- **Discovery Engine**: A multi-layer mechanism with 9 active methods for identifying AI agents.
- **Payment Intent Ledger**: A durable ledger for payment intents, providing state transitions and replay protection.
- **GPT In-Chat Credit Purchase**: Provides API endpoints for purchasing credits within ChatGPT.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator if available, otherwise falls back to x402.org.
- **x402Version Compliance**: Adheres to `x402Version: 2` (Coinbase specification).
- **Bazaar Discovery**: Uses `server/discovery/bazaarRegistrar.ts` for Coinbase Bazaar indexing.
- **GPT Session Auth**: Enables zero-friction ChatGPT integration via session-based authentication.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, tracked with `x402_payment_intents`, `x402_payments`, and `marketplace_orders` tables.
- **Multi-chain Capability**: Supports payment acceptance on 8 chains with same-chain settlement.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrating with Stripe for digital product fulfillment.
- **Farcaster Frame Integration**: Provides Farcaster Frame endpoints exposing 6 curated x402 services.
- **Cloudflare Worker Gateway**: A Cloudflare Worker template for x402 proxy, enabling AI agents to access Coin Railz x402 services.
- **MCP Payments Kit v1.5.0**: Single-call checkout endpoint for AI agents with three payment methods: Stripe (fiat), Credits (pre-purchased balance), and x402 (on-chain USDC). Features include: multi-wallet lookup (Ethereum/Solana/XRP), true ACID transactions via Neon WebSocket driver (race condition safe with balance guards), refund idempotency, rate limiting, full audit trail, Stripe Live Mode, and durable idempotency guard. Database transactions use BEGIN/COMMIT/ROLLBACK for complete atomicity.
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents, orchestrating device registration, API key generation, and wallet provisioning.
- **IoT Payments System v1.1.0**: Production-grade device payment infrastructure for IoT and DePIN networks. Features include:
  - Account management: Create IoT accounts to organize device fleets
  - Device registry: Register devices with spending limits and payment permissions
  - Credits system (v1.1 - 2x more credits): Pre-purchase credits ($25/5,000, $100/25,000, $500/200,000)
  - Volume pricing (v1.1): $0.005/event base, 100k-1M @ $0.0025, 1M+ @ $0.001
  - Billable event metering: $0.005/message default (50% reduction from v1.0)
  - D2D transfers: Device-to-device payments with 2% + $0.02 fee extraction
  - USDC on-chain: Non-custodial wallet-to-wallet transfers via CDP
  - Payment methods: Stripe (card) and PayPal (2-step flow) for credit topups
  - Multi-chain: Base, Ethereum, Polygon, Arbitrum, Solana support
  - Full audit trail: iot_billable_events, iot_transfers, iot_topups tables
  - Routes: `/api/iot/*` (account, register, balance, meter, transfer, topup, transactions, packs)
  - SDK: `@coinrailz/iot-payments` npm package with IoT-native methods
- **A2D (Agent-to-Device) x402 Payments v1.1.0**: Key synergy between IoT and MCP systems enabling AI agents to pay IoT devices for data via x402 protocol. Features include:
  - Device data products: IoT devices can register monetizable data products (sensor readings, streams, API calls)
  - Multi-chain support: Products can specify expectedNetwork (base, ethereum, polygon, arbitrum) - payments validated per-product
  - x402-protected endpoints: Data access returns HTTP 402 until payment verified on correct network
  - Payment verification: Strict validation - x402PaymentId mandatory, product binding in metadata, network matching, recipient/currency checks, 100-unit purchase limit, DB-backed replay protection
  - Access tokens: Short-lived tokens (15 min) for authenticated data retrieval
  - Seller credits: Device owners receive 85% of sales as account credits (15% platform fee)
  - Discovery: Products exposed via catalog with per-product network info for AI agent discovery
  - Security: Unique indexes on x402PaymentId and txHash for replay protection
  - Database: iot_device_products (with expectedNetwork), iot_data_sales tables
  - Routes: `/api/iot/products/*` (create, update, list), `/api/iot/data/*` (x402 access, verify), `/api/iot/catalog` (discovery), `/api/iot/sales/*` (history)
  - SDK: A2D methods added to @coinrailz/iot-payments v1.1.0 (createProduct, getProduct, updateProduct, getSales, browseCatalog)
- **A2A Protocol Outreach System**: Production-grade autonomous outreach to AI agents using Google's A2A Protocol (launched April 2025). Features include:
  - Registry sync from a2aregistry.org (103 public agents - entire current ecosystem)
  - High-value agent prioritization (7 developer platforms: Modal, Telex, a2aregistry.org, Railway, Fly.io, Render, Cloudrun, Vercel, Replit)
  - Reachability verification (probes .well-known endpoints before outreach)
  - Rate limiting (1 req per 5 seconds per agent) and circuit breaker with exponential backoff
  - JSON-RPC 2.0 compliant task sending (`tasks/send` method, message `type` parts)
  - Pipeline tracking in `a2a_outreach_logs` table (interested, needs_info, pending, declined)
  - Webhook endpoint for async responses (`/api/a2a/responses`)
  - Routes: `/api/a2a-protocol/outreach/*` (sync, verify-reachability, campaign, pipeline, high-value, ecosystem-stats)
- **Unified Credits System v1.0.0**: Shared credits pool for both MCP (AI agents) and IoT devices with unified balance management. Features include:
  - Single balance: One credits pool spanning both AI agents (ownerType=user) and IoT accounts (ownerType=iot_account)
  - ACID transactions: Balance guards prevent overdraft, idempotency keys for safe retries
  - Full audit trail: unified_credits_transactions ledger with source/description/idempotency tracking
  - Opt-in migration: /migrate endpoint consolidates legacy MCP and IoT balances into unified account
  - Security: Admin API key (X-Admin-Key) or internal service secret (X-Internal-Secret) for mutations, ownership verification for queries
  - Linked accounts: View all unified accounts linked to a user across owner types
  - Database: unified_credits, unified_credits_transactions tables
  - Routes: `/api/credits/unified/*` (add, deduct, balance, transactions, migrate, linked)
  - Environment: INTERNAL_SERVICE_SECRET for internal service-to-service calls

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, and transaction execution.
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** Standard for HTTP 402-based AI agent payments.
- **Circle:** Legacy USDC wallet management and MPC for instant agent wallets.
- **CoinGecko API:** Real-time cryptocurrency pricing data.
- **DEX Screener:** Pricing data for micro-cap tokens.
- **1inch API / Uniswap V3:** DEX aggregation and liquidity.
- **Stripe:** Credit/debit card payment processing and Agentic Commerce Protocol (ACP) integration.
- **PayPal:** Instant payment processing.
- **PostgreSQL:** Database for session storage and core data persistence.
- **Telegram:** Hosting Mini-Apps and webhook for @coinrailz_bot.
- **Amazon Associates:** Affiliate account (Store ID: coinrailz-20) for product recommendations.
- **OpenAI GPT Store:** Monetized Coin Railz GPT with custom actions.
- **Dialect Markets API:** Real-time Solana DeFi data (lending rates, yield opportunities).
- **Farcaster Frames:** For Farcaster Frame deployment.