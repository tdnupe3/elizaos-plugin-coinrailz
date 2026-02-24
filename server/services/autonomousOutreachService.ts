/**
 * Autonomous Outreach Service
 * 
 * Performs autonomous outreach to AI agents without human intervention
 * using A2A protocol discovery, blockchain messaging, and social platforms
 */

import axios from 'axios';
import { pool } from '../db';
import { VERIFIED_AGENT_TARGETS, AGENT_WALLET_ADDRESSES } from './verifiedAgentTargets';

export interface OutreachResult {
  method: string;
  target: string;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
}

export class AutonomousOutreachService {
  private outreachResults: OutreachResult[] = [];

  /**
   * Execute full autonomous outreach campaign
   */
  async executeOutreach(): Promise<OutreachResult[]> {
    console.log('🚀 Starting autonomous AI agent outreach...');
    this.outreachResults = [];

    // 1. Try A2A protocol discovery on verified targets
    await this.discoverViaA2A();

    // 2. Message any discovered agents
    await this.contactDiscoveredAgents();

    // 3. Report on wallet-only agents (can't contact via A2A yet)
    await this.reportWalletOnlyAgents();

    console.log(`\n📊 Outreach Results: ${this.outreachResults.length} attempts`);
    return this.outreachResults;
  }

  /**
   * Attempt A2A protocol discovery on verified agent domains
   */
  private async discoverViaA2A(): Promise<void> {
    console.log('\n🔍 Phase 1: A2A Protocol Discovery');
    
    for (const target of VERIFIED_AGENT_TARGETS) {
      if (!target.domain) continue;

      try {
        // Check for .well-known/agent-card.json endpoint
        const url = `https://${target.domain}/.well-known/agent-card.json`;
        console.log(`  Checking: ${url}`);

        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'CoinRailz-A2A-Discovery/1.0',
            'Accept': 'application/json'
          },
          validateStatus: (status) => status < 500 // Don't throw on 404
        });

