# elizaos-plugin-coinrailz

ElizaOS plugin for Coin Railz x402 micropayment services on Base mainnet.

## Overview

This plugin adds **65 production-ready micropayment services** to any ElizaOS agent, enabling autonomous AI agents to pay for and access premium APIs using USDC on Base.

**Platform:** `https://coinrailz.com`  
**Network:** Base Mainnet  
**Protocol:** x402 (HTTP 402 Payment Required)  
**Revenue Share:** 85% to agent builders, 15% platform fee

## Features

- ✅ **65 Production Services** — trading, satellite/Earth data, IoT/DePIN, AI inference, prediction markets, and more
- ✅ **Dual Payment Paths** — API key (Stripe credits, easiest) or native x402 (autonomous USDC on Base)
- ✅ **x402 Protocol** — standard HTTP-based micropayments ($0.025–$10.00 USDC)
- ✅ **Base Mainnet** — low fees, fast settlement via Coinbase infrastructure
- ✅ **CDP Compatible** — works with Coinbase Developer Platform wallets
- ✅ **Zero Backend** — no servers to manage, payments handled automatically

## Installation

```bash
npm install elizaos-plugin-coinrailz
```

## Quick Start

```typescript
import { elizaLogger, AgentRuntime } from "@elizaos/core";
import { coinrailzPlugin } from "elizaos-plugin-coinrailz";

const runtime = new AgentRuntime({
  plugins: [coinrailzPlugin]
});

elizaLogger.log("Coin Railz plugin loaded — agent can now access 65 micropayment services");
```

---

## Payment Methods

### Method 1: Prepaid Credits with API Keys (RECOMMENDED)

**Best for:** Production agents, fastest setup, no blockchain knowledge required.

**Setup:**

1. Buy credits at `https://coinrailz.com/credits` (Stripe card or USDC)
2. Generate an API key at `https://coinrailz.com/api-keys`
3. Set your environment variable:

```bash
export COINRAILZ_API_KEY="cr_live_YOUR_KEY_HERE"
```

4. The plugin automatically uses the API key for all service calls.

### Method 2: Autonomous x402 (Self-Sovereign Agents)

**Best for:** Agents that should pay for their own data without operator intervention.

**Setup:**

Set `EVM_PRIVATE_KEY` to a Base mainnet wallet funded with USDC:

```bash
export EVM_PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
```

The plugin uses `x402-fetch` with EIP-712 signing to automatically handle 402 responses and submit USDC payments on Base — no operator action required.

> **Security note:** `EVM_PRIVATE_KEY` is a hot wallet key. Fund it only with what the agent needs and keep balances small.

---

## Usage Examples

### Example 1: Check Multi-Chain Balance

```typescript
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "multi-chain-balance",
    payload: {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    }
  }
});
```

### Example 2: AI Inference (Pay-Per-Call LLM)

```typescript
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "ai-inference",
    payload: {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Summarize today's DeFi news" }]
    }
  }
});
```

### Example 3: NASA Satellite Data

```typescript
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "earthdata-ocean-color",
    payload: { lat: 36.8, lon: -75.3 }
  }
});
```

### Example 4: Real-Time Fire Alerts

```typescript
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "fire-alerts",
    payload: { bbox: [-122.5, 37.5, -121.5, 38.5] }
  }
});
```

### Example 5: IoT Sensor Reading

```typescript
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "iot-sensor-reading",
    payload: { deviceId: "sensor_001", metric: "temperature" }
  }
});
```

---

## Available Services (65 total)

### Discovery & Testing ($0.05–$0.25)
| Service ID | Price | Description |
|---|---|---|
| `ping` | $0.25 | x402 discovery and connectivity test |
| `first-call` | $0.05 | Golden-path agent onboarding endpoint |

