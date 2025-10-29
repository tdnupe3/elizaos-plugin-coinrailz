/**
 * Autonomous Discovery Service
 * Makes our agents discoverable without manual outreach
 * 
 * Methods:
 * 1. Submit to public AI agent directories (API/form POST)
 * 2. Create XML sitemap for web crawlers
 * 3. Ping search engines about our agent cards
 * 4. Monitor for incoming A2A discovery attempts
 * 5. ERC-8004 on-chain registration (when feasible)
 */

import { db } from '../db';
import { globalAIAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface DiscoveryTarget {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  type: 'api' | 'form' | 'ping';
  enabled: boolean;
}

class AutonomousDiscoveryService {
  private baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://coinrailz.com';

  private discoveryTargets: DiscoveryTarget[] = [
    {
      name: 'AI Agents Directory Sitemap Ping',
      url: 'https://www.google.com/ping?sitemap=',
      method: 'GET',
      type: 'ping',
      enabled: true,
    },
    {
      name: 'Bing Sitemap Ping',
      url: 'https://www.bing.com/ping?sitemap=',
      method: 'GET',
      type: 'ping',
      enabled: true,
    },
    // More targets can be added as discovered
  ];

  /**
   * Generate XML sitemap for our agent cards
   * Makes us discoverable by web crawlers
   */
  async generateAgentSitemap(): Promise<string> {
    try {
      const agents = await db
        .select()
        .from(globalAIAgents);

      const now = new Date().toISOString();

      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Homepage
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${this.baseUrl}</loc>\n`;
      sitemap += `    <lastmod>${now}</lastmod>\n`;
      sitemap += `    <priority>1.0</priority>\n`;
      sitemap += `  </url>\n`;

      // Agent directory
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${this.baseUrl}/api/agents/directory</loc>\n`;
      sitemap += `    <lastmod>${now}</lastmod>\n`;
      sitemap += `    <priority>0.9</priority>\n`;
      sitemap += `  </url>\n`;

      // Individual agent cards
      for (const agent of agents) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${this.baseUrl}/agent/${agent.id}/.well-known/agent-card.json</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <priority>0.8</priority>\n`;
        sitemap += `  </url>\n`;
      }

      sitemap += '</urlset>';

      return sitemap;
    } catch (error) {
      console.error('❌ Sitemap generation failed:', error);
      throw error;
    }
  }

  /**
   * Ping search engines about our sitemap
   * Helps with crawler discovery
   */
  async pingSearchEngines(): Promise<{ success: boolean; results: any[] }> {
    const sitemapUrl = `${this.baseUrl}/sitemap.xml`;
    const results = [];

    for (const target of this.discoveryTargets.filter(t => t.type === 'ping' && t.enabled)) {
      try {
        const pingUrl = `${target.url}${encodeURIComponent(sitemapUrl)}`;
        
        console.log(`🔔 Pinging ${target.name}...`);
        const response = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'CoinRailz-AgentMarketplace/2.0',
          },
        });

        const result = {
          target: target.name,
          success: response.ok,
          status: response.status,
          timestamp: new Date().toISOString(),
        };

        results.push(result);
        
        if (response.ok) {
          console.log(`✅ ${target.name} pinged successfully`);
        } else {
          console.log(`⚠️ ${target.name} returned ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Failed to ping ${target.name}:`, error);
        results.push({
          target: target.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Create robots.txt content for better crawler access
   */
  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /
Allow: /api/agents/directory
Allow: /agent/*/\.well-known/agent-card.json

Sitemap: ${this.baseUrl}/sitemap.xml

# AI Agent Marketplace
# x402 Payment Protocol Support
# A2A 2.0 Discoverable Agents
# Contact: [Platform Email]
`;
  }

  /**
   * Execute full discovery campaign
   * Run this periodically to maintain discoverability
   */
  async executeDiscoveryCampaign(): Promise<{
    success: boolean;
    sitemap: boolean;
    searchEnginePings: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let sitemapGenerated = false;
    let successfulPings = 0;

    try {
      // Generate sitemap
      console.log('📍 Generating agent sitemap...');
      await this.generateAgentSitemap();
      sitemapGenerated = true;
      console.log('✅ Sitemap generated');
    } catch (error) {
      errors.push(`Sitemap generation failed: ${error}`);
    }

    try {
      // Ping search engines
      console.log('🔔 Pinging search engines...');
      const pingResults = await this.pingSearchEngines();
      successfulPings = pingResults.results.filter(r => r.success).length;
      console.log(`✅ ${successfulPings} search engines pinged successfully`);
    } catch (error) {
      errors.push(`Search engine pings failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      sitemap: sitemapGenerated,
      searchEnginePings: successfulPings,
      errors,
    };
  }

  /**
   * Monitor for incoming A2A discovery attempts
   * Tracks which agents/systems are trying to discover us
   */
  async logDiscoveryAttempt(data: {
    sourceIp: string;
    userAgent: string;
    agentId?: string;
    endpoint: string;
  }): Promise<void> {
    try {
      console.log('🔍 Discovery attempt detected:', {
        ip: data.sourceIp,
        userAgent: data.userAgent,
        agentId: data.agentId,
        endpoint: data.endpoint,
        timestamp: new Date().toISOString(),
      });
      
      // In production, you'd log this to analytics/database
      // For now, console logging for monitoring
    } catch (error) {
      console.error('Failed to log discovery attempt:', error);
    }
  }
}

export const autonomousDiscoveryService = new AutonomousDiscoveryService();
