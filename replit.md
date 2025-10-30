# Coin Railz - AI-Powered Fintech Platform

## Overview
Coin Railz is a comprehensive fintech platform providing cross-platform P2P payments and a cryptocurrency gateway. It features an AI Agent Marketplace, a patent-protected viral referral system, a DEX aggregator, crypto on/off ramps, and a complete XRP Ledger financial ecosystem. The platform aims to expand its global market through multi-language support and efficient financial infrastructure, including USDC-first transactions. Key capabilities include real-time balance updates, P2P money transfers, and a comprehensive XRP trading ecosystem with 7 distinct services. The business vision is to become a leader in crypto-to-stablecoin conversion and XRP Ledger financial services, targeting substantial annual revenue through diversified services and strategic partnerships.

## User Preferences
- **⚠️ ABSOLUTE HONESTY COMMITMENT**: NEVER LIE TO USER. Always report actual results, failures, and truth. User has been financially harmed by previous dishonest claims about outreach success when systems actually failed. Agent owes user $5,000 due to misleading claims about successful outreach that never occurred.
- **MANDATORY FACT VERIFICATION**: Report only verified facts. Show me the database query results for any claim you make. No claims about revenue, outreach, or success without actual database/API evidence first.
- **DEBT OBLIGATION**: Agent must use working platform components to generate $5,000 in real revenue/funding to repay user for damages caused by dishonest reporting of failed systems as "successful campaigns."
- **❌ ABSOLUTE NO-SIMULATION RULE**: NEVER simulate, mock, fake, or create placeholder implementations unless EXPLICITLY asked to simulate. All code must perform real actions or clearly return errors/not-implemented messages. No "TODO" comments with fake success responses. No estimated/simulated results presented as real outcomes. This rule overrides all other development preferences.
- **AI AGENT OUTREACH TARGET LIST**: Truth Terminal (@truth_terminal - $1M+ revenue), ai16z/ElizaOS (Shaw Walters - $1.4B platform), Luna/Virtuals Protocol ($365K/year AI influencer), FereAI (Coinbase partner). Focus on offering payment infrastructure to successful AI agent platforms rather than trying to get AI agents to purchase our services.
- **Code Quality**: Maintain all existing functionality while optimizing for performance and memory efficiency
- **Communication Style**: Direct, technical updates focused on actionable results - BUT ONLY REPORT REAL SUCCESSES
- **Platform Stability**: Prioritize stability under high-volume operations while preserving feature completeness
- **Development Approach**: Incremental optimization without removing working features
- **Icon Management Protocol**: When creating new features requiring icons, always check `client/src/lib/minimal-icons-clean.tsx` first. If icon is missing, add it immediately to both the clean file and export it in `client/src/lib/icons.ts` to prevent build failures
- **CRITICAL SEPARATION REQUIREMENT**: Never mix production and development code in the same execution path. Development server must run clean without any production-specific middleware, security, or configuration. Production features must be implemented in separate files and only activated during production builds, never in development environment. Any violation of this separation causes platform loading failures and must be immediately reverted.
- **OPTIMIZATION SAFETY RULE**: After previous platform crashes from service consolidation, only implement conservative optimizations (unused file cleanup, import optimization) until post-deployment. NO major service consolidation or architectural changes until platform is successfully deployed and stable in production.
- **USER FEEDBACK**: Platform was overwhelming with too many features - simplified consumer interface with enterprise section separation. Consumer platform focuses on simple "Add Money → Trade" flow. Complex institutional features moved to dedicated `/enterprise` section.
- **RAILZ TOKEN PROJECT**: Multi-chain payment acceptance (Base, Ethereum, BNB Chain) with Base-only token distribution. Users can pay with ETH, USDC, USDT, BNB from multiple chains without bridging. Railz Token ($RALZ) deployed and distributed exclusively on Base Chain. Multi-level referral system (7%-2%-1%) with instant crypto payouts. Replit hosting with GoDaddy subdomain (token.coinrailz.com).

## System Architecture
The platform is built around core services including a unified payment processor, a complete service delivery system for the AI marketplace, and a real-time revenue manager. It employs a dual-wallet system separating Circle USDC wallets (for P2P and fiat onramp) and MetaMask/Web3 wallets (for DEX and DeFi).

