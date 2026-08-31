import axios from 'axios';
import { persistDiscoveredAgent } from './persistence/discoveredAgentPersistence';
import { discoveryPingService } from './discoveryPingService';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * A2A MASS DISCOVERY SERVICE
 * 
 * Crawls known AI agent platforms and domains to discover agents
 * via .well-known/agent-card.json endpoints (Google A2A Protocol)
 * 
 * Saves discovered agents to database for outreach campaigns
 * 
 * Now with RECIPROCAL DISCOVERY: Pings discovered agents with our URL
 * so they can discover us in return (feature-flagged via DISCOVERY_PING_ENABLED)
 */

interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  skills: any[];
  capabilities?: string[];
  endpoints?: any;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

interface DiscoveryResult {
  discovered: number;
  total: number;
  agents: Array<{
    url: string;
    name: string;
    capabilities: string[];
    status: string;
  }>;
}

export class A2AMassDiscoveryService {
  private readonly USER_AGENT = 'CoinRailz-A2A-Discovery/1.0';
  private readonly TIMEOUT_MS = 5000;

  /**
   * Known AI agent platforms and target domains
   * Based on research and A2A protocol adoption
   */
  private getTargetDomains(): string[] {
    return [
      // AI Agent Platforms (from research)
      'https://truth-terminal.vercel.app',
      'https://ai16z.ai',
      'https://elizaos.ai',
      'https://virtuals.io',
      'https://fereai.xyz',
      
      // x402 Ecosystem - Active Payment Services (Feb 2026)
      'https://x402.org',
      'https://www.x402scan.com',
      'https://x402station.com',
      'https://x402.dev',
      'https://fluora.xyz',
      'https://relai.network',
      'https://openclaw.com',
      'https://agentlisa.com',
      'https://payai.network',
      'https://slamai.xyz',
      'https://kobaru.xyz',
      'https://bond.credit',
      'https://heurist.ai',
      'https://aimo.network',
      'https://slinkylayer.com',
      'https://cybercentry.com',
      'https://eigencloud.io',
      
      // Coinbase & Base Ecosystem
      'https://agentkit.coinbase.com',
      'https://bazaar.coinbase.com',
      'https://base.org',
      'https://docs.base.org',
      
      // Google AP2 & A2A Protocol Hubs
      'https://google.com',
      'https://cloud.google.com',
      
      // Cloudflare x402
      'https://cloudflare.com',
      'https://workers.cloudflare.com',
      
      // Vercel x402 ecosystem
      'https://vercel.com',
      
      // Major AI Agent Platforms
      'https://anthropic.com',
      'https://openai.com',
      
      // DePIN / IoT Agent Networks
      'https://fetch.ai',
      'https://singularitynet.io',
      'https://ocean.protocol',
      'https://render.com',
      
      // x402 Hackathon Winners & Active Builders
      'https://zuplo.com',
      'https://jetpay.xyz',
      
      // Google Cloud Run patterns (common A2A deployment)
      'https://pizza-agent.run.app',
      'https://burger-agent.run.app',
      'https://demo-agent.run.app',
      'https://ai-agent.run.app',
      'https://chat-agent.run.app',
      'https://x402-agent.run.app',
      'https://payment-agent.run.app',
      'https://agentkit-agent.run.app',
      
      // Vercel deployments
      'https://agent.vercel.app',
      'https://ai-agent.vercel.app',
      'https://chat-agent.vercel.app',
      'https://x402-agent.vercel.app',
      
      // Common hosting platforms
      'https://agent.fly.io',
      'https://ai-agent.fly.io',
      'https://agent.render.com',
      'https://ai-agent.render.com',
      'https://agent.railway.app',
      'https://ai-agent.railway.app',
    ];
  }

  /**
   * Additional search patterns for ENS and custom domains
   */
  private getENSPatterns(): string[] {
    return [
      'truthterminal.eth',
      'ai16z.eth',
      'eliza.eth',
      'virtuals.eth',
      'agent.eth',
    ];
  }

  /**
   * Discover agent via .well-known/agent-card.json
   * Follows Google A2A Protocol v0.2.x and v0.3.x
   */
  private async discoverAgentCard(baseUrl: string): Promise<A2AAgentCard | null> {
    // Try both new and old paths
    const cardPaths = [
      '/.well-known/agent-card.json', // v0.3.x
      '/.well-known/agent.json'       // v0.2.x
    ];

    for (const cardPath of cardPaths) {
      try {
        const url = `${baseUrl}${cardPath}`;
        console.log(`🔍 A2A Discovery: Checking ${url}`);

        const response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.USER_AGENT,
          },
          timeout: this.TIMEOUT_MS,
          validateStatus: (status) => status === 200,
        });

        const card = response.data as A2AAgentCard;

