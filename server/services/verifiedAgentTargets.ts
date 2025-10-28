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
 * 
 * CRITICAL: Only add agents here with VERIFIED contact information.
 * No guesses, no theoretical endpoints. Real agents only.
 * 
 * Populate via:
 * 1. Web research with confirmed wallet addresses
 * 2. Self-registration via /api/agents/self-register
 * 3. x402 payment tracking (agents who pay us)
 * 4. Manual verification of A2A agent cards
 */
export const VERIFIED_AGENT_TARGETS: VerifiedAgentTarget[] = [
  // Real agents will be added here after research and verification
  // Format:
  // {
  //   domain: 'verified-agent.com',  // OR
  //   wallet: '0x123...',             // Ethereum wallet address
  //   platform: 'platform-name',
  //   verified: true,                 // Must be verified before adding
  //   description: 'Actual agent description',
  //   priority: 100
  // }
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
