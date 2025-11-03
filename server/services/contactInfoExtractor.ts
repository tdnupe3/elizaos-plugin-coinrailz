import { db } from '../db';
import { sql } from 'drizzle-orm';
import axios from 'axios';

interface ContactInfo {
  agentId: number;
  twitter?: string;
  discord?: string;
  telegram?: string;
  wallet?: string;
  email?: string;
  website?: string;
}

export class ContactInfoExtractor {
  
  async extractFromA2AAgentCards(): Promise<{ updated: number; found: ContactInfo[] }> {
    console.log('🔍 Extracting contact info from A2A agent cards...');
    
    // Get all A2A discovered agents
    const result = await db.execute(sql`
      SELECT id, url, metadata, channels
      FROM discovered_agents
      WHERE source = 'a2a-public-registry'
        AND url IS NOT NULL
    `);

    const agents = result.rows as any[];
    const contactInfo: ContactInfo[] = [];
    let updated = 0;

    for (const agent of agents) {
      try {
        const extracted = await this.extractFromAgentCard(agent.url, agent.id);
        if (extracted) {
          contactInfo.push(extracted);
          
          // Update database
          await this.updateAgentContactInfo(agent.id, extracted);
          updated++;
        }
      } catch (error: any) {
        console.log(`⚠️  Failed to extract from ${agent.url}: ${error.message}`);
      }
    }

    console.log(`✅ Extracted contact info for ${updated}/${agents.length} A2A agents`);
    return { updated, found: contactInfo };
  }

