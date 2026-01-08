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