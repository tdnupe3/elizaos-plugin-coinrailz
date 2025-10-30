# Coin Railz Micropayment Services - Technical Specification

## Overview
This document specifies 5 high-volume micropayment services designed for the x402 ecosystem. These services target AI agents and automated systems requiring instant, low-cost API access.

**Target Market:** x402 ecosystem (1.4M+ transactions/day, $0.001-$10 price point)
**Revenue Model:** High-volume, low-margin micropayments via x402 protocol
**Payment Method:** USDC on Base Chain via x402 HTTP 402 protocol

---

## Service Catalog

### 1. Multi-Chain Balance Checker
**Service ID:** `multi-chain-balance`  
**Price:** $0.01 USDC per query  
**Target Response Time:** <1 second  

#### Description
Query wallet balances across 7+ EVM chains in a single API call. Returns native token balances and top ERC-20 token holdings.

#### API Endpoint
```
POST /x402/service/multi-chain-balance
```

#### Request Format
```json
{
  "walletAddress": "0x...",
  "chains": ["ethereum", "base", "polygon", "arbitrum", "optimism", "bnb", "avalanche"],
  "includeTokens": true
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "balances": {
      "ethereum": {
        "native": "1.5 ETH",
        "nativeUSD": "$5,908.49",
        "tokens": [
          {"symbol": "USDC", "balance": "1000.00", "valueUSD": "$1,000.00"}
        ]
      },
      "base": {
        "native": "0.5 ETH",
        "nativeUSD": "$1,969.50",
        "tokens": []
      }
    },
    "totalValueUSD": "$8,877.99",
    "queryTime": "0.8s"
  }
}
```

#### Infrastructure
- Alchemy RPC endpoints (already configured)
- Parallel async queries across chains
- In-memory caching (5 minute TTL)

---

### 2. Gas Price Oracle
**Service ID:** `gas-price-oracle`  
**Price:** $0.01 USDC per query  
**Target Response Time:** <1 second  

#### Description
Real-time gas prices across multiple chains with slow/standard/fast estimates in both Gwei and USD.

#### API Endpoint
```
POST /x402/service/gas-price-oracle
```

#### Request Format
```json
{
  "chains": ["ethereum", "base", "polygon", "arbitrum"]
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "ethereum": {
      "slow": {"gwei": "20", "usd": "$0.84"},
      "standard": {"gwei": "25", "usd": "$1.05"},
      "fast": {"gwei": "30", "usd": "$1.26"},
      "baseFee": "18.5"
    },
    "base": {
      "slow": {"gwei": "0.1", "usd": "$0.004"},
      "standard": {"gwei": "0.15", "usd": "$0.006"},
      "fast": {"gwei": "0.2", "usd": "$0.008"}
    }
  },
  "timestamp": "2025-10-30T14:35:22Z",
  "queryTime": "0.3s"
}
```

#### Infrastructure
- Alchemy/public RPC gas estimation APIs
- CoinGecko for ETH price conversion
- Redis caching (1 minute TTL)

---

### 3. Token Price Feed
**Service ID:** `token-price-feed`  
**Price:** $0.05 USDC per token  
**Target Response Time:** <1 second  

#### Description
Real-time token pricing with 24h change, volume, market cap, and liquidity. Supports both major tokens (CoinGecko) and micro-caps (DEX Screener).

#### API Endpoint
```
POST /x402/service/token-price
```

#### Request Format
```json
{
  "tokenAddress": "0x...",
  "chain": "base"
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "symbol": "USDC",
    "name": "USD Coin",
    "price": "$0.9998",
    "priceChange24h": "+0.02%",
    "volume24h": "$45,234,567",
    "marketCap": "$38,456,789,012",
    "liquidity": "$125,000,000",
    "source": "coingecko",
    "chain": "base"
  },
  "queryTime": "0.5s"
}
```

#### Infrastructure
- CoinGecko API (free tier: 10-50 calls/min)
- DEX Screener API (fallback for micro-caps)
- In-memory caching (2 minute TTL)

---

### 4. Smart Contract Quick Scan
**Service ID:** `contract-quick-scan`  
**Price:** $2.00 USDC per scan  
**Target Response Time:** <10 seconds  

