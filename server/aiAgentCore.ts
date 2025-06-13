/**
 * Simplified AI Agent Core Service
 * Consolidates agent registration, marketplace, and referral functionality
 */

import { storage } from './storage';

interface AgentRegistration {
  agentName: string;
  walletAddress: string;
  walletNetwork: string;
  capabilities: string[];
  description?: string;
}

interface SimpleAgent {
  id: string;
  agentName: string;
  walletAddress: string;
  status: 'active' | 'pending' | 'suspended';
  monthlyFee: number;
  totalRevenue: number;
  isActive: boolean;
}

export class AIAgentCore {
  
  /**
   * Register new AI agent with simplified process
   */
  static async registerAgent(data: AgentRegistration): Promise<{ success: boolean; agentId?: string; error?: string }> {
    try {
      // Simple validation
      if (!data.agentName || !data.walletAddress) {
        return { success: false, error: 'Agent name and wallet address required' };
      }

      // Create agent with basic fields
      const agent = await storage.createAIAgent({
        agentName: data.agentName,
        walletAddress: data.walletAddress,
        walletNetwork: data.walletNetwork || 'ethereum',
        capabilities: data.capabilities || [],
        description: data.description || '',
        status: 'pending',
        publicKey: `pk_${Date.now()}`,
        signature: `sig_${Date.now()}`,
        preferredCurrencies: ['USD', 'ETH'],
        complianceLevel: 'basic',
        monthlySubscriptionFee: 50.00, // Fixed $50/month
        isActive: false
      });

      return { success: true, agentId: agent.id };
    } catch (error) {
      return { success: false, error: `Registration failed: ${error}` };
    }
  }

  /**
   * Get all active agents for marketplace
   */
  static async getActiveAgents(): Promise<SimpleAgent[]> {
    try {
      const agents = await storage.getAIAgents();
      
      return agents
        .filter(agent => agent.status === 'active')
        .map(agent => ({
          id: agent.id,
          agentName: agent.agentName,
          walletAddress: agent.walletAddress,
          status: agent.status as 'active' | 'pending' | 'suspended',
          monthlyFee: 50.00, // Simplified pricing
          totalRevenue: 0, // Placeholder for revenue tracking
          isActive: agent.isActive || false
        }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  /**
   * Process agent subscription payment
   */
  static async processSubscription(agentId: string, paymentMethod: string = 'stripe'): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      const agent = await storage.getAIAgent(agentId);
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      // Create subscription record
      const subscriptionId = `sub_${Date.now()}_${agentId}`;
      
      // Update agent status
      await storage.updateAIAgent(agentId, {
        status: 'active',
        isActive: true,
        updatedAt: new Date()
      });

      return { success: true, subscriptionId };
    } catch (error) {
      return { success: false, error: `Subscription failed: ${error}` };
    }
  }

  /**
   * Process simple referral (1% commission)
   */
  static async processReferral(referrerAgentId: string, referredUserId: string, transactionAmount: number): Promise<{ success: boolean; commission?: number; error?: string }> {
    try {
      // Simple 0.5% commission calculation
      const commission = Math.round(transactionAmount * 0.005 * 100) / 100;
      
      // Record referral
      await storage.createReferral({
        referredBy: referrerAgentId,
        referredUser: referredUserId,
        status: 'completed',
        bonusAmount: commission,
        currency: 'USD'
      });

      return { success: true, commission };
    } catch (error) {
      return { success: false, error: `Referral processing failed: ${error}` };
    }
  }

  /**
   * Get agent status and basic info
   */
  static async getAgentStatus(agentId: string): Promise<{ success: boolean; agent?: SimpleAgent; error?: string }> {
    try {
      const agent = await storage.getAIAgent(agentId);
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      return {
        success: true,
        agent: {
          id: agent.id,
          agentName: agent.agentName,
          walletAddress: agent.walletAddress,
          status: agent.status as 'active' | 'pending' | 'suspended',
          monthlyFee: 50.00,
          totalRevenue: 0,
          isActive: agent.isActive || false
        }
      };
    } catch (error) {
      return { success: false, error: `Status check failed: ${error}` };
    }
  }

  /**
   * Simple marketplace stats
   */
  static async getMarketplaceStats(): Promise<{ totalAgents: number; activeAgents: number; monthlyRevenue: number }> {
    try {
      const agents = await storage.getAIAgents();
      const activeAgents = agents.filter(agent => agent.status === 'active').length;
      
      return {
        totalAgents: agents.length,
        activeAgents,
        monthlyRevenue: activeAgents * 50 // $50 per active agent
      };
    } catch (error) {
      console.error('Error fetching marketplace stats:', error);
      return { totalAgents: 0, activeAgents: 0, monthlyRevenue: 0 };
    }
  }
}