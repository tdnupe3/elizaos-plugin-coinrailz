# Coin Railz — CCTP Implementation Roadmap

**Prepared for Circle Ventures**
**February 2026**

---

## 1. Overview

This document outlines a 90-day milestone plan for integrating Circle's Cross-Chain Transfer Protocol (CCTP) into Coin Railz's x402 payment infrastructure. CCTP integration would enable agents to pay for services on any supported chain while Coin Railz consolidates settlement on a primary chain (Base).

---

## 2. Current Multi-Chain Architecture

### 2.1 What Exists Today

| Capability | Status |
|-----------|--------|
| Chain ID parsing from X-PAYMENT headers | Production |
| Per-chain USDC contract address registry | Production |
| Multi-chain payment verification logic | Production |
| Base settlement (primary) | Active — $182.74 settled |
| Ethereum L1 verification | Configured |
| Polygon verification | Configured |
| Arbitrum verification | Configured |
| Cross-chain bridging service endpoint | Configured (`seamless-chain-bridge`, $2.00) — endpoint exists, no external usage yet |

### 2.2 What CCTP Adds

| Capability | Current (Same-Chain) | With CCTP |
|-----------|---------------------|-----------|
| Agent pays on Arbitrum, service on Base | Not supported | Automatic cross-chain settlement |
| Liquidity consolidation | Manual bridging | Automated routing to primary chain |
| Agent chain preference | Must match service chain | Agent chooses any supported chain |
| Settlement finality | Chain-dependent | CCTP attestation-backed |

---

## 3. Implementation Architecture

### 3.1 CCTP Payment Flow

```
Agent (Arbitrum) → Approves USDC spend → Burns USDC via CCTP TokenMessenger
    → Circle Attestation Service confirms burn
    → Coin Railz relayer submits mint on Base via CCTP MessageTransmitter
    → USDC minted on Base → Payment verified → Service delivered
```

### 3.2 Components Required

| Component | Description | Complexity |
|-----------|-------------|-----------|
| CCTP Contract Integration | Interface with TokenMessenger (burn) and MessageTransmitter (mint) contracts | Medium |
| Attestation Poller | Poll Circle's attestation service for burn confirmations | Low |
| Relayer Service | Submit mint transactions on destination chain | Medium |
| Payment Orchestrator Update | Detect cross-chain payments and route through CCTP flow | Medium |
| State Machine Extension | Add CCTP-specific states (BURNING → ATTESTING → MINTING → SETTLED) | Low |
| Gas Management | Fund relayer wallets for mint transaction gas on each chain | Low |

---

## 4. 90-Day Milestone Plan

### Phase 1: Foundation (Days 1–30)

**Goal**: CCTP contract integration and attestation polling on Base ↔ Ethereum testnet.

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1 | CCTP SDK integration | Install `@circle-fin/cctp-sdk` or direct contract interfaces for TokenMessenger and MessageTransmitter |
| 2 | Attestation service poller | Background job polling Circle's attestation API with exponential backoff (similar pattern to existing topup confirmation job) |
| 3 | Testnet burn/mint flow | End-to-end CCTP transfer on Sepolia ↔ Base Sepolia testnet |
| 4 | Payment orchestrator detection | Modify payment orchestrator to detect cross-chain payment intent (source chain ≠ settlement chain) |

**Dependencies**: Circle CCTP SDK access, testnet USDC faucet, Alchemy testnet RPC endpoints.

**Engineering effort**: 4 engineering-weeks (1 developer, full-time)

### Phase 2: Mainnet Integration (Days 31–60)

**Goal**: Production CCTP on Base ↔ Ethereum mainnet with the first cross-chain x402 payment.

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 5 | State machine extension | Add CCTP states to payment intent ledger: CROSS_CHAIN_DETECTED → BURN_SUBMITTED → ATTESTATION_RECEIVED → MINT_SUBMITTED → SETTLED |
| 6 | Relayer service | Automated mint transaction submission on destination chain; gas wallet management |
| 7 | Mainnet deployment (Base ↔ Ethereum) | First production cross-chain x402 payment |
| 8 | Monitoring and alerts | CCTP-specific monitoring: attestation latency, mint success rate, gas balance alerts |

**Dependencies**: Mainnet CCTP contract addresses, production gas funding for relayer wallets.

**Engineering effort**: 4 engineering-weeks (1 developer, full-time)

### Phase 3: Multi-Chain Expansion (Days 61–90)

