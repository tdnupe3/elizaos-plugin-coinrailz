
import { Router } from 'express';
import { aiAgentRecruitmentService } from '../services/aiAgentRecruitmentService';

const router = Router();

// Initialize the recruitment bot
router.post('/recruitment-bot/initialize', async (req, res) => {
  try {
    const botId = await aiAgentRecruitmentService.initializeRecruitmentBot();
    res.json({
      success: true,
      recruitmentBotId: botId,
      message: "Recruitment bot initialized and ready to start viral growth campaigns"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start a recruitment campaign
router.post('/recruitment-bot/campaigns/:campaignId/start', async (req, res) => {
  try {
    const { campaignId } = req.params;
    await aiAgentRecruitmentService.startRecruitmentCampaign(campaignId);
    res.json({
      success: true,
      message: `Recruitment campaign ${campaignId} started`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recruitment statistics
router.get('/recruitment-bot/stats', async (req, res) => {
  try {
    const stats = await aiAgentRecruitmentService.getRecruitmentStats();
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause a campaign
router.post('/recruitment-bot/campaigns/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    await aiAgentRecruitmentService.pauseCampaign(campaignId);
    res.json({
      success: true,
      message: `Campaign ${campaignId} paused`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume a campaign
router.post('/recruitment-bot/campaigns/:campaignId/resume', async (req, res) => {
  try {
    const { campaignId } = req.params;
    await aiAgentRecruitmentService.resumeCampaign(campaignId);
    res.json({
      success: true,
      message: `Campaign ${campaignId} resumed`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
