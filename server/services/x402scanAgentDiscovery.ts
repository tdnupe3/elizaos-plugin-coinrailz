import axios from 'axios';
import { persistDiscoveredAgent } from './persistence/discoveredAgentPersistence';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface X402Transaction {
  senderAddress: string;
  recipientAddress: string;
  amount: string;
  timestamp: string;
  chain: string;
  facilitator: string;
  serverUrl?: string;
}

interface AgentSpendingProfile {
  walletAddress: string;
  totalSpent: number;
  transactionCount: number;
  lastActivity: Date;
  preferredServices: string[];
  averageTransactionSize: number;
  chains: string[];
  facilitators: string[];
}

export class X402ScanAgentDiscovery {
  private baseUrl = 'https://www.x402scan.com';
  
  /**
   * NOTE: x402scan migrated to v2 (Next.js client-side rendering) in late 2025.
   * HTML table scraping no longer works. This method now returns empty gracefully.
   * TODO: Integrate with x402scan API when they expose public endpoints, or
   * query on-chain data directly from facilitator contracts.
   */
  async scrapeTransactions(limit: number = 100): Promise<X402Transaction[]> {
    console.log(`🔍 Starting x402scan transaction scrape (limit: ${limit})`);
    
    try {
      const response = await axios.get(`${this.baseUrl}/transactions`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'CoinRailz-Agent-Discovery/1.0'
        }
      });
      
      const html = response.data;
      const transactions: X402Transaction[] = [];
      
      // Detect Next.js v2 migration (client-side rendered, no HTML tables)
      const isNextJsApp = html.includes('/_next/static/chunks') || html.includes('__NEXT_DATA__');
      if (isNextJsApp) {
        console.log(`⚠️ x402scan v2 detected (Next.js client-side rendering)`);
        console.log(`📋 HTML scraping deprecated - x402scan no longer serves server-rendered tables`);
        console.log(`💡 Agent discovery continues via A2A Registry, on-chain lookups, and Coinbase Bazaar`);
        return []; // Graceful empty return - other discovery methods still work
      }
      
      const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
      const rows = html.match(tableRowRegex) || [];
      
      console.log(`📊 Found ${rows.length} table rows`);
      
      // If no rows found but not detected as Next.js, log warning
      if (rows.length === 0) {
        console.log(`⚠️ No table rows found - x402scan may have changed structure`);
        return [];
      }
      
      for (const row of rows.slice(0, limit)) {
        if (!row.includes('Sender') && row.includes('0x')) {
          const senderMatch = row.match(/0x[a-fA-F0-9]{4}\.{3}[a-fA-F0-9]{6}/);
          const amountMatch = row.match(/\$(\d+\.?\d*)/);
          const chainMatch = row.match(/Base|Solana|Ethereum|Polygon|Arbitrum/i);
          const facilitatorMatch = row.match(/Coinbase|Daydreams|PayAI|OpenX402|CodeNut|X402rs|AceData|ChaosChain/i);
          const serverMatch = row.match(/href="\/server\/[^"]*">([^<]+)</);
          
          if (senderMatch) {
            const senderShort = senderMatch[0];
            const senderFull = this.expandShortAddress(senderShort);
            
            transactions.push({
              senderAddress: senderFull,
              recipientAddress: serverMatch?.[1] || 'unknown',
              amount: amountMatch?.[1] || '0',
              timestamp: new Date().toISOString(),
              chain: chainMatch?.[0] || 'Base',
              facilitator: facilitatorMatch?.[0] || 'unknown',
              serverUrl: serverMatch?.[1]
            });
          }
        }
      }
      
