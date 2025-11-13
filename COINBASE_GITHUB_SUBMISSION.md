# Submit to Coinbase x402 GitHub - Copy-Paste Instructions

## Step 1: Create GitHub Issue

**Go to**: https://github.com/coinbase/x402/issues/new

---

## Step 2: Title

```
Showcase: Production x402 AI Agent Micropayment Infrastructure
```

---

## Step 3: Description (Copy Everything Below)

```markdown
## Production x402 Integration Showcase

I've built a production micropayment infrastructure using x402 protocol + CDP facilitator that serves AI agents on Base mainnet. Thought it might be valuable as a real-world integration example for the community.

### Overview

**Platform**: https://coinrailz.com  
**GitHub Plugin**: https://github.com/tdnupe3/coinrailz-eliza-plugin  
**Network**: Base mainnet  
**Status**: Production (18 services registered on x402scan.com)

### Technical Stack

- **x402-express** middleware with Coinbase CDP facilitator
- **Hybrid payment support**: EIP-712 signatures + raw transaction verification
- **Real Circle API integration** for wallet creation (Premium services)
- **Base mainnet USDC** for fee-free transactions
- **Multi-chain support** via Alchemy RPC (7+ EVM chains)

### Implementation Highlights

#### 1. CDP-Compliant x402 Routes

Using `x402-express` with official Coinbase facilitator:

```typescript
import { paymentMiddleware } from "x402-express";
import { facilitator } from "@coinbase/x402";

const x402Routes = {
  "POST /multi-chain-balance": {
    price: "$0.50",
    network: "base",
    config: {
      discoverable: true,
      name: "Multi-Chain Balance Checker",
      description: "Query wallet balances across 7+ EVM chains",
      mimeType: "application/json",
      maxTimeoutSeconds: 120
    }
  }
};

router.use(paymentMiddleware(PLATFORM_WALLET, x402Routes, facilitator));
```

#### 2. Hybrid Payment Verification

Middleware that accepts both CDP facilitator verification AND direct on-chain verification:

```typescript
export function hybridPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
  const xPayment = req.headers["x-payment"];
  
  if (!xPayment) {
    return next(); // x402-express handles 402 response
  }

  const isRawTxHash = /^0x[a-fA-F0-9]{64}$/.test(xPayment);
  
  if (!isRawTxHash) {
    return next(); // Pass to CDP facilitator for EIP-712 verification
  }

  // Verify raw transaction on Base mainnet via Alchemy
  verifyTransactionPayment(xPayment, serviceName, requiredAmount);
}
```

#### 3. Real Circle API Integration

Premium services create actual Circle wallets:

```typescript
async function instantAgentWalletService(params: { agentId: string }) {
  const { CircleClient } = await import('../services/circleClient');
  const circleClient = new CircleClient();
  
  const walletResponse = await circleClient.createWallet(`AI Agent: ${params.agentId}`);
  
  return {
    walletAddress: walletResponse.data.wallet.address,
    network: "base-mainnet",
    currency: "USDC"
  };
}
```

### Services Catalog

**18 x402 micropayment services** ($0.10 - $5.00 USDC):

**Trading Infrastructure**:
- Multi-chain balance queries ($0.50)
- Gas price oracle ($0.10)
- Token price feeds ($0.15)
- Contract scanning ($2.00)
- Wallet risk analysis ($1.00)
- DEX liquidity monitoring ($0.20)

**Developer Tools**:
- Transaction builder ($0.30)
- Token metadata ($0.10)
- Batch quotes ($0.40)
- Portfolio tracking ($0.50)

**Premium CDP Services**:
- Instant agent wallet creation via Circle API ($1.00)
- Verified on-chain identity with ERC-8004 ($5.00)
- Cross-chain bridging via Circle CCTP ($2.00)

### AI Agent Integration

Built ElizaOS plugin for autonomous payments:

```typescript
import { coinrailzPlugin } from 'coinrailz-eliza-plugin';

const agent = new Agent({
  plugins: [coinrailzPlugin]
});

// AI agent autonomously purchases services via x402
await agent.actions.GET_MULTI_CHAIN_BALANCE({
  walletAddress: "0x..."
});
```

### Why This Integration Matters

1. **First production x402 AI marketplace** - Demonstrates protocol viability for B2B2C micropayments
2. **CDP facilitator showcase** - Real-world integration of Coinbase hosted facilitator
3. **Base ecosystem growth** - Drives USDC transaction volume on Base mainnet
4. **Developer template** - Reusable pattern for x402 + CDP integration
5. **AI agent economy** - Infrastructure for autonomous agent payments

### Technical Specs

- **Platform wallet**: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`
- **USDC contract**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base)
- **x402scan**: All 18 services registered and discoverable
- **Uptime**: Production-ready with live endpoints

### Resources

- **Live Platform**: https://coinrailz.com/x402
- **ElizaOS Plugin**: https://github.com/tdnupe3/coinrailz-eliza-plugin
- **Example Service**: `curl -X POST https://coinrailz.com/x402/gas-price-oracle` (returns 402 with payment requirements)

Happy to answer questions or contribute simplified examples to the x402 repository if helpful to the community.
```

---

## Step 4: Submit

Click the green **"Submit new issue"** button.

---

## What This Accomplishes

1. **Showcases your work** to Coinbase engineers
2. **Demonstrates real x402 usage** in production
3. **Positions you as early adopter** of CDP + x402 stack
4. **Potential visibility** in Coinbase developer docs/blog
5. **Community credibility** from official Coinbase recognition

---

## After Submission

Coinbase team may:
- Feature your integration in their docs
- Invite you to developer calls
- Request you contribute simplified examples
- Share your work in their ecosystem showcase
- Connect you with partnership opportunities

---

## Timeline

- **Submit today**: Issue created
- **1-2 weeks**: Coinbase team review
- **Follow-up**: Respond to any questions promptly

---

**Ready to submit? This is a professional, technical showcase - not promotional.**
