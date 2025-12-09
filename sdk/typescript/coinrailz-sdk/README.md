# Coin Railz SDK

Official JavaScript/TypeScript SDK for [Coin Railz](https://coinrailz.com) - x402 micropayment-enabled crypto microservices for AI agents.

## Features

- 🚀 **37+ Microservices** - Trading intelligence, prediction markets, gas oracles, and more
- 💳 **Simple API Key Auth** - No blockchain wallet required
- 📦 **TypeScript First** - Full type definitions included
- ⚡ **Zero Dependencies** - Uses native fetch (Node 18+)
- 🤖 **Built for AI Agents** - Designed for autonomous bot integration

## Installation

```bash
npm install coinrailz
```

## Quick Start

```typescript
import { CoinRailzClient } from 'coinrailz';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY!,
});

// Get gas prices across chains
const gas = await client.gasPriceOracle({ chain: 'base' });
console.log('Gas prices:', gas.data);

// Get token metadata
const token = await client.tokenMetadata({
  chain: 'base',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
});
console.log('Token:', token.data);

// Get AI trade signals
const signals = await client.tradeSignals({ token: 'ETH' });
console.log('Signal:', signals.data?.signal, 'Confidence:', signals.data?.confidence);
```

## Getting an API Key

1. Visit [coinrailz.com/credits](https://coinrailz.com/credits)
2. Purchase credits with Stripe (credit card) or USDC
3. Get your API key from the dashboard

## Available Services

### Trading Intelligence
- `gasPriceOracle()` - Real-time gas prices across 7 chains
- `tokenMetadata()` - Token info (symbol, name, decimals)
- `tokenPrice()` - Current USD price
- `tradeSignals()` - AI-powered buy/sell/hold signals
- `whaleAlerts()` - Large transaction monitoring
- `sentimentAnalysis()` - Social media sentiment
- `dexLiquidity()` - DEX liquidity analysis
- `arbitrageScanner()` - Cross-chain arbitrage opportunities
- `contractScan()` - Smart contract security audit
- `portfolioOptimization()` - AI portfolio rebalancing
- `trendingTokens()` - Trending tokens by volume
- `correlationMatrix()` - Token price correlations

### Prediction Markets
- `predictionMarketOdds()` - Market odds and probabilities
- `polymarketEvents()` - Polymarket event listings
- `predictionAnalysis()` - Deep market analysis

### Agent Infrastructure
- `createAgentWallet()` - Instant USDC wallet on Base
- `transactionBuilder()` - Build transactions
- `batchQuote()` - Multi-swap quotes
- `chainBridge()` - Cross-chain bridge routing

### Risk & Compliance
- `walletRisk()` - Wallet risk scoring
- `riskMetrics()` - Token risk analysis

### Generic Call
```typescript
// Call any service by name
const result = await client.call('custom-service', { param: 'value' });
```

### Get Service Catalog
```typescript
const catalog = await client.getCatalog();
console.log(`${catalog.data?.totalServices} services available`);
```

## Response Format

All methods return a `ServiceResponse<T>`:

```typescript
interface ServiceResponse<T> {
  success: boolean;     // true if request succeeded
  data?: T;             // typed response data
  status: number;       // HTTP status code
  error?: string;       // error message if failed
  raw?: unknown;        // raw JSON response
}
```

## Configuration

```typescript
const client = new CoinRailzClient({
  apiKey: 'your-api-key',           // Required
  baseUrl: 'https://coinrailz.com', // Optional, defaults to production
  timeoutMs: 30000,                 // Optional, request timeout
});
```

## Error Handling

```typescript
const result = await client.tradeSignals({ token: 'ETH' });

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Status:', result.status);
  return;
}

console.log('Signal:', result.data?.signal);
```

## Supported Chains

- Ethereum
- Base
- Polygon
- Arbitrum
- Optimism
- BSC (BNB Chain)
- PulseChain

## Pricing

Services range from $0.10 to $5.00 per call. Free tier available for `gas-price-oracle` and `token-metadata`.

See full pricing at [coinrailz.com/x402/catalog](https://coinrailz.com/x402/catalog)

## Links

- [Documentation](https://coinrailz.com/docs)
- [API Catalog](https://coinrailz.com/x402/catalog)
- [Get API Key](https://coinrailz.com/credits)
- [GitHub](https://github.com/coinrailz/coinrailz-sdk)

## License

MIT
