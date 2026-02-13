/**
 * ELIZAOS REGISTRY DISCOVERY ADAPTER
 * 
 * Discovers AI agent plugins and projects from the ElizaOS ecosystem.
 * Fetches from the official ElizaOS plugin registry on GitHub.
 * 
 * Sources:
 * - https://raw.githubusercontent.com/elizaos-plugins/registry/main/index.json (plugin name → repo mappings)
 * - GitHub API to resolve plugin repos for wallet/contact info
 * 
 * These are ElizaOS-based agents that could integrate Coin Railz payment plugins.
 */

import { BaseDiscoveryAdapter } from './baseAdapter';
import { DiscoveredAgentRaw } from '../services/agentDiscoveryService';

interface ElizaPluginEntry {
  [pluginName: string]: string;
}

interface ElizaGeneratedRegistry {
  [pluginName: string]: {
    repo?: string;
    description?: string;
    version?: string;
    npmUrl?: string;
    branches?: string[];
    [key: string]: any;
  };
}

interface GitHubRepoInfo {
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  owner: {
    login: string;
    html_url: string;
  };
  stargazers_count: number;
  updated_at: string;
}

export class ElizaOSRegistryAdapter extends BaseDiscoveryAdapter {
  public name = 'ElizaOS Registry Adapter';
  public expectedYield = 100;
  public timeout = 60000;
  public rateLimit = 30;

  private indexUrl = 'https://raw.githubusercontent.com/elizaos-plugins/registry/main/index.json';
  private generatedRegistryUrl = 'https://raw.githubusercontent.com/elizaos-plugins/registry/main/generated-registry.json';

  async discover(): Promise<DiscoveredAgentRaw[]> {
    console.log('🔍 Starting ElizaOS Registry discovery...');
    const agents: DiscoveredAgentRaw[] = [];

    try {
      const indexResponse = await this.safeFetch(this.indexUrl, {}, 15000);
      if (!indexResponse.ok) {
        console.warn(`⚠️ ElizaOS index fetch failed: HTTP ${indexResponse.status}`);
        return agents;
      }
      const indexData: ElizaPluginEntry = await this.safeJsonParse(indexResponse);
      if (!indexData) {
        console.warn('⚠️ ElizaOS index parse failed');
        return agents;
      }

      const pluginNames = Object.keys(indexData);
      console.log(`📦 Found ${pluginNames.length} ElizaOS plugins in registry`);

      let generatedRegistry: ElizaGeneratedRegistry = {};
      try {
        const genResponse = await this.safeFetch(this.generatedRegistryUrl, {}, 15000);
        if (genResponse.ok) {
          generatedRegistry = await this.safeJsonParse(genResponse) || {};
        }
      } catch {
        console.warn('⚠️ Could not fetch generated registry, proceeding with index only');
      }

      const cryptoPaymentPlugins = pluginNames.filter(name => {
        const lower = name.toLowerCase();
        return lower.includes('solana') || lower.includes('evm') || lower.includes('wallet') ||
               lower.includes('payment') || lower.includes('defi') || lower.includes('swap') ||
               lower.includes('token') || lower.includes('bridge') || lower.includes('coinbase') ||
               lower.includes('base') || lower.includes('ethereum') || lower.includes('polygon') ||
               lower.includes('arbitrum') || lower.includes('usdc') || lower.includes('starknet') ||
               lower.includes('sui') || lower.includes('aptos') || lower.includes('near') ||
               lower.includes('ton') || lower.includes('bitcoin') || lower.includes('cosmos') ||
               lower.includes('avalanche') || lower.includes('bnb') || lower.includes('trading') ||
               lower.includes('nft') || lower.includes('x402') || lower.includes('coinrailz');
      });

      const otherPlugins = pluginNames.filter(name => !cryptoPaymentPlugins.includes(name));

      const prioritized = [...cryptoPaymentPlugins, ...otherPlugins];

      for (const pluginName of prioritized) {
        const repoPath = indexData[pluginName];
        if (!repoPath) continue;

        const repoUrl = repoPath.startsWith('http') ? repoPath : `https://github.com/${repoPath}`;
        const genData = generatedRegistry[pluginName] || {};
        const isCryptoRelated = cryptoPaymentPlugins.includes(pluginName);
        const score = isCryptoRelated ? 70 : 30;

        const agent: DiscoveredAgentRaw = {
          url: repoUrl,
          source: 'elizaos-registry',
          capabilities: {
            elizaos: true,
            pluginName,
            pluginType: 'elizaos:plugin:1.0.0',
            cryptoRelated: isCryptoRelated,
            ...(genData.branches ? { branches: genData.branches } : {}),
          },
          metadata: {
            platform: 'elizaos',
            pluginName,
            description: genData.description,
            version: genData.version,
            npmUrl: genData.npmUrl,
            registrySource: 'elizaos-plugins/registry',
            discoveredAt: new Date().toISOString(),
          },
        };

        if (this.validateAgent(agent)) {
          (agent as any).score = score;
          agents.push(agent);
        }
      }

      console.log(`✅ ElizaOS discovery complete: ${agents.length} plugins (${cryptoPaymentPlugins.length} crypto-related)`);

    } catch (error: any) {
      console.error(`❌ ElizaOS Registry discovery failed:`, error.message);
    }

    return agents;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.safeFetch(this.indexUrl, {}, 10000);
      return response.ok;
    } catch {
      return false;
    }
  }

  protected extractAgentUrl(rawData: any): string {
    return rawData.url || rawData.html_url || '';
  }
}
