/**
 * A2A REGISTRY DISCOVERY ADAPTER - REAL A2A PROTOCOL IMPLEMENTATION
 * 
 * Discovers AI agents from REAL A2A protocol endpoints following Google's A2A specification.
 * Checks .well-known/agent-card.json and .well-known/agent.json paths.
 * 
 * Updated: October 2025
 */

import { BaseDiscoveryAdapter } from './baseAdapter';
import { DiscoveredAgentRaw } from '../services/agentDiscoveryService';
import { 
  VERIFIED_AGENT_TARGETS, 
  getTargetsByPriority, 
  A2A_REGISTRY_URLS 
} from '../services/verifiedAgentTargets';

export class A2ARegistryAdapter extends BaseDiscoveryAdapter {
  public name = 'A2A Registry Adapter';
  public expectedYield = 50; // Realistic yield from verified agents
  public timeout = 60000;
  public rateLimit = 100;

  // A2A Protocol Standard Paths (per Google A2A spec)
  private agentCardPaths = [
    '/.well-known/agent-card.json',  // Primary A2A protocol path
    '/.well-known/agent.json'         // Alternative A2A path
  ];

  async discover(options: { registries?: string[] } = {}): Promise<DiscoveredAgentRaw[]> {
    console.log(`🔍 Starting REAL A2A protocol discovery from verified agent targets...`);
    
    const discoveredAgents: DiscoveredAgentRaw[] = [];

    // Method 1: Check verified agent targets with .well-known/agent-card.json
    try {
      const verifiedAgents = await this.discoverFromVerifiedTargets();
      discoveredAgents.push(...verifiedAgents);
      console.log(`✅ Found ${verifiedAgents.length} agents from verified targets`);
    } catch (error) {
      console.error(`❌ Verified targets discovery failed:`, (error as Error).message);
    }

    // Method 2: Check A2A registries (if they exist)
    try {
      const registryAgents = await this.discoverFromA2ARegistries();
      discoveredAgents.push(...registryAgents);
      console.log(`✅ Found ${registryAgents.length} agents from A2A registries`);
    } catch (error) {
      console.error(`❌ A2A registry discovery failed:`, (error as Error).message);
    }

    console.log(`🎯 A2A discovery complete: ${discoveredAgents.length} total REAL agents`);
    return discoveredAgents;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.safeFetch('https://api.github.com', {
        method: 'HEAD',
        headers: { 'User-Agent': 'CoinRailz-A2A-Platform/1.0' }
      }, 5000);
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discover agents from verified targets by checking .well-known/agent-card.json
   */
  private async discoverFromVerifiedTargets(): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    const targets = getTargetsByPriority(); // Sorted by priority
    
    console.log(`📡 Checking ${targets.length} verified agent targets for A2A protocol compliance...`);
    
    for (const target of targets) {
      try {
        // Try both domain and basename
        const domainToCheck = target.domain || (target.basename ? `${target.basename}.limo` : null);
        
        if (!domainToCheck) {
          continue; // Skip if no domain to check
        }
        
        // Try both A2A protocol paths
        for (const cardPath of this.agentCardPaths) {
          const url = `https://${domainToCheck}${cardPath}`;
          
          try {
            const response = await this.safeFetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'CoinRailz-A2A-Platform/1.0'
              }
            }, 10000);
            
            if (response.ok) {
              const agentCard = await this.safeJsonParse(response);
              
              if (agentCard && agentCard.name) {
                // Found a valid A2A agent card!
                agents.push({
                  url: `https://${domainToCheck}`,
                  source: 'verified-a2a-targets',
                  channels: {
                    webhook: agentCard.endpoints?.['message/send'] || url
                  },
                  wallet: target.wallet,
                  capabilities: agentCard.capabilities || {},
                  metadata: {
                    platform: target.platform,
                    verified: target.verified,
                    name: agentCard.name,
                    description: agentCard.description || target.description,
                    protocolVersion: agentCard.protocolVersion,
                    agentCardUrl: url
                  }
                });
                
                console.log(`✅ Discovered REAL A2A agent: ${agentCard.name} at ${domainToCheck}`);
                break; // Found agent card, no need to try other path
              }
            }
          } catch (error) {
            // Continue to next path
          }
        }
        
