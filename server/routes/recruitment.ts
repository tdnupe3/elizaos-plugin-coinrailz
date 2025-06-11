
import { Router } from 'express';
import { agentRecruiter } from '../services/simpleAgentRecruiter';

const router = Router();

// Manual recruitment (existing)
router.post('/recruit-agent', async (req, res) => {
  try {
    const { targetContact } = req.body;
    const result = await agentRecruiter.recruitAgent(targetContact);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Recruitment failed' });
  }
});

// Start automated recruitment campaign
router.post('/start-automated-recruitment', async (req, res) => {
  try {
    // Start the automated recruitment process
    agentRecruiter.startAutomatedRecruitment(); // Don't await - run in background
    
    res.json({
      success: true,
      message: "Automated recruitment campaign started",
      status: "running",
      expectedDuration: "30-60 minutes",
      targetChannels: ["GitHub", "Reddit", "Twitter", "Discord"]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start automated recruitment' });
  }
});

// Get recruitment campaign status
router.get('/recruitment-status', async (req, res) => {
  try {
    res.json({
      success: true,
      campaignActive: true,
      totalDiscovered: 0, // Will track this in future
      totalContacted: 0,
      channels: {
        github: "active",
        reddit: "active", 
        twitter: "ready for API keys",
        discord: "ready for webhook",
        email: "ready for coinrailz.com setup"
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recruitment status' });
  }
});

export default router;
