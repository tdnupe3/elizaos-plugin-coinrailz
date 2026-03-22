# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is developing a universal payment layer for the AI agent economy, enabling cross-platform payment routing across 8 blockchains (7 EVM + Solana), primarily settling in USDC. The platform provides a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. It aims to be the crypto-native equivalent of fiat-based agentic commerce protocols.

Additionally, Coin Railz offers production-grade device payment infrastructure for IoT and DePIN networks, facilitating AI agent payments to IoT devices for data via the x402 protocol. This includes dedicated landing pages and demo UIs for Fleet Telematics, Weather Data, and Satellite Data, along with a unified credits system for both AI agents and IoT devices. The project's vision includes serving as the foundational payment infrastructure for a thriving AI agent ecosystem, unlocking new market potentials in autonomous commerce and data exchange.

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
- **x402 Microservices**: 60 production services compatible with Coinbase Bazaar and x402scan, adhering to `x402Version: 2`.
- **Golden Path Endpoint**: `POST /x402/first-call` serves as the canonical $0.05 USDC first-payment endpoint for AI agent onboarding, supporting EVM (Base, Ethereum) and Solana.
- **Payment Intent Ledger**: A durable ledger ensuring state transitions and replay protection for payment intents.
- **Hybrid Facilitator**: Dynamically uses CDP facilitator, with Dexter as a fallback, processing a significant portion of global daily x402 transactions.
- **AI Inference Gateway**: An x402-protected pay-per-call LLM endpoint (`POST /x402/ai-inference`) supporting various GPT models via USDC on Base.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, with multi-chain support across 8 chains.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrated with Stripe.
- **M2M Onboarding & Credits**: Single-call onboarding for IoT devices and AI agents, with a unified credits system (Stripe, x402, fiat on-ramp). Includes a free trial key system (`GET /api/m2m/credits/trial`) and a machine-to-machine credits purchase endpoint (`POST /api/m2m/credits/purchase`) with API key generation.
- **Non-x402 Agent Payment Lane**: Parallel card-first payment path alongside x402. Golden path: `POST /api/m2m/credits/checkout/session` → Stripe Hosted Checkout → webhook auto-provisions `cr_live_` API key in ~60s. Discovery via `GET /api/auth/capabilities` (lists all 4 auth paths). Billing headers on every API-key call: `X-Credits-Used`, `X-Credits-Remaining`, `X-Recharge-Url`. UA classifier (`server/services/userAgentClassifier.ts`) segments funnel events by agent framework (httpx, LangChain, CrewAI, etc.). OpenAPI 3.1 spec at `GET /openapi.json` for LangChain/httpx auto-configuration. Provisioning logic centralized in `server/services/m2mProvisioningService.ts`.
- **IoT Payments System**: Production-grade device payment infrastructure for IoT and DePIN networks, featuring account management, device registry with spending limits, billable event metering, D2D transfers, non-custodial USDC on-chain transfers via CDP, and multi-chain support.
- **A2D (Agent-to-Device) x402 Payments**: Enables AI agents to pay IoT devices for data via x402, featuring device data products, strict payment verification, and replay protection.
- **Satellite Data Integration**: Production-grade x402-protected satellite data APIs connecting to NASA and ESA for 6 products ($0.05–$0.15/call), including response caching.
- **NASA Earthdata Intelligence Layer**: 5 authenticated NASA data services at $0.25/call flat pricing, routed under `/api/satellite/earthdata/*`. Backed by real NASA EOSDIS token auth (expires May 21, 2026). Products: CMR Granule Search (1B+ granules, Landsat/Sentinel/MODIS/VIIRS), GPM IMERG Precipitation (OPeNDAP point query, 0.1° resolution), MUR Sea Surface Temperature (OPeNDAP 1km, daily), SMAP Soil Moisture (SPL3SMP granule discovery), Ocean Color/Chlorophyll (MODISA_L3m_CHL). Payment: hybridPaymentMiddleware — x402 v2 on Base OR API-key credits. Free catalog at `GET /api/satellite/earthdata/catalog`. SatelliteDataPage.tsx updated to display all 11 products with "Earthdata Intelligence" badge on the 5 premium products. Pricing range updated to $0.05–$0.25.
- **A2A Protocol Outreach & Interaction**: Autonomous outreach to AI agents using Google's A2A Protocol, with full A2A 0.3.0 compliance at `/.well-known/agent-card.json` and an interaction endpoint at `POST /a2a/v1/message/send`.
- **AP2 v0.1 Merchant Endpoint**: Google's Agent Payments Protocol implementation for discovery (`GET /ap2/v1/merchant`) and PaymentMandate handling (`POST /ap2/v1/merchant`), supporting X402 and CARD methods.
- **On-Chain Payment Infrastructure (Multi-Token)**: Production-grade on-chain payment support for USDC and USDT across 4 mainnet chains (Ethereum, Base, Polygon, Arbitrum), including CDP wallet provisioning and credits-to-wallet withdrawal.
- **Atomic DB Transactions**: D2D on-chain transfers and withdrawals use `db.transaction()` for robust credit debit/rollback.
- **Wallet Safety Layer**: Centralized wallet registry with address validation, blacklist enforcement, and dry-run defaults for all fund transfer scripts, including a DB-persisted whitelist for outbound transfers.
- **CDP v1 to v2 Migration**: Migration from `@coinbase/coinbase-sdk` (v1) to `@coinbase/cdp-sdk` (v2) for enhanced wallet management.
- **402 Challenge Body Value Signal**: 402 challenge responses now include `trial_access`, `expected_output.sample`, and `agent_instructions.system_prompt` to provide agents with cost-utility context and clear paths forward.
- **Discord Removed**: Discord client code removed from `server/services/realAgentOutreach.ts` and `server/services/automatedOutreach.ts`. Discord never served a production purpose and the gateway intent mismatch was a confirmed production crash risk. On-chain messaging (realAgentOutreach) and Telegram (automatedOutreach) remain intact. `DISCORD_BOT_TOKEN` is not set and was never set in production.

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, and transaction execution.
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** Standard for HTTP 402-based AI agent payments.
- **Stripe:** Credit/debit card payment processing and Agentic Commerce Protocol (ACP) integration.
- **PostgreSQL:** Database for core data persistence.
- **Google's A2A Protocol:** For autonomous outreach to AI agents.
- **NASA GIBS & FIRMS:** Weather and fire alerts data.
- **ESA Copernicus OData Catalog & WorldCover:** Satellite imagery and land use data.
- **OpenAQ:** Ground-level air quality measurements.
- **Kalshi & Polymarket:** Prediction market data.
- **Transak:** White-label fiat-to-crypto on-ramp for USDC/USDT purchases.
- **Dexter (dexter.cash):** Compatible x402 payment facilitator.
- **OpenAI API:** Powers AI Inference Gateway, smart contract audits, and various microservices.