# Coin Railz — Technical Overview

**Prepared for Circle Ventures**
**February 2026**

---

## 1. Architecture Summary

Coin Railz is a USDC-native payment infrastructure platform that enables autonomous AI agents to discover, pay for, and consume digital services through programmable micropayments. The platform operates 57 priced x402 microservices (plus catalog and discovery endpoints) that settle in USDC, with Base as the primary settlement chain and payment acceptance configured across multiple EVM chains and Solana.

The system is built on three core pillars:

1. **Payment Orchestration** — x402 protocol (HTTP 402) payment gating with multi-method settlement
2. **Service Discovery** — Multi-surface agent discovery across Coinbase Bazaar, Google A2A, MCP, and open registries
3. **Multi-Chain Settlement** — USDC acceptance on Ethereum L1, Base, Polygon, Arbitrum, and Solana

---

## 2. x402 Protocol Implementation

### 2.1 Payment Flow

Coin Railz implements the x402 protocol (version 2), the HTTP-native payment standard for machine-to-machine commerce:

```
Agent → GET /x402/trade-signals
     ← 402 Payment Required (challenge payload)
Agent → GET /x402/trade-signals + X-PAYMENT header (USDC transaction)
     ← 200 OK (service response)
```

Each 402 challenge response includes:

- `x402Version: 2` protocol identifier
- `facilitatorUrl` pointing to the Coinbase facilitator or x402.org fallback
- `paymentRequirements` array specifying accepted token, network, amount, and receiver address
- `recommendedServices` for cross-sell (catalog enrichment)
- Machine-readable pricing in micro-USDC (6 decimal precision)

### 2.2 Payment Orchestrator

The payment orchestrator (`server/middleware/paymentOrchestrator.ts`) is the central authorization layer. It evaluates incoming requests through a defined sequence of payment methods:

1. **Bundle Subscription** — Pre-purchased service bundles
2. **First-Call-Free** — Trial access for discovery endpoints (gas-price-oracle, token-metadata)
3. **GPT Session Auth** — OpenAI GPT Store monetization path
4. **API Key Auth** — Developer API keys (`X-API-KEY` or `Bearer cr_live_*`)
5. **Credits Service** — Pre-purchased USDC credit balance
6. **On-Chain USDC Payment** — Direct x402 payment via `X-PAYMENT` header

Payment verification supports multiple encoding formats:

- Raw transaction hashes (0x-prefixed, 66 characters)
- EIP-712 typed signatures
- Coinbase facilitator payloads (MessagePack + gzip, ~5.8KB)
- Base64-encoded payloads

### 2.3 Payment Verification

On-chain payment verification includes:

- Transaction receipt confirmation with up to 10 retries (30-second window) for RPC indexing lag
- USDC contract address validation per chain
- Amount tolerance enforcement
- Sender address extraction and recording
- Replay protection via unique `txHash` constraint in the payment intent ledger
- Durable state machine: `PENDING → CONFIRMING → SUCCEEDED / FAILED`

### 2.4 Hybrid Facilitator

The system dynamically selects between Coinbase CDP facilitator (primary) and x402.org (fallback) for payment processing, maximizing availability without hard dependency on either.

---

## 3. Service Catalog

### 3.1 Service Verticals (57 Priced Services)

| Vertical | Services | Price Range (USDC) |
|----------|----------|--------------------|
| Trading Intelligence | gas-price-oracle, token-metadata, dex-liquidity, token-price, token-sentiment, transaction-builder, whale-alerts, batch-quote, multi-chain-balance, trending-tokens, portfolio-tracker, wallet-risk, trade-signals | $0.10 – $0.75 |
| Execution & Infrastructure | payment-processing, contract-scan, instant-agent-wallet, instant-api-key, agent-create-wallet, seamless-chain-bridge | $0.50 – $2.00 |
| Premium Services | verified-agent-identity, compliance-consultation, smart-contract-audit | $5.00 – $10.00 |
| Prediction Markets | polymarket-events, polymarket-odds, polymarket-search, prediction-market-odds, kalshi-markets, kalshi-odds, kalshi-search | $0.25 – $0.50 |
| Real Estate | property-valuation, lease-analysis, construction-progress | $0.75 – $1.50 |
| Banking/Finance | credit-risk-score, fraud-detection, compliance-check | $0.75 – $1.75 |
| Trading/Investment | trading-signal, portfolio-optimization, sentiment-analysis | $0.50 – $2.00 |
| Market Intelligence | arbitrage-scanner, correlation-matrix, risk-metrics | $0.75 – $1.25 |
| Traditional Markets | stock-sentiment, forex-sentiment | $0.40 |
| Solana DeFi | solana-yield-finder (Dialect integration) | $0.05 |
| Satellite Data (NASA/ESA) | fire-alerts, weather-imagery, vegetation, flood-detection, air-quality, land-use | $0.05 – $0.15 |
| IoT/DePIN | fleet-telematics, weather-station-data, iot-sensor-reading, iot-device-stream, iot-bulk-data | $0.025 – $0.50 |
| Discovery | ping (connectivity/health) | $0.25 |