        // Rate limit: wait between requests
        await this.sleep(500);
        
      } catch (error) {
        console.log(`⚠️ Could not reach ${target.domain || target.basename}:`, (error as Error).message);
      }
    }
    
    return agents;
  }

  /**
   * Discover agents from public A2A registries (REAL LIVE REGISTRIES)
   */
  private async discoverFromA2ARegistries(): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    for (const registryUrl of A2A_REGISTRY_URLS) {
      try {
        console.log(`🔍 Checking A2A registry: ${registryUrl}`);
        
        // CRITICAL FIX: Use native fetch with redirect: 'follow' to handle 301 redirects
        const response = await fetch(registryUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CoinRailz-A2A-Platform/1.0'
          },
          redirect: 'follow', // Follow HTTP redirects (www.a2aregistry.org → a2aregistry.org)
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          let data;
          try {
            data = await response.json();
          } catch (parseError) {
            console.error(`❌ JSON parse error for ${registryUrl}:`, (parseError as Error).message);
            continue; // Skip to next registry
          }
          
          // Handle different registry formats
          if (data && typeof data === 'object') {
            let agentList: any[] = [];
            
            // Format 1: a2aregistry.org format - { agents: [...] }
            if (data.agents && Array.isArray(data.agents)) {
              agentList = data.agents;
              console.log(`📦 Found ${agentList.length} agents in 'agents' array`);
            }
            // Format 2: api.a2a-registry.dev REST format - direct array
            else if (Array.isArray(data)) {
              agentList = data;
              console.log(`📦 Found ${agentList.length} agents in direct array`);
            }
            // Format 3: Generic 'data' wrapper
            else if (data.data && Array.isArray(data.data)) {
              agentList = data.data;
              console.log(`📦 Found ${agentList.length} agents in 'data' array`);
            }
            // Format 4: 'registry' wrapper
            else if (data.registry && Array.isArray(data.registry)) {
              agentList = data.registry;
              console.log(`📦 Found ${agentList.length} agents in 'registry' array`);
            }
            else {
              console.log(`⚠️ Unknown registry format for ${registryUrl}, data keys:`, Object.keys(data));
            }
            
            // Process discovered agents
            for (const agentRecord of agentList) {
              // Extract agent URL from various formats
              const agentUrl = agentRecord.url || 
                              agentRecord.wellKnownURI?.replace('/.well-known/agent-card.json', '') ||
                              agentRecord.endpoint ||
                              (agentRecord.domain ? `https://${agentRecord.domain}` : null);
              
              if (agentUrl) {
                agents.push({
                  url: agentUrl,
                  source: 'a2a-public-registry',
                  channels: {
                    webhook: agentRecord.endpoint || agentUrl
                  },
                  wallet: agentRecord.wallet || agentRecord.address,
                  capabilities: agentRecord.capabilities || agentRecord.skills || {},
                  metadata: {
                    name: agentRecord.name,
                    description: agentRecord.description,
                    author: agentRecord.author,
                    version: agentRecord.version,
                    protocolVersion: agentRecord.protocolVersion,
                    platform: 'a2a-registry',
                    verified: true,
                    registryUrl: registryUrl
                  }
                });
              }
            }
            
            console.log(`✅ Successfully parsed ${agentList.length} agents from ${registryUrl}`);
          }
        } else {
          console.log(`⚠️ HTTP ${response.status} for ${registryUrl}`);
        }
      } catch (error) {
        const err = error as Error;
        if (err.name === 'AbortError') {
          console.log(`⏰ Timeout fetching ${registryUrl}`);
        } else {
          console.log(`❌ Error fetching ${registryUrl}:`, err.message);
        }
      }
      
      // Rate limit between registries
      await this.sleep(1000);
    }
    
    console.log(`📊 Total agents from registries: ${agents.length}`);
    return agents;
  }

  /**
   * Extract agent URL from raw data (required by BaseDiscoveryAdapter)
   */
  protected extractAgentUrl(rawData: any): string {
    return rawData.url || rawData.domain || rawData.id || 'unknown';
  }
}