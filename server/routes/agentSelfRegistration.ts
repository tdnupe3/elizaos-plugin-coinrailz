/**
 * Agent Self-Registration Routes
 * 
 * Allows AI agents to self-register by providing their domain and agent card URL.
 * This helps bootstrap the A2A network by allowing compliant agents to join.
 * 
 * Updated: October 2025
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { discoveredAgents } from '../../shared/schema';
import { persistDiscoveredAgent, getAgentByURL } from '../storage/discoveredAgentsStorage';

const router = Router();

// Validation schema for self-registration
const selfRegistrationSchema = z.object({
  domain: z.string().url().or(z.string().regex(/^[a-zA-Z0-9.-]+\.(eth|base\.eth|com|io|xyz|org|ai|limo)$/)),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  agentCardUrl: z.string().url().startsWith('https://'), // HTTPS only to prevent SSRF
  contactEmail: z.string().email().optional(),
  platform: z.string().optional(),
  description: z.string().optional()
});

// Allowed hosts for agent card URLs (prevents SSRF attacks)
const ALLOWED_AGENT_CARD_HOSTS = [
  // Public domains only - no internal/localhost addresses
  /^[a-zA-Z0-9.-]+\.(com|io|xyz|org|ai|net|co|gg|app)$/,
  /^[a-zA-Z0-9.-]+\.eth\.limo$/,  // ENS gateway
  /^[a-zA-Z0-9.-]+\.base\.eth\.limo$/,  // Base basename gateway
];

/**
 * Validate agent card URL to prevent SSRF attacks
 */
function isAllowedAgentCardUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Must be HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }
    
    // Block internal/private addresses
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname === '0.0.0.0') {
      return false;
    }
    
    // Check against allowed patterns
    return ALLOWED_AGENT_CARD_HOSTS.some(pattern => pattern.test(hostname));
  } catch {
    return false;
  }
}

/**
 * POST /api/agents/self-register
 * 
 * Allows agents to self-register for discovery
 */
router.post('/self-register', async (req, res) => {
  try {
    // Validate request body
    const validation = selfRegistrationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }
    
    const { domain, walletAddress, agentCardUrl, contactEmail, platform, description } = validation.data;
    
    // SSRF Protection: Validate agent card URL
    if (!isAllowedAgentCardUrl(agentCardUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent card URL',
        message: 'Agent card URL must be HTTPS and from an allowed public domain. Internal/private addresses are not allowed.'
      });
    }
    
    // Verify agent card is accessible and valid
    console.log(`🔍 Verifying agent card at ${agentCardUrl}...`);
    
    let agentCard: any;
    try {
      const response = await fetch(agentCardUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinRailz-A2A-Platform/1.0'
        }
      });
      
      if (!response.ok) {
        return res.status(400).json({
          success: false,
          error: 'Agent card not accessible',
          message: `Failed to fetch agent card from ${agentCardUrl}: HTTP ${response.status}`
        });
      }
      
      agentCard = await response.json();
      
      // Validate agent card structure
      if (!agentCard.name) {
        return res.status(400).json({
          success: false,
          error: 'Invalid agent card',
          message: 'Agent card must contain a "name" field'
        });
      }
      
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch agent card',
        message: (error as Error).message
      });
    }
    
    console.log(`✅ Agent card verified: ${agentCard.name}`);
    
    // Check if agent already exists (using canonical URL)
    const existingAgent = await getAgentByURL(domain);
    
    if (existingAgent) {
      return res.status(409).json({
        success: false,
        error: 'Agent already registered',
        message: `An agent with domain ${domain} is already registered`,
        agentId: existingAgent.id
      });
    }
    
    // Register the agent (uses canonical URL storage)
    const newAgent = await persistDiscoveredAgent({
      url: domain,
      source: 'self-registration',
      wallet: walletAddress || null,
      status: 'pending-verification',
      score: 50, // Default score for self-registered agents
      channels: {
        webhook: agentCard.endpoints?.['message/send'] || agentCardUrl,
        email: contactEmail,
        a2a_protocol: true
      },
      capabilities: agentCard.capabilities || {},
      metadata: {
        name: agentCard.name,
        description: description || agentCard.description,
        platform: platform || 'self-registered',
        protocolVersion: agentCard.protocolVersion,
        agentCardUrl,
        contactEmail,
        registeredAt: new Date().toISOString()
      }
    });
    
    console.log(`✅ Agent registered successfully: ${agentCard.name} (ID: ${newAgent.id})`);
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Agent registered successfully and pending verification',
      agent: {
        id: newAgent.id,
        name: agentCard.name,
        domain,
        status: 'pending-verification',
        registeredAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Agent self-registration error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/agents/self-register/status/:agentId
 * 
 * Check the verification status of a self-registered agent
 */
router.get('/self-register/status/:agentId', async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID'
      });
    }
    
    const agent = await db.query.discoveredAgents.findFirst({
      where: (agents, { eq }) => eq(agents.id, agentId)
    });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        url: agent.url,
        status: agent.status,
        score: agent.score,
        source: agent.source,
        registeredAt: agent.discoveredAt,
        verifiedAt: agent.verifiedAt,
        metadata: agent.metadata
      }
    });
    
  } catch (error) {
    console.error('❌ Status check error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/agents/self-register/instructions
 * 
 * Returns instructions for agents on how to self-register
 */
router.get('/self-register/instructions', (req, res) => {
  res.json({
    title: 'A2A Agent Self-Registration',
    description: 'Register your AI agent with Coin Railz A2A marketplace',
    requirements: [
      'A valid .well-known/agent-card.json endpoint following the A2A protocol',
      'Agent card must be publicly accessible',
      'Agent card must contain at minimum: name field',
      'Optional: wallet address, contact email, platform information'
    ],
    steps: [
      '1. Ensure your agent has a valid .well-known/agent-card.json endpoint',
      '2. POST to /api/agents/self-register with your domain and agent card URL',
      '3. Your agent will be added with "pending-verification" status',
      '4. Check verification status using the returned agent ID',
      '5. Once verified, your agent will be discoverable in the marketplace'
    ],
    example: {
      method: 'POST',
      endpoint: '/api/agents/self-register',
      body: {
        domain: 'agent.example.com',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        agentCardUrl: 'https://agent.example.com/.well-known/agent-card.json',
        contactEmail: 'contact@agent.example.com',
        platform: 'custom',
        description: 'My autonomous AI agent'
      }
    },
    protocol: {
      name: 'Google A2A Protocol',
      specification: 'https://developers.google.com/a2a',
      requiredPaths: [
        '/.well-known/agent-card.json',
        '/.well-known/agent.json (alternative)'
      ]
    }
  });
});

export default router;
