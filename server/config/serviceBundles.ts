export interface ServiceBundle {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  pricingTiers: {
    starter: { monthlyUsd: number; creditsPerMonth: number };
    professional: { monthlyUsd: number; creditsPerMonth: number };
    enterprise: { monthlyUsd: number; creditsPerMonth: number };
  };
  includedServices: string[];
  useCases: string[];
  outcomePromise: string;
}

export const SERVICE_BUNDLES: ServiceBundle[] = [
  {
    id: "trading-intelligence",
    name: "Trading Intelligence Suite",
    description: "Real-time market data, gas optimization, whale tracking, and multi-chain portfolio analytics for autonomous trading agents",
    targetAudience: "Market-making bots, signal bots, DeFi trading agents, arbitrage algorithms",
    pricingTiers: {
      starter: { monthlyUsd: 39, creditsPerMonth: 200 },
      professional: { monthlyUsd: 99, creditsPerMonth: 600 },
      enterprise: { monthlyUsd: 199, creditsPerMonth: 1500 }
    },
    includedServices: [
      "gas-price-oracle",
      "token-price",
      "trending-tokens",
      "whale-alerts",
      "dex-liquidity",
      "portfolio-tracker",
      "multi-chain-balance",
      "transaction-builder",
      "trade-signals"
    ],
    useCases: [
      "Monitor gas prices across 7 chains to optimize transaction timing",
      "Track whale wallet movements for alpha signals",
      "Discover trending tokens before they pump",
      "Monitor DEX liquidity depth for slippage-free execution",
      "Build and simulate multi-chain transactions",
      "Track portfolio performance across all positions"
    ],
    outcomePromise: "Real-time trading signals and execution intelligence for autonomous agents"
  },
  {
    id: "security-compliance",
    name: "Smart Contract Security & Compliance Pack",
    description: "AI-powered contract auditing, wallet risk scoring, AML compliance, and approval management for DevOps and security-focused agents",
    targetAudience: "DevOps agents, auditing agents, compliance bots, security researchers",
    pricingTiers: {
      starter: { monthlyUsd: 99, creditsPerMonth: 500 },
      professional: { monthlyUsd: 249, creditsPerMonth: 1500 },
      enterprise: { monthlyUsd: 499, creditsPerMonth: 3500 }
    },
    includedServices: [
      "contract-scan",
      "wallet-risk",
      "approval-manager",
      "token-metadata",
      "smart-contract-audit",
      "compliance-consultation"
    ],
    useCases: [
      "Scan contracts for honeypots, reentrancy, and known vulnerabilities",
      "Risk-score wallets before interacting (scam detection)",
      "Audit token approvals to prevent unlimited spend exploits",
      "Verify token metadata and social links for legitimacy",
      "Get AI-powered compliance guidance for regulatory requirements",
      "Deep contract audits using Slither static analysis"
    ],
    outcomePromise: "Autonomous contract risk scoring and compliance validation for secure operations"
  },
  {
    id: "payments-execution",
    name: "FinTech Payments & Execution Suite",
    description: "Multi-chain USDC routing, DEX aggregation, instant wallet provisioning, and agent identity management for payment automation",
    targetAudience: "Payment agents, automation agents, settlement bots, cross-chain bridge operators",
    pricingTiers: {
      starter: { monthlyUsd: 49, creditsPerMonth: 250 },
      professional: { monthlyUsd: 99, creditsPerMonth: 650 },
      enterprise: { monthlyUsd: 199, creditsPerMonth: 1600 }
    },
    includedServices: [
      "batch-quote",
      "seamless-chain-bridge",
      "instant-agent-wallet",
      "verified-agent-identity",
      "token-sentiment",
      "payment-processing"
    ],
    useCases: [
      "Get best DEX quotes across 7 chains in a single call",
      "Bridge assets seamlessly between chains with auto-routing",
      "Provision CDP wallets instantly for new agents",
      "Issue ERC-8004 blockchain identities for agents",
      "Monitor token sentiment before executing large buys",
      "Process Stripe/PayPal payments with crypto settlement"
    ],
    outcomePromise: "Automated multi-chain payments and execution infrastructure for agent economies"
  }
];

// Mapping of service endpoint slugs to bundle IDs
export const SERVICE_TO_BUNDLES: Record<string, string[]> = {
  "gas-price-oracle": ["trading-intelligence"],
  "token-price": ["trading-intelligence"],
  "trending-tokens": ["trading-intelligence"],
  "whale-alerts": ["trading-intelligence"],
  "dex-liquidity": ["trading-intelligence"],
  "portfolio-tracker": ["trading-intelligence"],
  "multi-chain-balance": ["trading-intelligence"],
  "transaction-builder": ["trading-intelligence"],
  "trade-signals": ["trading-intelligence"],
  
  "contract-scan": ["security-compliance"],
  "wallet-risk": ["security-compliance"],
  "approval-manager": ["security-compliance"],
  "token-metadata": ["security-compliance"],
  "smart-contract-audit": ["security-compliance"],
  "compliance-consultation": ["security-compliance"],
  
  "batch-quote": ["payments-execution"],
  "seamless-chain-bridge": ["payments-execution"],
  "instant-agent-wallet": ["payments-execution"],
  "verified-agent-identity": ["payments-execution"],
  "token-sentiment": ["payments-execution"],
  "payment-processing": ["payments-execution"]
};

// Helper: Get bundles for a specific service
export function getBundlesForService(serviceSlug: string): ServiceBundle[] {
  const bundleIds = SERVICE_TO_BUNDLES[serviceSlug] || [];
  return SERVICE_BUNDLES.filter(bundle => bundleIds.includes(bundle.id));
}

// Helper: Get all services in a bundle
export function getServicesInBundle(bundleId: string): string[] {
  const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
  return bundle?.includedServices || [];
}

// Helper: Calculate bundle savings vs individual pricing
export function calculateBundleSavings(bundleId: string, tier: 'starter' | 'professional' | 'enterprise'): { 
  bundlePrice: number; 
  individualPrice: number; 
  savings: number;
  savingsPercent: number;
} {
  const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
  if (!bundle) return { bundlePrice: 0, individualPrice: 0, savings: 0, savingsPercent: 0 };

  const bundlePrice = bundle.pricingTiers[tier].monthlyUsd;
  const creditsInBundle = bundle.pricingTiers[tier].creditsPerMonth;
  
  // Individual x402 services cost $0.05-$0.50 per call (average $0.25)
  // At $0.25/call, bundles provide significant discounts
  const avgIndividualCostPerCall = 0.25;
  const individualPrice = creditsInBundle * avgIndividualCostPerCall;
  
  const savings = individualPrice - bundlePrice;
  const savingsPercent = Math.max(0, Math.round((savings / individualPrice) * 100));

  return { bundlePrice, individualPrice, savings, savingsPercent };
}
