# Coin Railz Agent Payments - API Surface Definition

## Overview

This document defines the unified API surface for all three packages:
- `@coinrailz/agent-payments` (NPM)
- `coinrailz` (Python)
- `coinrailz/agent-facilitator` (Docker)

All packages provide identical functionality with language-appropriate syntax.

## Core Classes

### CoinRailzPayments

The main client class for all payment operations.

#### Constructor

```typescript
// NPM
const payments = new CoinRailzPayments({
  apiKey: string,              // Required: Your API key
  baseUrl?: string,            // Optional: API base URL (default: https://coinrailz.com)
  createWallet?: boolean,      // Optional: Auto-create CDP wallet (default: false)
  network?: 'base' | 'polygon' | 'ethereum' | 'arbitrum',  // Optional (default: 'base')
  intelligenceBundle?: 'none' | 'full',  // Optional (default: 'none')
});
```

```python
# Python
payments = CoinRailzPayments(
    api_key: str,              # Required: Your API key
    base_url: str = None,      # Optional: API base URL
    create_wallet: bool = False,
    network: str = 'base',
    intelligence_bundle: str = 'none'
)
```

#### Methods

##### send(options) → Promise<PaymentResult>

Send USDC payment to another address.

```typescript
// NPM
const result = await payments.send({
  to: '0x...',           // Recipient address
  amount: 10.00,         // Amount in USD
  currency: 'USDC',      // Currency (USDC only initially)
  memo?: string,         // Optional memo
  metadata?: object      // Optional metadata
});

// Returns
{
  success: boolean,
  transactionHash: string,
  amount: number,
  fee: number,
  netAmount: number,
  timestamp: string
}
```

```python
# Python
result = await payments.send(
    to="0x...",
    amount=10.00,
    currency="USDC",
    memo=None,
    metadata=None
)
```

##### createInvoice(options) → Promise<Invoice>

Create a payment invoice/request.

```typescript
const invoice = await payments.createInvoice({
  amount: 25.00,
  currency: 'USDC',
  description: 'Service fee',
  expiresIn?: number,    // Minutes until expiration (default: 15)
  metadata?: object
});

// Returns
{
  invoiceId: string,
  paymentAddress: string,
  amount: number,
  currency: string,
  expiresAt: string,
  status: 'pending' | 'paid' | 'expired'
}
```

##### getBalance() → Promise<Balance>

Get wallet balance.

```typescript
const balance = await payments.getBalance();

// Returns
{
  address: string,
  balances: {
    USDC: number,
    ETH: number
  },
  network: string
}
```

##### getReports(options) → Promise<Report>

Get activity reports.

```typescript
const report = await payments.getReports({
  period?: 'daily' | 'weekly' | 'monthly',
  format?: 'json' | 'markdown'
});

// Returns
{
  agentId: string,
  period: { start: string, end: string },
  summary: {
    totalTransactions: number,
    totalVolumeUSD: number,
    feesCollected: number,
    successRate: number
  },
  transactions: Transaction[],
  intelligenceEvents: IntelEvent[]
}
```

### Intelligence Services

Access x402 intelligence services.

```typescript
// NPM - via payments.intelligence
const whaleData = await payments.intelligence.call('whale-alerts', {
  minAmount: 1000000,
  chains: ['base', 'ethereum']
});

// Or individual methods
const price = await payments.intelligence.getTokenPrice('ETH');
const gas = await payments.intelligence.getGasPrice('base');
const risk = await payments.intelligence.getWalletRisk('0x...');
```

```python
# Python
whale_data = await payments.intelligence.call('whale-alerts', {
    'min_amount': 1000000,
    'chains': ['base', 'ethereum']
})

price = await payments.intelligence.get_token_price('ETH')
```

### Wallet Helpers

CDP wallet creation helpers.

```typescript
// Create new CDP wallet
const wallet = await payments.createWallet();

// Returns
{
  address: string,
  network: string,
  created: string
}

// Import existing wallet (address only, non-custodial)
await payments.setWallet('0x...');
```

## HTTP API Endpoints

For Docker and direct API access:

### Payments

```
POST /api/agent-payments/send
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "to": "0x...",
  "amount": 10.00,
  "currency": "USDC",
  "memo": "Payment for service"
}
```

```
POST /api/agent-payments/invoice
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "amount": 25.00,
  "currency": "USDC",
  "description": "Service fee",
  "expiresIn": 15
}
```

### Intelligence

```
POST /x402/{serviceId}
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  // Service-specific payload
}
```

### Reports

```
GET /api/agent-payments/reports?period=weekly&format=json
Authorization: Bearer {apiKey}
```

### Webhooks

Configure webhook URL to receive real-time notifications:

```
POST {your-webhook-url}
Content-Type: application/json

{
  "event": "payment.completed",
  "data": {
    "transactionHash": "0x...",
    "amount": 10.00,
    "from": "0x...",
    "to": "0x...",
    "timestamp": "2025-12-31T12:00:00Z"
  }
}
```

## Error Handling

All packages return consistent error types:

```typescript
try {
  await payments.send({ ... });
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    // Handle low balance
  } else if (error.code === 'INVALID_ADDRESS') {
    // Handle invalid recipient
  } else if (error.code === 'RATE_LIMITED') {
    // Handle rate limiting
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INSUFFICIENT_BALANCE` | Wallet doesn't have enough funds |
| `INVALID_ADDRESS` | Recipient address is invalid |
| `INVALID_AMOUNT` | Amount is zero or negative |
| `RATE_LIMITED` | Too many requests |
| `UNAUTHORIZED` | Invalid or missing API key |
| `SERVICE_UNAVAILABLE` | Backend service unavailable |
| `TRANSACTION_FAILED` | On-chain transaction failed |

## Rate Limits

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Starter | 300 | 50 |
| Growth | 1000 | 100 |
| Platform | 5000 | 500 |

## Type Definitions

See `types.ts` (NPM) or `types.py` (Python) for complete type definitions.
