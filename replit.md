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
- **MCP Payments Kit v1.4.3**: Single-call checkout endpoint for AI agents with three payment methods: Stripe (fiat), Credits (pre-purchased balance), and x402 (on-chain USDC). Features include: multi-wallet lookup (Ethereum/Solana/XRP), atomic CTE credits deduction (race condition protection), refund idempotency, rate limiting, full audit trail, Stripe Live Mode, and durable idempotency guard. Known limitation: Neon HTTP mode doesn't support true BEGIN/COMMIT transactions; credits are protected but audit consistency has a theoretical edge case under rare failure modes (mitigated with best-effort retry).
- **M2M Onboarding**: Single-call onboarding for IoT devices and AI agents, orchestrating device registration, API key generation, and wallet provisioning.

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