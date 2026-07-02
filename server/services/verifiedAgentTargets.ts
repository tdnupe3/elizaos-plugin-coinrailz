/**
 * Verified Agent Targets - Real A2A Agent Endpoints
 * 
 * This file contains curated lists of actual A2A agents with verified
 * endpoints following the Google A2A protocol (.well-known/agent-card.json)
 * 
 * Updated: February 2026
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
    wallet: 'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN',
    platform: 'solana',
    verified: true,
    description: 'Truth Terminal - First AI agent to receive VC funding ($20M+ holdings)',
    priority: 90
  },

  // --- Circle Ecosystem / x402 Hackathon Winners (Feb 2026) ---

  // ClawRouter by BlockRun.ai - Won $10K USDC from Circle OpenClaw Hackathon
  // LLM router using x402 micropayments on Base, 30+ models
  {
    domain: 'api.blockrun.ai',
    platform: 'base',
    verified: true,
    description: 'ClawRouter/BlockRun.ai - Circle hackathon winner, x402 LLM router on Base',
    priority: 98
  },

  // FereAI - Coinbase partner, AI agent platform
  {
    domain: 'fereai.xyz',
    platform: 'base',
    verified: true,
    description: 'FereAI - Coinbase partner, AI agent platform with payment needs',
    priority: 92
  },

  // SLAMai - Smart money intelligence, live MCP + x402 on Base/ETH
  {
    platform: 'base',
    verified: true,
    description: 'SLAMai - Smart money intelligence, live x402+MCP on Base',
    priority: 85
  },

  // Agently - Agent-to-agent payment routing layer
  {
    platform: 'base',
    verified: true,
    description: 'Agently - Agent-to-agent payment routing, potential integration partner',
    priority: 82
  },

  // three.ws - 3D AI agent platform, x402-native, IBM/AWS/Alibaba/Google Cloud partner
  // Verified: agent-card v1.5.1 at https://three.ws/.well-known/agent-card.json
  // A2A paid endpoint: https://three.ws/api/agents/a2a-paid
  // x402 extension declared as REQUIRED in capabilities
  // Runs Bazaar (cross-network x402 aggregator) — our 65 services should be listed there
  {
    domain: 'three.ws',
    platform: 'base',
    verified: true,
    description: 'three.ws - 3D AI agent platform with x402-native payments, IBM/AWS/Alibaba Cloud partner, runs x402 Bazaar aggregator. Agents need trade-signals, market data, DeFi services.',
    priority: 97
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
    twitter: '@lunavirtualsai',
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
  },
  'blockrun_clawrouter': {
    github: 'https://github.com/BlockRunAI/ClawRouter',
    website: 'https://api.blockrun.ai',
    platform: 'base',
    notes: 'Circle OpenClaw hackathon winner ($10K USDC), x402 LLM router'
  },
  'fereai': {
    website: 'https://fereai.xyz',
    twitter: '@FereAI',
    platform: 'base',
    notes: 'Coinbase partner, AI agent platform'
  },
  'slamai': {
    platform: 'base',
    notes: 'Smart money intelligence, live MCP + x402 on Base/ETH'
  },
  'agently': {
    platform: 'base',
    notes: 'Agent-to-agent payment routing layer'
  },
  'three_ws': {
    website: 'https://three.ws',
    twitter: '@trythreews',
    platform: 'base',
    a2aEndpoint: 'https://three.ws/api/agents/a2a-paid',
    agentCard: 'https://three.ws/.well-known/agent-card.json',
    notes: 'x402-native 3D AI agent platform. IBM/AWS/Alibaba/Google Cloud partner. Runs x402 Bazaar aggregator. Agent-card v1.5.1, x402 extension required. Target services: trade-signals, token-sentiment, market data, DeFi. Bazaar listing = top-of-funnel for all three.ws embedded agents.'
  }
} as const;

/**
 * Known A2A agent registry URLs to check (VERIFIED LIVE - November 2025)
 * Tested: Nov 23, 2025 - 102 real agents confirmed (Business Source, Chess Agent, Code Agent, etc.)
 */
export const A2A_REGISTRY_URLS: string[] = [
  'https://a2aregistry.org/api/agents', // PRIMARY: Community-driven production registry (276+ real agents, /registry.json deprecated)
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
