/**
 * LEAD SCORING API ROUTES
 * Provides authenticated endpoints for accessing lead scoring data and high-value prospects
 * 
 * SECURITY: All routes protected by isAuthenticated middleware in routes.ts
 */

import { Router } from 'express';
import { z } from 'zod';
import { leadScoringService } from '../services/leadScoringService';
import { outreachAnalytics } from '../services/outreachAnalytics';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Apply authentication to ALL routes within this router for defense-in-depth
router.use(isAuthenticated);

// Validation schemas for request bodies and query parameters
const objectionProcessingSchema = z.object({
  responseContent: z.string().min(1, 'Response content is required'),
  channel: z.enum(['email', 'linkedin', 'twitter', 'discord', 'telegram', 'cold_call']),
  campaignId: z.string().optional()
});

const conversionSimulationSchema = z.object({
  targetId: z.string().min(1, 'Target ID is required'),
  amount: z.number().min(1, 'Amount must be positive').default(999)
});

const targetIdParamSchema = z.object({
  targetId: z.string().min(1, 'Target ID is required')
});

const analyticsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  timeframe: z.enum(['day', 'week', 'month', 'all']).optional()
});

/**
 * GET /api/leads/high-value
 * Get leads requiring human follow-up (score >= 75)
 */
router.get('/high-value', async (req, res) => {
  try {
    console.log('📊 Fetching high-value leads requiring human follow-up...');
    
    const highValueLeads = await leadScoringService.getLeadsRequiringHumanFollowUp();
    
    res.json({
      success: true,
      count: highValueLeads.length,
      leads: highValueLeads.map(lead => ({
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        industry: lead.industry,
        leadScore: lead.leadScore,
        leadTier: lead.leadTier,
        followUpStatus: lead.followUpStatus,
        objectionCategory: lead.objectionCategory,
        lastContactDate: lead.lastContactDate,
        priority: lead.priority,
        revenue: lead.revenue,
        employeeCount: lead.employeeCount
      }))
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch high-value leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch high-value leads',
      leads: []
    });
  }
});

/**
 * POST /api/leads/:targetId/score
 * Calculate/update lead score for a specific target
 */
router.post('/:targetId/score', async (req, res) => {
  try {
    // Validate path parameters
    const paramValidation = targetIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target ID',
        details: paramValidation.error.format()
      });
    }
    
    const { targetId } = paramValidation.data;
    console.log(`🎯 Calculating lead score for: ${targetId}`);
    
    const scoring = await leadScoringService.calculateLeadScore(targetId);
    await leadScoringService.updateTargetScore(targetId);
    
    res.json({
      success: true,
      targetId,
      score: scoring.score,
      tier: scoring.tier,
      factors: scoring.factors,
      recommendations: scoring.recommendations
    });
    
  } catch (error) {
    console.error(`❌ Failed to score lead ${req.params.targetId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate lead score'
    });
  }
});

/**
 * POST /api/leads/:targetId/objection
 * Process objection from a target response
 */
router.post('/:targetId/objection', async (req, res) => {
  try {
    // Validate path parameters
    const paramValidation = targetIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target ID',
        details: paramValidation.error.format()
      });
    }
    
    // Validate request body with Zod
    const validationResult = objectionProcessingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const { targetId } = paramValidation.data;
    const { responseContent, channel, campaignId } = validationResult.data;
    
    console.log(`🤔 Processing objection for target: ${targetId}`);
    
    const objectionClassification = await leadScoringService.processObjection(
      targetId,
      responseContent,
      channel,
      campaignId
    );
    
    res.json({
      success: true,
      targetId,
      objection: objectionClassification
    });
    
  } catch (error) {
    console.error(`❌ Failed to process objection for ${req.params.targetId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process objection'
    });
  }
});

/**
 * GET /api/leads/analytics/objections
 * Get objection analytics for optimization
 */
router.get('/analytics/objections', async (req, res) => {
  try {
    // Validate query parameters
    const queryValidation = analyticsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.format()
      });
    }
    
    console.log('📈 Generating objection analytics...');
    
    const analytics = await leadScoringService.getObjectionAnalytics();
    
    res.json({
      success: true,
      analytics
    });
    
  } catch (error) {
    console.error('❌ Failed to generate objection analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate objection analytics',
      analytics: {
        totalObjections: 0,
        categoryBreakdown: {},
        severityDistribution: {},
        commonKeywords: [],
        resolutionRate: 0
      }
    });
  }
});

/**
 * GET /api/leads/analytics/performance  
 * Get overall lead scoring performance metrics
 */
router.get('/analytics/performance', async (req, res) => {
  try {
    // Validate query parameters
    const queryValidation = analyticsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.format()
      });
    }
    
    console.log('📊 Generating lead scoring performance analytics...');
    
    // Get outreach analytics data
    const overallPerformance = outreachAnalytics.getOverallPerformance();
    const dashboardData = outreachAnalytics.getDashboardData();
    
    // Combine with lead scoring insights
    const response = {
      success: true,
      performance: {
        totalContacts: overallPerformance.totalContacts,
        totalRevenue: overallPerformance.totalRevenue,
        averageConversionRate: overallPerformance.averageConversionRate,
        bestPerformingChannel: overallPerformance.bestPerformingChannel,
        totalROI: overallPerformance.totalROI,
        
        // Today's activity
        todayStats: dashboardData.todayStats,
        
        // Channel comparison with conversion rates
        channelPerformance: dashboardData.channelComparison,
        
        // Lead scoring specific metrics
        leadScoring: {
          enabled: true,
          qualifiedThreshold: 75,
          tierDistribution: {
            cold: 'N/A - Using existing data structure',
            warm: 'N/A - Using existing data structure', 
            hot: 'N/A - Using existing data structure',
            qualified: 'N/A - Using existing data structure'
          }
        }
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Failed to generate performance analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance analytics'
    });
  }
});

/**
 * POST /api/leads/demo/simulate-conversion
 * Simulate a lead conversion for testing (demo purposes)
 */
router.post('/demo/simulate-conversion', async (req, res) => {
  try {
    // Validate request body with Zod
    const validationResult = conversionSimulationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const { targetId, amount } = validationResult.data;
    
    console.log(`🧪 Simulating conversion for demo: ${targetId}`);
    
    // Simulate conversion in analytics
    outreachAnalytics.simulateConversion('demo-campaign', targetId, amount);
    
    res.json({
      success: true,
      message: `Simulated $${amount} conversion for ${targetId}`,
      targetId,
      amount
    });
    
  } catch (error) {
    console.error('❌ Failed to simulate conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate conversion'
    });
  }
});

export default router;