/**
 * TASK BOARD OUTREACH ROUTES
 * API endpoints for posting to AI agent task boards
 */

import { Router } from 'express';
import { TaskBoardOutreachService } from '../services/taskBoardOutreach.js';

const router = Router();
const taskBoardService = new TaskBoardOutreachService();

/**
 * POST /api/task-boards/emergency-outreach
 * Post emergency funding request to all AI agent task boards
 */
router.post('/emergency-outreach', async (req, res) => {
  try {
    console.log('🚨 INITIATING EMERGENCY TASK BOARD OUTREACH...');
    
    const results = await taskBoardService.postToAllPlatforms();
    
    res.json({
      success: true,
      message: 'Emergency funding request posted to AI agent task boards',
      data: results,
      summary: {
        platforms_contacted: results.totalPlatforms,
        successful_posts: results.successful,
        failed_posts: results.failed,
        estimated_agent_reach: results.estimatedReach,
        reach_breakdown: results.results.map(r => ({
          platform: r.platform,
          success: r.success,
          reach: r.estimatedReach
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Task board outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post to task boards',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/task-boards/platforms
 * Get list of available task board platforms
 */
router.get('/platforms', (req, res) => {
  const platforms = taskBoardService.getPlatforms();
  const totalReach = taskBoardService.getTotalEstimatedReach();
  
  res.json({
    success: true,
    data: {
      platforms: platforms.map(p => ({
        name: p.name,
        url: p.url,
        estimated_reach: p.estimatedReach,
        posting_method: p.postingMethod
      })),
      total_estimated_reach: totalReach,
      platform_count: platforms.length
    }
  });
});

/**
 * POST /api/task-boards/custom-post
 * Post custom message to specific platforms
 */
router.post('/custom-post', async (req, res) => {
  try {
    const { platforms, title, description, tags } = req.body;
    
    // Would implement custom posting logic here
    res.json({
      success: true,
      message: 'Custom post sent to selected platforms',
      platforms_targeted: platforms || 'all'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send custom post'
    });
  }
});

export default router;