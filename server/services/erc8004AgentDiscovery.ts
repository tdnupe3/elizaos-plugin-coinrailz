import { ethers } from 'ethers';
import { ERC8004_CONTRACTS, IDENTITY_REGISTRY_ABI } from '../config/blockchain';
import { persistDiscoveredAgent } from './persistence/discoveredAgentPersistence';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface AgentRegistration {
  tokenId: number;
  walletAddress: string;
  agentCardURI: string;
  isActive: boolean;
}

interface AgentCardData {
  name: string;
  description?: string;
  capabilities?: string[];
  endpoints?: Record<string, any>;
  evm_address?: string;
  supportedTrust?: string[];
}

export class ERC8004AgentDiscovery {
  private provider: ethers.JsonRpcProvider;
  private identityRegistry: ethers.Contract;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(ERC8004_CONTRACTS.rpcUrl);
    this.identityRegistry = new ethers.Contract(
      ERC8004_CONTRACTS.contracts.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      this.provider
    );
  }
  
  async discoverAllRegisteredAgents(): Promise<{
    discovered: number;
    total: number;
    agents: AgentRegistration[];
  }> {
    console.log('🔍 Querying ERC-8004 IdentityRegistry on Base mainnet...');
    console.log(`📍 Contract: ${ERC8004_CONTRACTS.contracts.identityRegistry}`);
    console.log('⚠️ Note: Contract data methods broken - using ownerOf() workaround');
    
    try {
      const registrations: AgentRegistration[] = [];
      
      console.log('📊 Checking tokens 1-10 for existence...');
      
      for (let tokenId = 1; tokenId <= 10; tokenId++) {
        try {
          const owner = await this.identityRegistry.ownerOf(tokenId);
          
          if (owner && owner !== ethers.ZeroAddress) {
            const isBurnAddress = ['0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002'].includes(owner);
            
            registrations.push({
              tokenId,
              walletAddress: owner,
              agentCardURI: `https://basescan.org/token/${ERC8004_CONTRACTS.contracts.identityRegistry}?a=${tokenId}`,
              isActive: !isBurnAddress
            });
            
            if (isBurnAddress) {
              console.log(`⚠️ Token #${tokenId}: ${owner} (burn address - not real agent)`);
            } else {
              console.log(`✅ Token #${tokenId}: ${owner.slice(0, 10)}... (real wallet)`);
            }
          }
          
        } catch (error) {
          const msg = (error as Error).message;
          if (msg.includes('ERC721') || msg.includes('nonexistent') || msg.includes('invalid token')) {
            console.log(`⏭️ Token #${tokenId}: Not minted (end of token list)`);
            break;
          }
          console.log(`⏭️ Token #${tokenId}: ${msg.slice(0, 50)}...`);
          break;
        }
      }
      
      console.log(`\n📊 CONTRACT STATUS:`);
      console.log(`   Total tokens found: ${registrations.length}`);
      console.log(`   Real agents: ${registrations.filter(r => r.isActive).length}`);
      console.log(`   Burn addresses: ${registrations.filter(r => !r.isActive).length}`);
      console.log(`   ⚠️ Contract bug: getAgentInfo() and tokenURI() methods revert`);
      console.log(`   ⚠️ Solution: Tokens exist but agent data is inaccessible\n`);
      
      const savedCount = await this.saveDiscoveredAgents(registrations);
      
      return {
        discovered: savedCount,
        total: registrations.length,
        agents: registrations
      };
      
    } catch (error) {
      console.error('❌ Error discovering agents from ERC-8004:', error);
      throw error;
    }
  }
  
  private async fetchAgentCard(uri: string): Promise<AgentCardData | null> {
    try {
      if (uri.startsWith('ipfs://')) {
        uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      
      const response = await fetch(uri, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinRailz-ERC8004-Discovery/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        console.log(`⚠️ Failed to fetch agent card from ${uri}: ${response.status}`);
        return null;
      }
      
      const data = await response.json() as AgentCardData;
      return data;
      
    } catch (error) {
      console.log(`⚠️ Error fetching agent card from ${uri}:`, (error as Error).message);
      return null;
    }
  }
  
  private async saveDiscoveredAgents(registrations: AgentRegistration[]): Promise<number> {
    console.log(`💾 Saving ${registrations.length} discovered agents to database...`);
    
    let savedCount = 0;
    
    for (const registration of registrations) {
      try {
        const agentCard = await this.fetchAgentCard(registration.agentCardURI);
        
        const existing = await db.select()
          .from(discoveredAgents)
          .where(eq(discoveredAgents.wallet, registration.walletAddress.toLowerCase()))
          .limit(1);
        
        const metadata = {
          erc8004TokenId: registration.tokenId,
          agentCardURI: registration.agentCardURI,
          isActiveOnChain: registration.isActive,
          discoverySource: 'erc8004-on-chain',
          contractAddress: ERC8004_CONTRACTS.contracts.identityRegistry,
          chain: 'base-mainnet',
          agentCardData: agentCard
        };
        
        const capabilities = agentCard ? {
          name: agentCard.name,
          description: agentCard.description,
          capabilities: agentCard.capabilities || [],
          endpoints: agentCard.endpoints || {},
          supportedTrust: agentCard.supportedTrust || []
        } : null;
        
        const score = registration.isActive ? 80 : 40;
        const url = registration.agentCardURI.startsWith('http') 
          ? registration.agentCardURI 
          : `https://basescan.org/token/${ERC8004_CONTRACTS.contracts.identityRegistry}?a=${registration.tokenId}`;
        
        if (existing.length > 0) {
          await db.update(discoveredAgents)
            .set({
              lastSeenAt: new Date(),
              score,
              metadata,
          capabilities: capabilities ?? undefined,
              status: registration.isActive ? 'verified' : 'unreachable'
            })
            .where(eq(discoveredAgents.wallet, registration.walletAddress.toLowerCase()));
          
          console.log(`🔄 Updated agent #${registration.tokenId}: ${registration.walletAddress.slice(0, 10)}...`);
        } else {
          await persistDiscoveredAgent({
            url,
            source: 'erc8004',
            wallet: registration.walletAddress.toLowerCase(),
            status: registration.isActive ? 'verified' : 'new',
            score,
            capabilities: capabilities ?? undefined,
            metadata,
            channels: agentCard?.endpoints ? {
              a2a: !!agentCard.endpoints.a2a,
              mcp: !!agentCard.endpoints.mcp
            } : undefined,
            verifiedAt: registration.isActive ? new Date() : undefined,
          });
          
          console.log(`✅ Saved agent #${registration.tokenId}: ${agentCard?.name || 'Unknown'} (${registration.walletAddress.slice(0, 10)}...)`);
          savedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error saving agent ${registration.walletAddress}:`, error);
      }
    }
    
    console.log(`✅ Discovery complete: ${savedCount} new agents, ${registrations.length - savedCount} updated`);
    return savedCount;
  }
  
  async getDiscoveryStats(): Promise<{
    totalOnChain: number;
    totalInDatabase: number;
    activeAgents: number;
    averageScore: number;
  }> {
    const agents = await db.select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'erc8004'));
    
    const avgScore = agents.reduce((sum: number, a) => sum + (a.score || 0), 0) / agents.length || 0;
    const active = agents.filter(a => a.status === 'verified');
    
    let totalOnChain = 0;
    try {
      const events = await this.identityRegistry.queryFilter(
        this.identityRegistry.filters.Transfer(ethers.ZeroAddress, null, null)
      );
      totalOnChain = events.length;
    } catch (error) {
      console.error('Error getting on-chain count:', error);
    }
    
    return {
      totalOnChain,
      totalInDatabase: agents.length,
      activeAgents: active.length,
      averageScore: Math.round(avgScore)
    };
  }
}

export const erc8004Discovery = new ERC8004AgentDiscovery();