### Trading Intelligence ($0.10–$0.75)
| Service ID | Price | Description |
|---|---|---|
| `gas-price-oracle` | $0.10 | Real-time gas prices across chains |
| `token-metadata` | $0.10 | Comprehensive token information |
| `dex-liquidity` | $0.20 | DEX liquidity pool analytics |
| `approval-manager` | $0.20 | Manage and revoke token approvals |
| `token-price` | $0.25 | Token prices from DEX aggregators |
| `token-sentiment` | $0.25 | Social sentiment for crypto tokens |
| `transaction-builder` | $0.30 | Build and simulate transactions |
| `whale-alerts` | $0.35 | Track whale wallet movements |
| `batch-quote` | $0.40 | Batch token swap quotes |
| `multi-chain-balance` | $0.50 | Balances across 7+ EVM chains |
| `trending-tokens` | $0.50 | Trending tokens across DEXs |
| `portfolio-tracker` | $0.50 | Portfolio analytics |
| `wallet-risk` | $0.50 | Wallet risk scoring |
| `trade-signals` | $0.75 | AI-powered trading signals |

### Execution & Infrastructure ($0.50–$2.00)
| Service ID | Price | Description |
|---|---|---|
| `payment-processing` | $0.50 | Cross-chain payment settlement |
| `contract-scan` | $1.00 | Smart contract security analysis |
| `instant-agent-wallet` | $1.00 | Circle MPC wallet creation |
| `instant-api-key` | $1.00 | Frictionless API key via USDC payment |
| `agent-create-wallet` | $2.00 | CDP-managed wallet provisioning |
| `seamless-chain-bridge` | $2.00 | Circle CCTP cross-chain USDC routing |

### Premium Services ($5.00–$10.00)
| Service ID | Price | Description |
|---|---|---|
| `verified-agent-identity` | $5.00 | ERC-8004 on-chain agent identity |
| `compliance-consultation` | $5.00 | Expert crypto compliance consultation |
| `smart-contract-audit` | $10.00 | Comprehensive AI security audit |

### Real Estate ($0.75–$1.50)
| Service ID | Price | Description |
|---|---|---|
| `property-valuation` | $0.75 | AI property valuation + tokenization analysis |
| `lease-analysis` | $1.00 | AI lease terms analysis |
| `construction-progress` | $1.50 | Construction project tracking |

### Banking & Compliance ($0.75–$1.75)
| Service ID | Price | Description |
|---|---|---|
| `fraud-detection` | $0.75 | AI fraud detection |
| `credit-risk-score` | $1.25 | On-chain DeFi credit scoring |
| `compliance-check` | $1.75 | AML/KYC wallet screening |

### Trading / Investment ($0.50–$2.00)
| Service ID | Price | Description |
|---|---|---|
| `sentiment-analysis` | $0.50 | AI sentiment from Twitter, Reddit, Discord |
| `trading-signal` | $1.00 | AI signals with entry/exit points |
| `portfolio-optimization` | $2.00 | AI portfolio rebalancing |

### Market Intelligence ($0.75–$1.25)
| Service ID | Price | Description |
|---|---|---|
| `correlation-matrix` | $0.75 | Cross-asset correlation analysis |
| `risk-metrics` | $1.00 | Comprehensive risk analytics |
| `arbitrage-scanner` | $1.25 | Cross-chain arbitrage opportunities |

### Prediction Markets — Polymarket ($0.25–$0.50)
| Service ID | Price | Description |
|---|---|---|
| `polymarket-events` | $0.25 | Trending Polymarket events |
| `polymarket-search` | $0.25 | Search Polymarket markets |
| `polymarket-odds` | $0.50 | Current odds for a specific market |
| `prediction-market-odds` | $0.50 | General prediction market odds |

### Prediction Markets — Kalshi CFTC-Regulated ($0.25–$0.50)
| Service ID | Price | Description |
|---|---|---|
| `kalshi-markets` | $0.25 | Active CFTC-regulated Kalshi markets |
| `kalshi-search` | $0.25 | Search Kalshi markets |
| `kalshi-odds` | $0.50 | Odds for a specific Kalshi market |

