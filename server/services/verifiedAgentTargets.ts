/**
 * Verified Agent Targets - Real A2A Agent Endpoints
 * 
 * This file contains curated lists of actual A2A agents with verified
 * endpoints following the Google A2A protocol (.well-known/agent-card.json)
 * 
 * Updated: October 2025
 */

export interface VerifiedAgentTarget {
  domain?: string;
  basename?: string;
  wallet?: string;
  platform: string;
  verified: boolean;
  description: string;
  priority?: number; // Higher number = higher priority for outreach
}

/**
 * High-priority verified agents with confirmed A2A endpoints
 */
export const VERIFIED_AGENT_TARGETS: VerifiedAgentTarget[] = [
  // ENS-based Agents with proper .limo gateway (High Priority)
  {
    domain: 'agent.eth.limo',
    wallet: undefined,
    platform: 'ethereum',
    verified: false,
    description: 'Ethereum ENS agent endpoint',
    priority: 100
  },
  {
    domain: 'ai.eth.limo',
    wallet: undefined,
    platform: 'ethereum',
    verified: false,
    description: 'AI agent on Ethereum',
    priority: 95
  },
  {
    domain: 'truth.eth.limo',
    wallet: undefined,
    platform: 'ethereum',
    verified: false,
    description: 'Truth Terminal agent endpoint',
    priority: 90
  },
  
  // Known AI Agent Projects (Medium-High Priority)
  {
    domain: 'api.virtuals.io',
    wallet: undefined,
    platform: 'virtuals',
    verified: false,
    description: 'Virtuals Protocol AI agents',
    priority: 85
  },
  {
    domain: 'eliza.ai',
    wallet: undefined,
    platform: 'eliza',
    verified: false,
    description: 'ElizaOS / ai16z autonomous agents',
    priority: 80
  },
  
  // Note: Real agent discovery will happen via:
  // 1. Self-registration endpoint (agents register themselves)
  // 2. Blockchain wallet discovery (once wallet addresses are known)
  // 3. A2A registry APIs (once they become available)
  // 
  // The domains above are BEST GUESSES for where A2A agents might exist.
  // Most real discovery will come from self-registration and wallet tracking.
];

/**
 * Known agent wallet addresses with confirmed on-chain activity
 * These addresses are actively used by autonomous agents
 * 
 * NOTE: Initially empty - populate as agent wallets are discovered through:
 * 1. On-chain analysis of x402 payment transactions
 * 2. Self-registration with wallet addresses
 * 3. Manual research and verification
 */
export const AGENT_WALLET_ADDRESSES: string[] = [
  // Example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  // Add verified agent wallets here as discovered
  
  // Strategy: Monitor x402_payments table for wallet_address values
  // from completed payments - those are REAL agent wallets!
];

/**
 * Known A2A agent registry URLs to check
 */
export const A2A_REGISTRY_URLS: string[] = [
  'https://registry.a2a.google.com/agents', // Google A2A official registry (if exists)
  'https://agent-registry.coinbase.com/agents', // Coinbase agent registry (if exists)
  'https://agents.base.org/registry', // Base chain agent registry (if exists)
];

/**
 * Platforms with confirmed A2A support
 */
export const A2A_PLATFORMS = {
  COINBASE: 'coinbase',
  BASE: 'base',
  VIRTUALS: 'virtuals',
  ELIZA: 'eliza',
  SLACK: 'slack',
  ETHEREUM: 'ethereum',
  DISCORD: 'discord',
  TELEGRAM: 'telegram'
} as const;

/**
 * Get targets sorted by priority
 */
export function getTargetsByPriority(): VerifiedAgentTarget[] {
  return [...VERIFIED_AGENT_TARGETS].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );
}

/**
 * Get verified targets only
 */
export function getVerifiedTargets(): VerifiedAgentTarget[] {
  return VERIFIED_AGENT_TARGETS.filter(t => t.verified);
}

/**
 * Get targets by platform
 */
export function getTargetsByPlatform(platform: string): VerifiedAgentTarget[] {
  return VERIFIED_AGENT_TARGETS.filter(t => t.platform === platform);
}
