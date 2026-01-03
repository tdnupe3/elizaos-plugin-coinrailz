# @coinrailz/agent-payments

AI Agent Payment Processing SDK - Non-custodial USDC payments for AI agents with bundled intelligence services.

## Features

- **Non-custodial**: Your wallet, your keys. We never custody funds.
- **Low fees**: 1.5% + $0.01 per transaction ($0.05 minimum)
- **Multi-chain**: Base Chain primary, with Ethereum, Polygon, Arbitrum support
- **Intelligence bundle**: 41 x402 microservices for market data, analytics, and more
- **CDP wallets**: Automatic wallet creation via Coinbase Developer Platform
- **Framework agnostic**: Works with ElizaOS, AgentKit, MCP, or any TypeScript/JavaScript project

## Installation

```bash
npm install @coinrailz/agent-payments
# or
yarn add @coinrailz/agent-payments
# or
pnpm add @coinrailz/agent-payments
```

## Quick Start

```typescript
import { CoinRailz } from '@coinrailz/agent-payments';

// Initialize the client
const client = new CoinRailz({
  apiKey: 'cr_live_...' // Get your API key at https://coinrailz.com/api-keys
});

// Send a payment
const result = await client.send({
  to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  amount: 100,
  memo: 'Service payment'
});

if (result.success) {
  console.log('Payment sent:', result.transactionId);
  console.log('Fee:', result.fee);
  console.log('Net amount:', result.netAmount);
}
```

## API Reference

### Initialization

```typescript
const client = new CoinRailz({
  apiKey: 'cr_live_...', // Required
  baseUrl: 'https://coinrailz.com', // Optional, for self-hosted
  timeout: 30000, // Optional, request timeout in ms
  enableIntelligence: false // Optional, enable x402 intelligence services
});
```

### Send Payment

Send USDC to an address. Fee: 1.5% + $0.01

```typescript
const result = await client.send({
  to: '0x...', // Recipient address
  amount: 100, // Amount in USDC
  currency: 'USDC', // Optional, default USDC
  memo: 'Payment for services', // Optional
  metadata: { orderId: '123' } // Optional, custom data
});

// Response
{
  success: true,
  transactionId: 'sdk_tx_...',
  status: 'pending',
  amount: 100,
  fee: 1.51,
  netAmount: 98.49,
  feeBreakdown: {
    percentageFee: 1.50,
    fixedFee: 0.01,
    totalFee: 1.51,
    rate: '1.5% + $0.01'
  },
  timestamp: '2024-01-15T10:30:00Z',
  network: 'base'
}
```

### Create Invoice

Create a payment invoice for receiving funds.

```typescript
const invoice = await client.createInvoice({
  amount: 50,
  description: 'AI assistant service fee',
  expiresIn: 15 // Minutes, default 15
});

// Response
{
  success: true,
  invoiceId: 'sdk_inv_...',
  paymentAddress: '0x...',
  amount: 50,
  status: 'pending',
  expiresAt: '2024-01-15T10:45:00Z',
  paymentInstructions: { ... }
}
```

### Get Reports

Get activity reports for your account.

```typescript
const report = await client.getReports({
  period: 'weekly', // 'daily' | 'weekly' | 'monthly'
  format: 'json' // 'json' | 'markdown'
});

// Response
{
  success: true,
  summary: {
    totalTransactions: 42,
    totalVolumeUSD: 5280.50,
    feesCollected: 79.21,
    successRate: 98.5
  },
  transactions: [ ... ]
}
```

### Get Balance

Get your wallet balance.

```typescript
const balance = await client.getBalance();

// Response
{
  success: true,
  address: '0x...',
  balances: {
    USDC: 1250.00,
    ETH: 0.05
  }
}
```

### Create Wallet

Create a new CDP wallet.

```typescript
const wallet = await client.createWallet();

// Response
{
  success: true,
  walletId: 'sdk_wallet_...',
  address: '0x...',
  network: 'base',
  status: 'active'
}
```

### Intelligence Services

Access 41 bundled x402 microservices (requires bundle subscription or +0.35% per call).

```typescript
const client = new CoinRailz({
  apiKey: 'cr_live_...',
  enableIntelligence: true
});

// Get wallet risk score
const risk = await client.intelligence('wallet-risk', {
  address: '0x...'
});

// Get trade signals
const signals = await client.intelligence('trade-signals', {
  token: 'ETH'
});

// Get token sentiment
const sentiment = await client.intelligence('token-sentiment', {
  token: 'BTC'
});
```

Available intelligence services:
- `wallet-risk` - Wallet risk analysis
- `trade-signals` - AI-generated trade signals
- `token-sentiment` - Social sentiment analysis
- `whale-alerts` - Large transaction monitoring
- `trending-tokens` - Trending token discovery
- `gas-price-oracle` - Real-time gas prices
- `contract-scan` - Smart contract security scan
- And 34 more...

## Pricing

| Tier | Volume | Processing Fee |
|------|--------|----------------|
| Starter | $0-$10K/mo | 1.5% + $0.01 |
| Growth | $10K-$100K/mo | 1.25% + $0.01 |
| Platform | $100K+/mo | 0.9% + $0.01 |

**Intelligence Bundle**: +0.35% per transaction OR $79/month flat

## Error Handling

```typescript
const result = await client.send({ to: '0x...', amount: 100 });

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Message:', result.message);
  
  // Handle specific errors
  switch (result.error) {
    case 'INVALID_API_KEY':
      // Regenerate API key
      break;
    case 'RATE_LIMITED':
      // Wait and retry
      break;
    case 'INSUFFICIENT_BALANCE':
      // Add funds
      break;
  }
}
```

## Framework Integration

### ElizaOS Plugin

```typescript
import { CoinRailz } from '@coinrailz/agent-payments';

export const coinRailzPlugin = {
  name: 'coinrailz-payments',
  actions: {
    sendPayment: async (context, params) => {
      const client = new CoinRailz({ apiKey: context.env.COINRAILZ_API_KEY });
      return client.send(params);
    }
  }
};
```

### AgentKit Integration

```typescript
import { CoinRailz } from '@coinrailz/agent-payments';

const payments = new CoinRailz({ apiKey: process.env.COINRAILZ_API_KEY });

agent.registerTool('send_payment', async (params) => {
  return payments.send(params);
});
```

## Transaction Limits

- **Minimum transaction**: $0.05 USDC
- **Maximum transaction**: $100,000 USDC (contact sales for higher limits)

## Refunds & Disputes

Due to the non-custodial nature of blockchain transactions:

- **Refunds are not supported** - All blockchain transactions are final and irreversible
- **Disputes**: For transaction issues, contact support@coinrailz.com with your transaction ID
- **Prevention**: Always verify recipient addresses before sending

## Legal

This SDK provides non-custodial payment routing. Coin Railz does not hold, custody, or control user funds at any time. Users maintain full control of their wallets and private keys.

See [Terms of Service](https://coinrailz.com/docs/payments/terms-of-service) for full legal terms.

## Support

- Documentation: https://coinrailz.com/docs/sdk
- Discord: https://discord.gg/coinrailz
- Email: support@coinrailz.com

## License

MIT License - see [LICENSE](LICENSE) for details.
