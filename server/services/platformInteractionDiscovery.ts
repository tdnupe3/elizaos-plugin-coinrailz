/**
 * Platform Interaction Discovery Service
 * 
 * Automatically discovers AI agents by monitoring platform interactions:
 * - x402 payment transactions
 * - Self-registration submissions
 * - Marketplace orders
 * - Agent card requests
 */

import { pool } from '../db';
import { AGENT_WALLET_ADDRESSES, VERIFIED_AGENT_TARGETS } from './verifiedAgentTargets';

export interface DiscoveredAgentInteraction {
  wallet_address?: string;
  interaction_type: 'x402_payment' | 'self_registration' | 'marketplace_order' | 'agent_card_request';
  timestamp: string;
  metadata: any;
}

export class PlatformInteractionDiscovery {
  /**
   * Monitor x402 payments for new agent wallets
   */
  async discoverFromX402Payments(): Promise<string[]> {
    try {
      const result = await pool.query(`
        SELECT DISTINCT wallet_address 
        FROM x402_payments
        WHERE wallet_address IS NOT NULL
          AND wallet_address NOT IN (SELECT unnest($1::text[]))
        ORDER BY created_at DESC
      `, [AGENT_WALLET_ADDRESSES]);

      const newWallets = result.rows.map(r => r.wallet_address);
      
      if (newWallets.length > 0) {
        console.log(`📍 Discovered ${newWallets.length} new agent wallets from x402 payments:`);
        newWallets.forEach(wallet => console.log(`  - ${wallet}`));
        
        // Save to discovered_agents table
        for (const wallet of newWallets) {
          await this.saveDiscoveredAgent(wallet, 'x402_payment');
        }
      }

      return newWallets;
    } catch (error) {
      console.error('Error discovering from x402 payments:', error);
      return [];
    }
  }

  /**
   * Monitor self-registration for new agents
   */
  async discoverFromSelfRegistration(): Promise<string[]> {
    try {
      // Check for recently registered agents (last 24 hours)
      const result = await pool.query(`
        SELECT DISTINCT url, metadata
        FROM discovered_agents
        WHERE source = 'self-registration'
          AND discovered_at > NOW() - INTERVAL '24 hours'
        ORDER BY discovered_at DESC
      `);

      console.log(`📝 Found ${result.rows.length} self-registered agents in last 24 hours`);
      
      return result.rows.map(r => r.url);
    } catch (error) {
      console.error('Error discovering from self-registration:', error);
      return [];
    }
  }

  /**
   * Monitor marketplace orders for agent activity
   */
  async discoverFromMarketplaceOrders(): Promise<string[]> {
    try {
      const result = await pool.query(`
        SELECT DISTINCT agent_id, metadata
        FROM marketplace_orders
        WHERE created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50
      `);

      if (result.rows.length > 0) {
        console.log(`🛒 Found ${result.rows.length} marketplace orders from agents in last 7 days`);
      }

      return result.rows.map(r => r.agent_id);
    } catch (error) {
      console.error('Error discovering from marketplace orders:', error);
      return [];
    }
  }

  /**
   * Monitor agent card requests (A2A protocol discovery)
   */
  async monitorAgentCardRequests(): Promise<any[]> {
    try {
      // This would track requests to our agent card endpoints
      // For now, return empty - would need access log analysis
      return [];
    } catch (error) {
      console.error('Error monitoring agent card requests:', error);
      return [];
    }
  }

  /**
   * Save discovered agent to database
   */
  private async saveDiscoveredAgent(identifier: string, source: string): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO discovered_agents (url, source, wallet, channels, status, discovered_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (url) DO UPDATE SET
          last_seen_at = NOW(),
          status = 'active'
      `, [
        identifier,
        source,
        identifier, // Use identifier as wallet if it looks like an address
        JSON.stringify({ discovered_via: source }),
        'discovered'
      ]);
    } catch (error) {
      console.error(`Error saving discovered agent ${identifier}:`, error);
    }
  }

  /**
   * Run full discovery scan
   */
  async runDiscoveryScan(): Promise<{
    x402_wallets: string[];
    self_registered: string[];
    marketplace_agents: string[];
    total_new: number;
  }> {
    console.log('\n🔍 Running platform interaction discovery scan...');
    
    const [x402_wallets, self_registered, marketplace_agents] = await Promise.all([
      this.discoverFromX402Payments(),
      this.discoverFromSelfRegistration(),
      this.discoverFromMarketplaceOrders()
    ]);

    const total_new = x402_wallets.length + self_registered.length + marketplace_agents.length;

    console.log(`\n📊 Discovery Scan Results:`);
    console.log(`  - x402 payments: ${x402_wallets.length} new wallets`);
    console.log(`  - Self-registered: ${self_registered.length} agents`);
    console.log(`  - Marketplace orders: ${marketplace_agents.length} agents`);
    console.log(`  - Total new discoveries: ${total_new}`);

    return {
      x402_wallets,
      self_registered,
      marketplace_agents,
      total_new
    };
  }
}

// Singleton instance
export const platformInteractionDiscovery = new PlatformInteractionDiscovery();
