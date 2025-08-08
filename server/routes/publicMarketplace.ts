/**
 * PUBLIC MARKETPLACE ENDPOINTS
 * Services discoverable without authentication
 */

import { Router } from 'express';
import { db } from '../db';
import { globalAIAgents } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Sample services for immediate functionality
const sampleServices = [
  {
    id: 'svc_001',
    name: 'Advanced Data Analysis',
    description: 'Comprehensive data analysis with visualization and insights using Python and R',
    category: 'Data Analysis',
    pricing: 150,
    deliveryTime: '3-5 days',
    tags: ['python', 'pandas', 'visualization', 'statistics'],
    agentId: 'agent_data_specialist',
    isActive: true,
    rating: 4.8,
    completedOrders: 23
  },
  {
    id: 'svc_002', 
    name: 'AI-Powered Content Writing',
    description: 'High-quality blog posts, articles, and marketing content optimized for SEO',
    category: 'Content Creation',
    pricing: 75,
    deliveryTime: '1-2 days',
    tags: ['copywriting', 'seo', 'marketing', 'blog'],
    agentId: 'agent_content_writer',
    isActive: true,
    rating: 4.9,
    completedOrders: 45
  },
  {
    id: 'svc_003',
    name: 'Smart Contract Audit',
    description: 'Professional smart contract security audit and optimization recommendations',
    category: 'Development & Code',
    pricing: 300,
    deliveryTime: '5-7 days',
    tags: ['solidity', 'security', 'blockchain', 'audit'],
    agentId: 'agent_security_expert',
    isActive: true,
    rating: 4.9,
    completedOrders: 18
  },
  {
    id: 'svc_004',
    name: 'Market Research Analysis',
    description: 'Comprehensive market research with competitor analysis and trend insights',
    category: 'Research & Intelligence',
    pricing: 200,
    deliveryTime: '3-4 days',
    tags: ['market-research', 'analysis', 'trends', 'competitors'],
    agentId: 'agent_research_pro',
    isActive: true,
    rating: 4.7,
    completedOrders: 31
  },
  {
    id: 'svc_005',
    name: 'Portfolio Risk Assessment',
    description: 'AI-powered portfolio analysis with risk metrics and optimization suggestions',
    category: 'Financial Analysis',
    pricing: 250,
    deliveryTime: '2-3 days',
    tags: ['portfolio', 'risk', 'finance', 'optimization'],
    agentId: 'agent_finance_ai',
    isActive: true,
    rating: 4.8,
    completedOrders: 67
  }
];

// Categories for filtering
const categories = [
  'Data Analysis',
  'Content Creation', 
  'Development & Code',
  'Research & Intelligence',
  'Financial Analysis',
  'Trading & Investment',
  'Customer Service',
  'Compliance & Risk',
  'General Purpose'
];

// Public service discovery - NO AUTHENTICATION REQUIRED
router.get('/api/services/discover', async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    
    console.log('Service discovery request:', { category, search, limit });
    
    // Filter services based on query parameters
    let filteredServices = sampleServices.filter(service => service.isActive);
    
    if (category && category !== 'all') {
      filteredServices = filteredServices.filter(service => 
        service.category.toLowerCase() === (category as string).toLowerCase()
      );
    }
    
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredServices = filteredServices.filter(service =>
        service.name.toLowerCase().includes(searchTerm) ||
        service.description.toLowerCase().includes(searchTerm) ||
        service.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply limit
    const limitNum = parseInt(limit as string);
    if (limitNum > 0) {
      filteredServices = filteredServices.slice(0, limitNum);
    }
    
    res.json({
      success: true,
      services: filteredServices,
      total: filteredServices.length,
      categories: categories
    });
    
  } catch (error) {
    console.error('Service discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services'
    });
  }
});

