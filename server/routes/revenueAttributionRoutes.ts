import { Router } from "express";
import { revenueAttributionService } from "../services/revenueAttributionService";

const router = Router();

// Get overall attribution metrics
router.get("/metrics", async (req, res) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const metrics = await revenueAttributionService.getOverallMetrics(daysBack);
    
    res.json({
      success: true,
      period: `${daysBack} days`,
      metrics,
    });
  } catch (error: any) {
    console.error('❌ Attribution metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get revenue time series
router.get("/timeseries", async (req, res) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const timeseries = await revenueAttributionService.getRevenueTimeSeries(daysBack);
    
    res.json({
      success: true,
      period: `${daysBack} days`,
      timeseries,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get attribution details for specific agent
router.get("/agent/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const details = await revenueAttributionService.getAgentAttributionDetails(walletAddress);
    
    res.json({
      success: true,
      walletAddress,
      attribution: details,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
