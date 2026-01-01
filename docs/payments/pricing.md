# Coin Railz AI Agent Payment Processor - Pricing

## Overview

Coin Railz is a non-custodial payment processor for AI agents. We never hold your private keys or custody your funds. All transactions settle directly on-chain via USDC on Base Chain.

## Processing Fees

### Base Tier (Default)
| Volume | Processing Fee |
|--------|----------------|
| $0 - $10K/month | 1.5% + $0.01 per transaction |
| $10K - $100K/month | 1.25% + $0.01 per transaction |
| $100K+/month | 0.9% + $0.01 per transaction |

### Fee Comparison
| Provider | Fee | Notes |
|----------|-----|-------|
| **Coin Railz** | 1.5% | Includes wallet creation, reporting |
| Nevermined | 1% | Payment only |
| Stripe | 2.9% + $0.30 | Traditional processor |
| PayPal | 2.9% + $0.30 | Traditional processor |

## Intelligence Services

### Full Bundle (41 Services)
Access all 41 x402 intelligence services:

| Pricing Option | Cost |
|----------------|------|
| Per-transaction | +0.35% per transaction |
| Monthly flat rate | $79/month (unlimited calls) |

### Individual Services
Pay only for what you use:

| Category | Services | Price Range |
|----------|----------|-------------|
| **Market Data** | Token prices, whale alerts, gas oracle | $0.10 - $0.50/call |
| **Wallet Analysis** | Balance checks, tx history, risk scoring | $0.25 - $1.00/call |
| **Compliance** | Sanction screening, AML checks | $0.50 - $2.00/call |
| **DeFi Intelligence** | DEX quotes, liquidity analysis, yield rates | $0.25 - $1.00/call |
| **Security** | Contract audits, malware detection | $1.00 - $10.00/call |

### Service Categories

#### Market Intelligence
- `whale-alerts` - Real-time whale movement tracking
- `gas-oracle` - Multi-chain gas price estimates
- `token-price` - Real-time token pricing via CoinGecko
- `market-sentiment` - Social sentiment analysis

#### Wallet & Transaction
- `balance-check` - Multi-chain wallet balance lookup
- `transaction-history` - Wallet transaction history
- `wallet-risk-score` - Risk assessment for wallets

#### Compliance & Security
- `sanctions-screening` - OFAC sanctions list check
- `aml-check` - Anti-money laundering analysis
- `contract-audit` - Smart contract security scan
- `malware-detection` - On-chain malware patterns

#### DeFi Analytics
- `dex-quote` - Best DEX prices across aggregators
- `liquidity-analysis` - Pool liquidity depth
- `yield-rates` - Current DeFi yield opportunities

## Add-On Services

| Service | Price | Description |
|---------|-------|-------------|
| ERC-8004 Identity | +0.25%/tx | On-chain agent identity verification |
| Premium Compliance | +0.25%/tx | Enhanced AML/sanctions screening |
| Activity Reports | Included | Weekly JSON/webhook reports |
| Webhook Notifications | Included | Real-time transaction alerts |

## Free Features

All tiers include:
- CDP wallet creation helper
- Basic activity reports
- Webhook notifications
- API key management
- Multi-chain support (Base, Polygon, Ethereum, Arbitrum)

## Volume Discounts

For high-volume processors ($100K+/month):
- Custom pricing available
- Dedicated support
- SLA guarantees
- White-label options

Contact: enterprise@coinrailz.com

## Getting Started

### 1. Install the Package

```bash
# NPM
npm install @coinrailz/agent-payments

# Python
pip install coinrailz

# Docker
docker pull coinrailz/agent-facilitator
```

### 2. Initialize

```javascript
import { CoinRailzPayments } from '@coinrailz/agent-payments';

const payments = new CoinRailzPayments({
  apiKey: 'your-api-key'
});
```

### 3. Send Payment

```javascript
const result = await payments.send({
  to: '0x...',
  amount: 10.00,
  currency: 'USDC'
});
```

## Legal

Coin Railz is a non-custodial service. We do not:
- Hold private keys
- Custody funds
- Control user wallets

All transactions are executed on-chain via user-controlled or CDP-created wallets. Users are responsible for their own compliance with local laws and regulations.