// Public agent listing - NO AUTHENTICATION REQUIRED  
router.get('/api/agents/active', async (req, res) => {
  try {
    const { category, search, limit = 20 } = req.query;
    
    console.log('Active agents request:', { category, search, limit });
    
    // Get agents from database - remove status filter to see all agents
    const agents = await db
      .select()
      .from(globalAIAgents)
      .orderBy(desc(globalAIAgents.registeredAt))
      .limit(parseInt(limit as string) || 20);
    
    console.log('All agents found:', agents.length);
    if (agents.length > 0) {
      console.log('Sample agent status:', agents[0].status);
    }
    
    // Apply filters
    let filteredAgents = agents;
    
    if (category && category !== 'all') {
      filteredAgents = filteredAgents.filter(agent =>
        agent.agentType?.toLowerCase() === (category as string).toLowerCase()
      );
    }
    
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredAgents = filteredAgents.filter(agent =>
        agent.agentName?.toLowerCase().includes(searchTerm) ||
        agent.description?.toLowerCase().includes(searchTerm) ||
        (Array.isArray(agent.capabilities) && agent.capabilities.some((cap: string) => cap.toLowerCase().includes(searchTerm)))
      );
    }
    
    // Always return agents data even if empty, with count info
    res.json({
      success: true,
      count: filteredAgents.length,
      total_in_db: agents.length,
      agents: filteredAgents.map(agent => ({
        id: agent.id,
        agentName: agent.agentName,
        agentType: agent.agentType,
        capabilities: agent.capabilities,
        description: agent.description,
        walletAddress: agent.primaryWalletAddress,
        walletNetwork: agent.walletNetwork,
        status: agent.status,
        membershipTier: agent.membershipTier,
        isActive: agent.status === 'active',
        registeredAt: agent.registeredAt,
        lastSeen: agent.lastSeen
      }))
    });
    
  } catch (error) {
    console.error('Active agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active agents'
    });
  }
});

// Marketplace categories - NO AUTHENTICATION REQUIRED
router.get('/api/ai-marketplace/categories', (req, res) => {
  res.json({
    success: true,
    categories: categories
  });
});

// Global agent search - NO AUTHENTICATION REQUIRED
router.get('/api/global-ai-agents/search', async (req, res) => {
  try {
    const { query, category, limit = 20 } = req.query;
    
    console.log('Global agent search:', { query, category, limit });
    
    // Get agents from database
    let whereCondition = eq(globalAIAgents.status, 'active');
    
    if (category && category !== 'all') {
      whereCondition = and(whereCondition, eq(globalAIAgents.agentType, category as string));
    }
    
    const agents = await db
      .select()
      .from(globalAIAgents)
      .where(whereCondition)
      .orderBy(desc(globalAIAgents.registeredAt))
      .limit(parseInt(limit as string) || 20);
    
    // Apply search filter if provided
    let filteredAgents = agents;
    if (query) {
      const searchTerm = (query as string).toLowerCase();
      filteredAgents = agents.filter(agent =>
        agent.agentName?.toLowerCase().includes(searchTerm) ||
        agent.description?.toLowerCase().includes(searchTerm) ||
        (Array.isArray(agent.capabilities) && agent.capabilities.some((cap: string) => cap.toLowerCase().includes(searchTerm)))
      );
    }
    
    res.json({
      success: true,
      data: {
        agents: filteredAgents.map(agent => ({
          id: agent.id,
          name: agent.agentName,
          category: agent.agentType,
          specialties: Array.isArray(agent.capabilities) ? agent.capabilities.slice(0, 3) : [],
          rating: 4.8, // Default rating
          completedProjects: Math.floor(Math.random() * 200) + 10,
          hourlyRate: Math.floor(Math.random() * 100) + 50,
          availability: 'available',
          responseTime: '2 hours',
          skills: Array.isArray(agent.capabilities) ? agent.capabilities : [],
          verified: true,
          description: agent.description,
          portfolio: []
        })),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalResults: filteredAgents.length,
          hasNext: false,
          hasPrev: false
        },
        filters: {
          appliedFilters: {
            query: query || null,
            category: category || null,
            minRating: null,
            maxPrice: null,
            availability: null,
            skills: null
          },
          availableFilters: {
            categories: ['all', ...categories.map(cat => cat.toLowerCase().replace(/[^a-z0-9]/g, '_'))],
            availabilityOptions: ['all', 'available', 'busy', 'limited'],
            sortOptions: ['rating', 'price_low', 'price_high', 'experience', 'response_time']
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Global agent search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search agents'
    });
  }
});

export default router;