**Goal**: Expand CCTP to Arbitrum and Polygon; optimize for latency and cost.

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 9 | Arbitrum CCTP integration | Add Arbitrum as CCTP-enabled chain (burn/mint/attestation) |
| 10 | Polygon CCTP integration | Add Polygon as CCTP-enabled chain |
| 11 | Routing optimization | Smart routing: choose lowest-gas settlement path; batch attestation polling |
| 12 | Security review and documentation | Internal security review of CCTP flow; external audit preparation |

**Dependencies**: CCTP contract availability on Arbitrum and Polygon mainnets.

**Engineering effort**: 4 engineering-weeks (1 developer, full-time)

---

## 5. Chain Priority Order

| Priority | Chain | Rationale |
|----------|-------|-----------|
| 1 | Base ↔ Ethereum | Highest USDC liquidity; both chains already have payment verification deployed |
| 2 | Base ↔ Arbitrum | Growing agent ecosystem on Arbitrum; low gas costs for mint transactions |
| 3 | Base ↔ Polygon | Broad DeFi ecosystem; low gas costs |
| 4 | Solana (future) | Requires separate CCTP integration path (non-EVM); planned for post-90-day phase |

---

## 6. Engineering Cost Estimate

### 6.1 Direct Engineering

| Phase | Duration | Cost (at $150/hr) |
|-------|----------|-------------------|
| Phase 1: Foundation | 4 weeks | $24,000 |
| Phase 2: Mainnet | 4 weeks | $24,000 |
| Phase 3: Multi-Chain | 4 weeks | $24,000 |
| **Total** | **12 weeks** | **$72,000** |

### 6.2 Infrastructure Costs

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Relayer gas funding (Base) | ~$50–$200 | Gas for mint transactions |
| Relayer gas funding (Ethereum) | ~$200–$1,000 | Higher gas costs on L1 |
| Relayer gas funding (Arbitrum/Polygon) | ~$20–$100 | Low gas L2s |
| Additional RPC endpoints | ~$50–$200 | Higher volume for attestation polling |
| **Total monthly infra** | **~$320–$1,500** | |

### 6.3 Total 90-Day Cost

| Category | Cost |
|----------|------|
| Engineering | $72,000 |
| Infrastructure (3 months) | $1,000–$4,500 |
| Testing/QA | $5,000–$10,000 |
| **Total** | **$78,000–$86,500** |

This represents approximately 8% of a $1M raise.

---

## 7. Technical Leverage from Existing Architecture

The current codebase provides significant leverage for CCTP integration:

| Existing Component | CCTP Leverage |
|-------------------|---------------|
| Chain ID parsing in payment orchestrator | Detects source chain for cross-chain routing |
| Per-chain USDC contract registry | Already maintains verified USDC addresses per chain |
| Payment intent state machine | Extensible to CCTP states (pattern matches existing PENDING → CONFIRMING → SUCCEEDED) |
| Async topup confirmation job | Same pattern (poll → confirm → update) applies to attestation polling |
| Wallet safety layer | Extends to relayer wallet management |
| Atomic DB transactions | Ensures CCTP state transitions are crash-safe |

---

## 8. Success Metrics

| Metric | Day 30 | Day 60 | Day 90 |
|--------|--------|--------|--------|
| Testnet cross-chain payments | 100+ | — | — |
| Mainnet cross-chain payments | — | 10+ | 50+ |
| CCTP-enabled chains | 0 | 2 (Base↔ETH) | 4 (+ Arb, Polygon) |
| Cross-chain settlement latency | — | <5 min | <2 min |
| Cross-chain settlement success rate | — | >95% | >99% |

---

## 9. Risk Factors

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| CCTP contract changes during integration | Low | Medium | Pin to stable contract versions; follow Circle developer announcements |
| Attestation service latency | Medium | Low | Exponential backoff with timeout; fallback to same-chain settlement |
| Gas price spikes on Ethereum L1 | Medium | Medium | Priority routing through L2s; gas price monitoring and threshold alerts |
| Relayer wallet compromise | Low | High | Wallet whitelisting (existing); minimum balance policy; monitoring |

---

## 10. Circle Collaboration Opportunities

CCTP integration creates natural collaboration points between Coin Railz and Circle:

| Opportunity | Description |
|-------------|-------------|
| CCTP SDK early access | Access to latest SDK features and developer support |
| Attestation service SLA | Priority attestation for high-volume x402 settlements |
| Joint case study | "USDC micropayments across chains via CCTP" |
| Programmable Wallets integration | Replace/complement CDP wallets with Circle Programmable Wallets |
| CCTP V2 features | Cross-chain messaging beyond token transfer for richer agent interactions |

---

*This roadmap assumes one full-time senior developer. With the planned security hire (second developer), some phases could be parallelized, potentially compressing the timeline to 60–75 days.*
