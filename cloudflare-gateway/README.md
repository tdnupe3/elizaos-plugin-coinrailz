# Cloudflare x402 Gateway for Coin Railz

This directory contains a Cloudflare Worker that exposes all 65 Coin Railz x402 services to the Cloudflare Agent SDK ecosystem.

## Overview

This Worker acts as a gateway/proxy that:
1. Accepts x402 payment requests from AI agents via the standard `X-PAYMENT` header
2. Forwards them to the Coin Railz x402 endpoints at `coinrailz.com`
3. Returns service data after payment verification on Base or Solana

## Quick Start

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy
```

## Configuration

Edit `wrangler.toml` to set:
- `COINRAILZ_BASE_URL`: Your Coin Railz deployment URL (default: `https://coinrailz.com`)

## Endpoints

| Path | Description |
|------|-------------|
| `GET /` or `GET /health` | Health check, version, service count |
| `GET /catalog` or `GET /services` | Full service catalog (65 services) |
| `GET /<service-id>` | Call a service (returns 402 challenge if no payment) |
| `POST /<service-id>` | Call a service with `X-PAYMENT` header |

## Usage with @x402/fetch (Recommended)

```typescript
import { wrapFetch } from '@x402/fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const fetch402 = wrapFetch(fetch, walletClient);

// The worker returns a 402 challenge which @x402/fetch handles automatically
const response = await fetch402('https://your-worker.workers.dev/gas-price-oracle');
const data = await response.json();
console.log(data);
```

## Usage with Direct X-PAYMENT Header

```typescript
// First get the 402 challenge
const challenge = await fetch('https://your-worker.workers.dev/token-price');
// challenge.status === 402, challenge.json() has accepts[], price, facilitatorUrl

// Then submit payment proof
const response = await fetch('https://your-worker.workers.dev/token-price', {
  method: 'POST',
  headers: {
    'X-PAYMENT': '<base64-encoded-payment-payload>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ tokens: ['ETH', 'SOL'] }),
});
```

## Available Service Categories (65 total)

| Category | Example Services |
|----------|----------|
| Trading Intelligence | trade-signals, token-price, whale-alerts, trending-tokens, sentiment-analysis, dex-liquidity |
| Execution | seamless-chain-bridge, transaction-builder, batch-quote, approval-manager |
| Portfolio & Risk | portfolio-tracker, wallet-risk, multi-chain-balance |
| On-chain Data | gas-price-oracle, contract-scan, token-metadata |
| Agent Infrastructure | agent-wallet, verified-agent-identity, instant-agent-wallet |
| Satellite & IoT Data | satellite-earthdata, fire-alerts, weather-data, fleet-telematics |
| Real Estate | property-valuation, lease-analysis |
| Prediction Markets | prediction-markets, trade-ideas |
| AI & Inference | ai-inference, contract-audit |

See `/catalog` for the full list with pricing.

## Payment Details

- **Protocol**: x402 v2
- **Networks**: Base (`eip155:8453`), Solana (mainnet)
- **Token**: USDC
- **Facilitator**: `https://api.cdp.coinbase.com/platform/v2/x402`
- **Price range**: $0.05 – $1.00 per call
- **First call**: FREE (no payment needed for `/first-call`)

## x402 Protocol Notes

- Payment header: `X-PAYMENT` (not `X-402-Payment`)
- All 402 responses include `facilitatorUrl`, `accepts[]`, and `extensions.bazaar` metadata
- Replay protection is enforced — each transaction hash can only be used once per service
- The gateway version tracks the `@x402` SDK version (currently `2.12.0`)

## License

MIT - Coin Railz 2026
