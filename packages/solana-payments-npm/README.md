# @coinrailz/agent-payments-solana

Solana AI Agent Payment Processing SDK - Non-custodial SOL/USDC payments for AI agents.

## Installation

```bash
npm install @coinrailz/agent-payments-solana
# or
yarn add @coinrailz/agent-payments-solana
# or
pnpm add @coinrailz/agent-payments-solana
```

## Quick Start

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

const client = new CoinRailzSolana({
  apiKey: 'your-api-key' // Get at coinrailz.com/dashboard/api-keys
});

// Send USDC on Solana
const result = await client.send({
  to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  amount: 10.00,
  currency: 'USDC'
});

console.log(result);
// {
//   success: true,
//   transactionId: 'sol_abc123',
//   signature: '5abc...',
//   amount: { gross: 10.00, fee: 0.16, net: 9.84 },
//   explorerUrl: 'https://solscan.io/tx/5abc...'
// }
```

## Features

- **SOL Transfers** - Native SOL payments
- **USDC Transfers** - SPL Token USDC on Solana
- **Wallet Creation** - Generate new Solana wallets
- **Balance Queries** - Check SOL balances
- **Transaction Status** - Track payment confirmations

## API Reference

### Constructor

```typescript
const client = new CoinRailzSolana({
  apiKey: string,       // Required: Your API key
  baseUrl?: string,     // Optional: API base URL (default: https://coinrailz.com)
  timeout?: number      // Optional: Request timeout in ms (default: 30000)
});
```

### Methods

#### send(params)
Send SOL or USDC payment.

```typescript
const result = await client.send({
  to: 'SolanaAddress...',
  amount: 10.00,
  currency: 'USDC',  // 'SOL' or 'USDC'
  memo: 'Payment for service'
});
```

#### getBalance(address)
Get SOL balance for an address.

```typescript
const balance = await client.getBalance('SolanaAddress...');
// { success: true, balance: { sol: 1.5, lamports: 1500000000 } }
```

#### createWallet()
Create a new Solana wallet.

```typescript
const wallet = await client.createWallet();
// { success: true, wallet: { address: '...', publicKey: '...' }, privateKey: '...' }
```

#### getTransaction(signature)
Get transaction status.

```typescript
const tx = await client.getTransaction('5abc...');
// { success: true, signature: '5abc...', status: 'confirmed', explorerUrl: '...' }
```

#### status()
Check service status.

```typescript
const status = await client.status();
// { success: true, status: 'operational', network: 'mainnet-beta' }
```

## Pricing

| Tier | Volume | Processing Fee |
|------|--------|----------------|
| Starter | $0-$10K/mo | 1.5% + $0.01 |
| Growth | $10K-$100K/mo | 1.25% + $0.01 |
| Platform | $100K+/mo | 0.9% + $0.01 |

**Minimum transaction**: $0.05

## Use Cases

- **AI Agent Payments** - Autonomous agent-to-agent payments on Solana
- **ElizaOS Integration** - Payment processing for ElizaOS agents
- **AgentKit** - Coinbase AgentKit payment plugin
- **MCP Tools** - Model Context Protocol payment tools

## Refunds & Disputes

Due to the non-custodial nature of blockchain transactions:
- **Refunds are not supported** - All transactions are final
- **Disputes**: Contact support@coinrailz.com with transaction ID

## Support

- Documentation: https://coinrailz.com/docs/sdk/solana
- Discord: https://discord.gg/coinrailz
- Email: support@coinrailz.com

## License

MIT
