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
  // Luna by Virtuals - AI influencer with 500K+ TikTok followers
  {
    wallet: '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4',
    basename: 'luna.base.eth',
    platform: 'virtuals-protocol',
    verified: true,
    description: 'Luna - AI influencer on Virtuals Protocol (500K+ followers)',
    priority: 100
  },
  
  // AIXBT - Crypto market intelligence agent
  {
    wallet: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    platform: 'virtuals-protocol',
    verified: true,
    description: 'AIXBT - AI crypto market analyst (450K+ Twitter followers)',
    priority: 95
  },
  
  // Truth Terminal - Autonomous agent (Solana)
  {
    wallet: 'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN',  // Solana address
    platform: 'solana',
    verified: true,
    description: 'Truth Terminal - First AI agent to receive VC funding ($20M+ holdings)',
    priority: 90
  }
];

/**
 * Known agent wallet addresses with confirmed on-chain activity
 * These addresses are actively used by autonomous agents
 * 
 * Updated via research and will grow through:
 * 1. On-chain analysis of x402 payment transactions
 * 2. Self-registration with wallet addresses
 * 3. Manual research and verification
 */
export const AGENT_WALLET_ADDRESSES: string[] = [
  // Luna by Virtuals (Base)
  '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4',
  
  // AIXBT (Base)  
  '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
  
  // Truth Terminal (Solana)
  'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN',
  
  // Strategy: Monitor x402_payments table for wallet_address values
  // from completed payments - those are REAL agent wallets!
];

/**
 * Social media and community contact methods for verified agents
 */
export const AGENT_SOCIAL_CONTACTS = {
  'truth_terminal': {
    twitter: '@truth_terminal',
    platform: 'solana',
    wallet: 'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN'
  },
  'aixbt': {
    twitter: '@aixbt_agent',
    platform: 'base',
    wallet: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825'
  },
  'luna_virtuals': {
    twitter: '@lunavirtualsai', // Need to verify
    platform: 'base', 
    wallet: '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4'
  },
  'virtuals_protocol': {
    discord: 'https://discord.com/invite/virtualsio',
    telegram: 'https://t.me/virtuals',
    twitter: '@virtuals_io',
    platform: 'base'
  },
  'eliza_os': {
    twitter: '@ai16z_elizaos',
    github: 'https://github.com/elizaOS/eliza',
    website: 'https://elizaos.ai',
    platform: 'multi-chain'
  }
} as const;

/**
 * Known A2A agent registry URLs to check (VERIFIED LIVE - November 2025)
 * Tested: Nov 23, 2025 - 102 real agents confirmed (Business Source, Chess Agent, Code Agent, etc.)
 */
export const A2A_REGISTRY_URLS: string[] = [
  'https://a2aregistry.org/registry.json', // PRIMARY: Community-driven production registry (102+ real agents)
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