      console.log(`✅ Parsed ${transactions.length} transactions`);
      return transactions;
      
    } catch (error: any) {
      // Graceful error handling - don't break discovery pipeline
      console.error('⚠️ x402scan scrape unavailable:', error?.message || 'Unknown error');
      console.log(`💡 Continuing with other discovery methods (A2A Registry, on-chain, Bazaar)`);
      return []; // Return empty instead of throwing
    }
  }
  
  private expandShortAddress(shortAddr: string): string {
    const prefix = shortAddr.substring(0, 6);
    const suffix = shortAddr.substring(shortAddr.length - 6);
    return `${prefix}${'0'.repeat(30)}${suffix}`;
  }
  
  async analyzeSpendingPatterns(transactions: X402Transaction[]): Promise<AgentSpendingProfile[]> {
    console.log(`📊 Analyzing spending patterns for ${transactions.length} transactions`);
    
    const agentMap = new Map<string, AgentSpendingProfile>();
    
    for (const tx of transactions) {
      const address = tx.senderAddress.toLowerCase();
      
      if (!agentMap.has(address)) {
        agentMap.set(address, {
          walletAddress: address,
          totalSpent: 0,
          transactionCount: 0,
          lastActivity: new Date(tx.timestamp),
          preferredServices: [],
          averageTransactionSize: 0,
          chains: [],
          facilitators: []
        });
      }
      
      const profile = agentMap.get(address)!;
      profile.totalSpent += parseFloat(tx.amount);
      profile.transactionCount++;
      profile.lastActivity = new Date(tx.timestamp);
      
      if (tx.serverUrl && !profile.preferredServices.includes(tx.serverUrl)) {
        profile.preferredServices.push(tx.serverUrl);
      }
      
      if (!profile.chains.includes(tx.chain)) {
        profile.chains.push(tx.chain);
      }
      
      if (!profile.facilitators.includes(tx.facilitator)) {
        profile.facilitators.push(tx.facilitator);
      }
      
      profile.averageTransactionSize = profile.totalSpent / profile.transactionCount;
    }
    
    const profiles = Array.from(agentMap.values());
    
    profiles.sort((a, b) => b.totalSpent - a.totalSpent);
    
    console.log(`✅ Generated ${profiles.length} agent spending profiles`);
    console.log(`💰 Top spender: ${profiles[0]?.walletAddress} ($${profiles[0]?.totalSpent.toFixed(2)})`);
    
    return profiles;
  }
  
  async saveDiscoveredAgents(profiles: AgentSpendingProfile[]): Promise<number> {
    console.log(`💾 Saving ${profiles.length} discovered agents to database`);
    
    let savedCount = 0;
    
    for (const profile of profiles) {
      try {
        const existing = await db.select()
          .from(discoveredAgents)
          .where(eq(discoveredAgents.wallet, profile.walletAddress))
          .limit(1);
        
        const metadata = {
          totalSpent: profile.totalSpent,
          transactionCount: profile.transactionCount,
          averageTransactionSize: profile.averageTransactionSize,
          chains: profile.chains,
          facilitators: profile.facilitators,
          discoverySource: 'x402scan_transactions'
        };
        
        const capabilities = {
          preferredServices: profile.preferredServices,
          activeUser: profile.transactionCount > 5,
          highValueUser: profile.totalSpent > 10
        };
        
        const score = Math.min(100, Math.floor(
          (profile.transactionCount * 10) + 
          (profile.totalSpent * 2) +
          (profile.preferredServices.length * 5)
        ));
        
        if (existing.length > 0) {
          await db.update(discoveredAgents)
            .set({
              lastSeenAt: new Date(),
              score,
              metadata,
              capabilities,
              status: 'verified'
            })
            .where(eq(discoveredAgents.wallet, profile.walletAddress));
          
          console.log(`🔄 Updated existing agent: ${profile.walletAddress.slice(0, 10)}...`);
        } else {
          await persistDiscoveredAgent({
            url: `https://basescan.org/address/${profile.walletAddress}`,
            source: 'x402scan',
            wallet: profile.walletAddress,
            status: 'verified',
            score,
            capabilities,
            metadata,
          });
          
          console.log(`✅ Saved new agent: ${profile.walletAddress.slice(0, 10)}... (score: ${score})`);
          savedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error saving agent ${profile.walletAddress}:`, error);
      }
    }
    
    console.log(`✅ Discovery complete: ${savedCount} new agents, ${profiles.length - savedCount} updated`);
    return savedCount;
  }
  
  async discoverAndSaveAgents(transactionLimit: number = 200): Promise<{
    discovered: number;
    totalTransactions: number;
    topAgents: AgentSpendingProfile[];
  }> {
    console.log(`🚀 Starting x402scan agent discovery pipeline`);
    console.log(`📊 Target: ${transactionLimit} transactions`);
    
    const transactions = await this.scrapeTransactions(transactionLimit);
    
    const profiles = await this.analyzeSpendingPatterns(transactions);
    
    const savedCount = await this.saveDiscoveredAgents(profiles);
    
    const topAgents = profiles.slice(0, 10);
    
    return {
      discovered: savedCount,
      totalTransactions: transactions.length,
      topAgents
    };
  }
  
  async getDiscoveredAgentStats(): Promise<{
    totalAgents: number;
    verifiedAgents: number;
    averageScore: number;
    highValueAgents: number;
  }> {
    const agents = await db.select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'x402scan'));
    
    const verified = agents.filter(a => a.status === 'verified');
    const avgScore = agents.reduce((sum, a) => sum + (a.score || 0), 0) / agents.length || 0;
    const highValue = agents.filter(a => (a.score || 0) > 50);
    
    return {
      totalAgents: agents.length,
      verifiedAgents: verified.length,
      averageScore: Math.round(avgScore),
      highValueAgents: highValue.length
    };
  }
}

export const x402ScanDiscovery = new X402ScanAgentDiscovery();
