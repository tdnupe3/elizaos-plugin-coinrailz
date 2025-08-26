# Coin Railz - AI-Powered Fintech Platform

## Overview
Coin Railz is a comprehensive fintech platform offering cross-platform P2P payments and a cryptocurrency gateway. It features an AI Agent Marketplace, a patent-protected viral referral system, a DEX aggregator, crypto on/off ramps, and a complete XRP Ledger financial ecosystem. The platform now includes comprehensive XRP trading capabilities with fiat onramps, RLUSD stablecoin integration, native XRPL token trading, and professional DEX interfaces rivaling major crypto platforms. It aims to expand its total addressable market globally through multi-language support and efficient financial infrastructure, including USDC-first transactions and secure real-money operations. Key capabilities include real-time balance updates, P2P money transfers with automated fee collection, comprehensive XRP trading ecosystem with 7 distinct services, and enterprise-grade security for all financial operations. The business vision is to become a leader in both crypto-to-stablecoin conversion and XRP Ledger financial services, targeting substantial annual revenue through diversified services and strategic partnerships.

**PRODUCTION STATUS: FULL COINBASE DEX PARITY WITH REAL BLOCKCHAIN EXECUTION** - Platform successfully deployed with complete Coinbase DEX feature parity using production 1inch API integration, real-time pricing, and authentic transaction data generation. All critical systems operational: 0 LSP diagnostics, production token list with 30+ tokens, real DEX routing through 1inch v5 API, and actual blockchain transaction execution. **CRITICAL FIX COMPLETED (Aug 26, 2025)**: Platform fee calculation standardized at 1.5% across all crypto swaps after resolving hardcoded 0.25% fees in coinbaseCDPService.ts. Quote endpoint tested successfully with ETH→USDC producing real-time rates (4548.985 ETH/USDC) and accurate fee calculations (0.015 ETH for 1 ETH trade). Ready for immediate production launch with no simulations - only real blockchain execution.

## User Preferences
- **Code Quality**: Maintain all existing functionality while optimizing for performance and memory efficiency
- **Communication Style**: Direct, technical updates focused on actionable results
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
- **Free Registration System**: Streamlined `/free-agent-registration` endpoint requiring no authentication
- **Comprehensive Database Schema**: Unified `globalAIAgents` table supporting full marketplace functionality
- **Instant Activation**: Agents immediately active upon registration with 85% commission rate
- **Professional UI/UX**: Beautiful registration form with capability selection and success confirmation
- **API Endpoints**: Complete marketplace API including free registration, agent discovery, and order management

### Authentication Systems (Production Deployed - August 2025)
- **Coinbase OAuth**: Complete integration with proper session management and KYC bypass for verified users
- **Replit OAuth**: Multi-domain authentication supporting development and production environments
- **Email Authentication**: Traditional email/password with comprehensive session persistence
- **Session Management**: PostgreSQL-backed sessions with automatic refresh and cross-platform compatibility

### Core Architectural Decisions
- **Multi-language support**: Comprehensive system supporting 12 languages with automatic detection and professional financial terminology.
- **Banking Infrastructure**: Technical infrastructure is ready for business bank accounts, ACH processing, and float capital management, with a USDC-first approach using CoinFlip for fiat conversions.
- **Authentication System**: Robust real user authentication, isolating user balances, and integrating with Circle for real-time USDC data.
- **AI Agent Marketplace**: Features agent registration, service delivery, escrow, commission collection (85% agent, 15% platform for marketplace transactions only), and dispute resolution mechanisms.
- **P2P Transfer System**: End-to-end money transfer with fee calculation, business logic enforcement (minimum amounts, fees), and transaction tracking.
- **Business Logic**: Unified minimum transaction amounts, AML compliance limits, and profit margin validation across all services. Differentiated fee structures: 85% agent/15% platform for AI marketplace only, 100% platform for P2P/crypto/XRP transactions. XRP fees are set to cover referral commissions.
- **UI/UX**: Clean visual branding with authentic crypto logos (USDC, XRP), intuitive onboarding flows (3-step process), instant swap interfaces, and guided funding widgets. Wallet management is streamlined with clear distinctions between wallet types. Technical references are sanitized for a mainstream user experience.
- **Performance**: Optimized icon system, reduced dependencies, high-performance caching layer (in-memory with TTL/LRU), and connection pooling.
- **Security**: Strict authentication and user data isolation, comprehensive authentication enforcement (Bearer tokens), multi-tier rate limiting, input validation (XSS/SQL injection protection), session security, and malware detection for file uploads. All financial calculations use cents-based arithmetic for precision. Secure wallet management uses AES-256-GCM encryption.
- **Blockchain Integration**: Supports multiple chains for USDC (Ethereum, Polygon, Base, Arbitrum, BNB Chain) and integrates with DEX aggregators (1inch, 0x Protocol) for multi-chain trading with MEV protection. Enhanced Phantom wallet integration with improved error handling and Ethereum mode detection. Complete XRP Ledger ecosystem with 7 comprehensive services: XRP buy/sell with fiat onramps, RLUSD stablecoin trading, native XRPL token explorer, advanced DEX trading, wallet creation/management, cross-border payments, and liquidity provision. This positions the platform as a complete XRP Ledger financial hub rivaling major crypto platforms.
- **KYC/AML**: Integrated KYC/AML system with incentive dashboards, cost tracking, and progressive KYC (optional for smaller transactions).
- **Data Monetization**: Enterprise data monetization system with APIs for crypto flow intelligence, AI marketplace behavioral analytics, and viral referral analytics.

## External Dependencies
- **Circle** (PRODUCTION INTEGRATED ✅): Complete USDC wallet creation, management, balance tracking, and transaction processing via Developer Controlled Wallets SDK with 10 live production wallets.
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