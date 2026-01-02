/**
 * FREE AGENT REGISTRATION ENDPOINT
 * Handles agent registration without authentication requirements
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { globalAIAgents } from '../../shared/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

const router = Router();

// Agent registration schema
const AgentRegistrationSchema = z.object({
  agentName: z.string().min(3, 'Agent name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  capabilities: z.array(z.string()).min(1, 'At least one capability required'),
  category: z.string().min(1, 'Category is required'),
  walletAddress: z.string().min(1, 'Wallet address is required'),
  walletNetwork: z.string().min(1, 'Wallet network is required'),
  apiEndpoint: z.string().optional(),
  contactEmail: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal(''))
});

// Free agent registration endpoint - TEMPORARILY DISABLED
// External agent registration is locked down to platform services only
router.post('/api/free-agent-registration', async (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'REGISTRATION_CLOSED',
    message: 'External agent registration is temporarily closed. The marketplace currently features verified platform services only. Contact support for enterprise registration inquiries.'
  });
  
  /* DISABLED FOR SECURITY - Original registration logic below
  try {
    console.log('Free agent registration request received:', req.body);
    
    // Validate input data
    const validationResult = AgentRegistrationSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      });
    }

    const agentData = validationResult.data;
    
    // Generate unique agent ID
    const agentId = `agent_${nanoid(12)}`;
    
    // Create agent record in database
    const newAgent = {
      id: agentId,
      agentName: agentData.agentName,
      agentType: agentData.category,
      capabilities: agentData.capabilities,
      description: agentData.description,
      primaryWalletAddress: agentData.walletAddress,
      walletNetwork: agentData.walletNetwork,
      preferredCurrencies: ['USDC', 'USD'], // Default currencies
      complianceLevel: 'basic',
      status: 'active',
      membershipTier: 'basic' as const,
      publicKey: 'pk_' + agentId + '_' + Date.now(), // Generate proper public key format
      signature: 'sig_' + agentId + '_' + Date.now(), // Generate proper signature format
      apiEndpoint: agentData.apiEndpoint || null,
      contactEmail: agentData.contactEmail || null,
      website: agentData.website || null,
      registeredAt: new Date(),
      lastSeen: new Date(),
      totalRevenue: '0',
      premiumExpiresAt: null,
      // Additional required fields based on schema
      reputation: '0.0',
      transactionCount: 0,
      totalVolume: '0',
      referralCode: `ref_${agentId.slice(-8)}`,
      referralRewards: '0',
      referralCount: 0,
      hasCompletedFirstTransaction: false,
      annualRevenue: '0.0',
      hasAutoUpgraded: false,
      isHumanRegistered: true
    };

    // Check if wallet address already exists
    const existingAgent = await db.select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.primaryWalletAddress, agentData.walletAddress))
      .limit(1);

    if (existingAgent.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address already registered',
        message: 'This wallet address is already associated with another agent. Please use a different wallet address.'
      });
    }

    // Insert into database
    const [insertedAgent] = await db
      .insert(globalAIAgents)
      .values([newAgent])
      .returning();

    console.log('Agent registered successfully:', insertedAgent.id);

    // CRITICAL FIX: Auto-create marketplace service for the registered agent
    try {
      const serviceData = {
        agentId: insertedAgent.id,
        name: `${insertedAgent.agentName} Services`,
        description: insertedAgent.description,
        category: agentData.category || 'general',
        pricing: 75, // Default pricing - can be customized later
        pricingModel: 'hourly',
        deliveryTime: '24-48 hours',
        isActive: true,
        tags: insertedAgent.capabilities
      };
      
      const marketplaceService = await storage.createMarketplaceService(serviceData);
      console.log('Marketplace service created:', marketplaceService.id);
      
      // Return success response with both agent and service info
      res.status(201).json({
        success: true,
        message: 'Agent registered successfully with marketplace service',
        agentId: insertedAgent.id,
        serviceId: marketplaceService.id,
        agent: {
          id: insertedAgent.id,
          name: insertedAgent.agentName,
          category: agentData.category || 'general',
          capabilities: insertedAgent.capabilities,
          status: insertedAgent.status
        },
        service: {
          id: marketplaceService.id,
          name: serviceData.name,
          description: serviceData.description,
          pricing: serviceData.pricing,
          isActive: true
        }
      });
    } catch (serviceError) {
      console.error('Failed to create marketplace service:', serviceError);
      // Still return success for agent registration, but note service creation failed
      res.status(201).json({
        success: true,
        message: 'Agent registered successfully (marketplace service creation pending)',
        agentId: insertedAgent.id,
        agent: {
          id: insertedAgent.id,
          name: insertedAgent.agentName,
          category: agentData.category || 'general',
          capabilities: insertedAgent.capabilities,
          status: insertedAgent.status
        },
        serviceCreationError: 'Service will be created automatically in background'
      });
    }

  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to register agent'
    });
  }
  END OF DISABLED REGISTRATION CODE */
});

// Test endpoint
router.get('/api/free-agent-registration/test', (req, res) => {
  res.json({
    success: true,
    message: 'Free agent registration endpoint is working',
    timestamp: new Date().toISOString()
  });
});

export default router;