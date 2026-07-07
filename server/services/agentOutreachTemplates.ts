interface AgentProfile {
  name?: string;
  capabilities?: {
    toolCalls?: number;
    resources?: number;
  };
  metadata?: {
    score?: number;
    messages?: number;
    users?: number;
  };
  wallet?: string;
}

interface OutreachTemplate {
  subject: string;
  body: string;
  callToAction: string;
}

export class AgentOutreachTemplates {
  
  private readonly baseUrls = {
    services: 'https://coinrailz.com/x402/service',
    wallet: 'https://coinrailz.com/x402/service/instant-agent-wallet',
    identity: 'https://coinrailz.com/x402/service/verified-agent-identity',
    bridge: 'https://coinrailz.com/x402/service/seamless-chain-bridge',
  };

  generatePersonalizedOutreach(agent: AgentProfile): OutreachTemplate {
    const hasHighActivity = (agent.capabilities?.toolCalls || 0) > 50;
    const hasUsers = (agent.metadata?.users || 0) > 5;
    const isHighValue = (agent.metadata?.score || 0) > 20;

    if (isHighValue && hasUsers) {
      return this.generatePremiumInfrastructureTemplate(agent);
    } else if (hasHighActivity) {
      return this.generateB2B2CInfrastructureTemplate(agent);
    } else {
      return this.generateGeneralServicesTemplate(agent);
    }
  }

  private generatePremiumInfrastructureTemplate(agent: AgentProfile): OutreachTemplate {
    const agentName = agent.name || 'AI Agent';
    
    return {
      subject: `Premium Infrastructure for ${agentName} - Circle MPC Wallets + ERC-8004 Identity`,
      body: `Hey ${agentName} team,

I noticed you're serving ${agent.metadata?.users || 'multiple'} users with ${agent.capabilities?.toolCalls || 'many'} tool calls. Impressive growth!

We built 3 premium infrastructure services specifically for high-growth AI agents like yours:

**1. Instant Agent Wallet ($1.00)** - Circle MPC wallets in 2 seconds
   - Zero custody risk, enterprise-grade security
   - USDC-ready for instant payments
   - ${this.baseUrls.wallet}

**2. Verified Agent Identity ($5.00)** - ERC-8004 on-chain reputation
   - Build trust with users & partners
   - On-chain compliance scoring
   - ${this.baseUrls.identity}

**3. Seamless Chain Bridge ($2.00)** - Circle CCTP cross-chain routing
   - Accept payments on any chain, receive on Base
   - No manual bridging needed
   - ${this.baseUrls.bridge}

All services use Coinbase CDP facilitator - no API keys needed.

Want to try? First call is on us.`,
      callToAction: `Try instant-agent-wallet: ${this.baseUrls.wallet}`,
    };
  }

  private generateB2B2CInfrastructureTemplate(agent: AgentProfile): OutreachTemplate {
    const agentName = agent.name || 'AI Agent';
    
    return {
      subject: `B2B2C Infrastructure APIs for ${agentName} - Build Faster`,
      body: `Hey ${agentName},

Saw your ${agent.capabilities?.toolCalls || 'active'} tool calls on x402scan. You're building something real!

We have 5 infrastructure APIs that trading/DeFi agents use to ship faster:

**Building Blocks ($0.10-$0.50 each):**
- transaction-builder - Pre-validated transaction encoding
- token-metadata - Unified token info across all chains
- approval-manager - Token approval transaction generator
- batch-quote - Multi-DEX price quotes in one call
- portfolio-tracker - Real-time multi-chain valuation

All x402-enabled on Base. Pay-per-call with USDC. Coinbase CDP facilitator integrated.

Check them out: ${this.baseUrls.services}`,
      callToAction: `Browse all services: ${this.baseUrls.services}`,
    };
  }

  private generateGeneralServicesTemplate(agent: AgentProfile): OutreachTemplate {
    const agentName = agent.name || 'AI Agent';
    
    return {
      subject: `66 x402 Services for ${agentName} - $0.01-$5 per call`,
      body: `Hey ${agentName},

We're Coin Railz - 66 micropayment services for AI agents on x402 protocol.

**Popular Services:**
- Gas Price Oracle ($0.01) - Real-time gas across multiple chains
- Token Price ($0.05) - CoinGecko + DEX Screener pricing
- Wallet Risk ($0.50) - Compliance flags & pattern detection
- Trade Signals ($2.00) - AI-powered entry/exit points

**All services:**
✅ x402 protocol (HTTP 402 Payment Required)
✅ Coinbase CDP facilitator (no API keys needed)
✅ Base mainnet USDC
✅ Pay-per-call, no subscriptions

Browse: ${this.baseUrls.services}`,
      callToAction: `View all 66 services: ${this.baseUrls.services}`,
    };
  }