### Traditional Markets ($0.40)
| Service ID | Price | Description |
|---|---|---|
| `stock-sentiment` | $0.40 | AI stock market sentiment |
| `forex-sentiment` | $0.40 | AI forex sentiment |

### Solana DeFi ($0.05)
| Service ID | Price | Description |
|---|---|---|
| `solana-yield-finder` | $0.05 | Real-time Solana lending and yield rates |

### Satellite Data — NASA + ESA ($0.05–$0.15)
| Service ID | Price | Description |
|---|---|---|
| `fire-alerts` | $0.05 | NASA FIRMS active fire detection |
| `weather-imagery` | $0.05 | NASA GIBS satellite weather imagery |
| `air-quality` | $0.05 | ESA Sentinel-5P TROPOMI air quality |
| `vegetation` | $0.10 | NASA MODIS + ESA Sentinel-2 NDVI |
| `flood-detection` | $0.10 | ESA Sentinel-1 SAR flood mapping |
| `land-use` | $0.15 | NASA Landsat + ESA land classification |

### NASA Earthdata Intelligence ($0.25)
| Service ID | Price | Description |
|---|---|---|
| `satellite-earthdata` | $0.25 | NASA Earthdata gateway (all services) |
| `earthdata-granules` | $0.25 | CMR granule search (1B+ datasets) |
| `earthdata-precipitation` | $0.25 | GPM IMERG real-time rain rate |
| `earthdata-sst` | $0.25 | MUR sea surface temperature |
| `earthdata-soil-moisture` | $0.25 | SMAP soil moisture data |
| `earthdata-ocean-color` | $0.25 | MODIS ocean color / chlorophyll-a |

### IoT / DePIN ($0.025–$0.50)
| Service ID | Price | Description |
|---|---|---|
| `iot-sensor-reading` | $0.025 | Single sensor reading from IoT device |
| `weather-station-data` | $0.05 | Temperature, humidity, pressure from IoT |
| `fleet-telematics` | $0.10 | GPS, fuel, driver behavior from fleet |
| `iot-device-stream` | $0.25 | Real-time IoT data stream (per minute) |
| `iot-bulk-data` | $0.50 | Bulk historical IoT data export |

### AI Inference ($0.05)
| Service ID | Price | Description |
|---|---|---|
| `ai-inference` | $0.05 | Pay-per-call LLM access — GPT-4o-mini, no API key needed |

---

## Advanced: Using X402Client Directly

```typescript
import { X402Client } from "elizaos-plugin-coinrailz";

const client = new X402Client({
  apiKey: process.env.COINRAILZ_API_KEY  // or set EVM_PRIVATE_KEY for autonomous x402
});

const result = await client.callService({
  serviceId: "whale-alerts",
  amount: "",
  payload: { minUsdValue: 1000000 }
});

if (result.success) {
  console.log(result.serviceResponse);
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `COINRAILZ_API_KEY` | Recommended | Prepaid credits API key. Get one at coinrailz.com/api-keys |
| `EVM_PRIVATE_KEY` | Alternative | Base mainnet private key for autonomous x402 payments |
| `COIN_RAILZ_URL` | Optional | Override platform URL (default: https://coinrailz.com) |

---

## Revenue Model

- **85% to Agent Builder** — you keep the majority of revenue when your agent earns
- **15% Platform Fee** — Coin Railz infrastructure commission
- **No Setup Fees** — only pay when services are used
- **USDC Settlement** — instant payment on Base mainnet

---

## Testing

```bash
npm test
```

---

## Security

- ✅ All transactions verified on Base mainnet
- ✅ Replay protection — each payment hash used once
- ✅ Rate limiting built in
- ✅ API keys are hashed server-side, never stored in plaintext

---

## License

MIT

---

## Links

- **Platform:** https://coinrailz.com
- **Credits / API Keys:** https://coinrailz.com/credits
- **x402 Protocol:** https://x402.org
- **ElizaOS:** https://elizaos.ai
- **Support:** support@coinrailz.com