### 3.2 Pricing Architecture

Pricing is defined in `shared/pricing.ts` as a centralized, type-safe pricing system:

- `SERVICE_PRICING_MICRO`: Integer values in micro-USDC for on-chain verification (1 USDC = 1,000,000)
- `SERVICE_PRICING_USD`: Float values for analytics and display
- Type-safe `ServiceName` union type ensures compile-time correctness

---

## 4. Multi-Chain USDC Settlement

### 4.1 Supported Networks

| Chain | Chain ID | Payment Acceptance | Settlement Activity |
|-------|----------|-------------------|---------------------|
| Base | eip155:8453 | Live | Primary — $182.74 USDC settled |
| Ethereum L1 | eip155:1 | Live | Configured, payment verification active |
| Polygon | eip155:137 | Configured | Payment verification configured, no settlement yet |
| Arbitrum | eip155:42161 | Configured | Payment verification configured, no settlement yet |
| Solana | solana-mainnet | Configured | Solana Actions integration via Dialect |

All x402 challenge responses include multi-chain `paymentRequirements`, allowing the paying agent to select its preferred settlement chain. Base is the primary settlement chain with verified on-chain payment history. Ethereum L1, Polygon, and Arbitrum have payment verification infrastructure deployed but have not yet received external payments. Solana support operates through a separate integration path (Solana Actions / Dialect Blinks).

### 4.2 Wallet Infrastructure

- **Coinbase CDP SDK (v2)**: Shared wallet operations for platform wallets
- **AgentKit (v0.10.3)**: Agent wallet provisioning and management
- **Wallet Safety Layer**: Centralized wallet registry with address validation, blacklist enforcement, dry-run by default
- **Wallet Whitelisting**: Database-persisted whitelist for outbound transfers; all send operations validate against whitelist before execution

### 4.3 On-Chain Payment Infrastructure

- Multi-token support (USDC and USDT) across 4 EVM mainnets
- CDP wallet provisioning for new agents
- Credits-to-wallet withdrawal
- On-chain topup with async confirmation job (exponential backoff, state machine)
- Atomic database transactions for all fund movements

---

## 5. CCTP Integration Readiness

### 5.1 Current State

The platform's multi-chain architecture is designed for CCTP (Cross-Chain Transfer Protocol) integration:

- Same-chain settlement is active on Base (primary) and configured for Ethereum, Polygon, and Arbitrum
- Payment orchestrator already resolves chain ID from the `X-PAYMENT` header
- USDC contract addresses are maintained per chain in the payment verification layer (all chains have verification logic deployed, payments received to date on Base only)
- The `seamless-chain-bridge` service ($2.00) provides a cross-chain bridging endpoint

### 5.2 CCTP Integration Path

Integration of Circle CCTP would enable:

1. **Cross-chain settlement**: Agent pays on Arbitrum, service settles on Base — no manual bridging
2. **Liquidity consolidation**: Automatic USDC routing to a primary settlement chain
3. **Reduced friction**: Agents transact on their native chain without concern for service-side chain preference

**Current readiness**: The payment orchestrator already parses chain IDs from payment headers and maintains per-chain USDC contract addresses. This provides the detection layer needed to identify which chain an inbound payment originated from.

**Required engineering work**: CCTP integration would require implementing burn/mint transaction management, Circle attestation service integration, message relayer infrastructure, and cross-chain state synchronization. This represents meaningful engineering effort beyond the current same-chain verification capability.

### 5.3 Circle Gateway / Wallet Integration

The current Coinbase CDP wallet stack could be complemented or replaced by Circle Programmable Wallets:

- Account creation and key management
- USDC-native transaction execution
- Policy engine for spending controls (relevant for IoT device wallets with spending limits)

---

## 6. Discovery Engine

### 6.1 Discovery Surfaces (Production)

| Surface | Endpoint | Description |
|---------|----------|-------------|
| x402 Manifest | `/.well-known/x402.json` | x402 protocol discovery (57 priced services) |
| A2A Agent Card | `/.well-known/agent.json` | Google A2A protocol agent card |
| A2A v0.3 Card | `/.well-known/agent-card.json` | A2A v0.3 compliant (35 skills) |
| Agent Instructions | `/.well-known/agent-instructions.json` | Machine-readable onboarding guide |
| Bazaar Catalog | `/api/discovery/resources` | Coinbase Bazaar catalog |
| MCP Services | `/mcp/services` | Model Context Protocol discovery |
| x402 Catalog | `/x402/catalog` | Full service catalog with pricing |
| Payment Docs | `/x402/payment-docs` | Payment documentation for agents |

