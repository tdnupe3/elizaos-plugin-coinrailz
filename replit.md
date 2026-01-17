# Coin Railz - Multi-Chain Payment Infrastructure

## Overview
Coin Railz is building the universal payment layer for the AI agent economy. It provides cross-platform payment routing across 8 blockchains (7 EVM + Solana) for AI agents and users, primarily settling in USDC. The platform offers a multi-chain payment SDK, x402 protocol micropayments, agent-to-agent commerce infrastructure, DEX aggregation, and P2P payment routing. The vision is to be the crypto-native complement to fiat-based agentic commerce protocols.

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
The Coin Railz platform uses a USDC-first approach with Coinbase CDP for wallet management, enabling unified payment processing, an AI marketplace, and real-time revenue management.

**Key Architectural Decisions:**
- **AI Agent Marketplace:** Implemented via the x402 protocol for HTTP 402 payments on Base Chain, using Coinbase CDP for wallet creation and Alchemy RPC for verification. ERC-8004 Blockchain Identity is used for agent identities.
- **Authentication:** Supports Coinbase OAuth, Replit OAuth, and email/password, backed by PostgreSQL.
- **x402 Microservices**: 44 production services compatible with Coinbase Bazaar and x402scan (including Solana Yield Finder at $0.05/call).
- **Discovery Engine**: Multi-layer mechanism with 9 active methods for identifying AI agents.
- **Payment Intent Ledger**: Durable ledger for payment intents, supporting state transitions and replay protection.
- **GPT In-Chat Credit Purchase**: Provides API endpoints for purchasing credits within ChatGPT.
- **Hybrid Facilitator**: `getFacilitatorUrl()` dynamically uses CDP facilitator if available, otherwise falls back to x402.org.
- **x402Version Compliance**: Adheres to `x402Version: 2` (Coinbase specification).
- **Bazaar Discovery**: Uses `server/discovery/bazaarRegistrar.ts` for Coinbase Bazaar indexing.
- **GPT Session Auth**: Enables zero-friction ChatGPT integration via session-based authentication.
- **Crypto Checkout Architecture**: Endpoints for creating pending orders and verifying on-chain payments, tracking with `x402_payment_intents`, `x402_payments`, and `marketplace_orders` tables.
- **Multi-chain Capability**: Supports payment acceptance on 8 chains with same-chain settlement. Cross-chain settlement is a future roadmap item.
- **ACP Integration**: Endpoints (`/acp/v1/*`) for catalog, checkout, and order management, integrating with Stripe for fulfillment of digital products like API keys and credit packs.

## External Dependencies
- **Coinbase CDP:** Wallet creation, management, and transaction execution.
- **Alchemy:** Ethereum/Base RPC endpoints and blockchain infrastructure.
- **x402 Protocol:** Standard for HTTP 402-based AI agent payments.
- **Circle:** Legacy USDC wallet management (transitioning to CDP) and MPC via CDP for instant agent wallets.
- **CoinGecko API:** Real-time cryptocurrency pricing data.
- **DEX Screener:** Pricing data for micro-cap tokens.
- **1inch API / Uniswap V3:** DEX aggregation and liquidity.
- **Stripe:** Credit/debit card payment processing and Agentic Commerce Protocol (ACP) integration.
- **PayPal:** Instant payment processing.
- **PostgreSQL:** Database for session storage and core data persistence.
- **Telegram:** Hosting Mini-Apps and webhook for @coinrailz_bot.
- **Amazon Associates:** Affiliate account (Store ID: coinrailz-20) for product recommendations.
- **OpenAI GPT Store:** Monetized Coin Railz GPT with custom actions.
- **Dialect Markets API:** Real-time Solana DeFi data (lending rates, yield opportunities from Kamino, Jupiter Lend, Lulo, Marginfi) with 10-minute server-side caching.
- **Farcaster Frames:** User has account @tkellogg1 for Farcaster Frame deployment.

## Test Wallets

### x402 Payment Test Wallet (Created January 16, 2026)
- **Purpose**: End-to-end payment funnel testing without polluting analytics with platform wallet
- **Network**: Base Mainnet (Chain ID: 8453)
- **Wallet ID**: `90e2c77b-333d-4b7d-8f50-06a27fe1c1c0`
- **Address**: `0x6341B240547d520a425ea58EF91b33692b12f356`
- **Wallet Data**: Saved to `server/wallets/x402-test-wallet.json`
- **Fund with**: ETH (for gas) + USDC (for payments) on BASE CHAIN

## Recent Changes (January 2026)

### Farcaster Frame Integration
- **Added**: `server/routes/farcasterFrameRoutes.ts` - Farcaster Frame endpoints exposing 6 curated x402 services
- **Endpoints**: `/api/frames`, `/api/frames/action/:serviceId`, `/api/frames/services`, `/api/frames/catalog`
- **Curated Services**: gas-price-oracle ($0.10), whale-alerts ($0.35), token-price ($0.25), wallet-risk ($0.50), contract-scan ($1.00), trending-tokens ($0.50)
- **Pattern**: Uses deferred router pattern in `server/index.ts` for Vite compatibility

