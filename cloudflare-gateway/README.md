# Cloudflare x402 Gateway for Coin Railz

This directory contains a Cloudflare Worker template that exposes Coin Railz x402 services to the Cloudflare Agent SDK ecosystem.

## Overview

This Worker acts as a gateway/proxy that:
1. Accepts x402 payment requests from AI agents
2. Forwards them to Coin Railz x402 endpoints
3. Returns service data after payment verification

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
- `COINRAILZ_BASE_URL`: Your Coin Railz deployment URL (default: https://coinrailz.com)

## Available Services

The gateway proxies to these x402 services:

| Service | Price | Description |
|---------|-------|-------------|
| gas-price-oracle | $0.10 | Gas prices across 7 chains |
| whale-alerts | $0.35 | Whale wallet movements |
| token-price | $0.25 | Real-time token prices |
| wallet-risk | $0.50 | Wallet risk scoring |
| contract-scan | $1.00 | Smart contract security analysis |
| trending-tokens | $0.50 | Trending token discovery |

## Usage with Cloudflare Agent SDK

```typescript
import { x402Fetch } from '@x402/fetch';
import { EVMWallet } from '@x402/evm';

const wallet = new EVMWallet({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  network: 'eip155:8453' // Base
});

// Call through Cloudflare Worker
const response = await x402Fetch(
  'https://your-worker.workers.dev/gas-price-oracle',
  { wallet }
);

const data = await response.json();
```

## MCP Integration

This gateway can also be exposed as an MCP (Model Context Protocol) server for AI models:

```typescript
// In your MCP server configuration
{
  tools: [
    {
      name: 'get_gas_prices',
      description: 'Get current gas prices across 7 chains (costs $0.10 USDC)',
      x402: {
        scheme: 'exact',
        amount: '100000', // $0.10 in USDC (6 decimals)
        asset: 'USDC'
      }
    }
  ]
}
```

## License

MIT - Coin Railz 2026
