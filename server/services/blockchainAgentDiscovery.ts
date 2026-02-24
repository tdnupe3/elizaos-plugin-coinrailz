/**
 * Blockchain Agent Discovery Service
 * 
 * Discovers AI agents by checking on-chain wallet activity and resolving
 * ENS/basename domains to find .well-known/agent-card.json endpoints.
 * 
 * Updated: October 2025
 */

import { AGENT_WALLET_ADDRESSES } from './verifiedAgentTargets';
import type { DiscoveredAgentRaw } from './agentDiscoveryService';

export class BlockchainAgentDiscoveryService {
  private agentCardPaths = [
    '/.well-known/agent-card.json',
    '/.well-known/agent.json'
  ];

  /**
   * Discover agents by wallet activity - check known agent wallets for ENS/basename
   */
  async discoverAgentsByWalletActivity(): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    console.log(`🔍 Checking ${AGENT_WALLET_ADDRESSES.length} known agent wallet addresses...`);
    
    for (const walletAddress of AGENT_WALLET_ADDRESSES) {
      try {
        // Resolve ENS name
        const ensName = await this.resolveENS(walletAddress);
        
        if (ensName) {
          console.log(`✅ Resolved ENS for ${walletAddress}: ${ensName}`);
          
          // Try to fetch agent card from ENS domain
          const agentCard = await this.fetchAgentCardFromDomain(ensName);
          
          if (agentCard) {
            agents.push({
              url: `https://${ensName}`,
              source: 'blockchain-wallet-discovery',
              wallet: walletAddress,
              channels: {
                push_protocol: true,
                webhook: agentCard.endpoints?.['message/send']
              },
              capabilities: agentCard.capabilities || {},
              metadata: {
                ensName,
                verified: true,
                discoveryMethod: 'ens-resolution',
                name: agentCard.name,
                description: agentCard.description
              }
            });
            
            console.log(`✅ Discovered agent from wallet ${walletAddress}: ${agentCard.name}`);
          }
        }
        
        // Also try Base basename resolution (.base.eth)
        const basename = await this.resolveBasename(walletAddress);
        
        if (basename) {
          console.log(`✅ Resolved basename for ${walletAddress}: ${basename}`);
          
          const agentCard = await this.fetchAgentCardFromDomain(`${basename}.limo`);
          
          if (agentCard) {
            agents.push({
              url: `https://${basename}.limo`,
              source: 'blockchain-basename-discovery',
              wallet: walletAddress,
              channels: {
                webhook: agentCard.endpoints?.['message/send']
              },
              capabilities: agentCard.capabilities || {},
              metadata: {
                basename,
                verified: true,
                discoveryMethod: 'basename-resolution',
                name: agentCard.name,
                description: agentCard.description
              }
            });
            
            console.log(`✅ Discovered agent from basename ${basename}: ${agentCard.name}`);
          }
        }
        
      } catch (error) {
        console.log(`⚠️ Could not resolve wallet ${walletAddress}:`, (error as Error).message);
      }
    }
    
    return agents;
  }

  /**
   * Resolve ENS name for a wallet address (Ethereum mainnet)
   */
  private async resolveENS(walletAddress: string): Promise<string | null> {
    try {
      // Use public ENS resolver
      const response = await fetch(
        `https://api.ensideas.com/ens/resolve/${walletAddress}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.name || null;
      }
    } catch (error) {
      console.log(`⚠️ ENS resolution failed for ${walletAddress}`);
    }
    
    return null;
  }

  /**
   * Resolve basename for a wallet address (Base chain)
   */
  private async resolveBasename(walletAddress: string): Promise<string | null> {
    try {
      // Base basename lookup would go here
      // For now, return null - this would require Base chain RPC calls
      return null;
    } catch (error) {
      console.log(`⚠️ Basename resolution failed for ${walletAddress}`);
    }
    
    return null;
  }

  /**
   * Fetch agent card from a resolved domain
   */
  private async fetchAgentCardFromDomain(domain: string): Promise<any | null> {
    for (const cardPath of this.agentCardPaths) {
      try {
        const url = `https://${domain}${cardPath}`;
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CoinRailz-A2A-Platform/1.0'
          }
        });
        
        if (response.ok) {
          const agentCard = await response.json();
          
          if (agentCard && agentCard.name) {
            return agentCard;
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }
    
    return null;
  }

  /**
   * Discover agents from on-chain transactions
   * Looks for wallets that interact with known agent contracts
   */
  async discoverFromOnChainActivity(): Promise<DiscoveredAgentRaw[]> {
    const agents: DiscoveredAgentRaw[] = [];
    
    // This would analyze blockchain transactions to find agent wallets
    // For now, return empty array - requires blockchain indexer/explorer API
    
    return agents;
  }
}
