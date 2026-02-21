# Coin Railz — USDC Velocity Growth Model

**Prepared for Circle Ventures**
**February 2026**

---

## 1. Model Framework

This model projects USDC transaction velocity based on three growth drivers:

1. **Agent population growth** — Number of wallet-enabled agents interacting with x402 services
2. **Usage frequency** — Average service calls per agent per day
3. **Conversion rate improvement** — Percentage of interactions that result in paid transactions

**Formula**:

```
Monthly USDC Volume = Active Agents × Calls/Agent/Day × 30 Days × Avg Price × Conversion Rate
```

---

## 2. Current Baseline (Observed Production Data)

| Metric | Value | Source |
|--------|-------|--------|
| Monthly interactions | 14,163 | x402_interactions (30-day) |
| Daily interactions (avg) | 472 | 14,163 / 30 |
| Unique IPs (30-day) | 719 | x402_interactions |
| Paying agents | 1 | x402_payments (unique wallets) |
| Monthly USDC volume | $262.04 | x402_payment_intents (succeeded) |
| Conversion rate (challenge→payment) | 1.26% | 169 paid / 13,378 challenges issued (30-day) |
| Weighted avg price | $0.33 | Volume-weighted from pricing × interactions |

### Growth Trajectory (Observed)

| Month | Interactions | Unique IPs | MoM Growth |
|-------|-------------|------------|------------|
| Nov 2025 | 1,829 | 70 | — (launch) |
| Dec 2025 | 8,114 | 347 | +344% |
| Jan 2026 | 7,532 | 393 | –7% (seasonal) |
| Feb 2026 (projected) | 14,163 | 562 | +88% |

**Compound monthly growth rate** (Nov→Feb): ~97% month-over-month interaction growth

---

## 3. Agent Adoption Model

### 3.1 Agent Ecosystem Growth

The AI agent ecosystem is expanding rapidly. Key adoption catalysts:

| Catalyst | Impact on Coin Railz |
|----------|---------------------|
| Coinbase AgentKit wallet proliferation | More agents with USDC payment capability |
| x402 protocol standardization | Industry convergence on HTTP 402 for agent commerce |
| Bazaar marketplace growth | Central discovery point driving agent traffic |
| A2A protocol adoption | Google-backed standard increasing agent interoperability |
| MCP tool discovery | Anthropic/OpenAI ecosystem surfacing x402 services |

### 3.2 Agent Funnel

```
Discovery (crawlers/validators) → Evaluation (capability testing) → Trial (first-call-free) → Paid
```

Current traffic is primarily in the Discovery and Evaluation phases. The leading indicators are strong:
- 341 unique manifest visitors on Feb 21 alone (+127% over 4 days)
- 10 active crawler/validator categories indexing services
- First human browser traffic observed (Firefox 147, Chrome 120)

---

## 4. USDC Velocity Scenarios

### 4.1 Conservative Scenario (Organic Growth Only)

Assumes: No marketing spend, no partnerships, organic discovery only.

| Quarter | Active Agents | Calls/Agent/Day | Conversion | Avg Price | Monthly USDC |
|---------|--------------|-----------------|-----------|-----------|-------------|
| Q1 2026 (current) | 1 | 10 | 1.26% | $0.33 | $262 |
| Q2 2026 | 5 | 15 | 3% | $0.33 | $2,228 |
| Q3 2026 | 15 | 20 | 5% | $0.33 | $14,850 |
| Q4 2026 | 40 | 25 | 7% | $0.33 | $69,300 |
| Q1 2027 | 80 | 30 | 10% | $0.33 | $237,600 |

**12-month projected annual USDC volume (conservative)**: ~$324,000

### 4.2 Moderate Scenario (Funded Growth)

Assumes: $1M raise deployed toward engineering hires, BD outreach, and integration partnerships.

| Quarter | Active Agents | Calls/Agent/Day | Conversion | Avg Price | Monthly USDC |
|---------|--------------|-----------------|-----------|-----------|-------------|
| Q1 2026 (current) | 1 | 10 | 1.26% | $0.33 | $262 |
| Q2 2026 | 20 | 20 | 5% | $0.35 | $21,000 |
| Q3 2026 | 75 | 30 | 8% | $0.35 | $189,000 |
| Q4 2026 | 200 | 40 | 10% | $0.35 | $840,000 |
| Q1 2027 | 500 | 50 | 12% | $0.35 | $3,150,000 |

**12-month projected annual USDC volume (moderate)**: ~$4,200,000

