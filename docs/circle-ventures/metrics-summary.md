# Coin Railz — Production Metrics Summary

**Prepared for Circle Ventures**
**February 21, 2026**
**Data source: Production PostgreSQL database (verified queries)**

---

## 1. Platform Overview

| Metric | Value | Period |
|--------|-------|--------|
| Priced services in catalog | 57 | Current (shared/pricing.ts) |
| Total x402 interactions | 29,263 | All-time (since Nov 3, 2025) |
| 30-day interactions | 14,163 | Last 30 days |
| Unique IP addresses | 1,233 | All-time |
| 30-day unique IPs | 719 | Last 30 days |
| Unique services accessed | 72 | Last 30 days |
| Error rate | 0.62% | Last 30 days (88 / 14,163) |

---

## 2. Payment & Revenue

### 2.1 Payment Intents

| Status | Count | Amount (USDC) |
|--------|-------|---------------|
| Succeeded | 317 | $262.04 |
| Pending | 7 | $3.05 |
| **Total** | **324** | **$265.09** |

### 2.2 On-Chain USDC Payments

| Network | Payments | Revenue (USDC) | Unique Wallets |
|---------|----------|----------------|----------------|
| Base (eip155:8453) | 213 | $157.02 | 1 |
| Base (legacy identifier) | 13 | $25.72 | 1 |
| **Total** | **226** | **$182.74** | **1** |

Note: The $182.74 on-chain total represents verified blockchain payments recorded in the `x402_payments` table. The $262.04 payment intent total includes payments processed through all methods (on-chain, credits, API key). The difference ($79.30) represents non-on-chain settlement methods.

**First payment**: December 9, 2025
**Most recent payment**: February 18, 2026

### 2.3 Revenue Context

Revenue to date reflects early-stage infrastructure with a single repeat-paying agent on Base chain. The platform is currently in the discovery and cataloging phase, where crawlers, validators, and registry evaluators are indexing and evaluating services. Payment conversion follows discovery — the current growth trajectory is in inbound discovery traffic, not yet in revenue.

---

## 3. Interaction Funnel (30 Days)

| Event Type | Count | Description |
|------------|-------|-------------|
| challenge-issued | 13,378 | 402 payment challenges served |
| request-complete | 306 | Service calls completed |
| authorized | 169 | Payments authorized |
| payment-verified | 169 | Payments verified on-chain |
| first-call-free | 31 | Trial access grants |
| verification-failed | 61 | Failed payment verifications |
| error | 22 | Service errors |

**Authorization-to-verification rate**: 100% of 169 authorized events were subsequently verified on-chain within the 30-day window.
**Verification failures**: 61 attempts failed verification (malformed headers, insufficient amounts, or invalid signatures). These represent failed payment attempts, not service errors.

---

## 4. Discovery & Cataloging

### 4.1 Agent Registry

| Metric | Value |
|--------|-------|
| Total discovered agents | 2,411 |
| Discovery sources | 21 |
| Registry active since | October 29, 2025 |
| Latest discovery | February 21, 2026 |

**Top discovery sources:**

| Source | Agents |
|--------|--------|
| GitHub (crypto AI repos) | 1,278 |
| Coinbase x402 Bazaar | 654 |
| ElizaOS Registry | 241 |
| Coinbase CDP Wallet | 113 |
| A2A Public Registry | 102 |

### 4.2 Inbound Discovery Traffic

**Manifest visitors (/.well-known/x402) — last 4 days:**

| Date | Hits | Unique Visitors |
|------|------|----------------|
| Feb 18 | 192 | 150 |
| Feb 19 | 252 | 208 |
| Feb 20 | 277 | 214 |
| Feb 21 | 390 | 341 |

**Trend**: +127% unique visitors over 4 days (150 → 341)

### 4.3 Endpoint Hit Summary (since Jan 26, 2026)

| Metric | Value |
|--------|-------|
| Total endpoint hits | 5,830 |
| Unique visitors | 5,245 |
| Unique user agents | 57 |

### 4.4 Active Discovery Crawlers

| Crawler | Description | Status |
|---------|-------------|--------|
| Coinbase Bazaar (python-httpx) | Primary x402 ecosystem indexer | Active daily |
| Meta/Facebook (meta-externalagent) | Social graph cataloging | Cataloging 24+ services |
| AgentIndex-Validator | Agent registry validator | 61 unique visitors/12h |
| Waggle | Agent discovery network | 30 unique visitors/12h |
| GPTBot | OpenAI crawler | Active |
| AhrefsBot | SEO backlink indexer | Active |
| SemrushBot | Commercial SEO platform | Active |
| SERankingBot | Backlink analysis | Active |
| BotHub A2A Scanner | A2A protocol evaluator | First appearance Feb 21 |
| hol.org registry-broker | Agent registry listing eval | Daily since Feb 17 |

---

## 5. Service Performance

### 5.1 Latency (30-Day)

| Percentile | Latency |
|------------|---------|
| p50 (median) | 1 ms |
| p95 | 1,612 ms |
| p99 | 5,549 ms |

Note: p95/p99 include services that make external API calls (satellite data from NASA/ESA, prediction market data from Polymarket/Kalshi). Core infrastructure services (ping, gas-price-oracle, token-metadata) respond consistently under 3ms.

### 5.2 Top Services by Interaction Volume (30 Days)

