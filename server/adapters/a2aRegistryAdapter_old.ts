/**
 * A2A REGISTRY DISCOVERY ADAPTER
 * 
 * Discovers AI agents from A2A protocol registries and agent directories.
 * Focuses on agents that support inter-agent communication protocols.
 */

import { BaseDiscoveryAdapter } from './baseAdapter';
import { DiscoveredAgentRaw } from '../services/agentDiscoveryService';

export class A2ARegistryAdapter extends BaseDiscoveryAdapter {
  public name = 'A2A Registry Adapter';
  public expectedYield = 500; // Expected agents per run
  public timeout = 60000; // 1 minute
  public rateLimit = 100; // 100 requests per minute

  // Real A2A Protocol registries (verified endpoints only)
  private a2aRegistries = [
    {
      name: 'GitHub Agent Registry',
      url: 'https://api.github.com/repos/microsoft/autogen/contents/samples/agents',
        auth: undefined, // Public GitHub API
      network: 'multi-chain',
      api_type: 'github_api'
    },
    {
      name: 'Hugging Face Models',
      url: 'https://huggingface.co/api/models?filter=conversational',
        auth: undefined, // Public HF API
      network: 'api'
    },
    {
      name: 'OpenAI GPT Store',
      url: 'https://chatgpt.com/gpts/discovery',
        auth: undefined, // Public discovery
      network: 'api',
      api_type: 'scrape'
    }
  ];

  async discover(options: { registries?: string[] } = {}): Promise<DiscoveredAgentRaw[]> {
    console.log(`🔍 Starting A2A registry discovery across ${this.a2aRegistries.length} registries...`);
    
    const { registries = this.a2aRegistries.map(r => r.name) } = options;
    const discoveredAgents: DiscoveredAgentRaw[] = [];

    for (const registry of this.a2aRegistries) {
      if (!registries.includes(registry.name)) {
        continue;
      }

      try {
        console.log(`📡 Discovering agents from ${registry.name}...`);
        
        if (!this.checkRateLimit()) {
          await this.waitForRateLimit();
        }

        const agents = await this.discoverFromRegistry(registry);
        discoveredAgents.push(...agents);
        
        console.log(`✅ Found ${agents.length} agents from ${registry.name}`);
        
        // Respect rate limits
        await this.sleep(1000);
        
      } catch (error) {
        console.error(`❌ Failed to discover from ${registry.name}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`🎯 A2A discovery complete: ${discoveredAgents.length} total agents`);
    return discoveredAgents;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test connection using lightweight HEAD request to base URL
      const primaryRegistry = this.a2aRegistries[0];
      
      // First try HEAD request to base URL (most lightweight)
      try {
        const response = await this.safeFetch(primaryRegistry.url.replace('/api/agents', ''), {
          method: 'HEAD',
          headers: this.getAuthHeaders(primaryRegistry.auth)
        }, 5000);
        
        if (response.ok) {
          return true;
        }
      } catch (headError) {
        // HEAD failed, try OPTIONS
        console.warn(`HEAD request failed for ${primaryRegistry.name}, trying OPTIONS:`, headError instanceof Error ? headError.message : String(headError));
      }
      
      // Fallback to OPTIONS request
      try {
        const response = await this.safeFetch(primaryRegistry.url.replace('/api/agents', ''), {
          method: 'OPTIONS',
          headers: this.getAuthHeaders(primaryRegistry.auth)
        }, 5000);
        
        return response.ok || response.status === 405; // 405 is OK for OPTIONS
      } catch (optionsError) {
        console.warn(`OPTIONS request failed for ${primaryRegistry.name}:`, optionsError instanceof Error ? optionsError.message : String(optionsError));
      }
      
      // Last resort: try a lightweight GET to root
      const response = await this.safeFetch(primaryRegistry.url.replace('/api/agents', '/'), {
        headers: this.getAuthHeaders(primaryRegistry.auth)
      }, 3000);
      
      return response.ok || response.status === 404; // 404 is better than connection failure
    } catch (error) {
      console.error(`❌ A2A registry health check failed:`, error);
      return false;
    }
  }

  private async discoverFromRegistry(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Different discovery strategies based on registry type
      switch (registry.name) {
        case 'GitHub Agent Registry':
          return await this.discoverGitHubAgents(registry);
        case 'Hugging Face Models':
          return await this.discoverHuggingFaceAgents(registry);
        case 'OpenAI GPT Store':
          return await this.discoverOpenAIAgents(registry);
        default:
          return await this.discoverGenericRegistry(registry);
      }
    } catch (error) {
      console.error(`❌ Registry discovery failed for ${registry.name}:`, error);
      return [];
    }
  }

  private async discoverGitHubAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(registry.url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CoinRailz-A2A-Platform/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      // GitHub API returns array of file objects
      for (const item of data || []) {
        if (item.type === 'file' && (item.name.endsWith('.py') || item.name.endsWith('.json'))) {
          const agent: DiscoveredAgentRaw = {
            url: item.download_url || item.html_url,
            source: 'github-agent-registry',
            channels: {
              webhook: item.download_url
            },
            capabilities: {
              content_creation: true,
              analytics: true
            },
            metadata: {
              platform: 'github',
              network: 'api',
              verified: true,
              name: item.name
            }
          };
          
          agents.push(agent);
        }
      }
    } catch (error) {
      console.error('❌ AI16Z discovery failed:', error);
    }

    return agents;
  }

  private async discoverHuggingFaceAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const response = await this.safeFetch(registry.url, { headers: this.getAuthHeaders(registry.auth) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const models = await this.safeJsonParse(response) as any[];
    return (Array.isArray(models) ? models : []).map((model) => ({
      url: `https://huggingface.co/${model.modelId}`,
      source: 'huggingface-models',
      channels: { webhook: `https://huggingface.co/${model.modelId}` },
      capabilities: { conversational: true },
      metadata: { platform: 'huggingface', name: model.modelId, tags: model.tags ?? [] },
    }));
  }

