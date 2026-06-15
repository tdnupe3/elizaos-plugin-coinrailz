# elizaos-plugin-coinrailz

**Agent Treasury + Payments for ElizaOS.** Non-custodial USDC yield on Solana and Base, plus 66 x402 pay-per-call services — all in one plugin.

## What this plugin does

| Capability | Details |
|---|---|
| 🏦 **Solana USDC Yield** | Deposit into Kamino Lending — ~3.4% APY. Agent signs txs locally; Coin Railz never holds funds. |
| 🏦 **Base USDC Yield** | ERC-4626 vault auto-routing across Aave v3, Compound v3, and Morpho Blue for best rate. |
| ⚡ **66 x402 Services** | Pay-per-call APIs: NASA satellite data, prediction market spread, AI inference, trading signals. |
| 🔑 **Two payment paths** | API key credits (no wallet needed) or autonomous x402 (self-sovereign USDC on Base). |

**Platform:** `https://coinrailz.com`  
**Networks:** Solana Mainnet + Base Mainnet  
**Protocol:** x402 (HTTP 402 Payment Required) for paid services

---

## Installation

```bash
npm install elizaos-plugin-coinrailz
```

---

## Quick Start

```typescript
import { AgentRuntime } from "@elizaos/core";
import { coinrailzPlugin } from "elizaos-plugin-coinrailz";

const runtime = new AgentRuntime({
  plugins: [coinrailzPlugin]
});
// Agent can now earn yield + spend via x402
```

---

## Treasury Examples

### Check live Solana USDC yield rate

```typescript
await runtime.processAction({
  action: "COINRAILZ_SOLANA_YIELD",
  content: { operation: "GET_RATES" }
});
// → { usdc: { apy: 3.44, formatted: "3.44%" }, onChain: { depositTvlUsdc: 118420827 }, ... }
```

### Build a deposit transaction (non-custodial)

```typescript
await runtime.processAction({
  action: "COINRAILZ_SOLANA_YIELD",
  content: {
    operation: "CREATE_DEPOSIT_TX",
    wallet: "YOUR_SOLANA_PUBKEY",
    amount_usdc: 100,
    idempotency_key: crypto.randomUUID()  // prevents duplicate fees on retry
  }
});
// → { transactions: [{base64: "..."}], bundle_expires_at: "...", signing: { hint: "..." } }
// If SOLANA_PRIVATE_KEY is set, auto-signs and submits.
```

### Confirm after submission

```typescript
await runtime.processAction({
  action: "COINRAILZ_SOLANA_YIELD",
  content: {
    operation: "CONFIRM_DEPOSIT",
    wallet: "YOUR_SOLANA_PUBKEY",
    txSignature: "THE_TX_SIGNATURE_FROM_SUBMISSION"
  }
});
// → { verificationStatus: "confirmed", onChainVerified: true }
```

### Check existing position

```typescript
await runtime.processAction({
  action: "COINRAILZ_SOLANA_YIELD",
  content: {
    operation: "GET_POSITION",
    wallet: "YOUR_SOLANA_PUBKEY"
  }
});
// → { hasPosition: true, currentValueUsdc: 103.44, depositedUsdcRaw: "100000000" }
```

### Revenue flywheel — earn yield, spend via x402

```typescript
// 1. Check yield earned
const position = await runtime.processAction({
  action: "COINRAILZ_SOLANA_YIELD",
  content: { operation: "GET_POSITION", wallet: solanaWallet }
});

// 2. Spend x402 credits on data while yield accumulates
const signals = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: { serviceId: "trade-signals", payload: { token: "SOL" } }
});
```

---

## Solana Yield Operations

| Operation | Requires | Description |
|---|---|---|
| `GET_RATES` | — | Live APY, TVL, utilization from Kamino |
| `GET_MANIFEST` | — | Full agent integration guide |
| `GET_STATS` | — | Reserve health (liquidity, utilization) |
| `GET_POSITION` | `wallet` | Current position value and status |
| `CREATE_DEPOSIT_TX` | `wallet`, `amount_usdc` (≥5) | Build unsigned tx bundle. Auto-signs if `SOLANA_PRIVATE_KEY` set. |
| `CONFIRM_DEPOSIT` | `wallet`, `txSignature` | Notify platform after on-chain submission |

---

## Payment Methods (for x402 services)

### Method 1: API Key Credits (RECOMMENDED)

```bash
export COINRAILZ_API_KEY="cr_live_YOUR_KEY_HERE"
```

Buy credits at `https://coinrailz.com/credits`. No blockchain interaction required.

### Method 2: Autonomous x402 (Self-Sovereign)

```bash
export EVM_PRIVATE_KEY="0xYOUR_BASE_PRIVATE_KEY"
```

Uses `x402-fetch` with EIP-712 signing to pay for services automatically on Base.

---

## Environment Variables