### 6.2 Agent Registry

The discovery engine actively scans 21 sources and maintains a registry of 2,411 discovered agents:

| Source | Agents |
|--------|--------|
| GitHub | 1,278 |
| x402 Bazaar | 654 |
| ElizaOS Registry | 241 |
| Coinbase CDP Wallet | 113 |
| A2A Public Registry | 102 |
| Other sources (16) | 23 |

### 6.3 Inbound Discovery Activity

The platform is actively being indexed by:

- **Coinbase Bazaar** (python-httpx): Primary x402 ecosystem crawler
- **Meta/Facebook** (meta-externalagent): Cataloging services for social graph
- **Google** (GPTBot, AgentIndex-Validator): A2A protocol evaluation
- **SEO crawlers** (AhrefsBot, SemrushBot, SERankingBot): Commercial discoverability
- **BotHub A2A Scanner**: A2A registry evaluation
- **hol.org registry-broker**: Agent registry listing evaluation
- **Waggle**: Agent discovery network

---

## 7. Fiat On-Ramp (Transak Integration)

### 7.1 Production Status

White-label fiat-to-crypto purchase flow at `/buy` and `/buy-crypto`:

- **Supported tokens**: USDC, USDT
- **Supported networks**: Ethereum, Base, Polygon, Arbitrum, Optimism, Tron
- **Transaction limits**: $10 – $2,500
- **Platform fee**: 3% Coin Railz margin
- **Authentication**: Inline login/register (no redirect)
- **Webhook verification**: HMAC-SHA256

### 7.2 Architecture

- Backend: `server/routes/transakOnrampRoutes.ts`
- Frontend: `client/src/pages/BuyOnramp.tsx`
- Database: `onramp_orders` table with full order lifecycle tracking
- Real-time quotes from Transak API
- EVM and Tron wallet address validation

---

## 8. IoT/DePIN Payment Infrastructure

### 8.1 Agent-to-Device (A2D) Payments

Production infrastructure enabling AI agents to pay IoT devices for data via x402:

- Device registry with spending limits
- Credits system with volume pricing
- Billable event metering
- Device-to-device transfers with fee extraction
- Non-custodial USDC on-chain transfers via CDP
- Short-lived access tokens for data delivery

### 8.2 Satellite Data Integration

Production x402-protected APIs connecting to NASA and ESA:

| Data Product | Source | Price |
|-------------|--------|-------|
| Fire Alerts | NASA FIRMS | $0.05 |
| Weather Imagery | NASA GIBS | $0.05 |
| Vegetation Health | NASA MODIS + ESA Sentinel-2 | $0.10 |
| Flood Detection | ESA Sentinel-1 SAR | $0.10 |
| Air Quality | ESA Sentinel-5P TROPOMI | $0.05 |
| Land Use | NASA Landsat + ESA Sentinel-2 | $0.15 |

---

## 9. Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js / TypeScript |
| Framework | Express.js |
| Frontend | React + Vite |
| Database | PostgreSQL (Neon-backed) |
| ORM | Drizzle ORM |
| Wallet | Coinbase CDP SDK v2, AgentKit v0.10.3 |
| Blockchain RPC | Alchemy (Ethereum, Base) |
| Payment Protocol | x402 v2 (Coinbase standard) |
| Fiat On-Ramp | Transak |
| Card Payments | Stripe |
| Satellite APIs | NASA FIRMS, NASA GIBS, ESA Copernicus |

---

## 10. Production vs. Roadmap

### Production (Live)

- 57 priced x402 microservices with USDC settlement
- Multi-chain payment acceptance configured (Base active, Ethereum/Polygon/Arbitrum/Solana configured)
- Payment orchestrator with 6 payment methods
- Discovery engine (21 sources, 2,411 agents)
- 6 discovery surfaces (Bazaar, A2A, MCP, x402, catalog, payment docs)
- Fiat on-ramp (Transak, 6 networks)
- IoT/satellite data verticals (6 NASA/ESA data products)
- Agent wallet provisioning (Coinbase CDP)
- Interaction tracking and analytics
- Payment intent ledger with replay protection

### Roadmap

- **CCTP Integration**: Cross-chain USDC routing for multi-chain settlement consolidation
- **Circle Gateway**: Evaluation of Circle Programmable Wallets as complement to CDP
- **Enterprise SDK**: Packaged SDK for third-party developers to add x402 payment acceptance
- **Multi-token expansion**: Additional stablecoin support beyond USDC/USDT
- **Volume-based pricing**: Tiered pricing for high-frequency agent consumers

---

*Document prepared February 2026. All architecture details reference production code and verified infrastructure.*
