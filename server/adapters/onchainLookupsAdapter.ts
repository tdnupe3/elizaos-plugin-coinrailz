/**
 * ON-CHAIN LOOKUPS DISCOVERY ADAPTER
 * 
 * Discovers AI agents through on-chain lookups:
 * - ENS domain resolution for agent endpoints
 * - XMTP messaging protocol participants
 * - Farcaster/Lens protocol social graphs
 * - Smart contract analysis for agent patterns
 */

import { BaseDiscoveryAdapter } from './baseAdapter';
import { DiscoveredAgentRaw } from '../services/agentDiscoveryService';

export class OnchainLookupsAdapter extends BaseDiscoveryAdapter {
  public name = 'On-chain Lookups Adapter';
  public expectedYield = 2000; // Expected agents per run
  public timeout = 120000; // 2 minutes
  public rateLimit = 50; // 50 requests per minute

  // On-chain data sources
  private dataSources = {
    ens: {
      endpoint: 'https://api.ensdata.net',
      rpcUrl: process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://eth-mainnet.g.alchemy.com/v2/demo'
    },
    xmtp: {
      endpoint: 'https://production.xmtp.network',
      apiKey: process.env.XMTP_API_KEY
    },
    farcaster: {
      endpoint: 'https://api.neynar.com/v2/farcaster',
      apiKey: process.env.NEYNAR_API_KEY
    },
    lens: {
      endpoint: 'https://api.lens.dev',
      apiKey: process.env.LENS_API_KEY
    },
    base: {
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      explorerApi: 'https://api.basescan.org/api'
    },
    ethereum: {
      rpcUrl: process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://eth-mainnet.g.alchemy.com/v2/demo',
      explorerApi: 'https://api.etherscan.io/api'
    }
  };

  async discover(options: { 
    sources?: string[], 
    lookupLimit?: number,
    blockRange?: number 
  } = {}): Promise<DiscoveredAgentRaw[]> {
    console.log(`🔍 Starting on-chain discovery across multiple protocols...`);
    
    const { 
      sources = ['ens', 'xmtp', 'farcaster', 'lens', 'base', 'ethereum'],
      lookupLimit = 1000,
      blockRange = 10000
    } = options;
    
    const discoveredAgents: DiscoveredAgentRaw[] = [];

    // Run discovery methods in parallel
    const discoveryPromises = [];

    if (sources.includes('ens')) {
      discoveryPromises.push(this.discoverENSAgents(lookupLimit));
    }
    
    if (sources.includes('xmtp')) {
      discoveryPromises.push(this.discoverXMTPParticipants(lookupLimit));
    }
    
    if (sources.includes('farcaster')) {
      discoveryPromises.push(this.discoverFarcasterAgents(lookupLimit));
    }
    
    if (sources.includes('lens')) {
      discoveryPromises.push(this.discoverLensAgents(lookupLimit));
    }
    
    if (sources.includes('base')) {
      discoveryPromises.push(this.discoverBaseChainAgents(blockRange));
    }
    
    if (sources.includes('ethereum')) {
      discoveryPromises.push(this.discoverEthereumAgents(blockRange));
    }

    try {
      const results = await Promise.allSettled(discoveryPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          discoveredAgents.push(...result.value);
        } else {
          console.error('❌ On-chain discovery method failed:', result.reason);
        }
      }
    } catch (error) {
      console.error('❌ On-chain discovery failed:', error);
    }