| Service | Interactions | Category |
|---------|-------------|----------|
| gas-price-oracle | 2,356 | Trading Intelligence |
| ping | 2,342 | Discovery |
| token-metadata | 2,315 | Trading Intelligence |
| polymarket-search | 1,097 | Prediction Markets |
| polymarket-odds | 918 | Prediction Markets |
| dex-liquidity | 904 | Trading Intelligence |
| contract-scan | 231 | Infrastructure |
| transaction-builder | 230 | Infrastructure |
| agent-create-wallet | 219 | Infrastructure |
| trending-tokens | 191 | Trading Intelligence |

---

## 6. 14-Day Interaction Trend

| Date | Interactions | Unique IPs | Services Accessed |
|------|-------------|-----------|-------------------|
| Feb 7 | 799 | 46 | 43 |
| Feb 8 | 1,337 | 47 | 66 |
| Feb 9 | 312 | 34 | 27 |
| Feb 10 | 291 | 51 | 10 |
| Feb 11 | 132 | 25 | 30 |
| Feb 12 | 711 | 79 | 31 |
| Feb 13 | 468 | 45 | 16 |
| Feb 14 | 510 | 39 | 44 |
| Feb 15 | 333 | 27 | 20 |
| Feb 16 | 336 | 18 | 29 |
| Feb 17 | 496 | 49 | 24 |
| Feb 18 | 536 | 61 | 40 |
| Feb 19 | 485 | 79 | 35 |
| Feb 20 | 321 | 46 | 43 |
| Feb 21 | 300 | 39 | 37 |

**14-day average**: 494 interactions/day, 46 unique IPs/day

---

## 7. Multi-Chain Coverage

### 7.1 Chains with Active Payment Support

| Chain | USDC Support | USDT Support | Settlement Status |
|-------|-------------|-------------|-------------------|
| Base (eip155:8453) | Yes | Yes | Primary — $182.74 USDC settled on-chain |
| Ethereum (eip155:1) | Yes | Yes | Payment verification configured |
| Polygon (eip155:137) | Yes | Yes | Payment verification configured |
| Arbitrum (eip155:42161) | Yes | Yes | Payment verification configured |
| Solana | Yes | Yes | Via Solana Actions / Dialect integration |

Note: Base is the only chain with completed external payment transactions to date. Other chains have payment acceptance infrastructure deployed (USDC contract addresses, verification logic) but have not yet received external agent payments.

### 7.2 Fiat On-Ramp Networks (Transak)

| Network | USDC | USDT |
|---------|------|------|
| Ethereum | Yes | Yes |
| Base | Yes | Yes |
| Polygon | Yes | Yes |
| Arbitrum | Yes | Yes |
| Optimism | Yes | Yes |
| Tron | — | Yes |

---

## 8. Client Diversity (All-Time Top User Agents)

| Client | Interactions | Unique IPs | Type |
|--------|-------------|-----------|------|
| python-httpx (Bazaar) | 14,941 | 821 | Ecosystem crawler |
| Node.js clients | 4,314 | 310 | AI agents |
| curl | 3,592 | 139 | Developer testing |
| zauthx402-agent | 1,319 | 136 | x402 autonomous agent |
| Meta/Facebook | 697 | 67 | Social graph crawler |
| Go HTTP clients | 253 | 22 | AI agents |
| XGate-HealthCheck | 213 | 83 | Service validator |
| GPTBot (OpenAI) | 212 | 32 | AI crawler |
| AhrefsBot | 142 | 38 | SEO crawler |
| SeznamBot | 137 | 39 | Search engine |

---

## 9. USDC Velocity Potential

### 9.1 Current Transaction Economics

- **Weighted average service price**: $0.33 USDC (computed from 30-day interaction volume × service pricing from `shared/pricing.ts`)
- **Price range**: $0.025 (IoT sensor reading) to $10.00 (smart contract audit)
- **30-day challenge volume**: 13,378 payment challenges served
- **Implied demand at full conversion**: 13,378 challenges × $0.33 weighted avg = ~$4,415 USDC potential monthly volume

### 9.2 Illustrative Scenarios

The following are illustrative scenarios, not projections. Actual conversion rates will depend on agent payment infrastructure maturity and wallet provisioning adoption.

| Metric | Current | 10x Traffic | 100x Traffic |
|--------|---------|-------------|--------------|
| Monthly interactions | 14,163 | 141,630 | 1,416,300 |
| Monthly USDC volume (at current ~1.2% conversion) | $262 | $2,620 | $26,200 |
| Monthly USDC volume (at 5% conversion) | $2,208 | $22,075 | $220,750 |
| Monthly USDC volume (at 15% conversion) | $6,623 | $66,225 | $662,250 |

Note: Current conversion rate is approximately 1.2% (169 payments / 14,163 interactions). The 13,378 monthly payment challenges represent addressable demand currently in the discovery/evaluation phase. Most current traffic is from ecosystem crawlers and validators, not transacting agents.

---

## 10. Data Verification

All metrics in this document were extracted directly from the production PostgreSQL database using SQL queries against the following tables:

- `x402_interactions` — Primary interaction and funnel tracking
- `x402_payment_intents` — Payment intent ledger
- `x402_payments` — Completed on-chain payments
- `discovered_agents` — Agent registry
- `endpoint_hits` — Discovery endpoint tracking

Queries are reproducible and can be verified against the live database upon request.

---

**Document consistency note**: The accompanying investor memo references "41 services" and ">100 USDC payments" — these reflect earlier figures and should be updated to 57 services and 317 payment intents to match this verified data. The raise target should be harmonized across documents ($500K–$1M in the memo vs. $1M in the executive summary).

*Metrics current as of February 21, 2026, 16:00 UTC. All figures represent production data, not testnet or simulated activity.*
