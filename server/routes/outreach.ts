import express from 'express';
import { telegramOutreachService } from '../services/telegramOutreachService.js';

const router = express.Router();

/**
 * 🚀 ADD TARGET GROUP FOR @FeedAlphaBot PROMOTION (FREE)
 */
router.post('/add-group', async (req, res) => {
  try {
    const { chatId, groupName } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chat ID required' 
      });
    }

    await telegramOutreachService.addTargetGroup(chatId, groupName);

    res.json({ 
      success: true, 
      message: `Added ${groupName || chatId} to @FeedAlphaBot promotion queue` 
    });

  } catch (error: any) {
    console.error('Error adding target group:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🚀 START @FeedAlphaBot PROMOTION CAMPAIGN (FREE)
 */
router.post('/start-campaign', async (req, res) => {
  try {
    // Start the outreach campaign in background
    telegramOutreachService.startOutreachCampaign().catch(console.error);

    res.json({ 
      success: true, 
      message: '@FeedAlphaBot promotion campaign started!' 
    });

  } catch (error: any) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * ⏸️ STOP CAMPAIGN
 */
router.post('/stop-campaign', async (req, res) => {
  try {
    telegramOutreachService.stopCampaign();

    res.json({ 
      success: true, 
      message: 'Campaign stopped' 
    });

  } catch (error: any) {
    console.error('Error stopping campaign:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 📊 GET CAMPAIGN STATISTICS
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = telegramOutreachService.getCampaignStats();

    res.json({ 
      success: true, 
      stats 
    });

  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;