#### Description
Basic smart contract security scan including verification status, common vulnerability checks, honeypot detection, and safety score. Light version of the $1000 full audit.

#### API Endpoint
```
POST /x402/service/contract-scan
```

#### Request Format
```json
{
  "contractAddress": "0x...",
  "chain": "ethereum"
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "chain": "ethereum",
    "verified": true,
    "compiler": "v0.8.19+commit.7dd6d404",
    "safetyScore": 85,
    "findings": {
      "critical": 0,
      "high": 0,
      "medium": 1,
      "low": 3,
      "info": 5
    },
    "checks": {
      "isHoneypot": false,
      "hasProxyPattern": true,
      "hasOwnership": true,
      "hasPausable": false,
      "hasTimelocks": true,
      "canRenounceOwnership": true
    },
    "warnings": [
      "Contract uses proxy pattern - implementation can be changed",
      "Owner has elevated privileges"
    ],
    "recommendations": [
      "Verify implementation contract separately",
      "Check timelock settings before interacting"
    ]
  },
  "scanTime": "8.2s"
}
```

#### Infrastructure
- Etherscan/Basescan API for source code
- Pattern matching for common vulnerabilities
- Honeypot detector API integration
- Basic static analysis rules

---

### 5. Wallet Risk Score
**Service ID:** `wallet-risk-score`  
**Price:** $0.50 USDC per analysis  
**Target Response Time:** <2 seconds  

#### Description
Analyze wallet address for risk indicators including transaction patterns, interaction with flagged contracts, mixing service usage, and compliance red flags.

#### API Endpoint
```
POST /x402/service/wallet-risk
```

#### Request Format
```json
{
  "walletAddress": "0x...",
  "chain": "ethereum"
}
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "riskScore": 35,
    "riskLevel": "LOW",
    "flags": [
      "Interacted with Tornado Cash (2 transactions)",
      "High-value transaction >$100k detected"
    ],
    "analysis": {
      "age": "845 days",
      "totalTransactions": 1243,
      "totalVolume": "$2,456,789",
      "uniqueContracts": 89,
      "mixerInteractions": 2,
      "sanctionedAddresses": 0,
      "suspiciousPatterns": 1
    },
    "recommendation": "Low risk - suitable for normal transactions. Monitor mixer activity.",
    "lastUpdated": "2025-10-30T14:35:22Z"
  },
  "queryTime": "1.8s"
}
```

#### Infrastructure
- On-chain transaction history (Alchemy Transfers API)
- OFAC/sanctions list checking
- Known mixer/tumbler address database
- Pattern analysis (unusually large txs, rapid transfers)

---

## Technical Architecture

### Database Schema
```typescript
// Microservice request tracking
export const microserviceRequests = pgTable('microservice_requests', {
  id: varchar('id').primaryKey(),
  serviceId: varchar('service_id').notNull(),
  requestInput: jsonb('request_input').notNull(),
  responseData: jsonb('response_data'),
  responseTime: integer('response_time'), // milliseconds
  paymentAmount: numeric('payment_amount', { precision: 20, scale: 6 }),
  paymentStatus: varchar('payment_status', { length: 50 }),
  x402PaymentId: varchar('x402_payment_id'),
  walletAddress: varchar('wallet_address'),
  createdAt: timestamp('created_at').defaultNow(),
  error: text('error')
});

// Performance metrics
export const microserviceMetrics = pgTable('microservice_metrics', {
  id: serial('id').primaryKey(),
  serviceId: varchar('service_id').notNull(),
  date: date('date').notNull(),
  totalRequests: integer('total_requests').default(0),
  successfulRequests: integer('successful_requests').default(0),
  failedRequests: integer('failed_requests').default(0),
  totalRevenue: numeric('total_revenue', { precision: 20, scale: 6 }).default('0'),
  avgResponseTime: integer('avg_response_time'), // milliseconds
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### x402 Integration
Each service will have:
1. **Payment endpoint:** Returns HTTP 402 with payment request
2. **Service endpoint:** Processes request after payment verification
3. **Agent card:** `.well-known/agent-card.json` for A2A discovery

#### Payment Flow
```
1. Client → POST /x402/service/{service-id}
2. Server → 402 Payment Required
   Headers:
     X-Payment-Address: 0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321
     X-Payment-Amount: 0.01 USDC
     X-Payment-Chain: base
