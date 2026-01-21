# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is developing a universal payment layer for the AI agent economy. It facilitates cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform offers a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. The project aims to become the crypto-native complement to fiat-based agentic commerce protocols.

The platform has expanded into IoT, offering a production-grade device payment infrastructure for IoT and DePIN networks, enabling AI agents to pay IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics and Weather Data verticals, alongside a unified credits system for both AI agents and IoT devices.

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

**Core Architectural Patterns & Decisions:**
- **AI Agent Marketplace:** Leverages the x402 protocol for HTTP 402 payments on Base Chain, with Coinbase CDP for wallet creation and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL as the backend.
- **x402 Microservices**: 44 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`.
- **Discovery Engine**: A multi-layer mechanism with 9 active methods for identifying AI agents, including Coinbase Bazaar indexing via `server/discovery/bazaarRegistrar.ts`.
- **Payment Intent Ledger**: A durable ledger providing state transitions and replay protection for payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator if available, otherwise falls back to x402.org for payment processing.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, tracked with `x402_payment_intents`, `x402_payments`, and `marketplace_orders` tables.
- **Multi-chain Capability**: Supports payment acceptance on 8 chains with same-chain settlement.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrating with Stripe for digital product fulfillment.
- **Farcaster Frame Integration**: Provides Farcaster Frame endpoints exposing 6 curated x402 services.
- **Cloudflare Worker Gateway**: A Cloudflare Worker template for x402 proxy, enabling AI agents to access Coin Railz x402 services.
- **MCP Payments Kit v1.5.0**: Single-call checkout endpoint for AI agents with three payment methods: Stripe (fiat), Credits (pre-purchased balance), and x402 (on-chain USDC). Features include multi-wallet lookup, true ACID transactions via Neon WebSocket driver, refund idempotency, rate limiting, and a full audit trail.
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents, orchestrating device registration, API key generation, and wallet provisioning.
- **IoT Payments System v1.1.0**: Production-grade device payment infrastructure for IoT and DePIN networks, featuring:
  - Account management: Create IoT accounts to organize device fleets.
  - Device registry: Register devices with spending limits and payment permissions.
  - Credits system (v1.1): Pre-purchase credits with volume pricing ($0.005/event base, scaling down).
  - Billable event metering: $0.005/message default.
  - D2D transfers: Device-to-device payments with 2% + $0.02 fee extraction.
  - USDC on-chain: Non-custodial wallet-to-wallet transfers via CDP.
  - Payment methods: Stripe (card) and PayPal (2-step flow) for credit topups.
  - Multi-chain: Base, Ethereum, Polygon, Arbitrum, Solana support.
  - Full audit trail: `iot_billable_events`, `iot_transfers`, `iot_topups` tables.
  - API Routes: `/api/iot/*` for account, register, balance, meter, transfer, topup, transactions, packs.
  - SDK: `@coinrailz/iot-payments` npm package.
- **A2D (Agent-to-Device) x402 Payments v1.1.0**: Enables AI agents to pay IoT devices for data via x402 protocol, featuring:
  - Device data products: IoT devices can register monetizable data products (sensor readings, streams, API calls).
  - Multi-chain support: Products specify `expectedNetwork` (Base, Ethereum, Polygon, Arbitrum).
  - x402-protected endpoints: Data access requires HTTP 402 payment verification on the correct network.
  - Strict Payment verification: Mandatory `x402PaymentId`, product binding, network matching, recipient/currency checks, replay protection.
  - Access tokens: Short-lived tokens (15 min) for authenticated data retrieval.
  - Seller credits: Device owners receive 85% of sales as account credits.
  - Discovery: Products exposed via catalog with per-product network info.
  - API Routes: `/api/iot/products/*`, `/api/iot/data/*`, `/api/iot/catalog`, `/api/iot/sales/*`.
- **IoT Vertical Landing Pages (January 2026)**:
  - Fleet Telematics: `/fleet` (landing), `/fleet/demo` (interactive simulator). Pricing: $19-49/vehicle/month.
  - Weather Data: `/weather` (landing), `/weather/demo` (interactive simulator with A2D purchase). Pricing: $49-199/month.
  - IoT Dashboard: `/iot/dashboard` (usage monitoring, CSV export, catalog view).
  - Credits Ledger Proof: `/credits/proof` (balance breakdown, transaction history, audit trail).
  - API Documentation: `docs/IOT_API_DOCUMENTATION.md`.
- **IoT Partner & Sales Tools (January 2026)**:
  - Partner Program: `/partners` (device owner signup, 85/15 revenue split, application form with backend API).
  - Integration Guide: `/integrate` (step-by-step checklist, code examples, SDK samples, mark-complete).
  - Pilot Tracking: `/admin/pilots` (CRM for pilot customers, status pipeline, CRUD API).
  - Case Studies: `/case-studies` (customer success story templates, filtering by vertical).
  - API Routes: `/api/iot/partners/*`, `/api/iot/pilots/*` for partner applications and pilot management.
- **IoT Operations & Onboarding (January 2026)**:
  - IoT Hub: `/iot` (central navigation hub linking all IoT pivot pages).
  - Analytics Dashboard: `/iot/analytics` (KPIs for pilots, conversions, revenue, device metrics).
  - Pilot Onboarding: `/pilot/onboard` (self-serve 3-step pilot signup with account creation, API key generation).
- **A2A Protocol Outreach System**: Production-grade autonomous outreach to AI agents using Google's A2A Protocol, featuring:
  - Registry sync from a2aregistry.org.
  - High-value agent prioritization and reachability verification.
  - Rate limiting and circuit breaker with exponential backoff.
  - JSON-RPC 2.0 compliant task sending.
  - Pipeline tracking in `a2a_outreach_logs` table.
  - Webhook endpoint for async responses (`/api/a2a/responses`).
- **Unified Credits System v1.0.1**: Shared credits pool for both MCP (AI agents) and IoT devices, featuring:
  - Single balance: One credits pool spanning `user` and `iot_account` owner types.
  - ACID transactions: Balance guards prevent overdraft, idempotency keys for safe retries.
  - Full audit trail: `unified_credits_transactions` ledger.
  - Opt-in migration: `/migrate` endpoint consolidates legacy balances.
  - Security: Admin API key or internal service secret for mutations, ownership verification for queries.
  - Linked accounts: View all unified accounts linked to a user.
  - New: Credits Proof View (`/api/credits/unified/proof/:ownerType/:ownerId`) for balance breakdown.
  - New: Dispute Handling (`/api/credits/unified/dispute`) for admin refunds and `dispute-policy` endpoint.
  - API Routes: `/api/credits/unified/*` (add, deduct, balance, transactions, migrate, linked, proof, dispute, dispute-policy).

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

## Recent Changes (January 21, 2026)
- **CTA Updates**: All "Book Pilot"/"Start Pilot" buttons across Fleet/Weather landing and demo pages now route to `/pilot/onboard` (internal self-serve onboarding) instead of external Calendly links.
- **Demo API Alignment**: Demo pages updated to use correct API contracts (accountName, tier for accounts; deviceId, accountId, deviceName, deviceType, spendingLimit for devices; x-api-key authentication headers).
- **Production Hardening**: Verified STRIPE_WEBHOOK_SECRET configured, Stripe webhook handles IoT payment topups via checkout completion events.