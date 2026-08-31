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
 * Execute immediate on-chain campaign to discovered AI agents
 */
automatedOutreachRouter.post('/outreach/on-chain-campaign', async (req, res) => {
  try {
    console.log('🚀 Executing immediate on-chain campaign...');
    
    const result = await CostEffectiveOutreach.executeCampaign();
    
    res.json({
      success: true,
      campaign: 'On-chain Direct Messaging',
      reached: result.totalReached,
      cost: result.totalCost,
      efficiency: result.totalReached / Math.max(result.totalCost, 0.01),
      message: `Successfully messaged ${result.totalReached} AI agents for $${result.totalCost.toFixed(2)}`
    });

  } catch (error) {
    console.error('❌ On-chain campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'On-chain campaign execution failed',
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
    
    return res.status(501).json({
      success: false,
      error: 'Automated outreach campaigns not implemented',
      message: 'Full campaign automation requires real API implementations',
      availableAlternatives: [
        'Use working Stripe Payment Links for immediate revenue',
        'Manual Reddit OAuth setup at /auth/reddit',
        'Manual Discord/HN outreach with provided templates'
      ]
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
        onChain: {
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
        'Execute on-chain campaign immediately (highest ROI)',
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

/**
 * MANUAL TRIGGER: Execute GitHub campaign immediately
 * Posts to AI agent repositories with payment implementation guide
 */
automatedOutreachRouter.post('/outreach/github-campaign', async (req, res) => {
  try {
    console.log('🐙 Manual trigger: Executing GitHub campaign...');
    
    const { getOutreachOrchestrator } = await import('../services/automatedOutreachOrchestrator');
    const orchestrator = await getOutreachOrchestrator();
    
    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Outreach orchestrator not initialized',
        message: 'System is in deployment mode or orchestrator failed to start'
      });
    }
    
    const result = await orchestrator.triggerGitHubCampaign();
    
    res.json({
      success: result.success,
      campaign: 'GitHub Issues',
      issuesCreated: result.issuesCreated,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      message: result.message
    });

  } catch (error) {
    console.error('❌ GitHub campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get full orchestrator status including all channels
 */
automatedOutreachRouter.get('/outreach/orchestrator-status', async (req, res) => {
  try {
    const { getOutreachOrchestrator } = await import('../services/automatedOutreachOrchestrator');
    const orchestrator = await getOutreachOrchestrator();
    
    if (!orchestrator) {
      return res.status(503).json({
        success: false,
        error: 'Orchestrator not available'
      });
    }
    
    const status = await orchestrator.getAutomationStatus();
    res.json({
      success: true,
      ...status
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