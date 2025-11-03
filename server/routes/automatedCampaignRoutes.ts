import { Router } from "express";
import { automatedOutreachCampaign } from "../services/automatedOutreachCampaign";

const router = Router();

// Execute a Twitter outreach campaign
router.post("/twitter", async (req, res) => {
  try {
    const { 
      campaignName = 'twitter-outreach',
      targetMinScore = 10,
      targetMaxAttempts = 3,
      maxAgentsPerRun = 50,
      dryRun = true 
    } = req.body;

    console.log(`🚀 Starting Twitter outreach campaign: ${campaignName}`);
    console.log(`   - Min Score: ${targetMinScore}`);
    console.log(`   - Max Attempts: ${targetMaxAttempts}`);
    console.log(`   - Max Agents: ${maxAgentsPerRun}`);
    console.log(`   - Dry Run: ${dryRun}`);

    const result = await automatedOutreachCampaign.executeTwitterCampaign({
      name: campaignName,
      channel: 'twitter',
      targetMinScore,
      targetMaxAttempts,
      maxAgentsPerRun,
      dryRun,
    });

    res.json({
      success: true,
      campaign: campaignName,
      channel: 'twitter',
      dryRun,
      results: result,
    });
  } catch (error: any) {
    console.error('❌ Twitter campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute an XMTP outreach campaign
router.post("/xmtp", async (req, res) => {
  try {
    const { 
      campaignName = 'xmtp-outreach',
      targetMinScore = 15,
      targetMaxAttempts = 2,
      maxAgentsPerRun = 30,
      dryRun = true 
    } = req.body;

    console.log(`🚀 Starting XMTP outreach campaign: ${campaignName}`);

    const result = await automatedOutreachCampaign.executeXMTPCampaign({
      name: campaignName,
      channel: 'xmtp',
      targetMinScore,
      targetMaxAttempts,
      maxAgentsPerRun,
      dryRun,
    });

    res.json({
      success: true,
      campaign: campaignName,
      channel: 'xmtp',
      dryRun,
      results: result,
    });
  } catch (error: any) {
    console.error('❌ XMTP campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute a Discord outreach campaign
router.post("/discord", async (req, res) => {
  try {
    const { 
      campaignName = 'discord-outreach',
      targetMinScore = 20,
      targetMaxAttempts = 2,
      maxAgentsPerRun = 20,
      dryRun = true 
    } = req.body;

    console.log(`🚀 Starting Discord outreach campaign: ${campaignName}`);

    const result = await automatedOutreachCampaign.executeDiscordCampaign({
      name: campaignName,
      channel: 'discord',
      targetMinScore,
      targetMaxAttempts,
      maxAgentsPerRun,
      dryRun,
    });

    res.json({
      success: true,
      campaign: campaignName,
      channel: 'discord',
      dryRun,
      results: result,
    });
  } catch (error: any) {
    console.error('❌ Discord campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get campaign statistics
router.get("/stats/:campaignName", async (req, res) => {
  try {
    const { campaignName } = req.params;
    const stats = await automatedOutreachCampaign.getCampaignStats(campaignName);

    res.json({
      success: true,
      campaign: campaignName,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Select and preview target agents without sending
router.post("/preview", async (req, res) => {
  try {
    const { 
      channel = 'twitter',
      targetMinScore = 10,
      targetMaxAttempts = 3,
      maxAgentsPerRun = 50,
    } = req.body;

    const agents = await automatedOutreachCampaign.selectTargetAgents({
      name: 'preview',
      channel: channel as 'twitter' | 'xmtp' | 'discord',
      targetMinScore,
      targetMaxAttempts,
      maxAgentsPerRun,
    });

    res.json({
      success: true,
      totalAgents: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        url: a.url,
        wallet: a.wallet,
        score: a.score,
        attempts: a.attempts,
        lastContact: a.last_contact_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
