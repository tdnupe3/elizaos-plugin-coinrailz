# Coin Railz — Revenue Model Breakdown

**Prepared for Circle Ventures**
**February 2026**

---

## 1. Revenue Streams

Coin Railz generates revenue through four mechanisms:

| Stream | Description | Current Status |
|--------|-------------|----------------|
| x402 Micropayments | Per-call USDC fees on 57 priced services | Live — $262.04 realized |
| Fiat On-Ramp Margin | 3% fee on Transak-powered USDC/USDT purchases | Integrated — no purchase volume yet |
| Credits System | Pre-purchased USDC balance with volume pricing | Live — credits ledger operational |
| Enterprise API Keys | Monthly/annual API access subscriptions | Planned |

---

## 2. x402 Per-Call Economics

### 2.1 Pricing by Vertical

| Vertical | Services | Price Range (USDC) | Weighted Avg |
|----------|----------|--------------------|-------------|
| Trading Intelligence | 14 services | $0.10 – $0.75 | $0.33 |
| Execution & Infrastructure | 6 services | $0.50 – $2.00 | $1.08 |
| Premium Services | 3 services | $5.00 – $10.00 | $6.67 |
| Prediction Markets | 7 services | $0.25 – $0.50 | $0.36 |
| Real Estate | 3 services | $0.75 – $1.50 | $1.08 |
| Banking/Finance | 3 services | $0.75 – $1.75 | $1.25 |
| Trading/Investment | 3 services | $0.50 – $2.00 | $1.17 |
| Market Intelligence | 3 services | $0.75 – $1.25 | $1.00 |
| Traditional Markets | 2 services | $0.40 | $0.40 |
| Solana DeFi | 1 service | $0.05 | $0.05 |
| Satellite Data (NASA/ESA) | 6 services | $0.05 – $0.15 | $0.08 |
| IoT/DePIN | 5 services | $0.025 – $0.50 | $0.19 |
| Discovery | 1 service (ping) | $0.25 | $0.25 |

**Catalog-wide simple average**: $0.65 USDC per call (unweighted across 57 services)
**Volume-weighted average**: $0.33 USDC per call (weighted by 30-day interaction volume; low-cost discovery and trading services dominate current traffic)

### 2.2 Gross Margin Per Call

| Cost Component | Per-Call Estimate | Notes |
|----------------|-------------------|-------|
| **Revenue (weighted avg)** | **$0.33** | Volume-weighted from production data |
| RPC / Blockchain verification | ~$0.001 | Alchemy RPC calls for tx verification |
| External API costs | $0.00 – $0.02 | NASA/ESA (free), Polymarket (free), Kalshi (free) |
| Compute (server) | ~$0.001 | Marginal cost at current scale |
| **Variable cost per call** | **~$0.005** | |
| **Gross margin per call** | **~$0.325** | **~98.5% gross margin** |

Gross margins are high because:
- Data sources (NASA, ESA, Polymarket, Kalshi) are free public APIs
- RPC costs are minimal per verification call
- No per-transaction fees to Circle/USDC issuers
- Compute costs are near-zero at current scale

**At scale**: RPC costs increase with verification volume but remain sub-$0.01/call. The primary cost scaling factor is engineering headcount, not per-call variable costs.

### 2.3 Cost Basis Assumptions

| External Service | Pricing Model | Current Cost |
|------------------|---------------|-------------|
| Alchemy RPC | Free tier (300M compute units/month) | $0/month |
| NASA Earthdata | Free (U.S. government open data) | $0/month |
| ESA Copernicus | Free (EU open data program) | $0/month |
| Polymarket API | Free public access | $0/month |
| Kalshi API | Free public access | $0/month |
| Coinbase CDP | Free tier (wallet operations) | $0/month |
| Replit hosting | Included in platform | $0/month marginal |

Note: At higher scale (>100K daily calls), Alchemy would require a paid plan (~$49–$199/month). NASA/ESA data remains free regardless of scale.

---

## 3. Conversion Funnel Economics

### 3.1 Current Funnel (30-Day Window: Jan 22 – Feb 21, 2026)

| Stage | Count | Rate |
|-------|-------|------|
| x402 Challenges Issued (30-day) | 13,378 | 100% (addressable demand) |
| Payments Authorized (30-day) | 169 | 1.26% challenge-to-payment conversion |
| Payments Verified (30-day) | 169 | 100% authorized→verified |
| Requests Completed (30-day) | 306 | Includes first-call-free grants (31) |

**Conversion rate definition**: 1.26% = 169 paid transactions / 13,378 payment challenges issued (30-day). This measures the rate at which agents that encounter a payment challenge actually complete a payment.
**Revenue per challenge**: $262.04 / 13,378 challenges = $0.0196 per challenge issued

### 3.2 Why Conversion Is Low (By Design at This Stage)

The 1.26% conversion rate reflects the current traffic composition:

