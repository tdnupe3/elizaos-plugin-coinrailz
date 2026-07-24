# @coinrailz/ai-payments-sdk

**Enterprise-grade AI payment infrastructure by Coin Railz LLC for fintech startups and AI agent developers**

## Overview

The CoinRailz AI Payments SDK provides comprehensive payment processing, AI agent marketplace, and compliance infrastructure for modern fintech applications. Built for enterprise customers paying $2K-$200K annually.

## Features

- **Multi-Platform Payments**: USDC, Stripe, PayPal, crypto wallets
- **AI Agent Marketplace**: Register, discover, and monetize AI agents
- **Enterprise Compliance**: AML/KYC, sanctions screening, risk management
- **Real-time Analytics**: Transaction monitoring, performance metrics
- **White-label Ready**: Customizable for your brand

## Quick Start

```typescript
import { CoinRailzSDK } from '@coinrailz/ai-payments-sdk';

// Initialize with your license key
const sdk = new CoinRailzSDK({
  licenseKey: 'your-license-key',
  environment: 'production'
});

// Initialize the SDK
await sdk.initialize();

// Process a payment
const result = await sdk.processPayment(100, 'USD', 'usdc');
console.log('Payment result:', result);

// Register an AI agent
const agent = await sdk.registerAgent({
  name: 'My AI Agent',
  description: 'AI-powered payment processor',
  capabilities: [
    {
      name: 'process_payment',
      description: 'Process payments automatically',
      category: 'payment',
      inputs: [],
      outputs: [],
      pricing: { type: 'per_call', amount: 0.10, currency: 'USD' }
    }
  ]
});
```

## Installation

```bash
npm install @coinrailz/ai-payments-sdk
```

## Get Started - Instant API Key

**For developers who want to try before committing to enterprise:**

Pay $1 (USDC/USDT on Base or Solana) and get an API key immediately—no account required!

1. Visit [coinrailz.com/api-keys](https://coinrailz.com/api-keys)
2. Send $1 to the platform wallet
3. Verify your transaction and receive your key + $5 starter credits

Your API key is **permanent** and works across ALL 78 Coin Railz microservices. Credits are deducted per use, and you can top up anytime with the same key.

## License Tiers

- **Startup** ($2,000/year): $100K monthly volume, 10 agents
- **Growth** ($8,000/year): $1M monthly volume, 50 agents  
- **Enterprise** ($25,000/year): $10M monthly volume, 500 agents
- **Custom** ($200,000/year): Unlimited volume, custom features

## Documentation

Visit [docs.coinrailz.com](https://docs.coinrailz.com) for complete documentation.

## Support

- **Community**: GitHub Issues
- **Business**: support@coinrailz.com
- **Enterprise**: enterprise@coinrailz.com

## License

Commercial License - See LICENSE file for details.