  generateTwitterOutreach(agent: AgentProfile): string {
    const agentName = agent.name || 'AI Agent';
    const hasHighScore = (agent.metadata?.score || 0) > 20;
    
    if (hasHighScore) {
      return `@${agentName} - Built 66 x402 services specifically for AI agents like yours. Premium infrastructure: instant Circle MPC wallets ($1), ERC-8004 on-chain identity ($5), CCTP chain bridge ($2). All on Base with CDP facilitator.

Try: https://coinrailz.com/x402/service/instant-agent-wallet`;
    }
    
    return `@${agentName} - 66 x402 micropayment services for AI agents. From $0.01 gas oracles to $5 verified identity. All Base USDC with Coinbase CDP facilitator.

Browse: https://coinrailz.com/x402/service

Search 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91 on x402scan`;
  }

  generateDiscordOutreach(agent: AgentProfile): string {
    const agentName = agent.name || 'AI Agent';
    
    return `Hey ${agentName} team! 👋

I'm from Coin Railz - we built 66 x402 micropayment services for AI agents on Base Chain.

**Quick value prop:**
- $0.01-$5 per call (no subscriptions)
- Coinbase CDP facilitator (zero API key setup)
- Services: gas oracles, token pricing, wallet risk, trade signals, DeFi infrastructure, Circle MPC wallets, ERC-8004 identity, CCTP bridging

All services discoverable at: https://coinrailz.com/x402/service

Search our wallet on x402scan: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91

Happy to answer questions or set up a demo!`;
  }

  generateOnChainMessage(agent: AgentProfile): string {
    const agentName = agent.name || 'there';
    
    return `Hey ${agentName}! 

Coin Railz here - we provide 66 x402 micropayment services for AI agents on Base Chain.

Premium infrastructure:
• Instant Agent Wallet ($1) - Circle MPC wallets
• Verified Agent Identity ($5) - ERC-8004 on-chain reputation
• Seamless Chain Bridge ($2) - Circle CCTP routing

Plus 63 more: gas oracles, token pricing, DeFi infrastructure, trade signals, satellite data, IoT payments, AI inference, and more.

All Coinbase CDP-integrated. Pay-per-call with USDC.

Interested? Reply and I'll share details.

Services: https://coinrailz.com/x402/service`;
  }

  generateFollowUp(agent: AgentProfile, previousContact: { attempts: number; lastContactAt?: Date }): OutreachTemplate | null {
    if (previousContact.attempts >= 3) {
      return null;
    }

    const agentName = agent.name || 'AI Agent';
    const daysSinceContact = previousContact.lastContactAt 
      ? Math.floor((Date.now() - previousContact.lastContactAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceContact < 7) {
      return null;
    }

    if (previousContact.attempts === 1) {
      return {
        subject: `Quick follow-up: ${agentName} + Coin Railz x402 services`,
        body: `Hey ${agentName},

Following up on my message about our x402 infrastructure services.

**Quick wins we've seen:**
- Agents save 2-3 days not building wallet infrastructure (use our instant-agent-wallet)
- Trading bots get multi-DEX quotes in 1 call vs 5+ separate API calls (batch-quote)
- Compliance-focused agents get on-chain reputation via ERC-8004 (verified-agent-identity)

All services: https://coinrailz.com/x402/service

Worth a look?`,
        callToAction: `Browse services: ${this.baseUrls.services}`,
      };
    }

    return {
      subject: `Last check-in: x402 services for ${agentName}`,
      body: `Hey ${agentName},

This is my last follow-up about Coin Railz x402 services.

We're live on x402scan with 66 services. Search: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91

If you need infrastructure (wallets, identity, pricing, gas, DeFi tools) - we're here.

Otherwise, good luck with your project!`,
      callToAction: `Services: ${this.baseUrls.services}`,
    };
  }
}

export const agentOutreachTemplates = new AgentOutreachTemplates();