| Traffic Type | Estimated Share | Conversion Behavior |
|-------------|-----------------|---------------------|
| Ecosystem crawlers & indexers | ~60% | Never pay — cataloging only |
| Registry validators & evaluators | ~25% | Never pay — capability assessment |
| SEO bots (Ahrefs, Semrush, etc.) | ~10% | Never pay — web indexing |
| Transacting agents | ~5% | Pay when wallet-enabled |

The platform is in the **discovery phase**: crawlers and validators must index services before transacting agents begin paying. This is the expected funnel sequence for a new protocol.

### 3.3 Conversion Sensitivity

| Conversion Rate | Monthly USDC Volume | Annual Run Rate |
|-----------------|---------------------|-----------------|
| 1.26% (current) | $262 | $3,144 |
| 5% (early traction) | $2,208 | $26,496 |
| 10% (moderate adoption) | $4,415 | $52,980 |
| 15% (mature marketplace) | $6,623 | $79,476 |

Note: These assume current traffic volume (14,163/month). Volume growth compounds with conversion improvement — see USDC Velocity Model for combined projections.

---

## 4. Average Revenue Per Agent

### 4.1 Current State

| Metric | Value |
|--------|-------|
| Unique paying wallets | 1 |
| Total revenue | $262.04 USDC |
| Revenue per paying agent | $262.04 |
| Paying period | Dec 9, 2025 – Feb 18, 2026 (71 days) |
| Monthly revenue per agent | ~$110.72 |
| Payments per agent | 317 |
| Average payment size | $0.83 |

### 4.2 Revenue Per Agent at Scale

With a broader agent base, average revenue per agent will normalize lower as casual users mix with power users:

| Agent Segment | Estimated Monthly Calls | Monthly Revenue |
|---------------|------------------------|-----------------|
| Power agent (daily use) | 300–1,000 calls | $99 – $330 |
| Regular agent (weekly use) | 50–200 calls | $16.50 – $66 |
| Casual agent (occasional) | 5–20 calls | $1.65 – $6.60 |
| Discovery-only (trial) | 1–5 calls (free tier) | $0 |

**Blended ARPA target**: $15–$50/month across all active agents (based on SaaS API marketplace benchmarks)

---

## 5. Fiat On-Ramp Margin

### 5.1 Transak Integration Economics

| Component | Value |
|-----------|-------|
| Supported purchase range | $10 – $2,500 |
| Coin Railz fee | 3% of purchase amount |
| Transak processing fee | Included in their spread |
| Supported tokens | USDC, USDT |
| Supported networks | Ethereum, Base, Polygon, Arbitrum, Optimism, Tron |
| Payment methods | Credit/debit card, Apple Pay, Google Pay |

### 5.2 On-Ramp Revenue Model

| Monthly On-Ramp Volume | 3% Coin Railz Fee |
|------------------------|-------------------|
| $10,000 | $300 |
| $50,000 | $1,500 |
| $100,000 | $3,000 |
| $500,000 | $15,000 |

The on-ramp is currently live but pre-marketing. Revenue from this channel will grow as agent operators and developers need to acquire USDC to use x402 services.

---

## 6. Credits System Economics

The credits system allows agents to pre-purchase USDC balance for service consumption:

| Credit Purchase | USDC Value | Effective Discount |
|----------------|------------|-------------------|
| $5.00 | $5.00 | 0% (standard) |
| $25.00 | $25.00 | 0% (standard) |
| $100.00 | $100.00 | 0% (standard) |

Credits provide:
- **For agents**: Reduced per-call latency (no on-chain verification needed)
- **For Coin Railz**: Pre-paid revenue with float benefit
- **For ecosystem**: Lower gas costs (single purchase vs. per-call payments)

---

## 7. Unit Economics Summary

| Metric | Current | Target (12-Month) |
|--------|---------|-------------------|
| Weighted avg price per call | $0.33 | $0.33 (stable pricing) |
| Gross margin per call | ~98.5% | ~95% (accounting for scaled RPC costs) |
| Conversion rate | 1.26% | 5–10% |
| Monthly USDC volume | $262 | $10,000–$50,000 |
| Revenue per paying agent | $110.72/month | $15–$50/month (blended) |
| On-ramp margin | 3% | 3% |
| Monthly interactions | 14,163 | 100,000–500,000 |

---

## 8. Revenue Growth Drivers

1. **Agent wallet proliferation**: As more agents gain USDC wallets (via Coinbase AgentKit, CDP), conversion rates increase
2. **Discovery → transaction pipeline**: Current crawlers/validators are the leading indicator; transacting agents follow
3. **Vertical expansion**: Prediction markets showing strongest engagement (28 interactions across 6 services from multiple sources)
4. **On-ramp activation**: Marketing the fiat → USDC flow to developers and agent operators
5. **Enterprise API keys**: Subscription access for high-volume agent platforms

---

*All figures derived from production PostgreSQL database and `shared/pricing.ts`. Revenue projections are illustrative scenarios based on observed baselines, not guarantees.*
