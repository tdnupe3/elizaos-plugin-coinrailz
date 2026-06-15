# Coin Railz SDK

Official JavaScript/TypeScript SDK for [Coin Railz LLC](https://coinrailz.com) - x402 micropayment-enabled crypto microservices for AI agents.

## Features

- 🚀 **66 Microservices** - NASA satellite data, trading intelligence, prediction markets, AI inference, and IoT/DePIN
- 💳 **Simple API Key Auth** - No account or blockchain wallet required to start
- 📦 **TypeScript First** - Full type definitions included
- ⚡ **Zero Dependencies** - Lightweight and fast, uses native fetch
- 🤖 **Built for AI Agents** - Native x402 micropayment support for autonomous integration
- 💰 **Yield-While-Trading** - Earn USDC yield (Kamino/Aave) while your agent operates
- 🌍 **NASA/ESA Earth Data** - Real-time satellite intelligence at $0.15-$0.25/call

## Installation

```bash
npm install coinrailz
```

## Quick Start (No API Key Required!)

```typescript
import { CoinRailzClient } from 'coinrailz';

// Zero-config start - works without API key for free services!
const client = new CoinRailzClient();

// FREE: Get gas prices across chains
const gas = await client.gasPriceOracle({ chain: 'base' });
console.log('Gas prices:', gas.data);

// FREE: Get token metadata
const token = await client.tokenMetadata({
  chain: 'base',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
});
console.log('Token:', token.data);

// Paid services auto-fetch a demo key with $1 trial credits!
const signals = await client.tradeSignals({ token: 'ETH' });
console.log('Signal:', signals.data?.signal, 'Confidence:', signals.data?.confidence);
```

### With API Key (Production)

```typescript
import { CoinRailzClient } from 'coinrailz';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY,
});

// All 66 services available with full credits
const signals = await client.tradeSignals({ token: 'ETH' });
```

## Create an Agent Wallet (Most Valuable Service)

```typescript
import { CoinRailzClient } from 'coinrailz';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY!,
});

// Create a USDC wallet on Base for your AI agent ($0.50 per wallet)
const wallet = await client.createAgentWallet({
  label: 'my-trading-bot-wallet'
});

if (wallet.success) {
  console.log('Wallet Address:', wallet.data.address);
  console.log('Chain:', wallet.data.chain); // 'base'
  console.log('Wallet ID:', wallet.data.walletId);
  // Store walletId securely for future operations
}
```

## Trading Bot Example

```typescript
import { CoinRailzClient } from 'coinrailz';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY!,
});

async function runTradingBot() {
  // 1. Check gas before trading
  const gas = await client.gasPriceOracle({ chain: 'base' });
  if (gas.data.gasPrice > 50) {
    console.log('Gas too high, waiting...');
    return;
  }

  // 2. Get AI trading signal
  const signal = await client.tradeSignals({ token: 'ETH' });
  console.log('Signal:', signal.data?.signal); // 'buy', 'sell', or 'hold'
  console.log('Confidence:', signal.data?.confidence);

  // 3. Check whale activity
  const whales = await client.whaleAlerts({ chain: 'ethereum' });
  console.log('Recent whale moves:', whales.data?.alerts?.length);

  // 4. Execute based on signals...
}

runTradingBot();
```

> **More examples:** Visit [coinrailz.com/quickstart](https://coinrailz.com/quickstart) for complete runnable examples

## Get Your API Key

**Instant API Key** - Pay $1 (USDC/USDT on Base or Solana) and get your API key immediately. No account required!

1. Visit [coinrailz.com/api-keys](https://coinrailz.com/api-keys)
2. Send $1 to the platform wallet
3. Verify your transaction and receive your key + $5 starter credits

**Key Persistence**: Your API key is permanent and works across ALL Coin Railz services. One key = unlimited access (credits are deducted per use). You can top up credits anytime with the same key.

## Available Services

### 🛰️ Satellite Intelligence (NASA & ESA)
- `satelliteEarthdata()` - NASA Earthdata gateway (1B+ datasets)
- `weatherImagery()` - Real-time NASA GIBS satellite weather imagery
- `floodDetection()` - ESA Sentinel-1 SAR flood mapping
- `fireAlerts()` - NASA FIRMS active fire detection

### 📈 Trading & Market Intelligence
- `tradeSignals()` - AI-powered buy/sell/hold signals
- `predictionMarketSpread()` - [NEW] Arb scanner for Polymarket/Kalshi
- `whaleAlerts()` - Large transaction monitoring ($0.35)
- `gasPriceOracle()` - FREE tier gas prices across 7+ chains

### 🤖 AI & Execution
- `aiInference()` - Pay-per-call GPT on Base ($0.05)
- `createAgentWallet()` - Instant USDC wallet on Base
- `seamlessChainBridge()` - Automated cross-chain routing
- `verifiedAgentIdentity()` - On-chain agent verification (ERC-8004)

### 📟 IoT & DePIN
- `weatherStationData()` - Global weather station sensor readings
- `fleetTelematics()` - GPS and vehicle behavior data
- `iotDeviceStream()` - Real-time machine data streams

### ⚖️ Risk, Banking & Real Estate
- `walletRisk()` - ML-powered wallet risk scoring
- `complianceCheck()` - Regulatory AML/KYC checks
- `propertyValuation()` - AI-driven real estate valuation

---
*See the full 66-service catalog at [coinrailz.com/x402/catalog](https://coinrailz.com/x402/catalog)*

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

## Payment Methods

### 1. Prepaid Credits (Recommended for SDK users)
Purchase credits with credit card (Stripe) or USDC, then use your API key:
```typescript
const client = new CoinRailzClient({ apiKey: 'your-api-key' });
```

### 2. x402 Protocol (Direct USDC payments)
For agents with wallets, pay per request with USDC on Base Chain via HTTP 402:
- No API key needed
- Autonomous agent compatible
- See [x402.io](https://x402.io) for protocol details

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