### Cloudflare Worker Gateway Template
- **Added**: `cloudflare-gateway/` directory with Cloudflare Worker template for x402 proxy
- **Purpose**: Enables AI agents using Cloudflare Agent SDK to access Coin Railz x402 services
- **Files**: `src/index.ts`, `wrangler.toml`, `package.json`, `README.md`
- **Status**: Template only - not deployed, no runtime impact

### Deferred Router Pattern Fix
- **Fixed**: `/api/bundles` was returning SPA HTML instead of JSON
- **Solution**: Added deferred router for `/api/bundles` in `server/index.ts`

### MCP Dynamic Service Discovery (January 16, 2026)
- **Updated**: `server/routes/mcpServiceDiscovery.ts` - Now imports from ServiceCatalogService dynamically
- **Behavior**: MCP endpoint at `/mcp/services` now returns 42 x402-compatible services (was 18 hardcoded)
- **Source**: ServiceCatalogService is the authoritative source for all 44 services (2 SDK payment services filtered as non-x402)
- **Response includes**: Cloudflare Gateway URL, Coinbase Facilitator URL, version 2

### Cloudflare Worker Endpoint Fix (January 16, 2026)
- **Fixed**: Changed endpoint paths from `/x402/v2/{serviceId}` to `/x402/{serviceId}` (canonical format)
- **Version**: Bumped to 2.1.0
- **Files changed**: `cloudflare-gateway/src/index.ts`
- **Note**: User must redeploy Worker locally via `npx wrangler deploy` for fix to take effect

### Farcaster Frame Endpoint Fix (January 16, 2026)
- **Fixed**: Changed endpoint paths from `/x402/v2/${serviceId}` to `/x402/${serviceId}` in Farcaster Frame routes
- **Files changed**: `server/routes/farcasterFrameRoutes.ts` (lines 138, 199)
- **Impact**: Frame action links and catalog now point to canonical x402 endpoints

### Landing Page Discovery Channels (January 16, 2026)
- **Added**: AI Agent Discovery Endpoints section on landing page
- **Location**: After Key Stats section in `client/src/pages/landing.tsx` (lines 265-282)
- **Links**: MCP Protocol, Cloudflare Gateway, Farcaster Frame

### Multi-Modal Payment Metadata (January 16, 2026)
- **Updated**: `server/routes/mcpServiceDiscovery.ts` - MCP discovery now advertises multi-modal payment capabilities
- **Changes**:
  - Provider description: "Universal payment infrastructure for AI agents - Crypto (x402), Fiat (Stripe), Credits, and FREE wallet provisioning"
  - paymentMethods: ["x402-erc20-usdc", "stripe-fiat", "credits"] (was just x402)
  - Added paymentCapabilities object with crypto, fiat, credits, and walletProvisioning details
  - Service entries now include stripeCompatible and paymentOptions fields
- **Cloudflare Gateway**: Updated description in `cloudflare-gateway/src/index.ts` to match
- **Baseline (for rollback)**:
  ```json
  {
    "paymentMethods": ["x402-erc20-usdc"],
    "provider.description": "Multi-chain payment infrastructure for AI agents - 44 x402 services"
  }
  ```
- **Impact**: AI agents can now discover that Coin Railz supports fiat payments, not just crypto

### Rollback Instructions

To revert Multi-Modal Payment Metadata:
1. In `server/routes/mcpServiceDiscovery.ts`:
   - Change `paymentMethods` back to `["x402-erc20-usdc"]`
   - Remove `paymentCapabilities` object
   - Change provider description back to "Multi-chain payment infrastructure for AI agents - 44 x402 services"
   - Remove `stripeCompatible` and `paymentOptions` from service map return
2. In `cloudflare-gateway/src/index.ts`:
   - Change description back to "Pay-per-call crypto intelligence for AI agents - ALL 44 services"
3. Redeploy Cloudflare Worker via `npx wrangler deploy`

To revert MCP dynamic services:
1. Revert `server/routes/mcpServiceDiscovery.ts` to previous version (hardcoded 18 services)

To revert Cloudflare Worker changes:
1. Change `/x402/${serviceId}` back to `/x402/v2/${serviceId}` in `cloudflare-gateway/src/index.ts`
2. Redeploy Worker via `npx wrangler deploy`

To revert landing page changes:
1. Remove lines 265-282 from `client/src/pages/landing.tsx`

To revert Farcaster Frame changes:
1. Delete `server/routes/farcasterFrameRoutes.ts`
2. Delete `cloudflare-gateway/` directory
3. Remove frames router from `server/index.ts`