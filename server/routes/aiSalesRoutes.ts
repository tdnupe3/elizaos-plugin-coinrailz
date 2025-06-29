/**
 * AI Sales Agent API Routes
 * Endpoints for autonomous enterprise client acquisition
 */

import { Router } from 'express';
import { z } from 'zod';
import { aiSalesAgentService } from '../services/aiSalesAgent';
import { db } from '../db/db';
import { aiProspects, aiOutreachSequences, aiSalesMetrics } from '../../shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

// Validation schemas
const createProspectSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string(),
  employeeCount: z.number().optional(),
  revenueRange: z.string().optional(),
  contactName: z.string().min(1),
  contactTitle: z.string().min(1),
  contactEmail: z.string().email(),
  contactLinkedin: z.string().optional(),
  painPoints: z.array(z.string()).default([]),
  valueProposition: z.string().default(''),
  personalizationData: z.any().default({}),
  aiScore: z.number().min(0).max(100).default(50)
});

const researchProspectSchema = z.object({
  company: z.string().min(1),
  industry: z.string().min(1)
});

const responseAnalysisSchema = z.object({
  message: z.string().min(1),
  prospectId: z.number()
});

/**
 * Research prospect company and generate intelligence
 */
router.post('/research-prospect', async (req, res) => {
  try {
    const { company, industry } = researchProspectSchema.parse(req.body);
    
    const intelligence = await aiSalesAgentService.generateProspectResearch(company, industry);
    
    res.json({
      success: true,
      intelligence,
      message: `Research completed for ${company}`
    });
  } catch (error) {
    console.error('Error researching prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to research prospect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create new prospect
 */
router.post('/prospects', async (req, res) => {
  try {
    const prospectData = createProspectSchema.parse(req.body);
    
    const prospectId = await aiSalesAgentService.createProspect(prospectData);
    
    res.status(201).json({
      success: true,
      prospectId,
      message: 'Prospect created successfully'
    });
  } catch (error) {
    console.error('Error creating prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prospect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all prospects with optional filtering
 */
router.get('/prospects', async (req, res) => {
  try {
    const { 
      status = 'all',
      industry,
      minScore = 0,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = db.select().from(aiProspects);
    
    // Apply filters
    const conditions: any[] = [];
    
    if (status !== 'all') {
      conditions.push(eq(aiProspects.outreachStatus, status as string));
    }
    
    if (industry) {
      conditions.push(eq(aiProspects.industry, industry as string));
    }
    
    if (minScore) {
      conditions.push(sql`ai_score >= ${Number(minScore)}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const prospects = await query
      .orderBy(desc(aiProspects.aiScore))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      prospects,
      count: prospects.length,
      filters: { status, industry, minScore, limit, offset }
    });
  } catch (error) {
    console.error('Error getting prospects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prospects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Launch outreach campaign for prospect
 */
router.post('/prospects/:id/launch-campaign', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    
    if (isNaN(prospectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect ID'
      });
    }
    
    await aiSalesAgentService.launchCampaign(prospectId);
    
    res.json({
      success: true,
      message: `Campaign launched for prospect ${prospectId}`
    });
  } catch (error) {
    console.error('Error launching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to launch campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate personalized outreach for prospect
 */
router.post('/prospects/:id/generate-outreach', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    
    if (isNaN(prospectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect ID'
      });
    }
    
    // Get prospect details
    const [prospect] = await db
      .select()
      .from(aiProspects)
      .where(eq(aiProspects.id, prospectId));
    
    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }
    
    const outreach = await aiSalesAgentService.generatePersonalizedOutreach(prospect as any);
    
    res.json({
      success: true,
      outreach,
      prospect: {
        id: prospect.id,
        companyName: prospect.companyName,
        contactName: prospect.contactName
      }
    });
  } catch (error) {
    console.error('Error generating outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate outreach',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Score prospect fit and buying potential
 */
router.post('/prospects/:id/score', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    
    if (isNaN(prospectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect ID'
      });
    }
    
    // Get prospect details
    const [prospect] = await db
      .select()
      .from(aiProspects)
      .where(eq(aiProspects.id, prospectId));
    
    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }
    
    const score = await aiSalesAgentService.scoreProspect(prospect as any);
    
    // Update prospect with new score
    await db
      .update(aiProspects)
      .set({ aiScore: score.overall })
      .where(eq(aiProspects.id, prospectId));
    
    res.json({
      success: true,
      score,
      prospectId,
      updated: true
    });
  } catch (error) {
    console.error('Error scoring prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to score prospect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze inbound response and suggest next action
 */
router.post('/analyze-response', async (req, res) => {
  try {
    const { message, prospectId } = responseAnalysisSchema.parse(req.body);
    
    const analysis = await aiSalesAgentService.analyzeResponse(message, prospectId);
    
    // Update prospect response status
    await db
      .update(aiProspects)
      .set({ 
        responseStatus: 'responded',
        lastContactDate: new Date()
      })
      .where(eq(aiProspects.id, prospectId));
    
    res.json({
      success: true,
      analysis,
      prospectId,
      message: 'Response analyzed successfully'
    });
  } catch (error) {
    console.error('Error analyzing response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AI sales performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const metrics = await aiSalesAgentService.getPerformanceMetrics(Number(days));
    
    res.json({
      success: true,
      metrics,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get outreach sequences for prospect
 */
router.get('/prospects/:id/outreach', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    
    if (isNaN(prospectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect ID'
      });
    }
    
    const sequences = await db
      .select()
      .from(aiOutreachSequences)
      .where(eq(aiOutreachSequences.prospectId, prospectId))
      .orderBy(aiOutreachSequences.stepNumber);
    
    res.json({
      success: true,
      sequences,
      prospectId,
      count: sequences.length
    });
  } catch (error) {
    console.error('Error getting outreach sequences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outreach sequences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Bulk create prospects from enterprise database
 */
router.post('/prospects/bulk-import', async (req, res) => {
  try {
    const { prospects } = req.body;
    
    if (!Array.isArray(prospects) || prospects.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospects array'
      });
    }
    
    const validatedProspects = prospects.map(prospect => 
      createProspectSchema.parse(prospect)
    );
    
    const created = [];
    const errors = [];
    
    for (const prospect of validatedProspects) {
      try {
        const prospectId = await aiSalesAgentService.createProspect(prospect);
        created.push({ prospectId, company: prospect.companyName });
      } catch (error) {
        errors.push({ 
          company: prospect.companyName, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      details: { created, errors },
      message: `Imported ${created.length} prospects with ${errors.length} errors`
    });
  } catch (error) {
    console.error('Error bulk importing prospects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk import prospects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get prospects ready for outreach
 */
router.get('/prospects/ready-for-outreach', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const prospects = await aiSalesAgentService.getProspectsForOutreach(Number(limit));
    
    res.json({
      success: true,
      prospects,
      count: prospects.length,
      message: `Found ${prospects.length} prospects ready for outreach`
    });
  } catch (error) {
    console.error('Error getting prospects for outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prospects for outreach',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;