        if (response.status === 200 && response.data) {
          console.log(`  ✅ Found A2A agent card at ${target.domain}`);
          
          // Save discovered agent to database
          await this.saveDiscoveredAgent({
            url: url,
            agentCard: response.data,
            source: 'a2a-protocol',
            domain: target.domain
          });

          this.outreachResults.push({
            method: 'a2a-discovery',
            target: target.domain,
            success: true,
            message: 'Agent card found',
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`  ❌ No agent card at ${target.domain} (HTTP ${response.status})`);
          this.outreachResults.push({
            method: 'a2a-discovery',
            target: target.domain,
            success: false,
            error: `HTTP ${response.status}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error: any) {
        const errorMsg = error.code === 'ENOTFOUND' ? 'Domain not found' :
                        error.code === 'ETIMEDOUT' ? 'Timeout' :
                        error.message;
        console.log(`  ❌ Error checking ${target.domain}: ${errorMsg}`);
        
        this.outreachResults.push({
          method: 'a2a-discovery',
          target: target.domain,
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Save discovered agent to database
   */
  private async saveDiscoveredAgent(data: {
    url: string;
    agentCard: any;
    source: string;
    domain: string;
  }): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO discovered_agents (url, source, channels, capabilities, metadata, status, discovered_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (url) DO UPDATE SET
          channels = EXCLUDED.channels,
          capabilities = EXCLUDED.capabilities,
          metadata = EXCLUDED.metadata,
          status = EXCLUDED.status,
          last_seen_at = NOW()
      `, [
        data.url,
        data.source,
        JSON.stringify({ a2a_endpoint: data.url }),
        JSON.stringify(data.agentCard.capabilities || {}),
        JSON.stringify({ agent_card: data.agentCard, domain: data.domain }),
        'discovered'
      ]);
    } catch (error) {
      console.error('Error saving discovered agent:', error);
    }
  }

  /**
   * Contact discovered agents with our platform offer
   */
  private async contactDiscoveredAgents(): Promise<void> {
    console.log('\n💬 Phase 2: Contacting Discovered Agents');

    try {
      // Get agents discovered in last 24 hours that haven't been contacted
      const result = await pool.query(`
        SELECT id, url, channels, metadata
        FROM discovered_agents
        WHERE source = 'a2a-protocol'
          AND status = 'discovered'
          AND (last_contact_at IS NULL OR last_contact_at < NOW() - INTERVAL '7 days')
        ORDER BY discovered_at DESC
        LIMIT 10
      `);

      if (result.rows.length === 0) {
        console.log('  No newly discovered agents to contact');
        return;
      }

      console.log(`  Found ${result.rows.length} agents to contact`);

      for (const agent of result.rows) {
        await this.sendOutreachMessage(agent);
      }
    } catch (error) {
      console.error('Error contacting agents:', error);
    }
  }

  /**
   * Send outreach message to a discovered agent
   */
  private async sendOutreachMessage(agent: any): Promise<void> {
    try {
      const agentCard = agent.metadata?.agent_card;
      const contactEndpoint = agentCard?.endpoints?.contact || agentCard?.endpoints?.message;

      if (!contactEndpoint) {
        console.log(`  ⚠️  No contact endpoint for agent ${agent.url}`);
        return;
      }

      const message = this.generateOutreachMessage(agentCard);

      console.log(`  📤 Sending message to ${agent.url}`);
      
      // Attempt to send message via A2A protocol
      const response = await axios.post(contactEndpoint, {
        from: {
          platform: 'Coin Railz',
          endpoint: process.env.REPL_URL || 'https://coinrailz.com',
          agent_card: `${process.env.REPL_URL || 'https://coinrailz.com'}/api/platform/.well-known/agent-card.json`
        },
        message: message,
        subject: 'Payment Infrastructure Partnership Opportunity',
        metadata: {
          outreach_type: 'partnership',
          platform: 'coin_railz'
        }
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CoinRailz-A2A-Client/1.0'
        },
        validateStatus: (status) => status < 500
      });

      if (response.status === 200 || response.status === 201 || response.status === 202) {
        console.log(`  ✅ Message sent successfully to ${agent.url}`);
        
        // Update last_contact_at
        await pool.query(`
          UPDATE discovered_agents
          SET last_contact_at = NOW(), attempts = attempts + 1, success_count = success_count + 1
          WHERE id = $1
        `, [agent.id]);

        this.outreachResults.push({
          method: 'a2a-message',
          target: agent.url,
          success: true,
          message: 'Outreach message delivered',
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`  ⚠️  Message not accepted by ${agent.url} (HTTP ${response.status})`);
        
        await pool.query(`
          UPDATE discovered_agents
          SET last_contact_at = NOW(), attempts = attempts + 1
          WHERE id = $1
        `, [agent.id]);

        this.outreachResults.push({
          method: 'a2a-message',
          target: agent.url,
          success: false,
          error: `HTTP ${response.status}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to contact ${agent.url}:`, error.message);
      
      this.outreachResults.push({
        method: 'a2a-message',
        target: agent.url,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate outreach message for AI agents
   */
  private generateOutreachMessage(agentCard: any): string {
    const platformUrl = process.env.REPL_URL || 'https://coinrailz.com';
    
    return `Hello from Coin Railz!

We discovered your AI agent through the A2A protocol and would like to offer payment infrastructure for your platform.

**What We Offer:**
• x402 Protocol: Autonomous USDC payments on Base Chain (~2 second settlement)
• Marketplace Escrow: Safe payment holding for agent services  
• Multi-chain Support: Accept payments on Ethereum, Base, Polygon, Arbitrum
• Revenue Share: 85% to you, 15% platform fee

**Why Partner With Us:**
• Zero integration complexity - REST API + x402 standard
• Instant USDC settlements with no KYC required
• Proven infrastructure (10+ production Circle wallets)
• Crypto-native payment rails built for AI agents

**Get Started:**
1. Register your agent: ${platformUrl}/api/agents/self-register
2. Start accepting payments immediately
3. View our agent cards: ${platformUrl}/api/agents/directory

Interested? Reply via your A2A endpoint or visit our platform.

Coin Railz Team
${platformUrl}`;
  }

  /**
   * Report on wallet-only agents that can't be contacted via A2A yet
   */
  private async reportWalletOnlyAgents(): Promise<void> {
    console.log('\n💼 Wallet-Only Agents (No A2A endpoints yet):');
    
    for (const target of VERIFIED_AGENT_TARGETS) {
      if (target.wallet && !target.domain) {
        console.log(`  ℹ️  ${target.description}`);
        console.log(`     Wallet: ${target.wallet}`);
        console.log(`     Platform: ${target.platform}`);
        console.log(`     Status: Verified but no A2A endpoint available`);
        console.log(`     Future: Can contact via on-chain messaging`);
        
        this.outreachResults.push({
          method: 'wallet-only',
          target: target.wallet!,
          success: false,
          message: 'Wallet verified but no A2A endpoint to contact',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Get outreach statistics
   */
  getStatistics(): {
    total_attempts: number;
    successful: number;
    failed: number;
    wallet_only: number;
    by_method: Record<string, { success: number; failed: number }>;
  } {
    const stats = {
      total_attempts: this.outreachResults.length,
      successful: this.outreachResults.filter(r => r.success).length,
      failed: this.outreachResults.filter(r => !r.success && r.method !== 'wallet-only').length,
      wallet_only: this.outreachResults.filter(r => r.method === 'wallet-only').length,
      by_method: {} as Record<string, { success: number; failed: number }>
    };

    for (const result of this.outreachResults) {
      if (!stats.by_method[result.method]) {
        stats.by_method[result.method] = { success: 0, failed: 0 };
      }
      if (result.success) {
        stats.by_method[result.method].success++;
      } else {
        stats.by_method[result.method].failed++;
      }
    }

    return stats;
  }
}

// Singleton instance
export const autonomousOutreachService = new AutonomousOutreachService();
