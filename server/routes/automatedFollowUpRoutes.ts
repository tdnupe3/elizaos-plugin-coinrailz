import { Router } from "express";
import { automatedFollowUpSystem } from "../services/automatedFollowUpSystem";

const router = Router();

// Get follow-up candidates
router.get("/candidates", async (req, res) => {
  try {
    const candidates = await automatedFollowUpSystem.identifyFollowUpCandidates();
    
    res.json({
      success: true,
      count: candidates.length,
      candidates: candidates.map(c => ({
        id: c.id,
        wallet: c.wallet,
        url: c.url,
        attempts: c.attempts,
        lastContact: c.last_contact_at,
        interactionsCount: c.interactions_count,
        servicesViewed: c.services_viewed,
      })),
    });
  } catch (error: any) {
    console.error('❌ Follow-up candidates error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute follow-up campaign
router.post("/execute", async (req, res) => {
  try {
    const { dryRun = true } = req.body;
    
    console.log(`🚀 Executing follow-up campaign (dryRun: ${dryRun})`);
    const result = await automatedFollowUpSystem.executeFollowUpCampaign(dryRun);
    
    res.json({
      success: true,
      dryRun,
      results: result,
    });
  } catch (error: any) {
    console.error('❌ Follow-up execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get follow-up metrics
router.get("/metrics", async (req, res) => {
  try {
    const metrics = await automatedFollowUpSystem.getFollowUpMetrics();
    
    res.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
