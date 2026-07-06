# Coin Railz x402 Micropayment Services - Developer Guide

## Overview

Coin Railz provides **66 production-ready x402 micropayment services** ($0.05-$10.00 USDC) on Base and Solana. We offer **three payment methods** for maximum developer flexibility:

1. **Prepaid Credits with API Keys** (RECOMMENDED) - Easiest integration, highest conversion
2. **Standard x402 Protocol** - Works with existing x402 tools (AgentKit, x402-fetch, ElizaOS)
3. **Direct On-Chain Payment** - Manual USDC transfers with transaction hash

**Platform Wallet**: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` (Base mainnet)

---

## 🚀 Quick Start

### Option 1: Prepaid Credits with API Keys (RECOMMENDED - 50-70% Conversion Rate)

**Why prepaid credits?**
- ✅ No blockchain knowledge required
- ✅ Pay with Stripe (credit card) or crypto
- ✅ Single API key for all services
- ✅ Automatic credit deduction
- ✅ Real-time balance tracking
- ✅ 50-70% conversion vs 2-5% for manual USDC payments

**Step 1: Buy Credits**
Visit https://coinrailz.com/credits and purchase credits via:
- Stripe (credit/debit card)
- USDC/USDT (any amount)

**Step 2: Generate API Key**
Visit https://coinrailz.com/api-keys and click "Generate New API Key"

**Step 3: Use the API Key**

**TypeScript/JavaScript (Server-Side):**
```typescript
import { X402Client } from '@coinrailz/x402-client';

const client = new X402Client({ 
  apiKey: process.env.COINRAILZ_API_KEY 
});

const response = await client.callService({
  serviceId: 'multi-chain-balance',
  payload: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' }
});
```

**Direct HTTP (cURL):**
```bash
curl -X POST "https://coinrailz.com/x402/multi-chain-balance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cr_live_YOUR_API_KEY_HERE" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

**Python:**
```python
import requests

headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer cr_live_YOUR_API_KEY_HERE"
}

response = requests.post(
    "https://coinrailz.com/x402/multi-chain-balance",
    json={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"},
    headers=headers
)
```

**🔐 SECURITY WARNING**: 
- NEVER expose API keys in client-side code (browsers, mobile apps)
- ALWAYS use API keys server-side only (Node.js, Python, backend services)
- Store API keys in environment variables, not in source code
- Revoke compromised keys immediately at https://coinrailz.com/api-keys

---

### Option 2: Standard x402 Tools