| Variable | Required for | Description |
|---|---|---|
| `COINRAILZ_API_KEY` | x402 services | Prepaid credits. Get one at coinrailz.com/api-keys |
| `EVM_PRIVATE_KEY` | x402 services | Base mainnet private key for autonomous payments |
| `SOLANA_PRIVATE_KEY` | Auto-sign Solana deposits | Base58 or JSON uint8 array. Optional — without it, unsigned tx bundle is returned with signing instructions. |
| `SOLANA_RPC_URL` | Auto-sign Solana deposits | RPC endpoint (default: `https://api.mainnet-beta.solana.com`) |
| `COIN_RAILZ_URL` | Optional | Override platform URL (default: `https://coinrailz.com`) |

---

## x402 Pay-Per-Call Services (66 total)

### 📈 Featured: Prediction Markets ($0.25–$0.75)
| Service ID | Price | Description |
|---|---|---|
| `prediction-market-spread` | $0.75 | Arbitrage scanner for Polymarket vs Kalshi spreads |
| `polymarket-odds` | $0.50 | Current odds for a specific market |
| `kalshi-odds` | $0.50 | Odds for a specific Kalshi market |
| `polymarket-search` | $0.25 | Search for specific prediction markets |

### Discovery & Testing ($0.05–$0.25)
| Service ID | Price | Description |
|---|---|---|
| `first-call` | $0.05 | Golden-path agent onboarding endpoint |
| `ping` | $0.25 | x402 connectivity test |

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

### Solana DeFi ($0.25)
| Service ID | Price | Description |
|---|---|---|
| `solana-yield-finder` | $0.25 | Real-time Solana lending rates across Kamino, Jupiter, Marinade |

### Satellite Data — NASA + ESA ($0.05–$0.25)
| Service ID | Price | Description |
|---|---|---|
| `fire-alerts` | $0.05 | NASA FIRMS active fire detection |
| `weather-imagery` | $0.05 | NASA GIBS satellite weather imagery |
| `air-quality` | $0.05 | ESA Sentinel-5P TROPOMI air quality |
| `vegetation` | $0.10 | NASA MODIS + ESA Sentinel-2 NDVI |
| `flood-detection` | $0.10 | ESA Sentinel-1 SAR flood mapping |
| `land-use` | $0.15 | NASA Landsat + ESA land classification |
| `satellite-earthdata` | $0.25 | NASA Earthdata gateway |
| `earthdata-granules` | $0.25 | CMR granule search (1B+ datasets) |
| `earthdata-precipitation` | $0.25 | GPM IMERG real-time rain rate |
| `earthdata-sst` | $0.25 | MUR sea surface temperature |
| `earthdata-soil-moisture` | $0.25 | SMAP soil moisture data |
| `earthdata-ocean-color` | $0.25 | MODIS ocean color / chlorophyll-a |

### IoT / DePIN ($0.025–$0.50)
| Service ID | Price | Description |
|---|---|---|
| `iot-sensor-reading` | $0.025 | Single sensor reading |
| `weather-station-data` | $0.05 | Temperature, humidity, pressure |
| `fleet-telematics` | $0.10 | GPS, fuel, driver behavior |
| `iot-device-stream` | $0.25 | Real-time IoT data stream |
| `iot-bulk-data` | $0.50 | Bulk historical IoT data |

### AI Inference ($0.05)
| Service ID | Price | Description |
|---|---|---|
| `ai-inference` | $0.05 | Pay-per-call GPT-4o-mini — no API key needed |

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

### Traditional Markets, Real Estate, Banking, Market Intelligence
Full list at `https://coinrailz.com/services` or via the `serviceRegistryProvider`.

---

## Advanced: Direct client access

```typescript
import { X402Client, SolanaYieldClient } from "elizaos-plugin-coinrailz";

// x402 paid services
const x402 = new X402Client({ apiKey: process.env.COINRAILZ_API_KEY });
const result = await x402.callService({ serviceId: "whale-alerts", amount: "", payload: { minUsdValue: 1000000 } });

// Solana yield portal (free REST)
const yield = new SolanaYieldClient();
const rates = await yield.getRates();
console.log(rates.usdc.formatted); // "3.44%"
```

---

## Security

- ✅ Non-custodial — agent signs all transactions; Coin Railz never holds USDC
- ✅ On-chain signature verification on every deposit confirm
- ✅ Idempotency keys prevent duplicate fee charges on retry
- ✅ Keeper reconciles unverified deposits within 60 minutes
- ✅ API keys hashed server-side, never stored in plaintext
- ⚠️ `EVM_PRIVATE_KEY` and `SOLANA_PRIVATE_KEY` are hot wallet keys — fund only what the agent needs

---

## Links

- **Platform:** https://coinrailz.com
- **Solana Yield Portal:** https://coinrailz.com/solana-yield
- **Base Yield Vault:** https://coinrailz.com/yield-portal
- **Credits / API Keys:** https://coinrailz.com/credits
- **x402 Protocol:** https://x402.org
- **ElizaOS:** https://elizaos.ai
- **Support:** support@coinrailz.com

---

## License

MIT
