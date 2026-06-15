# @elizaos/plugin-coinrailz

> ⚠️ **DEPRECATED** — This package is no longer maintained.
>
> Please use [`elizaos-plugin-coinrailz`](https://www.npmjs.com/package/elizaos-plugin-coinrailz) instead.
> It includes Yield-While-Trading (Kamino + Morpho/Aave), all 66 x402 services, and has an active PR merged into the ElizaOS develop branch.
>
> ```bash
> npm install elizaos-plugin-coinrailz
> ```

ElizaOS plugin for Coin Railz x402 micropayment services on Base mainnet.

## Overview

This plugin adds **18 production-ready micropayment services** to any ElizaOS agent, enabling autonomous AI agents to pay for and access premium APIs using USDC on Base.

**Platform Wallet:** `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`  
**Network:** Base Mainnet  
**Protocol:** x402 (HTTP 402 Payment Required)  
**Revenue Share:** 85% to agent builders, 15% platform fee

## Features

- ✅ **18 Production Services** - Multi-chain balance, gas prices, token data, wallet analysis, trading signals, and more
- ✅ **x402 Protocol** - Standard HTTP-based micropayments ($0.10 - $5.00 USDC)
- ✅ **Base Mainnet** - Low fees, fast settlement via Coinbase infrastructure
- ✅ **CDP Compatible** - Works with Coinbase Developer Platform wallets
- ✅ **Auto-Retry Logic** - Handles 402 responses and payment verification
- ✅ **Zero Backend** - No servers to manage, payments handled automatically

## Installation

### Option 1: Prepaid Credits with API Keys (RECOMMENDED - 50-70% Conversion)

**Best for:** Production applications, autonomous agents, enterprise use

```bash
# Install standalone SDK (no ElizaOS required)
npm install @coinrailz/sdk
# or for Python
pip install coinrailz-sdk
```

**Why prepaid credits?**
- ✅ No blockchain knowledge required
- ✅ Pay with Stripe (credit card) or USDC
- ✅ Single API key for all services
- ✅ Automatic credit deduction
- ✅ 50-70% conversion vs 2-5% for manual USDC payments

**Quick Start with Prepaid Credits:**

```typescript
import { CoinRailzClient } from '@coinrailz/sdk';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY
});

// Check balance
const balance = await client.getBalance();

// Call any service
const risk = await client.getWalletRisk('0x742d35Cc...', 'ethereum');
```

See `/examples/node/` for standalone JavaScript examples and `/examples/python/` for Python examples.

### Option 2: ElizaOS Plugin (x402 Protocol)

**Best for:** ElizaOS agent integration with autonomous USDC payments

```bash
npm install @elizaos/plugin-coinrailz
```

```typescript
import { elizaLogger, AgentRuntime } from "@elizaos/core";
import { coinrailzPlugin } from "@elizaos/plugin-coinrailz";

const runtime = new AgentRuntime({
  // ... your config
  plugins: [coinrailzPlugin]
});

elizaLogger.log("Coin Railz plugin loaded - agent can now use micropayment services");
```

See `/examples/eliza/` for advanced ElizaOS agent examples.

## Available Services

### Trader Services ($0.10 - $2.00)
- **multi-chain-balance** ($0.50) - Query balances across 7+ EVM chains
- **gas-price-oracle** ($0.10) - Real-time gas prices
- **token-price** ($0.15) - Token price feeds from DEX aggregators
- **contract-scan** ($2.00) - Smart contract security analysis
- **wallet-risk** ($1.00) - Wallet risk scoring
- **trade-signals** ($0.75) - AI-powered trading signals
- **token-sentiment** ($0.25) - Social sentiment analysis
- **trending-tokens** ($0.50) - Discover trending tokens
- **whale-alerts** ($0.35) - Track whale wallet movements
- **dex-liquidity** ($0.20) - DEX liquidity analytics

### Infrastructure Services ($0.10 - $5.00)
- **transaction-builder** ($0.30) - Build blockchain transactions
- **token-metadata** ($0.10) - Token information
- **approval-manager** ($0.20) - Manage token approvals
- **batch-quote** ($0.40) - Batch token swap quotes
- **portfolio-tracker** ($0.50) - Portfolio analytics
- **instant-agent-wallet** ($1.00) - Circle MPC wallet creation
- **verified-agent-identity** ($5.00) - ERC-8004 on-chain identity
- **seamless-chain-bridge** ($2.00) - Cross-chain USDC routing

## Usage Examples

### Example 1: Check Multi-Chain Balance

```typescript
// In your agent's character or action
{
  name: "CHECK_WALLET_BALANCE",
  description: "Check wallet balance across multiple chains",
  handler: async (runtime, message) => {
    const response = await runtime.processAction({
      action: "COINRAILZ_PAY_SERVICE",
      content: {
        serviceId: "multi-chain-balance",
        payload: {
          address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        }
      }
    });
    return response;
  }
}
```

### Example 2: Get Gas Prices

```typescript
const gasData = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "gas-price-oracle",
    payload: {
      chains: ["ethereum", "base", "polygon"]
    }
  }
});
```

### Example 3: Token Price Feed

```typescript
const price = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "token-price",
    payload: {
      tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      chain: "ethereum"
    }
  }
});
```

## Payment Methods

### Option 1: Prepaid Credits with API Keys (RECOMMENDED)

**⚡ 50-70% conversion rate vs 2-5% for manual USDC payments**

**Why use prepaid credits?**
- ✅ No blockchain knowledge required
- ✅ Pay with Stripe or crypto
- ✅ Single API key for all services
- ✅ Automatic credit deduction
- ✅ Much easier for non-technical users

**Setup:**

1. **Buy Credits**: Visit https://coinrailz.com/credits
   - Pay with credit card (Stripe) or USDC/USDT
   
2. **Generate API Key**: Visit https://coinrailz.com/api-keys
   - Click "Generate New API Key"
   - Copy your key (starts with `cr_live_`)

3. **Configure Environment Variable**:
```bash
export COINRAILZ_API_KEY="cr_live_YOUR_KEY_HERE"
```

4. **Use in ElizaOS**:
```typescript
import { coinrailzPlugin } from "@elizaos/plugin-coinrailz";

const runtime = new AgentRuntime({
  env: {
    COINRAILZ_API_KEY: process.env.COINRAILZ_API_KEY
  },
  plugins: [coinrailzPlugin]
});

// Plugin automatically uses API key for all service calls
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "multi-chain-balance",
    payload: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" }
  }
});
```

**🔐 SECURITY**: API keys should ONLY be used server-side. Never expose them in client-side code.

---

### Option 2: x402 Protocol (For Autonomous Agents)

**How It Works:**

1. **Agent calls service** - Action triggers x402 payment flow
2. **402 Response** - Service returns payment requirement (amount, address)
3. **Payment made** - Agent signs USDC transfer on Base
4. **Auto-retry** - Request retried with payment proof (transaction hash)
5. **Service response** - Data returned, 85% revenue goes to agent builder

## Payment Flow

The plugin handles two payment methods:

### Method 1: Standard x402 (EIP-712 Signature)
```typescript
// Automatic - handled by plugin
// Signs EIP-712 payload, includes in X-PAYMENT header
```

### Method 2: Raw Transaction Hash
```typescript
// For manual payments
const response = await runtime.processAction({
  action: "COINRAILZ_PAY_SERVICE",
  content: {
    serviceId: "multi-chain-balance",
    payload: { address: "0x..." },
    transactionHash: "0xYourTxHash"  // Include if payment already made
  }
});
```

## Configuration

### Environment Variables

```bash
# Optional - defaults to production
COIN_RAILZ_URL=https://coinrailz.com
```

### Plugin Options

```typescript
import { coinrailzPlugin } from "@elizaos/plugin-coinrailz";

const runtime = new AgentRuntime({
  plugins: [
    {
      ...coinrailzPlugin,
      // Plugin config (if needed)
    }
  ]
});
```

## Testing

```bash
npm test
```

Tests verify:
- Action validation
- Service registry provider
- x402 payment flow
- 402 response handling
- Retry logic

## Revenue Model

- **85% to Agent Builder** - You keep most of the revenue
- **15% Platform Fee** - Coin Railz platform commission
- **No Setup Fees** - Only pay when services are used
- **USDC Settlement** - Instant payment on Base mainnet

## Security

- ✅ **Production Wallets** - Coinbase CDP MPC wallet support
- ✅ **Payment Verification** - All transactions verified on-chain
- ✅ **Replay Protection** - Each transaction can only be used once
- ✅ **Rate Limiting** - Built-in protection against abuse

## Contributing

Contributions welcome! This is an open-source plugin for the ElizaOS ecosystem.

## License

MIT

## Links

- **Coin Railz Platform:** https://coinrailz.com
- **Developer Docs:** See `X402_DEVELOPER_GUIDE.md` in platform repo
- **x402 Protocol:** https://x402.org
- **ElizaOS:** https://github.com/ai16z/eliza

## Support

- **Issues:** Open a GitHub issue
- **Questions:** ElizaOS Discord #plugins channel
- **Platform Support:** support@coinrailz.com

---

**Built by Coin Railz** - Autonomous AI payment infrastructure on Base
