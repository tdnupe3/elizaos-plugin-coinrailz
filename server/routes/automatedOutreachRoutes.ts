/**
 * Automated Outreach API Routes
 * Fully automated outreach execution - no manual work required
 */

import { Router } from 'express';
import CostEffectiveOutreach from '../services/costEffectiveOutreach';
import RedditOutreachService from '../services/redditOutreachService';
import LowCostOutreachOrchestrator from '../services/lowCostOutreachOrchestrator';

export const automatedOutreachRouter = Router();

/**
 * Execute immediate XMTP campaign to discovered AI agents
 */
automatedOutreachRouter.post('/outreach/xmtp-campaign', async (req, res) => {
  try {
    console.log('🚀 Executing immediate XMTP campaign...');
    
    const result = await CostEffectiveOutreach.executeXMTPCampaign();
    
    res.json({
      success: true,
      campaign: 'XMTP Direct Messaging',
      reached: result.reached,
      cost: result.cost,
      efficiency: result.reached / Math.max(result.cost, 0.01),
      message: `Successfully messaged ${result.reached} AI agents for $${result.cost.toFixed(2)}`
    });

  } catch (error) {
    console.error('❌ XMTP campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'XMTP campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute full automated outreach campaign
 */
automatedOutreachRouter.post('/outreach/full-campaign', async (req, res) => {
  try {
    const { budget = 50 } = req.body;
    
    console.log(`🎯 Executing full automated campaign with $${budget} budget`);
    
    const results = await LowCostOutreachOrchestrator.executeOptimizedCampaign(budget);
    
    res.json({
      success: true,
      totalReached: results.totalReached,
      totalCost: results.totalCost,
      costPerContact: results.costPerContact,
      channels: results.channelBreakdown,
      nextSteps: results.nextSteps,
      message: `Reached ${results.totalReached.toLocaleString()} developers for $${results.totalCost.toFixed(2)}`
    });

  } catch (error) {
    console.error('❌ Full campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Full campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute Reddit campaign specifically
 */
automatedOutreachRouter.post('/outreach/reddit-campaign', async (req, res) => {
  try {
    const { budget = 25 } = req.body;
    
    console.log(`📱 Executing Reddit campaign with $${budget} budget`);
    
    const result = await RedditOutreachService.executeCampaign(budget);
    
    res.json({
      success: true,
      campaign: 'Reddit API',
      postsCreated: result.postsCreated,
      totalReach: result.totalReach,
      cost: result.cost,
      errors: result.errors,
      message: `Created ${result.postsCreated} posts reaching ${result.totalReach.toLocaleString()} developers`
    });

  } catch (error) {
    console.error('❌ Reddit campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Reddit campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Emergency funding campaign - maximum automation
 */
automatedOutreachRouter.post('/outreach/emergency-funding', async (req, res) => {
  try {
    const { budget = 100 } = req.body;
    
    console.log(`🚨 Executing EMERGENCY FUNDING campaign with $${budget}`);
    
    const result = await LowCostOutreachOrchestrator.executeEmergencyFunding(budget);
    
    res.json({
      success: true,
      campaignResults: result.campaignResults,
      emergencyActions: result.emergencyActions,
      timeline: result.timeline,
      message: `Emergency campaign launched: ${result.campaignResults.totalReached.toLocaleString()} contacts for $${result.campaignResults.totalCost.toFixed(2)}`
    });

  } catch (error) {
    console.error('❌ Emergency campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Emergency campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get outreach system status
 */
automatedOutreachRouter.get('/outreach/status', async (req, res) => {
  try {
    res.json({
      success: true,
      systems: {
        xmtp: {
          operational: true,
          cost: '$2-5 per 1000 messages',
          description: 'Direct messaging to AI agent wallets'
        },
        reddit: {
          operational: true,
          cost: '$0.24 per 1000 requests',
          description: 'Automated posting to AI/ML subreddits',
          setupRequired: 'OAuth flow needed'
        },
        discord: {
          operational: true,
          cost: 'FREE',
          description: 'Manual community participation'
        },
        hackerNews: {
          operational: true,
          cost: 'FREE',
          description: 'Show HN posts during peak hours'
        }
      },
      recommendations: [
        'Execute XMTP campaign immediately (highest ROI)',
        'Set up Reddit OAuth for automated posting',
        'Monitor engagement and optimize messaging'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default automatedOutreachRouter;