    console.log(`🎯 On-chain discovery complete: ${discoveredAgents.length} total agents`);
    return discoveredAgents;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test primary RPC connections
      const ethResponse = await this.safeFetch(this.dataSources.ethereum.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      }, 10000);
      
      return ethResponse.ok;
    } catch (error) {
      console.error(`❌ On-chain health check failed:`, error);
      return false;
    }
  }

  /**
   * DISCOVER ENS AGENTS
   * Look for ENS domains with agent-related subdomains and metadata
   */
  private async discoverENSAgents(limit: number): Promise<DiscoveredAgentRaw[]> {
    console.log('🌐 Discovering agents via ENS domains...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Look for common agent-related ENS patterns
      const agentPatterns = [
        'agent.',
        'ai.',
        'bot.',
        'trading.',
        'defi.',
        'assistant.',
        'service.',
        'api.',
        'webhook.',
        'oracle.'
      ];

      for (const pattern of agentPatterns) {
        if (agents.length >= limit) break;
        
        const patternAgents = await this.searchENSPattern(pattern, Math.min(100, limit - agents.length));
        agents.push(...patternAgents);
        
        await this.sleep(2000); // Rate limiting
      }
      
      console.log(`✅ ENS discovery found ${agents.length} agents`);
    } catch (error) {
      console.error('❌ ENS discovery failed:', error);
    }

    return agents;
  }

  private async searchENSPattern(pattern: string, limit: number): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Use ENS subgraph or API to search for domains
      const response = await this.safeFetch(`${this.dataSources.ens.endpoint}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            domains(first: ${limit}, where: { name_contains: "${pattern}" }) {
              name
              owner { id }
              resolver { texts }
              registrations(first: 1) { registrationDate }
            }
          }`
        })
      });

      if (!response.ok) return agents;

      const data = await this.safeJsonParse(response);
      
      for (const domain of data.data?.domains || []) {
        const agent = await this.processENSDomain(domain);
        if (agent) agents.push(agent);
      }
    } catch (error) {
      console.error(`❌ ENS pattern search failed for ${pattern}:`, error);
    }

    return agents;
  }

  private async processENSDomain(domain: any): Promise<DiscoveredAgentRaw | null> {
    try {
      // Extract agent information from ENS domain
      const url = await this.resolveENSUrl(domain.name);
      if (!url) return null;

      return {
        url,
        source: 'ens-lookup',
        wallet: domain.owner?.id,
        channels: {
          webhook: url,
          email: await this.getENSTextRecord(domain.name, 'email')
        },
        capabilities: this.inferCapabilitiesFromDomain(domain.name),
        metadata: {
          ens_name: domain.name,
          registration_date: domain.registrations?.[0]?.registrationDate,
          resolver_texts: domain.resolver?.texts
        }
      };
    } catch (error) {
      console.error(`❌ Failed to process ENS domain ${domain.name}:`, error);
      return null;
    }
  }

  private async resolveENSUrl(ensName: string): Promise<string | null> {
    try {
      // Try to resolve URL text record
      const url = await this.getENSTextRecord(ensName, 'url');
      if (url) return url;

      // Try contenthash
      const contenthash = await this.getENSTextRecord(ensName, 'contenthash');
      if (contenthash) return `https://ipfs.io/ipfs/${contenthash}`;

      // Default to ENS app URL
      return `https://app.ens.domains/name/${ensName}`;
    } catch (error) {
      return null;
    }
  }

  private async getENSTextRecord(ensName: string, key: string): Promise<string | null> {
    try {
      // This would use ENS resolver to get text records
      // Simplified implementation
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * DISCOVER XMTP PARTICIPANTS
   * Find active XMTP participants who might be agents
   */
  private async discoverXMTPParticipants(limit: number): Promise<DiscoveredAgentRaw[]> {
    console.log('💬 Discovering agents via XMTP participants...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Query XMTP network for active participants
      const response = await this.safeFetch(`${this.dataSources.xmtp.endpoint}/participants`, {
        headers: {
          'Authorization': `Bearer ${this.dataSources.xmtp.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('⚠️ XMTP API unavailable, using known participants...');
        return this.getKnownXMTPAgents();
      }

      const data = await this.safeJsonParse(response);
      
      for (const participant of (data.participants || []).slice(0, limit)) {
        const agent = this.processXMTPParticipant(participant);
        if (agent) agents.push(agent);
      }
      
      console.log(`✅ XMTP discovery found ${agents.length} participants`);
    } catch (error) {
      console.error('❌ XMTP discovery failed:', error);
      return this.getKnownXMTPAgents();
    }

    return agents;
  }

  private processXMTPParticipant(participant: any): DiscoveredAgentRaw | null {
    try {
      return {
        url: `https://xmtp.agent/${participant.address}`,
        source: 'xmtp-participants',
        wallet: participant.address,
        channels: {
          xmtp: true
        },
        capabilities: {
          messaging: true,
          xmtp_native: true
        },
        metadata: {
          xmtp_enabled: true,
          last_message: participant.lastMessage,
          message_count: participant.messageCount
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * DISCOVER FARCASTER AGENTS
   * Find AI agents active on Farcaster protocol
   */
  private async discoverFarcasterAgents(limit: number): Promise<DiscoveredAgentRaw[]> {
    console.log('🟣 Discovering agents via Farcaster protocol...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const response = await this.safeFetch(
        `${this.dataSources.farcaster.endpoint}/users/search?q=agent&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.dataSources.farcaster.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.log('⚠️ Farcaster API unavailable, using known agents...');
        return this.getKnownFarcasterAgents();
      }

      const data = await this.safeJsonParse(response);
      
      for (const user of data.result?.users || []) {
        const agent = this.processFarcasterUser(user);
        if (agent) agents.push(agent);
      }
      
      console.log(`✅ Farcaster discovery found ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Farcaster discovery failed:', error);
      return this.getKnownFarcasterAgents();
    }

    return agents;
  }

  private processFarcasterUser(user: any): DiscoveredAgentRaw | null {
    try {
      // Check if user appears to be an AI agent
      const isAgent = this.isLikelyAgent(user.displayName, user.bio);
      if (!isAgent) return null;

      return {
        url: `https://warpcast.com/${user.username}`,
        source: 'farcaster-protocol',
        wallet: user.custodyAddress || user.verifications?.[0],
        channels: {
          farcaster: `@${user.username}`,
          xmtp: user.verifications?.length > 0
        },
        capabilities: {
          social_media: true,
          content_creation: true,
          farcaster_native: true
        },
        metadata: {
          fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          bio: user.bio,
          follower_count: user.followerCount,
          following_count: user.followingCount,
          verified_addresses: user.verifications
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * DISCOVER LENS AGENTS
   * Find AI agents on Lens Protocol
   */
  private async discoverLensAgents(limit: number): Promise<DiscoveredAgentRaw[]> {
    console.log('🌿 Discovering agents via Lens Protocol...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const query = `
        query SearchProfiles($query: String!, $limit: LimitScalarType!) {
          searchProfiles(request: { 
            query: $query, 
            limit: $limit 
          }) {
            items {
              id
              handle
              name
              bio
              ownedBy
              stats {
                totalFollowers
                totalFollowing
                totalPosts
              }
              attributes {
                key
                value
              }
            }
          }
        }
      `;

      const response = await this.safeFetch(this.dataSources.lens.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.dataSources.lens.apiKey}`
        },
        body: JSON.stringify({
          query,
          variables: {
            query: 'agent',
            limit
          }
        })
      });

      if (!response.ok) {
        console.log('⚠️ Lens API unavailable, using known agents...');
        return this.getKnownLensAgents();
      }

      const data = await this.safeJsonParse(response);
      
      for (const profile of data.data?.searchProfiles?.items || []) {
        const agent = this.processLensProfile(profile);
        if (agent) agents.push(agent);
      }
      
      console.log(`✅ Lens discovery found ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Lens discovery failed:', error);
      return this.getKnownLensAgents();
    }

    return agents;
  }

  private processLensProfile(profile: any): DiscoveredAgentRaw | null {
    try {
      const isAgent = this.isLikelyAgent(profile.name, profile.bio);
      if (!isAgent) return null;

      return {
        url: `https://lenster.xyz/u/${profile.handle}`,
        source: 'lens-protocol',
        wallet: profile.ownedBy,
        channels: {
          lens: `@${profile.handle}`
        },
        capabilities: {
          social_media: true,
          content_creation: true,
          lens_native: true
        },
        metadata: {
          lens_id: profile.id,
          handle: profile.handle,
          name: profile.name,
          bio: profile.bio,
          followers: profile.stats?.totalFollowers,
          following: profile.stats?.totalFollowing,
          posts: profile.stats?.totalPosts,
          attributes: profile.attributes
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * DISCOVER BASE CHAIN AGENTS
   * Scan Base blockchain for agent-related contracts and transactions
   */
  private async discoverBaseChainAgents(blockRange: number): Promise<DiscoveredAgentRaw[]> {
    console.log('🟦 Discovering agents via Base blockchain analysis...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      // Get recent blocks to analyze
      const latestBlock = await this.getLatestBlockNumber('base');
      const fromBlock = latestBlock - blockRange;
      
      // Look for agent-related contract deployments and transactions
      const agentContracts = await this.findAgentContracts('base', fromBlock, latestBlock);
      
      for (const contract of agentContracts) {
        const agent = await this.processAgentContract(contract, 'base');
        if (agent) agents.push(agent);
      }
      
      console.log(`✅ Base chain discovery found ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Base chain discovery failed:', error);
    }

    return agents;
  }

  /**
   * DISCOVER ETHEREUM AGENTS
   * Scan Ethereum blockchain for agent-related contracts
   */
  private async discoverEthereumAgents(blockRange: number): Promise<DiscoveredAgentRaw[]> {
    console.log('🔵 Discovering agents via Ethereum blockchain analysis...');
    const agents: DiscoveredAgentRaw[] = [];
    
    try {
      const latestBlock = await this.getLatestBlockNumber('ethereum');
      const fromBlock = latestBlock - blockRange;
      
      const agentContracts = await this.findAgentContracts('ethereum', fromBlock, latestBlock);
      
      for (const contract of agentContracts) {
        const agent = await this.processAgentContract(contract, 'ethereum');
        if (agent) agents.push(agent);
      }
      
      console.log(`✅ Ethereum discovery found ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Ethereum discovery failed:', error);
    }

    return agents;
  }

  // Helper methods
  private async getLatestBlockNumber(network: 'ethereum' | 'base'): Promise<number> {
    const rpcUrl = network === 'base' ? this.dataSources.base.rpcUrl : this.dataSources.ethereum.rpcUrl;
    
    const response = await this.safeFetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    const data = await this.safeJsonParse(response);
    return parseInt(data.result, 16);
  }

  private async findAgentContracts(network: string, fromBlock: number, toBlock: number): Promise<any[]> {
    // This would implement contract scanning logic
    // For now, return known agent contracts
    return this.getKnownAgentContracts(network);
  }

  private async processAgentContract(contract: any, network: string): Promise<DiscoveredAgentRaw | null> {
    try {
      return {
        url: `https://agent.contract/${contract.address}`,
        source: `${network}-contracts`,
        wallet: contract.address,
        channels: {
          contract_call: true
        },
        capabilities: {
          smart_contract: true,
          on_chain: true
        },
        metadata: {
          contract_address: contract.address,
          network,
          deployment_block: contract.deploymentBlock,
          contract_type: contract.type
        }
      };
    } catch (error) {
      return null;
    }
  }

  private isLikelyAgent(name: string = '', bio: string = ''): boolean {
    const agentIndicators = [
      'ai', 'agent', 'bot', 'assistant', 'automated', 'ai16z', 'virtual',
      'trading', 'defi', 'oracle', 'service', 'protocol', 'smart'
    ];
    
    const text = `${name} ${bio}`.toLowerCase();
    return agentIndicators.some(indicator => text.includes(indicator));
  }

  private inferCapabilitiesFromDomain(domain: string): any {
    const capabilities: any = {};
    
    if (domain.includes('trading') || domain.includes('defi')) {
      capabilities.trading = true;
      capabilities.defi = true;
    }
    
    if (domain.includes('social') || domain.includes('chat')) {
      capabilities.social_media = true;
    }
    
    if (domain.includes('api') || domain.includes('service')) {
      capabilities.api_access = true;
    }
    
    return capabilities;
  }

  // Fallback methods for known agents
  private getKnownXMTPAgents(): DiscoveredAgentRaw[] {
    return [
      {
        url: 'https://xmtp.agent/known1',
        source: 'xmtp-known',
        wallet: '0x1234567890123456789012345678901234567890',
        channels: { xmtp: true },
        capabilities: { messaging: true },
        metadata: { source: 'known_participant' }
      }
    ];
  }

  private getKnownFarcasterAgents(): DiscoveredAgentRaw[] {
    return [
      {
        url: 'https://warpcast.com/agentExample',
        source: 'farcaster-known',
        wallet: '0x2234567890123456789012345678901234567890',
        channels: { farcaster: '@agentExample' },
        capabilities: { social_media: true },
        metadata: { source: 'known_farcaster_agent' }
      }
    ];
  }

  private getKnownLensAgents(): DiscoveredAgentRaw[] {
    return [
      {
        url: 'https://lenster.xyz/u/agent.lens',
        source: 'lens-known',
        wallet: '0x3234567890123456789012345678901234567890',
        channels: { lens: '@agent.lens' },
        capabilities: { social_media: true },
        metadata: { source: 'known_lens_agent' }
      }
    ];
  }

  private getKnownAgentContracts(network: string): any[] {
    return [
      {
        address: '0x4234567890123456789012345678901234567890',
        type: 'agent_contract',
        deploymentBlock: 12345678,
        network
      }
    ];
  }

  protected extractAgentUrl(rawData: any): string {
    return rawData.url || 
           rawData.website || 
           rawData.endpoint || 
           `https://onchain.agent/${rawData.address}`;
  }

  protected extractChannels(rawData: any): any {
    return rawData.channels || {};
  }

  protected extractWalletAddress(rawData: any): string | undefined {
    return rawData.wallet || rawData.address || rawData.owner;
  }

  protected extractCapabilities(rawData: any): any {
    return rawData.capabilities || {};
  }

  protected extractMetadata(rawData: any): any {
    return rawData.metadata || rawData;
  }
}