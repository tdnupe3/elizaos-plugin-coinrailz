# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is developing a universal payment layer for the AI agent economy, enabling cross-platform payment routing across 9 blockchains (8 EVM + Solana), primarily settling in USDC. The platform provides a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. It aims to be the crypto-native equivalent of fiat-based agentic commerce protocols.

Coin Railz also offers production-grade device payment infrastructure for IoT and DePIN networks, facilitating AI agent payments to IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics, Weather Data, and Satellite Data, along with a unified credits system for both AI agents and IoT devices. The project's vision includes serving as the foundational payment infrastructure for a thriving AI agent ecosystem, unlocking new market potentials in autonomous commerce and data exchange.

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
- **AI Agent Marketplace:** Leverages the x402 protocol for HTTP 402 payments on Ethereum and Base, Coinbase CDP for wallet creation, and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities on Base.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, with PostgreSQL.
- **x402 Microservices**: 60 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`. All discovery surfaces (sitemap, agent-card, x402.json manifest) are in sync.
- **Golden Path Endpoint**: `POST /x402/first-call` serves as the canonical $0.05 USDC first-payment endpoint for AI agent onboarding, supporting Base (EVM) and Solana. Verified with real on-chain USDC payment via x402-fetch v0.7.3.
- **Payment Intent Ledger**: A durable ledger ensuring state transitions and replay protection for payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator, with Dexter as a fallback. `network` field uses shorthand (`"base"`, `"solana"`) required by x402-fetch PaymentRequirementsSchema; `x402Network` retains full CAIP-2 (`"eip155:8453"`, `"solana:5eykt4..."`) for Dexter compatibility. Ethereum mainnet removed from accepts array — it is not in the x402-fetch schema enum and caused ZodError blocking all payments.
- **baseUrl Fix**: `getPublicBaseUrl(req)` used throughout `paymentOrchestrator.ts` — bare `baseUrl` variable was causing ReferenceError and billing-without-delivery on API key path.
- **AI Inference Gateway**: An x402-protected pay-per-call LLM endpoint (`POST /x402/ai-inference`) supporting various GPT models via USDC on Base.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, with multi-chain support across 8 chains.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrated with Stripe.
- **M2M Onboarding & Credits**: Single-call onboarding for IoT devices and AI agents, with a unified credits system (Stripe, x402, fiat on-ramp). Includes a free trial key system and a machine-to-machine credits purchase endpoint with API key generation.
- **Non-x402 Agent Payment Lane**: Parallel card-first payment path alongside x402, using Stripe Hosted Checkout for provisioning API keys. Billing headers `X-Credits-Used`, `X-Credits-Remaining`, `X-Recharge-Url` on every API-key call. OpenAPI 3.1 spec at `GET /openapi.json`.
- **IoT Payments System**: Production-grade device payment infrastructure for IoT and DePIN networks, featuring account management, device registry with spending limits, billable event metering, D2D transfers, non-custodial USDC on-chain transfers via CDP, and multi-chain support.
- **A2D (Agent-to-Device) x402 Payments**: Enables AI agents to pay IoT devices for data via x402, featuring device data products, strict payment verification, and replay protection.
- **Satellite Data Integration**: Production-grade x402-protected satellite data APIs connecting to NASA and ESA for 6 products, including response caching.
- **NASA Earthdata Intelligence Layer**: 5 authenticated NASA data services at $0.25/call flat pricing, routed under `/api/satellite/earthdata/*`, backed by real NASA EOSDIS token auth.
- **A2A Protocol Outreach & Interaction**: Autonomous outreach to AI agents using Google's A2A Protocol, with full A2A 0.3.0 compliance at `/.well-known/agent-card.json` and an interaction endpoint at `POST /a2a/v1/message/send`.
- **AP2 v0.1 Merchant Endpoint**: Google's Agent Payments Protocol implementation for discovery (`GET /ap2/v1/merchant`) and PaymentMandate handling (`POST /ap2/v1/merchant`), supporting X402 and CARD methods.
- **On-Chain Payment Infrastructure (Multi-Token)**: Production-grade on-chain payment support for USDC and USDT across 4 mainnet chains (Ethereum, Base, Polygon, Arbitrum), including CDP wallet provisioning and credits-to-wallet withdrawal.
- **Atomic DB Transactions**: D2D on-chain transfers and withdrawals use `db.transaction()` for robust credit debit/rollback.
- **Wallet Safety Layer**: Centralized wallet registry with address validation, blacklist enforcement, and dry-run defaults for all fund transfer scripts.
- **CDP v1 to v2 Migration**: Migration from `@coinbase/coinbase-sdk` to `@coinbase/cdp-sdk` for enhanced wallet management.
- **402 Challenge Body Value Signal**: 402 challenge responses include `trial_access`, `expected_output.sample`, and `agent_instructions.system_prompt` to provide agents with cost-utility context.
- **Stripe Webhook Dispute/Refund Handlers**: `charge.dispute.created` and `charge.refunded` handlers added to `server/routes/stripeRoutes.ts` (the single active webhook endpoint at `/api/stripe/webhook`).
- **klic.gg eSports Partner API**: Three flows: payout USDC prize, create payment session for entry fee/tip, and auto-detect on-chain USDC payment by scanning Transfer events. Fee: 1.5%. Supported chains: Base, Ethereum.
- **Stripe Connect Integration**: Plan for connected account onboarding to enable agent payouts via Stripe, with a 15% platform fee via `application_fee_amount`.
- **Discovery Surfaces Audit**: All 6 discovery surfaces (sitemap, agent-card, x402.json manifest, etc.) correctly list 60 services. IoT x402 discovery fixed to point to correct `/x402` routes and return 402 challenges on GET/HEAD probes.
- **AWI + WebMCP Manifests**: Added `/.well-known/webmcp.json`, `/.well-known/awi.json`, and `/.well-known/mcp-integration.json` for agent web interface, MCP protocol, and integration guides.
- **MCP Integration Guide Page**: Frontend page at `/mcp-integration-guide` with copy-paste instructions for API key credits and native x402 integration.
- **X-Agent-Instructions Header (Global)**: A response interceptor middleware in `server/appMain.ts` automatically injects `X-Agent-Instructions` and `Link` headers on every 402 response platform-wide. This covers all 65+ `res.status(402)` call sites across 16 files without modifying individual routes. Agents using HEAD requests (Meta externalagent, python-httpx monitors) now receive the instructions pointer in HTTP headers without reading the body.

## User Preferences
- Do not propose follow-up tasks unless they are absolutely blocking or critical. The user finds unsolicited task suggestions annoying.

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, and transaction execution.
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** Standard for HTTP 402-based AI agent payments.
- **Stripe:** Credit/debit card payment processing, Agentic Commerce Protocol (ACP) integration, and Stripe Connect.
- **PostgreSQL:** Database for core data persistence.
- **Google's A2A Protocol:** For autonomous outreach to AI agents.
- **NASA GIBS & FIRMS:** Weather and fire alerts data.
- **ESA Copernicus OData Catalog & WorldCover:** Satellite imagery and land use data.
- **OpenAQ:** Ground-level air quality measurements.
- **Kalshi & Polymarket:** Prediction market data.
- **Transak:** White-label fiat-to-crypto on-ramp for USDC/USDT purchases.
- **Dexter (dexter.cash):** Compatible x402 payment facilitator.
- **OpenAI API:** Powers AI Inference Gateway, smart contract audits, and various microservices.