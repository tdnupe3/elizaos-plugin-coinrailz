/**
 * AGENT CARD ROUTES - A2A Protocol Discovery
 * 
 * Serves .well-known/agent-card.json files for each registered agent
 * Makes our marketplace agents discoverable by other A2A platforms
 * Includes 15% platform commission in pricing
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { globalAIAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /agent/:id/.well-known/agent-card.json
 * 
 * Returns A2A protocol compliant agent card for registered agents
 * This makes our agents discoverable by other A2A platforms
 */
router.get('/agent/:id/.well-known/agent-card.json', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [agent] = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.id, id))
      .limit(1);
    
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'No agent exists with this ID'
      });
    }
    
    if (agent.status !== 'active') {
      return res.status(404).json({
        error: 'Agent inactive',
        message: 'This agent is not currently accepting work'
      });
    }
    
    const capabilities = Array.isArray(agent.capabilities) 
      ? agent.capabilities 
      : [];
    
    if (capabilities.length === 0) {
      return res.status(404).json({
        error: 'Agent not available',
        message: 'This agent has no active capabilities'
      });
    }
    
    const baseRate = parseFloat(agent.hourlyRate?.toString() || '50');
    
    // Platform-owned agents: 100% platform fee (agent IS the platform)
    // External agents: 85% agent, 15% platform
    const isPlatformOwned = agent.isHumanRegistered === false;
    const platformFee = isPlatformOwned ? baseRate : baseRate * 0.15;
    const agentPortion = isPlatformOwned ? 0 : baseRate * 0.85;
    const totalRate = baseRate + (isPlatformOwned ? 0 : platformFee);
    
    const agentCard = {
      name: agent.agentName,
      description: agent.description || `${agent.agentName} - Professional AI Agent Services`,
      version: '2.0.0',
      
      capabilities: capabilities as string[],
      
      pricing: {
        model: agent.pricingModel || 'per_service',
        base_rate: baseRate,
        platform_fee: platformFee,
        total_rate: totalRate,
        currency: 'USD',
        minimum_transaction: parseFloat(agent.minimumTransactionAmount || '15.00'),
        note: isPlatformOwned 
          ? 'Platform-operated service. 100% platform fee covers all costs and service delivery.'
          : 'Platform handles payments and escrow. 85% to agent, 15% platform fee.'
      },
      
      payment: {
        methods: ['x402', 'marketplace_escrow'],
        wallet_address: agent.primaryWalletAddress,
        supported_currencies: Array.isArray(agent.preferredCurrencies) 
          ? agent.preferredCurrencies 
          : ['USDC', 'USDT', 'ETH', 'DAI', 'WBTC'],
        payment_networks: agent.walletNetwork === 'multi-chain' 
          ? ['base', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'binance-smart-chain']
          : (agent.walletNetwork || 'base'),
        stablecoins: Array.isArray(agent.acceptedStablecoins)
          ? agent.acceptedStablecoins
          : ['USDC', 'USDT', 'DAI'],
        network_details: {
          base: ['USDC', 'USDT', 'ETH', 'DAI'],
          ethereum: ['USDC', 'USDT', 'ETH', 'DAI', 'WBTC'],
          polygon: ['USDC', 'USDT', 'MATIC', 'DAI'],
          arbitrum: ['USDC', 'USDT', 'ETH', 'DAI'],
          optimism: ['USDC', 'USDT', 'ETH', 'DAI'],
          avalanche: ['USDC', 'USDT', 'AVAX', 'DAI'],
          'binance-smart-chain': ['USDC', 'USDT', 'BNB', 'DAI']
        }
      },
      
      endpoints: {
        marketplace_order: `${process.env.REPLIT_DEPLOYMENT === '1' 
          ? 'https://coinrailz.com' 
          : 'http://localhost:5000'}/api/marketplace/order`,
        x402_payment: `${process.env.REPLIT_DEPLOYMENT === '1' 
          ? 'https://coinrailz.com' 
          : 'http://localhost:5000'}/api/x402/create-payment`,
        agent_profile: `${process.env.REPLIT_DEPLOYMENT === '1' 
          ? 'https://coinrailz.com' 
          : 'http://localhost:5000'}/marketplace/agent/${agent.id}`,
        health_check: `${process.env.REPLIT_DEPLOYMENT === '1' 
          ? 'https://coinrailz.com' 
          : 'http://localhost:5000'}/api/agent/${agent.id}/health`
      },
      
      reputation: {
        rating: parseFloat(agent.reputation?.toString() || '0'),
        completed_jobs: agent.completedJobs || 0,
        total_volume: agent.totalVolume,
        transaction_count: agent.transactionCount || 0
      },
      
      metadata: {
        agent_id: agent.id,
        platform: 'Coin Railz',
        platform_url: process.env.REPLIT_DEPLOYMENT === '1' 
          ? 'https://coinrailz.com' 
          : 'http://localhost:5000',
        registered_at: agent.registeredAt,
        last_active: agent.lastActive,
        compliance_level: agent.complianceLevel || 'basic',
        membership_tier: agent.membershipTier || 'basic'
      },
      
      protocol_info: {
        a2a_version: '2.0.0',
        payment_protocol: 'x402',
        discovery_enabled: true,
        platform_commission: isPlatformOwned ? '100%' : '15%',
        platform_operated: isPlatformOwned,
        escrow_available: true
      }
    };
    
    return res.status(200).json(agentCard);
    
  } catch (error) {
    console.error('❌ Error serving agent card:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve agent information'
    });
  }
});

/**
 * GET /api/agents/directory
 * 
 * Returns list of all discoverable agents for A2A platforms
 */
router.get('/api/agents/directory', async (req: Request, res: Response) => {
  try {
    const agents = await db
      .select({
        id: globalAIAgents.id,
        name: globalAIAgents.agentName,
        capabilities: globalAIAgents.capabilities,
        agent_card_url: globalAIAgents.id
      })
      .from(globalAIAgents)
      .where(eq(globalAIAgents.status, 'active'));
    
    const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com' 
      : 'http://localhost:5000';
    
    const directory = agents
      .filter(agent => {
        const caps = Array.isArray(agent.capabilities) ? agent.capabilities : [];
        return caps.length > 0;
      })
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        agent_card_url: `${baseUrl}/agent/${agent.id}/.well-known/agent-card.json`
      }));
    
    return res.status(200).json({
      success: true,
      total_agents: directory.length,
      platform: 'Coin Railz AI Agent Marketplace',
      agents: directory,
      discovery_protocol: 'A2A 2.0',
      platform_commission: '15%'
    });
    
  } catch (error) {
    console.error('❌ Error listing agent directory:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve agent directory'
    });
  }
});

/**
 * GET /api/agent/:id/health
 * 
 * Health check endpoint for agents
 */
router.get('/api/agent/:id/health', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [agent] = await db
      .select({
        id: globalAIAgents.id,
        status: globalAIAgents.status,
        lastActive: globalAIAgents.lastActive
      })
      .from(globalAIAgents)
      .where(eq(globalAIAgents.id, id))
      .limit(1);
    
    if (!agent) {
      return res.status(404).json({
        healthy: false,
        error: 'Agent not found'
      });
    }
    
    return res.status(200).json({
      healthy: agent.status === 'active',
      agent_id: agent.id,
      status: agent.status,
      last_active: agent.lastActive,
      accepting_work: agent.status === 'active'
    });
    
  } catch (error) {
    console.error('❌ Error checking agent health:', error);
    return res.status(500).json({
      healthy: false,
      error: 'Health check failed'
    });
  }
});

export default router;
