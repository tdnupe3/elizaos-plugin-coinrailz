/**
 * AGENT REGISTRATION AND VERIFICATION SYSTEM
 * Complete agent onboarding with verification workflow
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Agent storage (in-memory for now, will move to database)
const agents = new Map();
const agentVerifications = new Map();

// Agent registration schema - flexible structure to match API calls
const agentRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  specialization: z.string().min(1, 'Specialization required'),
  skills: z.array(z.string()).min(1, 'At least one skill required'),
  experience: z.string().min(10, 'Experience description required'),
  pricing: z.union([
    z.object({
      hourly: z.number().min(10, 'Minimum hourly rate is $10'),
      fixed: z.array(z.object({
        service: z.string(),
        price: z.number().min(25)
      })).optional()
    }),
    z.object({
      hourlyRate: z.number().min(10, 'Minimum hourly rate is $10'),
      projectMinimum: z.number().min(25, 'Minimum project fee is $25')
    }),
    z.number().min(25) // Allow simple number for backward compatibility
  ]),
  availability: z.enum(['full-time', 'part-time', 'project-based']),
  portfolio: z.union([
    z.array(z.object({
      title: z.string(),
      description: z.string()
    })),
    z.object({
      website: z.string().url().optional(),
      samples: z.array(z.string()).optional(),
      certifications: z.array(z.string()).optional()
    })
  ]).optional(),
  type: z.enum(['human', 'ai']).default('human')
});

// Register new agent
router.post('/register', async (req, res) => {
  try {
    const validation = agentRegistrationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration data',
        details: validation.error.issues
      });
    }

    const agentData = validation.data;
    
    // Check for duplicate email
    const existingAgent = Array.from(agents.values()).find(agent => agent.email === agentData.email);
    if (existingAgent) {
      return res.status(409).json({
        success: false,
        error: 'Agent with this email already exists'
      });
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const agent = {
      id: agentId,
      ...agentData,
      status: 'pending_verification',
      rating: 0,
      completedOrders: 0,
      totalEarnings: 0,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      tier: 'basic' // basic, premium, enterprise
    };

    agents.set(agentId, agent);

    // Create verification record
    agentVerifications.set(agentId, {
      agentId,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      documents: [],
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null
    });

    res.status(201).json({
      success: true,
      data: {
        agentId,
        status: agent.status,
        message: 'Registration successful. Verification review in progress.',
        estimatedReviewTime: '24-48 hours'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

// Get agent profile
router.get('/profile/:agentId', (req, res) => {
  const { agentId } = req.params;
  const agent = agents.get(agentId);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  // Return public profile (hide sensitive data)
  const publicProfile = {
    id: agent.id,
    name: agent.name,
    specialization: agent.specialization,
    skills: agent.skills,
    experience: agent.experience,
    portfolio: agent.portfolio,
    pricing: agent.pricing,
    availability: agent.availability,
    rating: agent.rating,
    completedOrders: agent.completedOrders,
    status: agent.status,
    joinedAt: agent.joinedAt,
    tier: agent.tier
  };

  res.json({
    success: true,
    data: publicProfile
  });
});

// List all verified agents
router.get('/list', (req, res) => {
  const { specialization, minRating, maxRate, availability } = req.query;
  
  let agentList = Array.from(agents.values())
    .filter(agent => agent.status === 'verified');

  // Apply filters
  if (specialization) {
    agentList = agentList.filter(agent => 
      agent.specialization.toLowerCase().includes(specialization.toLowerCase()) ||
      agent.skills.some(skill => skill.toLowerCase().includes(specialization.toLowerCase()))
    );
  }

  if (minRating) {
    agentList = agentList.filter(agent => agent.rating >= Number(minRating));
  }

  if (maxRate) {
    agentList = agentList.filter(agent => agent.pricing.hourlyRate <= Number(maxRate));
  }

  if (availability) {
    agentList = agentList.filter(agent => agent.availability === availability);
  }

  // Return public profiles only
  const publicProfiles = agentList.map(agent => ({
    id: agent.id,
    name: agent.name,
    specialization: agent.specialization,
    skills: agent.skills,
    pricing: agent.pricing,
    availability: agent.availability,
    rating: agent.rating,
    completedOrders: agent.completedOrders,
    tier: agent.tier
  }));

  res.json({
    success: true,
    data: {
      agents: publicProfiles,
      total: publicProfiles.length,
      filters: { specialization, minRating, maxRate, availability }
    }
  });
});

// Submit verification documents
router.post('/verify/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { documents, additionalInfo } = req.body;

  const agent = agents.get(agentId);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  const verification = agentVerifications.get(agentId);
  if (!verification) {
    return res.status(404).json({
      success: false,
      error: 'Verification record not found'
    });
  }

  // Update verification with documents
  verification.documents = documents || [];
  verification.additionalInfo = additionalInfo;
  verification.status = 'under_review';
  verification.submittedAt = new Date().toISOString();

  agentVerifications.set(agentId, verification);

  res.json({
    success: true,
    data: {
      status: verification.status,
      message: 'Documents submitted for review',
      estimatedReviewTime: '24-48 hours'
    }
  });
});

// Admin: Approve/reject agent verification
router.post('/admin/verify/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { approved, notes, reviewerId } = req.body;

  const agent = agents.get(agentId);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  const verification = agentVerifications.get(agentId);
  if (!verification) {
    return res.status(404).json({
      success: false,
      error: 'Verification record not found'
    });
  }

  // Update verification status
  verification.status = approved ? 'approved' : 'rejected';
  verification.reviewNotes = notes;
  verification.reviewedBy = reviewerId;
  verification.reviewedAt = new Date().toISOString();

  // Update agent status
  agent.status = approved ? 'verified' : 'rejected';
  agent.lastActive = new Date().toISOString();

  agents.set(agentId, agent);
  agentVerifications.set(agentId, verification);

  res.json({
    success: true,
    data: {
      agentId,
      status: agent.status,
      verificationStatus: verification.status,
      message: approved ? 'Agent verified successfully' : 'Agent verification rejected'
    }
  });
});

// Get agent statistics
router.get('/stats', (req, res) => {
  const allAgents = Array.from(agents.values());
  
  const stats = {
    total: allAgents.length,
    verified: allAgents.filter(a => a.status === 'verified').length,
    pending: allAgents.filter(a => a.status === 'pending_verification').length,
    rejected: allAgents.filter(a => a.status === 'rejected').length,
    bySpecialization: {},
    byTier: {},
    averageRating: 0,
    totalEarnings: allAgents.reduce((sum, a) => sum + a.totalEarnings, 0)
  };

  // Calculate specialization distribution
  allAgents.forEach(agent => {
    stats.bySpecialization[agent.specialization] = 
      (stats.bySpecialization[agent.specialization] || 0) + 1;
    stats.byTier[agent.tier] = (stats.byTier[agent.tier] || 0) + 1;
  });

  // Calculate average rating
  const ratedAgents = allAgents.filter(a => a.rating > 0);
  if (ratedAgents.length > 0) {
    stats.averageRating = ratedAgents.reduce((sum, a) => sum + a.rating, 0) / ratedAgents.length;
  }

  res.json({
    success: true,
    data: stats
  });
});

export default router;