3. Client → Payment to wallet
4. Client → POST /x402/service/{service-id} (with payment proof)
5. Server → 200 OK (service response)
```

### Caching Strategy
- Balance checker: 5 min TTL (balances change frequently)
- Gas oracle: 1 min TTL (gas prices very dynamic)
- Token price: 2 min TTL (acceptable staleness)
- Contract scan: 24 hour TTL (contract code rarely changes)
- Risk score: 1 hour TTL (risk profiles evolve slowly)

### Rate Limiting
- Per wallet: 100 requests/hour (prevent abuse)
- Per IP: 50 requests/hour (non-authenticated limit)
- Global: 10,000 requests/hour (infrastructure protection)

---

## Performance Targets

| Service | Response Time | Throughput | Cache Hit Rate |
|---------|---------------|------------|----------------|
| Balance Checker | <1s | 1000 req/min | 40% |
| Gas Oracle | <1s | 2000 req/min | 80% |
| Token Price | <1s | 1500 req/min | 70% |
| Contract Scan | <10s | 100 req/min | 90% |
| Wallet Risk | <2s | 500 req/min | 60% |

---

## Revenue Projections

### Conservative (0.1% x402 market share)
- 1,400 transactions/day
- Average $0.30 per transaction
- **Daily: $420**
- **Monthly: $12,600**
- **Annual: $151,200**

### Moderate (1% x402 market share)
- 14,000 transactions/day
- Average $0.30 per transaction
- **Daily: $4,200**
- **Monthly: $126,000**
- **Annual: $1,512,000**

### Optimistic (5% x402 market share)
- 70,000 transactions/day
- Average $0.30 per transaction
- **Daily: $21,000**
- **Monthly: $630,000**
- **Annual: $7,560,000**

---

## Success Metrics

**Week 1:**
- ✅ All 5 services deployed and operational
- ✅ <2% error rate
- ✅ Meeting response time targets
- 🎯 10+ unique wallet interactions

**Month 1:**
- 🎯 100+ daily transactions
- 🎯 $500+ daily revenue
- 🎯 50+ unique customers (wallets)
- 🎯 Listed on x402scan with active status

**Month 3:**
- 🎯 1,000+ daily transactions
- 🎯 $5,000+ daily revenue
- 🎯 500+ unique customers
- 🎯 Top 20 x402 service by volume

---

## Implementation Phases

### Phase 1: Core Service Development (Current)
- Build all 5 API endpoints
- Implement x402 payment verification
- Add caching layer
- Create database schema

### Phase 2: Testing & Optimization (Next)
- End-to-end testing with real x402 payments
- Performance optimization
- Error handling refinement
- Load testing

### Phase 3: Registration & Launch (After)
- Register on x402scan
- Create ERC-8004 agent identities
- Deploy to production
- Monitor initial traction

### Phase 4: Growth & Iteration (Ongoing)
- Add more services based on demand
- Optimize pricing
- Improve performance
- Scale infrastructure

---

## Technical Dependencies

**Required APIs:**
- ✅ Alchemy RPC (already configured)
- ✅ Etherscan/Basescan API (for contract verification)
- ⚠️ CoinGecko API (need free tier key - 10-50 calls/min)
- ⚠️ DEX Screener API (public, no key required)
- ⚠️ Honeypot detection API (public services available)

**Infrastructure:**
- ✅ PostgreSQL database
- ✅ CDP wallet for payments
- ✅ Express.js backend
- ⚠️ Redis/in-memory caching (implement)
- ⚠️ Rate limiting middleware (implement)

---

## Risk Mitigation

**API Rate Limits:**
- Implement aggressive caching
- Use multiple API providers as fallbacks
- Monitor usage closely

**Payment Verification:**
- Use Alchemy for on-chain verification
- Implement timeout handling
- Store payment proofs in database

**Service Abuse:**
- Wallet-based rate limiting
- IP-based throttling
- Payment verification before processing

**Performance:**
- Parallel async operations
- Database connection pooling
- Response size optimization

---

**Status:** Ready for implementation
**Last Updated:** October 30, 2025
**Version:** 1.0
