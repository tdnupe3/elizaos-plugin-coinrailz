/**
 * Add High-Value Crypto AI Agent Targets
 * 
 * Manually add known high-value AI agent operators to discovered_agents
 * with their social/contact information for targeted outreach.
 */

import { db } from '../db';
import { discoveredAgents } from '@shared/schema';

const HIGH_VALUE_TARGETS = [
  {
    url: 'https://twitter.com/truth_terminal',
    source: 'manual-high-value',
    xmtpStatus: 'not_checked' as const,
    xmtpQualityScore: 100,
    agentCardData: {
      name: 'Truth Terminal',
      description: '$1M+ revenue AI agent - autonomous crypto trading',
      contact: {
        twitter: '@truth_terminal',
        telegram: 'truth_terminal_bot'
      },
      capabilities: ['crypto-trading', 'autonomous-revenue', 'viral-content']
    },
    channels: {
      twitter: 'https://twitter.com/truth_terminal'
    },
    notes: 'Priority target: $1M+ revenue AI agent, autonomous operations'
  },
  {
    url: 'https://github.com/ai16z/eliza',
    source: 'manual-high-value',
    xmtpStatus: 'not_checked' as const,
    xmtpQualityScore: 100,
    agentCardData: {
      name: 'ai16z ElizaOS',
      description: '$1.4B platform - Shaw Walters AI agent framework',
      contact: {
        twitter: '@shawmakesmagic',
        github: 'ai16z',
        discord: 'ai16z Discord'
      },
      capabilities: ['agent-framework', 'platform', 'high-revenue']
    },
    channels: {
      github: 'https://github.com/ai16z/eliza',
      twitter: 'https://twitter.com/shawmakesmagic'
    },
    notes: 'Priority target: $1.4B platform operator Shaw Walters'
  },
  {
    url: 'https://twitter.com/luna_virtuals',
    source: 'manual-high-value',
    xmtpStatus: 'not_checked' as const,
    xmtpQualityScore: 100,
    agentCardData: {
      name: 'Luna (Virtuals Protocol)',
      description: '$365K/year AI influencer - autonomous content & revenue',
      contact: {
        twitter: '@luna_virtuals'
      },
      capabilities: ['ai-influencer', 'content-generation', 'revenue-generation']
    },
    channels: {
      twitter: 'https://twitter.com/luna_virtuals'
    },
    notes: 'Priority target: $365K/year AI influencer on Virtuals Protocol'
  },
  {
    url: 'https://twitter.com/fereAI_',
    source: 'manual-high-value',
    xmtpStatus: 'not_checked' as const,
    xmtpQualityScore: 100,
    agentCardData: {
      name: 'FereAI',
      description: 'Coinbase partner - enterprise AI agent platform',
      contact: {
        twitter: '@fereAI_'
      },
      capabilities: ['enterprise', 'coinbase-partner', 'platform']
    },
    channels: {
      twitter: 'https://twitter.com/fereAI_'
    },
    notes: 'Priority target: Coinbase partner, enterprise AI platform'
  }
];

async function addHighValueTargets() {
  console.log('🎯 Adding high-value crypto AI agent targets...');
  
  for (const target of HIGH_VALUE_TARGETS) {
    try {
      // Check if target already exists
      const existing = await db.query.discoveredAgents.findFirst({
        where: (agents, { eq }) => eq(agents.url, target.url)
      });

      if (existing) {
        console.log(`⚠️ Target already exists: ${target.agentCardData.name}`);
        continue;
      }

      // Insert new target
      await db.insert(discoveredAgents).values({
        ...target,
        agentCardData: target.agentCardData
      });

      console.log(`✅ Added: ${target.agentCardData.name} (${target.url})`);
    } catch (error) {
      console.error(`❌ Failed to add ${target.agentCardData.name}:`, error);
    }
  }

  console.log('✅ High-value target addition complete!');
  process.exit(0);
}

addHighValueTargets().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