  private async discoverOpenAIAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    return this.discoverGenericRegistry(registry);
  }

  private async discoverVirtualsAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Use paginated approach for Virtuals Protocol
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 10) { // Max 10 pages
        const response = await this.safeFetch(`${registry.url}?page=${page}&limit=100`, {
          headers: this.getAuthHeaders(registry.auth)
        });

        if (!response.ok) {
          break;
        }

        const data = await this.safeJsonParse(response);
        
        if (!data.agents || data.agents.length === 0) {
          hasMore = false;
          break;
        }

        for (const agent of data.agents) {
          const normalizedAgent = this.normalizeAgent(agent, 'virtuals-registry');
          if (normalizedAgent) {
            normalizedAgent.metadata = {
              ...normalizedAgent.metadata,
              platform: 'virtuals',
              network: 'base',
              verified: true,
              symbol: agent.symbol,
              holders: agent.holders
            };
            
            normalizedAgent.capabilities = {
              ...normalizedAgent.capabilities,
              trading: true,
              social_media: true,
              funding_requests: true
            };
            
            agents.push(normalizedAgent);
          }
        }
        
        page++;
        this.logProgress(agents.length, data.total || agents.length, 'processed');
      }
    } catch (error) {
      console.error('❌ Virtuals discovery failed:', error);
    }

    return agents;
  }

  private async discoverAgentKitAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(`${registry.url}/agents?status=active`, {
        headers: this.getAuthHeaders(registry.auth)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      for (const agent of data.agents || []) {
        const normalizedAgent = this.normalizeAgent(agent, 'agentkit-registry');
        if (normalizedAgent) {
          normalizedAgent.metadata = {
            ...normalizedAgent.metadata,
            platform: 'agentkit',
            network: 'base',
            framework: 'coinbase',
            deployment: agent.deployment_type
          };
          
          normalizedAgent.capabilities = {
            ...normalizedAgent.capabilities,
            defi: true,
            base_native: true,
            funding_requests: true
          };
          
          agents.push(normalizedAgent);
        }
      }
    } catch (error) {
      console.error('❌ AgentKit discovery failed:', error);
    }

    return agents;
  }

  private async discoverGoogleAP2Agents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(`${registry.url}?protocol=a2a&limit=1000`, {
        headers: this.getAuthHeaders(registry.auth)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      for (const agent of data.agents || []) {
        const normalizedAgent = this.normalizeAgent(agent, 'google-ap2');
        if (normalizedAgent) {
          normalizedAgent.metadata = {
            ...normalizedAgent.metadata,
            platform: 'google_ap2',
            network: 'base',
            verified: true,
            partnership: 'google',
            priority: 'high'
          };
          
          normalizedAgent.capabilities = {
            ...normalizedAgent.capabilities,
            a2a_protocol: true,
            google_integration: true,
            high_throughput: true
          };
          
          agents.push(normalizedAgent);
        }
      }
    } catch (error) {
      console.error('❌ Google AP2 discovery failed:', error);
    }

    return agents;
  }

  private async discoverFarcasterAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(`${registry.url}?type=agent&active=true`, {
        headers: this.getAuthHeaders(registry.auth)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      for (const agent of data.users || []) {
        const normalizedAgent = this.normalizeAgent(agent, 'farcaster-directory');
        if (normalizedAgent) {
          normalizedAgent.metadata = {
            ...normalizedAgent.metadata,
            platform: 'farcaster',
            network: 'ethereum',
            social_network: true,
            fid: agent.fid
          };
          
          normalizedAgent.channels = {
            ...normalizedAgent.channels,
            farcaster: `@${agent.username}`
          };
          
          agents.push(normalizedAgent);
        }
      }
    } catch (error) {
      console.error('❌ Farcaster discovery failed:', error);
    }

    return agents;
  }

  private async discoverBaseAgents(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(`${registry.url}?network=base&type=agent`, {
        headers: this.getAuthHeaders(registry.auth)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      for (const agent of data.agents || []) {
        const normalizedAgent = this.normalizeAgent(agent, 'base-registry');
        if (normalizedAgent) {
          normalizedAgent.metadata = {
            ...normalizedAgent.metadata,
            platform: 'base',
            network: 'base',
            verified: agent.verified,
            contract_address: agent.contract_address
          };
          
          agents.push(normalizedAgent);
        }
      }
    } catch (error) {
      console.error('❌ Base registry discovery failed:', error);
    }

    return agents;
  }

  private async discoverGenericRegistry(registry: any): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(registry.url, {
        headers: this.getAuthHeaders(registry.auth)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await this.safeJsonParse(response);
      
      // Generic parsing - adapt based on common patterns
      const agentList = data.agents || data.data || data.results || [];
      
      for (const agent of agentList) {
        const normalizedAgent = this.normalizeAgent(agent, 'a2a-registry');
        if (normalizedAgent) {
          normalizedAgent.metadata = {
            ...normalizedAgent.metadata,
            platform: registry.name.toLowerCase().replace(/\s+/g, '_'),
            network: registry.network
          };
          
          agents.push(normalizedAgent);
        }
      }
    } catch (error) {
      console.error(`❌ Generic registry discovery failed for ${registry.name}:`, error);
    }

    return agents;
  }

  private getAuthHeaders(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  protected extractAgentUrl(rawData: any): string {
    return rawData.url || 
           rawData.endpoint || 
           rawData.webhook_url || 
           rawData.agent_url ||
           `https://agent.placeholder/${rawData.id || rawData.address}`;
  }

  protected extractChannels(rawData: any): any {
    return {
      webhook: rawData.webhook_url || rawData.endpoint,
      email: rawData.email || rawData.contact_email,
      telegram: rawData.telegram || rawData.social?.telegram,
      twitter: rawData.twitter || rawData.social?.twitter,
      farcaster: rawData.farcaster || rawData.social?.farcaster,
      push_protocol: rawData.supports_push || rawData.push_enabled || false
    };
  }

  protected extractWalletAddress(rawData: any): string | undefined {
    return rawData.wallet_address || 
           rawData.address || 
           rawData.owner_address || 
           rawData.contract_address;
  }

  protected extractCapabilities(rawData: any): any {
    const capabilities = rawData.capabilities || {};
    
    // Add inferred capabilities based on platform
    if (rawData.platform === 'virtuals') {
      capabilities.trading = true;
      capabilities.social_media = true;
    }
    
    if (rawData.platform === 'agentkit') {
      capabilities.defi = true;
      capabilities.base_native = true;
    }
    
    if (rawData.type === 'trading_agent') {
      capabilities.trading = true;
      capabilities.defi = true;
    }
    
    return capabilities;
  }

  protected extractMetadata(rawData: any): any {
    return {
      id: rawData.id,
      name: rawData.name || rawData.title,
      description: rawData.description,
      symbol: rawData.symbol,
      market_cap: rawData.market_cap || rawData.marketCap,
      token_address: rawData.token_address || rawData.tokenAddress,
      verified: rawData.verified || false,
      active: rawData.active !== false,
      last_updated: rawData.updated_at || rawData.lastUpdated,
      holders: rawData.holders,
      platform_specific: rawData
    };
  }
}