# @coinrailz/agent-payments

AI Agent Payment Processing SDK - Non-custodial USDC payments for AI agents with bundled intelligence services.

## Features

- **Non-custodial**: Your wallet, your keys. We never custody funds.
- **Yield-while-trading**: Earn USDC yield (Kamino ~3.4% APY / Aave) while your agent spends.
- **Low fees**: 1.5% + $0.01 per transaction ($0.05 minimum)
- **Multi-chain**: Base and Solana primary, with Ethereum, Polygon, Arbitrum support.
- **Intelligence bundle**: 66 x402 microservices covering NASA satellite data, prediction markets, and AI.
- **CDP wallets**: Automatic wallet creation via Coinbase Developer Platform.
- **Official ElizaOS Plugin**: Deep integration with the leading AI agent framework.

## Installation

```bash
npm install @coinrailz/agent-payments
# or
yarn add @coinrailz/agent-payments
# or
pnpm add @coinrailz/agent-payments
```

## Get Your API Key

**Instant API Key** - Pay $1 (USDC/USDT on Base or Solana) and get your API key immediately. No account required!

1. Visit https://coinrailz.com/api-keys
2. Send $1 to the platform wallet
3. Verify your transaction and receive your key + $5 starter credits

**Key Persistence**: Your API key is permanent and works across ALL services. One key = unlimited access (credits are deducted per use). You can top up credits anytime with the same key.

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

Access 66 bundled x402 microservices (requires bundle subscription or +0.35% per call).

```typescript
const client = new CoinRailz({
  apiKey: 'cr_live_...',
  enableIntelligence: true
});

// Get prediction market spreads (featured)
const spread = await client.intelligence('prediction-market-spread', {
  event: 'US Election'
});

// Get NASA satellite imagery
const satellite = await client.intelligence('weather-imagery', {
  lat: 40.7128,
  lon: -74.0060
});
```

Available intelligence categories:
- **Trading & Markets**: Signals, whale alerts, trending tokens, gas oracles.
- **Satellite (NASA/ESA)**: Earthdata, fire alerts, flood detection, air quality.
- **Prediction Markets**: Polymarket/Kalshi odds, spreads, and search.
- **AI & IoT**: Pay-per-call GPT inference, telematics, and sensor readings.
- **Risk & Compliance**: Wallet scoring, AML checks, and contract audits.
- And 50+ more...

## Error Handling

All API errors return machine-readable JSON with structured error codes for programmatic handling:

```typescript
const result = await client.send({ to: '0x...', amount: 100 });

if (!result.success) {
  console.error('Error code:', result.error.code);
  console.error('Message:', result.error.humanMessage);
  console.error('Hint:', result.error.agentHint);
  
  // Programmatic error handling
  switch (result.error.code) {
    case 'PAYMENT_INVALID_TX_HASH_LENGTH':
      // Transaction hash is wrong length
      break;
    case 'PAYMENT_VERIFICATION_FAILED':
      // On-chain verification returned false
      break;
    case 'INSUFFICIENT_CREDITS':
      // Top up credits at coinrailz.com/api-keys
      break;
  }
}
```

### Error Response Schema

```typescript
{
  success: false,
  error: {
    code: string,           // Stable error identifier for switch statements
    httpStatus: number,     // HTTP status code
    humanMessage: string,   // Human-readable explanation
    agentHint: string,      // Actionable fix suggestion for AI agents
    recoverable: boolean,   // Whether retrying may succeed
    telemetryId: string,    // Support ticket reference
    expectedFormat?: {      // Correct format examples (when applicable)
      txHash: string,
      examples: string[]
    }
  }
}
```

### Error Codes Reference

| Code | Description | Recoverable |
|------|-------------|-------------|
| `PAYMENT_HEADER_MISSING` | X-PAYMENT header is empty | Yes |
| `PAYMENT_INVALID_TX_HASH_LENGTH` | Transaction hash wrong length | Yes |
| `PAYMENT_INVALID_TX_HASH_FORMAT` | Invalid characters in hash | Yes |
| `PAYMENT_DECODE_FAILED` | Could not decode payment payload | Yes |
| `PAYMENT_VERIFICATION_FAILED` | On-chain verification returned false | No |
| `PAYMENT_VERIFICATION_EXCEPTION` | Verification threw an error | Maybe |
| `INSUFFICIENT_CREDITS` | Not enough credits for operation | Yes |
| `INVALID_API_KEY` | API key not found or expired | No |
| `RATE_LIMITED` | Too many requests | Yes |

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
