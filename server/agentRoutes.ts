/**
 * AI Agent Routes - Simplified
 */

import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { z } from "zod";

// Simple validation schemas
const agentRegistrationSchema = z.object({
  agentName: z.string().min(3),
  walletAddress: z.string().min(10),
  walletNetwork: z.string().default('ethereum'),
  capabilities: z.array(z.string()).default([]),
  description: z.string().optional()
});

export function registerAgentRoutes(app: Express) {

  // Register new AI agent - LOCKED DOWN
  // External agent registration is temporarily closed - platform services only
  app.post('/api/agents/register', async (req, res) => {
    // SECURITY: Registration locked down to platform services only
    return res.status(403).json({
      success: false,
      error: 'REGISTRATION_CLOSED',
      message: 'External agent registration is temporarily closed. The marketplace currently features verified platform services only. Contact support for enterprise registration inquiries.'
    });
  });

  // Get all active agents
  app.get('/api/agents/active', async (req, res) => {
    try {
      const agents = await storage.getAgents();
      
      const activeAgents = agents
        .filter(agent => agent.status === 'active')
        .map(agent => ({
          id: agent.id,
          agentName: agent.agentName,
          walletAddress: agent.walletAddress,
          capabilities: agent.capabilities,
          description: agent.description,
          monthlyFee: 50.00,
          status: agent.status
        }));

      res.json({
        success: true,
        agents: activeAgents,
        totalAgents: activeAgents.length
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agents' });
    }
  });

  // Get agent details
  app.get('/api/agents/:agentId', async (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }

      res.json({
        success: true,
        agent: {
          id: agent.id,
          agentName: agent.agentName,
          walletAddress: agent.walletAddress,
          capabilities: agent.capabilities,
          description: agent.description,
          status: agent.status,
          monthlyFee: 50.00,
          complianceLevel: agent.complianceLevel
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch agent details' });
    }
  });

  // Subscribe to agent service
  app.post('/api/agents/:agentId/subscribe', isAuthenticated, async (req, res) => {
    try {
      const { agentId } = req.params;
      const userId = (req.user as any)?.claims?.sub;
      
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }

      // Create subscription record with $50 monthly fee
      const subscription = await storage.createTransaction({
        fromUserId: userId,
        amount: '50.00',
        currency: 'USD',
        transactionType: 'subscription',
        platformFee: '2.50', // 5% commission
        status: 'completed',
        message: `Subscription to AI Agent: ${agent.agentName}`
      });

      res.json({
        success: true,
        subscriptionId: subscription.id,
        monthlyFee: 50.00,
        platformFee: 2.50,
        message: 'Agent subscription activated'
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Subscription failed' });
    }
  });

  // Process referral reward
  app.post('/api/agents/referral', async (req, res) => {
    try {
      const { referrerAgentId, referredUserId, transactionAmount } = req.body;
      
      if (!referrerAgentId || !referredUserId || !transactionAmount) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Simple 5% commission
      const commission = Math.round(transactionAmount * 0.05 * 100) / 100;
      
      // Create referral record
      const referral = await storage.createReferral({
        referrerId: referrerAgentId,
        refereeId: referredUserId,
        referralCode: `agent_${referrerAgentId}`,
        status: 'completed',
        bonusAmount: commission.toFixed(2)
      });

      res.json({
        success: true,
        referralId: referral.id,
        commission,
        message: 'Referral reward processed'
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Referral processing failed' });
    }
  });

  // Get marketplace stats
  app.get('/api/agents/marketplace/stats', async (req, res) => {
    try {
      const agents = await storage.getAgents();
      const activeAgents = agents.filter(agent => agent.status === 'active').length;
      
      res.json({
        success: true,
        stats: {
          totalAgents: agents.length,
          activeAgents,
          monthlyRevenue: activeAgents * 50, // $50 per active agent
          averageMonthlyFee: 50.00
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  });
}