### 4.3 Aggressive Scenario (Network Effects)

Assumes: CCTP integration live, multiple agent platforms integrated, enterprise API agreements.

| Quarter | Active Agents | Calls/Agent/Day | Conversion | Avg Price | Monthly USDC |
|---------|--------------|-----------------|-----------|-----------|-------------|
| Q1 2026 (current) | 1 | 10 | 1.26% | $0.33 | $262 |
| Q2 2026 | 50 | 30 | 8% | $0.40 | $144,000 |
| Q3 2026 | 250 | 50 | 12% | $0.40 | $1,800,000 |
| Q4 2026 | 1,000 | 75 | 15% | $0.40 | $13,500,000 |
| Q1 2027 | 3,000 | 100 | 18% | $0.40 | $64,800,000 |

**12-month projected annual USDC volume (aggressive)**: ~$80,000,000

---

## 5. Network Effects Thesis

### 5.1 Supply-Side Network Effects

More services → more discovery traffic → more agent evaluations → more payments

| Current | Moderate Scale | Full Scale |
|---------|---------------|------------|
| 57 services | 200 services | 1,000+ services |
| 12 verticals | 25 verticals | 50+ verticals |
| Solo developer | 5-person team | Developer ecosystem |

### 5.2 Demand-Side Network Effects

More paying agents → better pricing data → smarter recommendations → more agent value → more agents

The x402 interaction log creates a feedback loop: every challenge and payment generates pricing intelligence that improves service recommendations for future agents.

### 5.3 Cross-Chain Network Effects (CCTP-Enabled)

With CCTP integration, agents on any chain can access any service:

```
Agent on Arbitrum → pays USDC on Arbitrum → CCTP burns USDC
→ CCTP mints USDC on Base → service settles on Base
```

This eliminates the current constraint where agents must have USDC on the same chain as the service provider, expanding the addressable market to all USDC holders across all supported chains.

---

## 6. Scale Math (Circle's Core Question)

**"If 10,000 agents call 10 endpoints per day at $0.33 average..."**

```
10,000 agents × 10 calls/day × $0.33 × 30 days = $990,000/month USDC volume
```

At various scales:

| Active Agents | Daily Calls/Agent | Monthly USDC Volume | Annual USDC Volume |
|--------------|-------------------|--------------------|--------------------|
| 100 | 10 | $9,900 | $118,800 |
| 1,000 | 10 | $99,000 | $1,188,000 |
| 10,000 | 10 | $990,000 | $11,880,000 |
| 100,000 | 10 | $9,900,000 | $118,800,000 |
| 1,000,000 | 10 | $99,000,000 | $1,188,000,000 |

Note: These calculations assume 100% conversion rate to illustrate maximum velocity potential. In practice, conversion rates of 10–20% are realistic for mature API marketplaces, reducing these figures accordingly.

---

## 7. USDC Velocity vs. Traditional Payment Volume

Unlike traditional payment infrastructure where money moves through and settles elsewhere, x402 creates **persistent USDC velocity**:

| Characteristic | Traditional Payments | x402 USDC Payments |
|---------------|---------------------|-------------------|
| Settlement token | Fiat (converted) | USDC (native) |
| Settlement time | 1–3 business days | Seconds (on-chain) |
| Transaction size | $10+ (card minimums) | $0.025+ (micropayments) |
| Transaction frequency | Occasional | Per-API-call |
| USDC lifecycle | None | Acquired → spent → re-spent |

The critical insight for Circle: x402 micropayments create **high-frequency USDC circulation**, not one-time settlement. Each USDC token can cycle through multiple agent-to-service transactions per day, driving velocity multiplication.

---

## 8. Key Assumptions and Risks

| Assumption | Risk Level | Mitigation |
|-----------|-----------|-----------|
| Agent wallet adoption accelerates | Medium | Multiple wallet providers (CDP, AgentKit, MetaMask) |
| x402 becomes standard protocol | Medium | Already adopted by Coinbase, growing ecosystem |
| Conversion rates improve with maturity | Low | Standard SaaS API marketplace pattern |
| Average price remains stable | Low | Pricing anchored to cost structure, not speculative |
| No major protocol competitor emerges | Medium | First-mover advantage in USDC-native settlement |

---

*All baseline figures are from production data. Projections are illustrative scenarios using observed growth rates and industry benchmarks for API marketplace conversion. Actual results will depend on agent ecosystem adoption pace, protocol standardization, and market conditions.*
