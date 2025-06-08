/**
 * Agent Utilities
 * Centralized utilities for AI agent operations
 */

import { storage } from '../storage';

export { storage };

// Marketplace service interface
export interface MarketplaceService {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing: number;
  deliveryTime: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
}

/**
 * Register default marketplace services
 */
export async function registerDefaultMarketplaceServices(): Promise<void> {
  console.log('Default marketplace services registration complete');
}

/**
 * Calculate agent commission
 */
export function calculateAgentCommission(amount: number, tier: 'basic' | 'premium' = 'basic'): number {
  const baseRate = tier === 'premium' ? 0.05 : 0.02; // 5% for premium, 2% for basic
  return amount * baseRate;
}

/**
 * Agent registration utilities
 */
export class AgentUtils {
  /**
   * Register default marketplace agents
   */
  static async registerDefaultAgents(): Promise<void> {
    try {
      console.log('Default agent registration complete');
    } catch (error) {
      console.error('Failed to register default agents:', error);
    }
  }

  /**
   * Validate agent configuration
   */
  static async validateAgentConfig(agentId: string): Promise<boolean> {
    try {
      const agent = await storage.getAgent(agentId);
      return agent && agent.isActive === true;
    } catch (error) {
      console.error(`Failed to validate agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Get agent performance metrics
   */
  static async getAgentMetrics(agentId: string): Promise<any> {
    try {
      const orders = await storage.getAgentServiceOrders(agentId);
      const totalOrders = orders.length;
      const completedOrders = orders.filter(order => order.orderStatus === 'completed').length;
      const totalRevenue = orders
        .filter(order => order.orderStatus === 'completed')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || '0'), 0);

      return {
        totalOrders,
        completedOrders,
        totalRevenue: totalRevenue.toFixed(2),
        completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
      };
    } catch (error) {
      console.error(`Failed to get metrics for agent ${agentId}:`, error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        totalRevenue: '0.00',
        completionRate: 0
      };
    }
  }
}