# Coin Railz x402 Cloudflare Worker Gateway

A Cloudflare Worker that proxies all 76+ Coin Railz x402 services into the Cloudflare Agent SDK ecosystem. Compatible with **Cloudflare Wallets** (launched August 2026).

## What it does

- Dynamically exposes the full Coin Railz service catalog (`/catalog`) from the live API
- Proxies any `/{service-id}` request to the corresponding Coin Railz x402 endpoint
- Passes through `X-PAYMENT`, `Authorization`, and `X-API-Key` headers transparently
- Adds `X-Gateway: cloudflare-coinrailz` attribution header
- CF Wallet agents paying via the Coinbase CDP facilitator work automatically — no configuration change needed

## Why it works with Cloudflare Wallets

Cloudflare Wallets use the **Coinbase CDP facilitator** (`api.cdp.coinbase.com/platform/v2/x402`) — the same one Coin Railz already lists in its `accepts[]` array. CF Wallet agents can pay Coin Railz services directly with zero additional setup.

## Deploy

```bash
# Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN=<your-token>

# Deploy to Cloudflare Workers
cd cloudflare-gateway
npm install
wrangler publish
```

The worker uses the `COINRAILZ_BASE_URL` variable (defaults to `https://coinrailz.com`).

## Endpoints

| Path | Description |
|------|-------------|
| `GET /` or `/health` | Health check + service count |
| `GET /catalog` or `/services` | Full service catalog |
| `POST /{service-id}` | Proxy to Coin Railz x402 endpoint |

## CF Agent Identity

CF Wallet agents should include the `cloudflare-agent-id` header to:
- Receive first-call-free grants on eligible services (e.g. `/x402/first-call`)
- Get per-agent attribution in analytics
- Bypass the user-agent guard on free tier (CF Workers can strip UA headers)

```javascript
// Cloudflare Agents SDK example
const response = await agent.fetch('https://coinrailz.com/x402/gas-price-oracle', {
  method: 'POST',
  headers: {
    'cloudflare-agent-id': env.CF_AGENT_ID,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ chains: ['base', 'ethereum'] })
});
```

## Current deployment status

Not yet deployed to production. To deploy, a `CLOUDFLARE_API_TOKEN` with Workers:Edit permission is required.
Set the secret in the Replit environment and run `wrangler publish` from this directory.