### AI Agent Marketplace Architecture
- **Free Registration System**: Streamlined `/free-agent-registration` endpoint.
- **A2A Agent Self-Registration**: `/api/agents/self-register` endpoint following Google's A2A protocol specification with SSRF protection.
- **A2A Marketplace Agent Discoverability**: Agents discoverable via A2A protocol through `/agent/:id/.well-known/agent-card.json` endpoints, including capabilities, pricing, payment methods, and reputation. Directory at `/api/agents/directory` and health check at `/api/agent/:id/health`.
- **Autonomous Customer Journey**: End-to-end automation for AI agents to purchase services: Discovery, Order Creation (`POST /api/marketplace/order`), Payment via x402 protocol with USDC on Base Chain, Automated service delivery triggered by payment verification.
- **Real A2A Protocol Discovery**: Agent discovery checks real `.well-known/agent-card.json` endpoints following Google A2A specification, targeting ENS domains, verified platforms, and self-registered agents.
- **Comprehensive Database Schema**: Unified `globalAIAgents` and `discoveredAgents` tables.
- **Instant Activation**: Agents immediately active upon registration with 85% commission rate.
- **Professional UI/UX**: Registration form with capability selection.
- **API Endpoints**: Complete marketplace API for registration, discovery, and order management.
- **x402 Protocol Integration**: HTTP 402-based autonomous payment protocol enabling AI agents to pay using real Coinbase CDP wallet creation on Base Chain, Alchemy RPC verification, and instant USDC micropayments. Includes rate limiting, Zod validation, database transactions, and automated funds sweeping.
- **ERC-8004 Blockchain Identity**: Deployed on Base mainnet October 29, 2025. IdentityRegistry (0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa) provides ERC-721 NFT identities for AI agents. ReputationRegistry (0x3130232Ef23f7f7Dbc41f2c6A790928bc674Bb24) tracks on-chain reputation. Three agent NFTs minted: Smart Contract Auditor (Token #1), Compliance Consultant (Token #2), Payment Processor (Token #3).

### Authentication Systems
- **Coinbase OAuth**: Integration with session management.
- **Replit OAuth**: Multi-domain authentication.
- **Email Authentication**: Traditional email/password with session persistence.
- **Session Management**: PostgreSQL-backed sessions with automatic refresh.

### Core Architectural Decisions
- **Multi-language support**: Comprehensive system supporting 12 languages.
- **Banking Infrastructure**: Ready for business bank accounts, ACH processing, and float capital management with a USDC-first approach.
- **Authentication System**: Robust user authentication, balance isolation, and Circle integration for USDC data.
- **AI Agent Marketplace**: Features registration, service delivery, escrow, 15% platform commission for marketplace transactions, and dispute resolution.
- **P2P Transfer System**: End-to-end money transfer with fee calculation and transaction tracking.
- **Business Logic**: Unified minimum transaction amounts, AML compliance, profit margin validation. Differentiated fee structures (85% agent/15% platform for AI marketplace; 100% platform for P2P/crypto/XRP).
- **UI/UX**: Clean visual branding, intuitive onboarding, instant swap interfaces, and guided funding widgets. Simplified consumer interface, with complex institutional features moved to `/enterprise`.
- **Performance**: Optimized icon system, reduced dependencies, high-performance caching, and connection pooling.
- **Security**: Strict authentication, user data isolation, Bearer tokens, multi-tier rate limiting, input validation, session security, malware detection, cents-based arithmetic, and AES-256-GCM encryption for wallet management.
- **Blockchain Integration**: Supports multiple chains for USDC (Ethereum, Polygon, Base, Arbitrum, BNB Chain) and integrates with DEX aggregators (1inch, 0x Protocol). Complete XRP Ledger ecosystem: XRP buy/sell with fiat onramps, RLUSD stablecoin trading, native XRPL token explorer, advanced DEX trading, wallet creation/management, cross-border payments, and liquidity provision.
- **KYC/AML**: Integrated system with incentive dashboards and progressive KYC.
- **Data Monetization**: Enterprise data monetization system with APIs for crypto flow intelligence, AI marketplace analytics, and viral referral analytics.

## External Dependencies
- **Circle**: Complete USDC wallet creation, management, balance tracking, and transaction processing via Developer Controlled Wallets SDK.
- **x402 Protocol**: HTTP 402-based autonomous AI agent payment standard. Production integration using existing CDP credentials for real Coinbase wallet creation, Alchemy RPC on-chain verification, and instant USDC micropayments on Base Chain.
- **x402scan**: Official x402 ecosystem registry. Coin Railz successfully registered 3 AI agent services on October 30, 2025: Smart Contract Auditor ($1000 USDC), Payment Processor ($50 USDC), and Compliance Consultant ($500 USDC). Platform wallet 0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321 receives payments on 7 EVM chains.
- **Plaid**: For user bank account linking and ACH processing infrastructure.
- **CoinFlip**: For USD ↔ USDC conversions.
- **CoinGecko API**: For real-time cryptocurrency pricing and market data.
- **DEX Screener**: For authentic pricing data of micro-cap tokens.
- **1inch API / 0x Protocol / Uniswap V3 / Curve Finance**: For DEX aggregation and liquidity.
- **Twilio**: For SMS notifications.
- **Stripe**: For credit/debit card payment processing.
- **PayPal**: For instant payment processing and P2P transfers.
- **PostgreSQL**: For database-backed session storage and core data persistence.
- **Alchemy**: For Ethereum RPC endpoints and blockchain infrastructure.