  private async extractFromAgentCard(url: string, agentId: number): Promise<ContactInfo | null> {
    // Try both v0.3 and v0.2 paths
    const paths = [
      `${url}/.well-known/agent-card.json`,
      `${url}/.well-known/ai-plugin.json`,
    ];

    for (const cardUrl of paths) {
      try {
        const response = await axios.get(cardUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'CoinRailz/1.0 (x402 Payment Infrastructure)',
          },
        });

        const card = response.data;
        const info: ContactInfo = { agentId };

        // Extract from various fields
        if (card.contact) {
          if (card.contact.twitter) info.twitter = this.cleanTwitterHandle(card.contact.twitter);
          if (card.contact.discord) info.discord = card.contact.discord;
          if (card.contact.telegram) info.telegram = card.contact.telegram;
          if (card.contact.email) info.email = card.contact.email;
        }

        if (card.owner) {
          if (card.owner.twitter) info.twitter = this.cleanTwitterHandle(card.owner.twitter);
          if (card.owner.discord) info.discord = card.owner.discord;
          if (card.owner.wallet) info.wallet = card.owner.wallet;
        }

        if (card.social) {
          if (card.social.twitter) info.twitter = this.cleanTwitterHandle(card.social.twitter);
          if (card.social.discord) info.discord = card.social.discord;
        }

        // Extract wallet from agent_id or metadata
        if (card.agent_id && card.agent_id.startsWith('0x')) {
          info.wallet = card.agent_id;
        }

        if (card.metadata?.wallet) {
          info.wallet = card.metadata.wallet;
        }

        // Check if we found anything useful
        if (info.twitter || info.discord || info.telegram || info.wallet || info.email) {
          console.log(`✅ Found contact for ${url}: ${JSON.stringify(info)}`);
          return info;
        }
      } catch (error: any) {
        // Try next path
        continue;
      }
    }

    return null;
  }

  async extractFromERC8004OnChain(): Promise<{ updated: number; found: ContactInfo[] }> {
    console.log('🔍 Extracting wallet addresses from ERC-8004 on-chain data...');
    
    const result = await db.execute(sql`
      SELECT id, url, wallet
      FROM discovered_agents
      WHERE source = 'erc8004'
        AND wallet IS NOT NULL
    `);

    const agents = result.rows as any[];
    const contactInfo: ContactInfo[] = [];

    for (const agent of agents) {
      contactInfo.push({
        agentId: agent.id,
        wallet: agent.wallet,
      });
    }

    console.log(`✅ Found ${contactInfo.length} ERC-8004 agents with wallets`);
    return { updated: contactInfo.length, found: contactInfo };
  }

  async extractFromMetadata(): Promise<{ updated: number; found: ContactInfo[] }> {
    console.log('🔍 Extracting contact info from agent metadata...');
    
    const result = await db.execute(sql`
      SELECT id, url, metadata, channels
      FROM discovered_agents
      WHERE metadata IS NOT NULL OR channels IS NOT NULL
    `);

    const agents = result.rows as any[];
    const contactInfo: ContactInfo[] = [];
    let updated = 0;

    for (const agent of agents) {
      const info: ContactInfo = { agentId: agent.id };
      let found = false;

      // Check metadata
      if (agent.metadata) {
        if (agent.metadata.twitter) {
          info.twitter = this.cleanTwitterHandle(agent.metadata.twitter);
          found = true;
        }
        if (agent.metadata.discord) {
          info.discord = agent.metadata.discord;
          found = true;
        }
        if (agent.metadata.wallet) {
          info.wallet = agent.metadata.wallet;
          found = true;
        }
        if (agent.metadata.email) {
          info.email = agent.metadata.email;
          found = true;
        }
      }

      // Check channels
      if (agent.channels) {
        if (agent.channels.twitter) {
          info.twitter = this.cleanTwitterHandle(agent.channels.twitter);
          found = true;
        }
        if (agent.channels.discord) {
          info.discord = agent.channels.discord;
          found = true;
        }
      }

      if (found) {
        contactInfo.push(info);
        await this.updateAgentContactInfo(agent.id, info);
        updated++;
      }
    }

    console.log(`✅ Extracted contact info from ${updated} agents' metadata`);
    return { updated, found: contactInfo };
  }

  async extractFromURLPatterns(): Promise<{ updated: number; found: ContactInfo[] }> {
    console.log('🔍 Extracting contact info from URL patterns...');
    
    const result = await db.execute(sql`
      SELECT id, url
      FROM discovered_agents
      WHERE url IS NOT NULL
    `);

    const agents = result.rows as any[];
    const contactInfo: ContactInfo[] = [];
    let updated = 0;

    for (const agent of agents) {
      const info: ContactInfo = { agentId: agent.id };
      let found = false;

      // Extract Twitter from URL patterns
      const twitterMatch = agent.url.match(/twitter\.com\/([A-Za-z0-9_]+)/);
      if (twitterMatch) {
        info.twitter = twitterMatch[1];
        found = true;
      }

      // Extract wallet from URL
      const walletMatch = agent.url.match(/(0x[a-fA-F0-9]{40})/);
      if (walletMatch) {
        info.wallet = walletMatch[1];
        found = true;
      }

      if (found) {
        contactInfo.push(info);
        await this.updateAgentContactInfo(agent.id, info);
        updated++;
      }
    }

    console.log(`✅ Extracted contact info from ${updated} URL patterns`);
    return { updated, found: contactInfo };
  }

  async runFullExtraction(): Promise<{
    totalUpdated: number;
    bySource: {
      a2a: number;
      erc8004: number;
      metadata: number;
      urlPatterns: number;
    };
  }> {
    console.log('🚀 Running full contact info extraction...');

    const [a2a, erc8004, metadata, urlPatterns] = await Promise.all([
      this.extractFromA2AAgentCards(),
      this.extractFromERC8004OnChain(),
      this.extractFromMetadata(),
      this.extractFromURLPatterns(),
    ]);

    const totalUpdated = a2a.updated + erc8004.updated + metadata.updated + urlPatterns.updated;

    console.log(`✅ Full extraction complete: ${totalUpdated} agents updated`);
    return {
      totalUpdated,
      bySource: {
        a2a: a2a.updated,
        erc8004: erc8004.updated,
        metadata: metadata.updated,
        urlPatterns: urlPatterns.updated,
      },
    };
  }

  private cleanTwitterHandle(handle: string): string {
    // Remove @ symbol and URL prefixes
    return handle
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?twitter\.com\//, '')
      .replace(/^https?:\/\/(www\.)?x\.com\//, '')
      .trim();
  }

  private async updateAgentContactInfo(agentId: number, info: ContactInfo): Promise<void> {
    const updates: any = {};
    
    if (info.wallet) {
      updates.wallet = info.wallet;
    }

    const channels: any = {};
    if (info.twitter) channels.twitter = info.twitter;
    if (info.discord) channels.discord = info.discord;
    if (info.telegram) channels.telegram = info.telegram;
    if (info.email) channels.email = info.email;

    if (Object.keys(channels).length > 0) {
      updates.channels = JSON.stringify(channels);
    }

    if (Object.keys(updates).length === 0) return;

    const setClauses = Object.keys(updates).map(key => 
      key === 'channels' 
        ? `channels = COALESCE(channels, '{}'::jsonb) || '${updates[key]}'::jsonb`
        : `${key} = '${updates[key]}'`
    ).join(', ');

    await db.execute(sql.raw(`
      UPDATE discovered_agents
      SET ${setClauses}
      WHERE id = ${agentId}
    `));
  }

  async getExtractionStats(): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(wallet) FILTER (WHERE wallet IS NOT NULL) as with_wallet,
        COUNT(channels->>'twitter') FILTER (WHERE channels->>'twitter' IS NOT NULL) as with_twitter,
        COUNT(channels->>'discord') FILTER (WHERE channels->>'discord' IS NOT NULL) as with_discord,
        COUNT(channels->>'telegram') FILTER (WHERE channels->>'telegram' IS NOT NULL) as with_telegram,
        COUNT(channels->>'email') FILTER (WHERE channels->>'email' IS NOT NULL) as with_email
      FROM discovered_agents
    `);

    return result.rows[0];
  }
}

export const contactInfoExtractor = new ContactInfoExtractor();
