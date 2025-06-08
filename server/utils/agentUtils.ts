/**
 * Agent Utilities for Registration and Management
 * Provides core functionality for AI agent operations
 */

import { storage } from '../storage';
import { nanoid } from 'nanoid';

export interface AgentRegistrationData {
  name: string;
  description: string;
  category: string;
  pricing: number;
  deliveryTime: string;
  userId: string;
  isPremium?: boolean;
}

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
 * Default marketplace services to register at startup
 */
export const DEFAULT_MARKETPLACE_SERVICES: Omit<MarketplaceService, 'id' | 'createdAt'>[] = [
  {
    name: 'Data Processing & Analysis Bot',
    description: 'Advanced data processing and analysis using AI algorithms. Perfect for large datasets, trend analysis, and business intelligence reports.',
    category: 'Data Analysis',
    pricing: 50,
    deliveryTime: '2-4 hours',
    tags: ['data', 'analysis', 'AI', 'business intelligence'],
    isActive: true
  },
  {
    name: 'AI Model Training & Prompt Engineering',
    description: 'Custom AI model training and prompt engineering services. Optimize your AI interactions for better results.',
    category: 'AI Development',
    pricing: 150,
    deliveryTime: '24-48 hours',
    tags: ['AI', 'machine learning', 'prompt engineering', 'training'],
    isActive: true
  },
  {
    name: 'Traditional Market Analysis & Signals',
    description: 'Professional market analysis and trading signals for stocks, forex, and traditional markets.',
    category: 'Market Analysis',
    pricing: 75,
    deliveryTime: '1-3 hours',
    tags: ['trading', 'market analysis', 'signals', 'finance'],
    isActive: true
  },
  {
    name: 'Social Media Automation Setup',
    description: 'Complete social media automation setup including posting schedules, content curation, and engagement tracking.',
    category: 'Social Media',
    pricing: 25,
    deliveryTime: '2-6 hours',
    tags: ['social media', 'automation', 'marketing', 'engagement'],
    isActive: true
  },
  {
    name: 'Email Marketing Automation',
    description: 'Professional email marketing campaign setup with automation workflows, segmentation, and analytics.',
    category: 'Marketing',
    pricing: 35,
    deliveryTime: '4-8 hours',
    tags: ['email marketing', 'automation', 'campaigns', 'analytics'],
    isActive: true
  },
  {
    name: 'Task Scheduling & Workflow Automation',
    description: 'Custom task scheduling and workflow automation solutions to streamline your business processes.',
    category: 'Automation',
    pricing: 20,
    deliveryTime: '1-3 hours',
    tags: ['automation', 'workflow', 'scheduling', 'productivity'],
    isActive: true
  }
];

/**
 * Register a new AI agent
 */
export async function registerAgent(agentData: AgentRegistrationData): Promise<string> {
  const agentId = nanoid();
  
  try {
    const agent = {
      id: agentId,
      ...agentData,
      createdAt: new Date(),
      isActive: true,
      stats: {
        totalSales: 0,
        rating: 0,
        completedTasks: 0
      }
    };

    // Store agent in database
    await storage.createAgent(agent);
    
    return agentId;
  } catch (error) {
    console.error('Error registering agent:', error);
    throw new Error('Failed to register agent');
  }
}

/**
 * Get agent by ID
 */
export async function getAgent(agentId: string) {
  try {
    return await storage.getAgent(agentId);
  } catch (error) {
    console.error('Error fetching agent:', error);
    return null;
  }
}

/**
 * Update agent status
 */
export async function updateAgentStatus(agentId: string, isActive: boolean): Promise<boolean> {
  try {
    await storage.updateAgentStatus(agentId, isActive);
    return true;
  } catch (error) {
    console.error('Error updating agent status:', error);
    return false;
  }
}

/**
 * Get agents by user ID
 */
export async function getUserAgents(userId: string) {
  try {
    return await storage.getUserAgents(userId);
  } catch (error) {
    console.error('Error fetching user agents:', error);
    return [];
  }
}

/**
 * Calculate commission for agent transactions
 */
export function calculateAgentCommission(amount: number, isPremium: boolean = false): {
  platformFee: number;
  agentEarnings: number;
  commissionRate: number;
} {
  // Premium agents get 1.5% commission rate vs 3.5% for basic
  const commissionRate = isPremium ? 0.015 : 0.035;
  const platformFee = amount * commissionRate;
  const agentEarnings = amount - platformFee;

  return {
    platformFee,
    agentEarnings,
    commissionRate
  };
}

/**
 * Register default marketplace services
 */
export async function registerDefaultMarketplaceServices(): Promise<void> {
  try {
    console.log('Registering default marketplace services...');
    
    for (const serviceData of DEFAULT_MARKETPLACE_SERVICES) {
      const service: MarketplaceService = {
        id: nanoid(),
        ...serviceData,
        createdAt: new Date()
      };
      
      try {
        await storage.createMarketplaceService(service);
        console.log(`Registered service: ${service.name}`);
      } catch (error) {
        // Service might already exist, skip
        console.log(`Service already exists: ${service.name}`);
      }
    }
    
    console.log('Default marketplace services registration complete');
  } catch (error) {
    console.error('Error registering default marketplace services:', error);
  }
}

/**
 * Validate agent registration data
 */
export function validateAgentData(data: AgentRegistrationData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length < 3) {
    errors.push('Agent name must be at least 3 characters long');
  }

  if (!data.description || data.description.trim().length < 10) {
    errors.push('Agent description must be at least 10 characters long');
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.push('Agent category is required');
  }

  if (!data.pricing || data.pricing <= 0) {
    errors.push('Agent pricing must be greater than 0');
  }

  if (!data.deliveryTime || data.deliveryTime.trim().length === 0) {
    errors.push('Delivery time is required');
  }

  if (!data.userId || data.userId.trim().length === 0) {
    errors.push('User ID is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}