**Works out-of-the-box with:**
- [Coinbase AgentKit](https://github.com/coinbase/agentkit) - Python SDK for AI agents
- [x402-fetch](https://www.npmjs.com/package/x402-fetch) - JavaScript HTTP 402 client
- [ElizaOS](https://github.com/ai16z/eliza) - AI agent framework with x402 support

**Example with AgentKit:**
```python
from coinbase_agentkit.agents import CoinbaseAgent

agent = CoinbaseAgent()
response = agent.call_x402_service(
    url="https://coinrailz.com/x402/multi-chain-balance",
    payload={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
)
```

**Example with x402-fetch:**
```javascript
import { fetch402 } from 'x402-fetch';

const response = await fetch402('https://coinrailz.com/x402/token-price', {
  method: 'POST',
  body: JSON.stringify({
    tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    chain: 'ethereum'
  })
});
```

---

### Option 3: Direct On-Chain Payment (For Manual Testing / Advanced Use Cases)

**Step 1: Send USDC on Base mainnet**
- To: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`
- Token: USDC (6 decimals)
- Amount: Service price (see pricing table below)
- Network: Base

**Step 2: Include transaction hash in request**
```bash
curl -X POST "https://coinrailz.com/x402/multi-chain-balance" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: 0xYOUR_TX_HASH_HERE" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

**How it works:**
1. Our middleware detects the `X-PAYMENT` header with a raw transaction hash (0x + 64 hex chars)
2. Verifies the transaction on-chain via Alchemy Base RPC
3. Validates USDC transfer to platform wallet matches service price
4. Prevents replay attacks (each transaction can only be used once)
5. Returns service response if payment is valid

---

## 📋 Available Services

### Trader Services (10 services - $0.10 to $2.00)

| Service | Price | Endpoint | Use Case |
|---------|-------|----------|----------|
| Multi-Chain Balance | $0.50 | `/x402/multi-chain-balance` | Check wallet balances across chains |
| Gas Price Oracle | $0.10 | `/x402/gas-price-oracle` | Real-time gas prices |
| Token Price Feed | $0.15 | `/x402/token-price` | Real-time token pricing |
| Contract Scanner | $2.00 | `/x402/contract-scan` | Smart contract security analysis |
| Wallet Risk Scoring | $1.00 | `/x402/wallet-risk` | Analyze wallet risk patterns |
| Trading Signals | $0.75 | `/x402/trade-signals` | AI-powered trading signals |
| Token Sentiment | $0.25 | `/x402/token-sentiment` | Social media sentiment analysis |
| Trending Tokens | $0.50 | `/x402/trending-tokens` | Real-time trending tokens |
| Whale Alerts | $0.35 | `/x402/whale-alerts` | Track large wallet movements |
| DEX Liquidity | $0.20 | `/x402/dex-liquidity` | DEX liquidity pool monitoring |

### Infrastructure Services (5 services - $0.10 to $0.50)

| Service | Price | Endpoint | Use Case |
|---------|-------|----------|----------|
| Transaction Builder | $0.30 | `/x402/transaction-builder` | Pre-validated transaction encoding |
| Token Metadata | $0.10 | `/x402/token-metadata` | Unified token info across chains |
| Approval Manager | $0.20 | `/x402/approval-manager` | Token approval transaction generator |
| Batch Quote | $0.40 | `/x402/batch-quote` | Multi-DEX price quotes |
| Portfolio Tracker | $0.50 | `/x402/portfolio-tracker` | Multi-chain portfolio valuation |

### Premium Services (3 services - $1.00 to $5.00)

| Service | Price | Endpoint | Use Case |
|---------|-------|----------|----------|
| Instant Agent Wallet | $1.00 | `/x402/instant-agent-wallet` | Create MPC-secured USDC wallets via Circle |
| Verified Agent Identity | $5.00 | `/x402/verified-agent-identity` | KYA verification with ERC-8004 on-chain identity |
| Seamless Chain Bridge | $2.00 | `/x402/seamless-chain-bridge` | Cross-chain USDC routing via Circle CCTP |

---

## 🔍 Detailed Examples

### Example 1: Multi-Chain Balance (Standard x402 Flow)

**Request without payment:**
```bash
curl -X POST "https://coinrailz.com/x402/multi-chain-balance" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

**Response (HTTP 402 Payment Required):**
```json
{
  "x402Version": "1",
  "accepts": [
    {
      "scheme": "facilitator",
      "network": "base",
      "asset": "USDC",
      "amount": "500000",
      "minAmount": "500000",
      "address": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      "description": "Multi-chain wallet balance checker - supports Ethereum, Base, Polygon, Arbitrum, BNB Chain with real-time token prices"
    }
  ],
  "facilitator": "https://facilitator.cdp.coinbase.com",
  "message": "Payment required: $0.50 USDC"
}
```

**After payment (with AgentKit/x402-fetch), you receive:**
```json
{
  "success": true,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "balances": {
    "ethereum": {
      "ETH": "1.2345",
      "USDC": "1000.50",
      "totalUSD": 4234.56
    },
    "base": {
      "ETH": "0.5",
      "USDC": "500.00",
      "totalUSD": 1842.12
    }
  },
  "totalBalanceUSD": 6076.68
}
```

---

### Example 2: Verified Agent Identity (Direct On-Chain Payment)

**Step 1: Send $5.00 USDC to platform wallet**
- To: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`
- Amount: 5.00 USDC (5000000 in 6-decimal format)
- Network: Base mainnet
- Transaction: `0xabc123...def456`

**Step 2: Call service with transaction hash**
```bash
curl -X POST "https://coinrailz.com/x402/verified-agent-identity" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: 0xabc123...def456" \
  -d '{
    "agentId": "my-trading-bot-v1",
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "metadata": {
      "name": "Trading Bot Alpha",
      "version": "1.0",
      "capabilities": ["trading", "portfolio-management"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "verificationStatus": "verified",
  "trustScore": 85,
  "reputationScore": 42,
  "compliance": {
    "kycStatus": "verified",
    "sanctionsCheck": "clear",
    "riskLevel": "low"
  },
  "onChainIdentity": {
    "tokenId": "3",
    "contract": "0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa",
    "network": "base",
    "verified": true
  }
}
```

---

## 🔐 Payment Verification Details

### Standard x402 Flow (EIP-712)
- Uses Coinbase CDP facilitator for payment verification
- Supports all x402-compatible SDKs (AgentKit, x402-fetch, ElizaOS)
- Cryptographic signatures verify payment without on-chain lookup
- Instant verification (< 100ms)

### Direct On-Chain Flow
- Accepts raw transaction hashes in `X-PAYMENT` header
- Verifies via Alchemy Base RPC (queries actual blockchain)
- Checks: recipient, amount, token (USDC), and replay prevention
- Verification time: 200-500ms (blockchain RPC lookup)

**Both flows are production-ready and equally secure.**

---

## ⚠️ Error Handling

### Insufficient Payment
```json
{
  "error": "Payment verification failed",
  "required": "500000",
  "received": "100000",
  "message": "Insufficient payment: 0.10 USDC < 0.50 USDC required"
}
```

### Replay Attack (Transaction Already Used)
```json
{
  "error": "Transaction already used",
  "txHash": "0xabc123...",
  "message": "This transaction has already been used for payment"
}
```

### Invalid Transaction
```json
{
  "error": "Payment verification failed",
  "message": "Transaction not found or invalid recipient"
}
```

---

## 🛠️ Technical Specifications

- **Network**: Base mainnet (Chain ID: 8453)
- **Payment Token**: USDC (6 decimals, contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Platform Wallet**: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`
- **RPC Provider**: Alchemy
- **Rate Limiting**: 100 requests/hour per wallet
- **Payment Timeout**: 15 minutes
- **Facilitator**: Coinbase CDP (`https://facilitator.cdp.coinbase.com`)

---

## 📚 Additional Resources

- **x402scan Registry**: [x402scan.com](https://www.x402scan.com/) - Discover all registered services
- **AgentKit Documentation**: [GitHub](https://github.com/coinbase/agentkit)
- **x402-fetch NPM**: [npmjs.com/package/x402-fetch](https://www.npmjs.com/package/x402-fetch)
- **Circle CCTP Docs**: [Circle Developers](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- **ERC-8004 Standard**: [GitHub](https://github.com/ethereum/EIPs/issues/8004)

---

## 🤝 Support

- **Platform Status**: All services operational on Base mainnet
- **Discovery**: Auto-indexed by Coinbase Bazaar API
- **Integration Help**: Check service-specific input schemas in 402 responses
- **Pricing**: Fixed USDC pricing, no hidden fees

---

## 🎯 Why Coin Railz?

✅ **Dual payment support** - Works with standard x402 tools AND direct payments  
✅ **Production infrastructure** - Circle wallets, Alchemy RPC, on-chain verification  
✅ **Bazaar-compliant** - Auto-discoverable by Coinbase AI agents  
✅ **18 services** - From basic price feeds to premium identity verification  
✅ **Real implementations** - No mocks, all services call actual APIs (Circle, Coinbase, Alchemy)  

**Start building with Coin Railz micropayment infrastructure today.**
