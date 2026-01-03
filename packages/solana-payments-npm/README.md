# @coinrailz/agent-payments-solana

Solana AI Agent Payment Processing SDK - Non-custodial USDC payments for AI agents.

[![npm version](https://img.shields.io/npm/v/@coinrailz/agent-payments-solana.svg)](https://www.npmjs.com/package/@coinrailz/agent-payments-solana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Non-Custodial** - Your keys, your crypto. We never hold funds.
- **Low Fees** - 1.5% + $0.01 per transaction
- **USDC Payments** - SPL Token USDC transfers on Solana mainnet
- **AI Agent Ready** - Built for ElizaOS, AgentKit, MCP, and autonomous agents
- **Server-Side** - API-key authenticated, your backend signs transactions
- **TypeScript** - Full type definitions included

> **Note**: This SDK is for server-side, API-authenticated payments. For user-signed
> payments via Dialect Blinks, see the [Blinks Quickstart](./docs/BLINKS_QUICKSTART.md).

## Installation

```bash
npm install @coinrailz/agent-payments-solana
# or
yarn add @coinrailz/agent-payments-solana
# or
pnpm add @coinrailz/agent-payments-solana
```

## Quick Start

### 1. Get Your API Key

Sign up at [coinrailz.com/api-keys](https://coinrailz.com/api-keys) to get your API key.

### 2. Initialize the Client

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

const client = new CoinRailzSolana({
  apiKey: process.env.COINRAILZ_API_KEY  // Required
});
```

### 3. Send a Payment

```typescript
const result = await client.send({
  to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  amount: 10.00,
  currency: 'USDC',
  memo: 'Payment for AI service'
});

// All methods return a union type - always check success first
if (result.success) {
  // Success - access payment properties
  console.log('Transaction ID:', result.transactionId);
  console.log('Signature:', result.signature);
  console.log('Fee:', result.amount.fee);
  console.log('Net amount:', result.amount.net);
  console.log('Explorer:', result.explorerUrl);
} else {
  // Error - access error properties
  console.error('Error code:', result.error);
  console.error('Message:', result.message);
}
```

## Complete API Reference

### Constructor Options

```typescript
const client = new CoinRailzSolana({
  apiKey: string,      // Required: Your API key from dashboard
  baseUrl?: string,    // Optional: API URL (default: https://coinrailz.com)
  timeout?: number     // Optional: Request timeout in ms (default: 30000)
});
```

### API Endpoint Structure

All SDK requests go to:
```
{baseUrl}/api/sdk/solana/{method}
```

Required headers (handled automatically by SDK):
- `Authorization: Bearer {apiKey}`
- `Content-Type: application/json`
- `X-SDK-Version: {version}`

### Methods

#### `send(params)` - Send Payment

Send USDC to a Solana address. This is a server-side payment where your backend
signs the transaction using Coin Railz's secure infrastructure.

```typescript
const result = await client.send({
  to: 'RecipientSolanaAddress',    // Required: Recipient wallet (Base58)
  amount: 10.00,                    // Required: Amount in USDC (min: $0.05)
  currency: 'USDC',                 // Optional: Currently 'USDC' supported
  memo: 'Payment note',             // Optional: Transaction memo
  metadata: { orderId: '123' }      // Optional: Custom metadata (stored, not on-chain)
});
```

**Response (Success):**
```typescript
{
  success: true,
  transactionId: 'sol_abc123xyz',
  status: 'confirmed',
  signature: '5abc...xyz',
  amount: {
    gross: 10.00,  // Original amount
    fee: 0.16,     // Processing fee (1.5% + $0.01)
    net: 9.84      // Amount received by recipient
  },
  currency: 'USDC',
  recipient: '9WzD...WWM',
  network: 'mainnet-beta',
  explorerUrl: 'https://solscan.io/tx/5abc...xyz',
  timestamp: '2026-01-01T12:00:00Z'
}
```

**Response (Error):**
```typescript
{
  success: false,
  error: 'INSUFFICIENT_BALANCE',
  message: 'Not enough USDC to complete transaction'
}
```

#### `getBalance(address)` - Check Balance

Get SOL balance for any Solana address.

```typescript
const balance = await client.getBalance('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');

if (balance.success) {
  console.log('SOL:', balance.balance.sol);
  console.log('Lamports:', balance.balance.lamports);
}
```

**Response:**
```typescript
{
  success: true,
  address: '9WzD...WWM',
  balance: {
    sol: 1.5,
    lamports: 1500000000
  },
  network: 'mainnet-beta',
  timestamp: '2026-01-01T12:00:00Z'
}
```

#### `createWallet()` - Create Wallet

Create a new Solana wallet for your AI agent.

```typescript
const wallet = await client.createWallet();

if (wallet.success) {
  console.log('Address:', wallet.wallet.address);
  console.log('Public Key:', wallet.wallet.publicKey);
  
  // IMPORTANT: Store privateKey securely!
  // Never expose or commit to version control
  storeSecurely(wallet.privateKey);
}
```

**Response:**
```typescript
{
  success: true,
  wallet: {
    address: 'NewWalletAddress...',
    publicKey: 'PublicKeyBase58...',
    network: 'mainnet-beta',
    createdAt: '2026-01-01T12:00:00Z'
  },
  privateKey: 'PrivateKeyBase58...', // Store securely!
  message: 'Wallet created successfully'
}
```

#### `getTransaction(signature)` - Transaction Status

Check the status of a transaction.

```typescript
const tx = await client.getTransaction('5abc123...');

if (tx.success) {
  console.log('Status:', tx.status); // 'pending' | 'confirmed' | 'failed'
  console.log('Explorer:', tx.explorerUrl);
}
```

**Response:**
```typescript
{
  success: true,
  signature: '5abc123...',
  status: 'confirmed',
  network: 'mainnet-beta',
  explorerUrl: 'https://solscan.io/tx/5abc123...',
  timestamp: '2026-01-01T12:00:00Z'
}
```

#### `status()` - Service Status

Check if the Coin Railz Solana service is operational.

```typescript
const status = await client.status();

if (status.success && status.status === 'operational') {
  console.log('Service is running');
  console.log('Features:', status.features);
}
```

**Response:**
```typescript
{
  success: true,
  service: 'coinrailz-solana',
  version: '1.0.3',
  status: 'operational',
  features: {
    payments: true,
    walletCreation: true,
    solTransfers: false,  // Coming soon
    usdcTransfers: true
  },
  pricing: {
    processingFee: '1.5% + $0.01'
  },
  network: 'mainnet-beta',
  currencies: ['USDC'],
  timestamp: '2026-01-01T12:00:00Z'
}
```

## Error Handling

All methods return a discriminated union with `success: boolean`.

```typescript
const result = await client.send({ to: '...', amount: 1 });

if (result.success) {
  // TypeScript knows this is SendPaymentResult
  console.log(result.transactionId);
} else {
  // TypeScript knows this is ApiError
  console.error(`Error [${result.error}]: ${result.message}`);
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is missing or invalid |
| `INSUFFICIENT_BALANCE` | Not enough funds to complete transaction |
| `INVALID_ADDRESS` | Recipient address is not valid Solana address |
| `AMOUNT_TOO_LOW` | Amount below minimum ($0.05) |
| `RATE_LIMITED` | Too many requests, slow down |
| `NETWORK_ERROR` | Failed to connect to API |
| `TIMEOUT` | Request timed out |

## Environment Variables

```bash
# Required
COINRAILZ_API_KEY=your-api-key-here

# Optional (for custom deployments)
COINRAILZ_BASE_URL=https://coinrailz.com
```

## Examples

See the [examples](./examples) directory for complete working examples:

- **[basic-payment.ts](./examples/basic-payment.ts)** - Simple payment flow
- **[wallet-management.ts](./examples/wallet-management.ts)** - Create wallets and check balances
- **[ai-agent-integration.ts](./examples/ai-agent-integration.ts)** - Complete AI agent handler
- **[elizaos-plugin.ts](./examples/elizaos-plugin.ts)** - ElizaOS action plugin
- **[mcp-tool.ts](./examples/mcp-tool.ts)** - MCP tools for Claude/GPT
- **[dialect-blinks.ts](./examples/dialect-blinks.ts)** - Solana Actions/Blinks integration

### Run Examples

```bash
# Clone and install
git clone https://github.com/coinrailz/agent-payments-solana
cd agent-payments-solana
npm install

# Set your API key
export COINRAILZ_API_KEY=your-key-here

# Run an example
npx ts-node examples/basic-payment.ts
```

## Integration Guides

### ElizaOS (ai16z)

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

// Create payment action for ElizaOS
const paymentAction = {
  name: 'SEND_PAYMENT',
  handler: async (runtime, message, state) => {
    const client = new CoinRailzSolana({ 
      apiKey: runtime.getSetting('COINRAILZ_API_KEY') 
    });
    
    return client.send({
      to: state.recipientWallet,
      amount: parseFloat(message.content),
      currency: 'USDC'
    });
  }
};
```

### Coinbase AgentKit

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';
import { AgentKit } from '@coinbase/agentkit';

const agent = new AgentKit();
const payments = new CoinRailzSolana({ apiKey: process.env.COINRAILZ_API_KEY });

// Register as a tool
agent.registerTool('solana_payment', async (params) => {
  return payments.send(params);
});
```

### MCP (Model Context Protocol)

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

const client = new CoinRailzSolana({ apiKey: process.env.COINRAILZ_API_KEY });

// MCP tool definition
const sendPaymentTool = {
  name: 'send_solana_payment',
  description: 'Send USDC on Solana',
  inputSchema: {
    type: 'object',
    properties: {
      recipient: { type: 'string' },
      amount: { type: 'number' }
    },
    required: ['recipient', 'amount']
  },
  handler: (params) => client.send({ to: params.recipient, amount: params.amount })
};
```

### Dialect Blinks

Create shareable payment links:

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

// Your action endpoint (implement on your server)
// GET /solana-pay/actions/pay - Returns action metadata
// POST /solana-pay/actions/pay - Processes payment

// Generate dial.to shareable link
const blinkUrl = `https://dial.to/?action=${encodeURIComponent(
  'https://yoursite.com/solana-pay/actions/pay?amount=5&recipient=ADDRESS'
)}`;
```

## Pricing

| Tier | Monthly Volume | Processing Fee |
|------|----------------|----------------|
| Starter | $0 - $10K | 1.5% + $0.01 |
| Growth | $10K - $100K | 1.25% + $0.01 |
| Platform | $100K+ | 0.9% + $0.01 |

**Minimum transaction**: $0.05

## Network

- **Network**: Solana Mainnet-Beta
- **USDC**: Native SPL Token (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
- **Confirmation**: ~400ms average

## Security

- Non-custodial: We never hold your private keys
- API keys are scoped per-project
- All API calls over HTTPS
- Rate limiting to prevent abuse

## Refunds & Disputes

Due to the non-custodial, irreversible nature of blockchain transactions:

- **Refunds are not supported** - All transactions are final
- **Disputes**: Contact support@coinrailz.com with transaction ID

## Support

- **Documentation**: [coinrailz.com/docs/sdk/solana](https://coinrailz.com/docs/sdk/solana)
- **Examples**: [GitHub examples](https://github.com/coinrailz/agent-payments-solana/tree/main/examples)
- **Discord**: [discord.gg/coinrailz](https://discord.gg/coinrailz)
- **Email**: support@coinrailz.com

## Related Packages

- [@coinrailz/agent-payments](https://www.npmjs.com/package/@coinrailz/agent-payments) - EVM chains (Ethereum, Base, Polygon, etc.)
- [coinrailz](https://pypi.org/project/coinrailz/) - Python SDK for EVM
- [coinrailz-solana](https://pypi.org/project/coinrailz-solana/) - Python SDK for Solana

## License

MIT
