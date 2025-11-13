# Coinbase x402 + CDP Integration Submission Package

## Target Repository
**Primary**: https://github.com/coinbase/x402  
**Secondary**: https://github.com/coinbase/agentkit

## Submission Type
**Showcase Integration** - x402 protocol + CDP facilitator for AI agent micropayments

---

## Overview
Coin Railz is a production x402 micropayment infrastructure serving AI agents on Base mainnet. It demonstrates real-world integration of Coinbase's x402 protocol with CDP facilitator for autonomous AI agent payments.

**Live Platform**: https://coinrailz.com  
**GitHub Plugin**: https://github.com/tdnupe3/coinrailz-eliza-plugin  
**Registry**: 18 services registered on x402scan.com

---

## Technical Implementation

### Architecture
- **18 x402 services** at $0.10-$5.00 USDC per call
- **CDP Facilitator** for payment verification
- **Base mainnet** for all transactions
- **Hybrid payment middleware** accepting both EIP-712 signatures and raw transaction hashes
- **Real API integrations**: Circle, Alchemy, CoinGecko, Etherscan
- **ElizaOS plugin** for AI agent integration

### Key Features
✅ **Production CDP Integration**: Real Circle wallet creation via Developer Controlled Wallets API  
✅ **x402 Facilitator Compliance**: Full HTTP 402 response format with CDP facilitator support  
✅ **Multi-Chain Support**: Services query 7+ EVM chains via Alchemy  
✅ **On-Chain Identity**: ERC-8004 blockchain identity registry deployed on Base  
✅ **Autonomous Payments**: AI agents can discover and purchase services without human intervention  
✅ **Fee-Free USDC**: Leveraging Base mainnet for zero transaction fees

---

## Code Highlights

### 1. x402 Payment Middleware with CDP Facilitator
```typescript
// server/middleware/hybridPaymentMiddleware.ts
export function hybridPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
  const xPayment = req.headers["x-payment"] as string | undefined;
  
  if (!xPayment) {
    return next(); // Returns 402 with CDP facilitator requirements
  }

  // Supports both EIP-712 signatures (via x402-express) 
  // AND raw transaction hashes (verified on-chain via Alchemy)
  const isRawTxHash = /^0x[a-fA-F0-9]{64}$/.test(xPayment.trim());
  
  if (!isRawTxHash) {
    return next(); // Pass to x402-express for CDP facilitator verification
  }

  // Verify raw transaction on Base mainnet
  verifyTransactionPayment(xPayment, serviceName, requiredAmount)
    .then((verified) => {
      if (verified) {
        return next(); // Payment verified - serve content
      }
      // Return 402 with payment requirements
    });
}
```

### 2. CDP-Compliant 402 Response Format
```typescript
// server/routes/x402MicroserviceRoutesV2.ts
const x402Routes = {
  "POST /multi-chain-balance": {
    price: "$0.50",
    network: "base", // Base mainnet for fee-free USDC
    config: {
      discoverable: true,
      name: "Multi-Chain Balance Checker",
      description: "Query wallet balances across 7+ EVM chains",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", required: true }
          }
        }
      }
    }
  }
};

// Applied via official x402-express middleware
router.use(paymentMiddleware(PLATFORM_WALLET, x402Routes, facilitator));
```

### 3. Real Circle API Integration
```typescript
// server/routes/microservices.ts - Premium B2B2C Services
async function instantAgentWalletService(params: { agentId: string }) {
  // REAL Circle API call - no mocking
  const { CircleClient } = await import('../services/circleClient');
  const circleClient = new CircleClient();
  
  const walletResponse = await circleClient.createWallet(`AI Agent: ${params.agentId}`);
  
  return {
    walletAddress: walletResponse.data.wallet.address,
    walletId: walletResponse.data.wallet.walletId,
    network: "base-mainnet",
    currency: "USDC"
  };
}
```

---

## Services Catalog

### Trader-Focused Services ($0.10-$2.00)
1. Multi-chain balance checker - $0.50
2. Gas price oracle - $0.10
3. Token price feed - $0.15
4. Smart contract scanner - $2.00
5. Wallet risk analysis - $1.00
6. Trade signals - $0.75
7. Token sentiment - $0.25
8. Trending tokens - $0.50
9. Whale alerts - $0.35
10. DEX liquidity - $0.20

### Infrastructure Services ($0.10-$0.50)
11. Transaction builder - $0.30
12. Token metadata - $0.10
13. Approval manager - $0.20
14. Batch quotes - $0.40
15. Portfolio tracker - $0.50

### Premium CDP Services ($1.00-$5.00)
16. **Instant agent wallet** - $1.00 (Circle MPC wallet creation)
17. **Verified agent identity** - $5.00 (KYA with ERC-8004 on-chain identity)
18. **Seamless chain bridge** - $2.00 (Circle CCTP cross-chain routing)

---

## Production Metrics

**Platform Wallet**: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`  
**Network**: Base mainnet  
**Token**: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)  
**x402scan Registry**: All 18 services registered and discoverable  
**Status**: Production-ready with live endpoints

---

## Integration Examples

### For AI Agent Developers (ElizaOS)
```bash
npm install github:tdnupe3/coinrailz-eliza-plugin
```

```typescript
import { coinrailzPlugin } from 'coinrailz-eliza-plugin';

const agent = new Agent({
  plugins: [coinrailzPlugin]
});

// Agent can now autonomously purchase services
await agent.actions.GET_MULTI_CHAIN_BALANCE({
  walletAddress: "0x..."
});
```

### Direct x402 Integration (Any Client)
```typescript
import { x402Fetch } from 'x402-fetch';
import { Wallet } from 'ethers';

const wallet = new Wallet(process.env.PRIVATE_KEY);

const response = await x402Fetch(
  'https://coinrailz.com/x402/gas-price-oracle',
  { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chains: ['ethereum', 'base'] })
  },
  wallet
);

const data = await response.json();
// Payment handled automatically via CDP facilitator
```

---

## Why This Matters for Coinbase Ecosystem

1. **First Production x402 AI Marketplace**: Demonstrates x402 protocol viability for B2B2C micropayments
2. **CDP Facilitator Showcase**: Real-world integration of Coinbase hosted facilitator
3. **Base Adoption**: Drives USDC transaction volume on Base mainnet
4. **AI Agent Economy**: Infrastructure for autonomous AI agent payments using Coinbase tech
5. **Developer Template**: Reusable pattern for building x402 services with CDP

---

## Submission Recommendation

**Option 1: GitHub Issue Showcase**
- Repository: https://github.com/coinbase/x402
- Issue Type: Showcase / Community Example
- Include: Architecture overview + code snippets + live demo link

**Option 2: Pull Request to Examples**
- Repository: https://github.com/coinbase/x402
- Path: `examples/typescript/fullstack/ai-marketplace/`
- Include: Simplified reference implementation based on Coin Railz architecture

**Option 3: AgentKit Integration**
- Repository: https://github.com/coinbase/agentkit
- Demonstrate: x402 micropayment plugin for AI agents with wallets

---

## Next Steps

1. ✅ Create GitHub issue in x402 repo showcasing integration
2. ⏳ Wait for Coinbase team feedback
3. ⏳ Potentially contribute simplified example to x402/examples
4. ⏳ Cross-promote with AgentKit ecosystem

---

**Contact**: tdnupe3 (GitHub)  
**Platform**: https://coinrailz.com  
**Documentation**: Available in repository
