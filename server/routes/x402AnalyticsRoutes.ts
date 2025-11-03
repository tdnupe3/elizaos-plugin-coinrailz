import { Router } from "express";
import { x402InteractionTracker } from "../services/x402InteractionTracker";

const router = Router();

// Get interaction history for a specific wallet
router.get("/interactions/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    const history = await x402InteractionTracker.getAgentInteractionHistory(wallet);
    
    res.json({
      success: true,
      wallet,
      interactions: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get analytics for a specific service
router.get("/service/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    
    const analytics = await x402InteractionTracker.getServiceAnalytics(serviceId, days);
    
    res.json({
      success: true,
      serviceId,
      period: `${days} days`,
      analytics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get hot leads (agents with multiple interactions but no purchases)
router.get("/hot-leads", async (req, res) => {
  try {
    const minInteractions = parseInt(req.query.minInteractions as string) || 3;
    const excludePaid = req.query.excludePaid !== 'false';
    
    const leads = await x402InteractionTracker.getHotLeads(minInteractions, excludePaid);
    
    res.json({
      success: true,
      leads,
      criteria: {
        minInteractions,
        excludePaid,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get outreach attribution for a wallet
router.get("/attribution/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    const attribution = await x402InteractionTracker.getOutreachAttribution(wallet);
    
    res.json({
      success: true,
      wallet,
      attribution: attribution || null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