        // Validate required fields per Google A2A spec
        if (this.validateAgentCard(card)) {
          console.log(`✅ A2A Discovery: Found ${card.name} (v${card.protocolVersion})`);
          return card;
        }

      } catch (error: any) {
        // Silent failure, try next path
        if (error.code !== 'ECONNABORTED') {
          console.log(`⚠️ A2A Discovery: ${baseUrl}${cardPath} - ${error.message}`);
        }
      }
    }

    return null;
  }

  /**
   * Validate agent card against Google A2A Protocol
   */
  private validateAgentCard(card: any): boolean {
    if (!card || typeof card !== 'object') return false;

    const requiredFields = ['name', 'description', 'url', 'version', 'protocolVersion', 'skills'];
    
    for (const field of requiredFields) {
      if (!card[field]) {
        console.log(`❌ A2A Discovery: Missing field '${field}'`);
        return false;
      }
    }

    // Validate protocol version (0.2.x or 0.3.x)
    const version = card.protocolVersion;
    if (!version.startsWith('0.2.') && !version.startsWith('0.3.')) {
      console.log(`❌ A2A Discovery: Unsupported version ${version}`);
      return false;
    }

    if (!Array.isArray(card.skills)) {
      console.log(`❌ A2A Discovery: Skills must be array`);
      return false;
    }

    return true;
  }

  /**
   * Save discovered agent to database
   */
  private async saveDiscoveredAgent(card: A2AAgentCard): Promise<boolean> {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(discoveredAgents)
        .where(eq(discoveredAgents.url, card.url))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(discoveredAgents)
          .set({
            status: 'verified',
            lastSeenAt: new Date(),
            capabilities: card.capabilities || [],
            metadata: {
              name: card.name,
              description: card.description,
              version: card.version,
              protocolVersion: card.protocolVersion,
              skills: card.skills,
              endpoints: card.endpoints,
            },
            verifiedAt: new Date(),
          })
          .where(eq(discoveredAgents.url, card.url));

        console.log(`💾 A2A Discovery: Updated ${card.name} in database`);
      } else {
        // Insert new
        await persistDiscoveredAgent({
          url: card.url,
          source: 'a2a_protocol',
          channels: {
            a2a: card.url,
            endpoints: card.endpoints,
          },
          status: 'verified',
          score: 75, // Base score for verified A2A agents
          capabilities: card.capabilities || [],
          metadata: {
            name: card.name,
            description: card.description,
            version: card.version,
            protocolVersion: card.protocolVersion,
            skills: card.skills,
            endpoints: card.endpoints,
          },
          verifiedAt: new Date(),
        });

        console.log(`💾 A2A Discovery: Saved ${card.name} to database`);
      }

      return true;
    } catch (error) {
      console.error(`❌ A2A Discovery: Failed to save ${card.name}:`, error);
      return false;
    }
  }

  /**
   * Run mass discovery across all target domains
   */
  async discoverAllAgents(): Promise<DiscoveryResult> {
    console.log('🚀 A2A Mass Discovery: Starting...');

    const targets = this.getTargetDomains();
    const discovered: A2AAgentCard[] = [];
    const results: DiscoveryResult = {
      discovered: 0,
      total: targets.length,
      agents: [],
    };

    console.log(`🎯 A2A Mass Discovery: Checking ${targets.length} target domains...`);

    // Discover agents from all targets
    const discoveredUrls: string[] = [];
    
    for (const target of targets) {
      const card = await this.discoverAgentCard(target);
      if (card) {
        discovered.push(card);
        
        // Save to database
        const saved = await this.saveDiscoveredAgent(card);
        if (saved) {
          results.discovered++;
          results.agents.push({
            url: card.url,
            name: card.name,
            capabilities: card.capabilities || [],
            status: 'verified',
          });
          discoveredUrls.push(card.url);
        }
      }
    }

    // Ping all discovered agents to leave our URL in their logs (reciprocal discovery)
    if (discoveredUrls.length > 0) {
      console.log(`🔔 A2A Discovery: Pinging ${discoveredUrls.length} discovered agents for reciprocal discovery...`);
      const pingResults = await discoveryPingService.pingBatch(discoveredUrls);
      const pingStats = discoveryPingService.getStats();
      console.log(`🔔 A2A Discovery: Ping complete - ${pingStats.success}/${pingStats.total} successful (${pingStats.rate})`);
    }

    console.log(`✅ A2A Mass Discovery: Complete - ${results.discovered}/${targets.length} agents discovered`);

    return results;
  }

  /**
   * Discover agent from single URL
   */
  async discoverSingleAgent(url: string): Promise<A2AAgentCard | null> {
    console.log(`🔍 A2A Discovery: Checking single URL ${url}`);
    
    const card = await this.discoverAgentCard(url);
    if (card) {
      await this.saveDiscoveredAgent(card);
    }
    
    return card;
  }

  /**
   * Get discovery statistics from database
   */
  async getDiscoveryStats(): Promise<{
    total: number;
    verified: number;
    sources: Record<string, number>;
  }> {
    const allAgents = await db.select().from(discoveredAgents);

    const stats = {
      total: allAgents.length,
      verified: allAgents.filter(a => a.status === 'verified').length,
      sources: {} as Record<string, number>,
    };

    // Count by source
    for (const agent of allAgents) {
      const source = agent.source || 'unknown';
      stats.sources[source] = (stats.sources[source] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get all discovered A2A agents from database
   */
  async getDiscoveredAgents(): Promise<any[]> {
    return await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'a2a_protocol'))
      .orderBy(discoveredAgents.score);
  }
}

export default new A2AMassDiscoveryService();
