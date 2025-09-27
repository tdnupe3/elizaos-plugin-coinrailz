/**
 * 🚨 EMERGENCY FUNDING ROUTES
 * 
 * API endpoints for emergency funding request system
 */

import { Router } from 'express';
import { emergencyFundingService } from '../services/emergencyFundingService.js';

const router = Router();

/**
 * POST /api/emergency-funding/critical
 * Create and optionally execute critical emergency funding campaign
 */
router.post('/critical', async (req, res) => {
  try {
    const { targetAmount = 5000, maxTargets = 25, execute = false } = req.body;

    console.log(`🚨 Creating critical funding campaign - Target: $${targetAmount}`);

    // Create critical funding requests
    const requests = await emergencyFundingService.createCriticalFundingCampaign(
      targetAmount, 
      maxTargets
    );

    let executionResults = null;
    if (execute && requests.length > 0) {
      // Execute the campaign immediately
      const campaignId = requests[0].campaignId;
      executionResults = await emergencyFundingService.executeEmergencyFundingCampaign(campaignId);
    }

    res.json({
      success: true,
      campaign: {
        totalRequests: requests.length,
        targetAmount,
        maxTargets,
        requests: requests.slice(0, 5).map(req => ({
          id: req.id,
          targetWallet: req.targetWallet.slice(0, 8) + '...',
          requestAmount: req.requestAmount,
          urgencyLevel: req.urgencyLevel,
          status: req.status
        }))
      },
      execution: executionResults,
      message: execute ? 
        `Critical funding campaign executed: ${executionResults?.requestsSent} requests sent` :
        `Critical funding campaign created with ${requests.length} requests. Use execute=true to send.`
    });

  } catch (error) {
    console.error('❌ Critical funding campaign failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Campaign creation failed'
    });
  }
});

/**
 * POST /api/emergency-funding/target-whales
 * Target ultra-high-value wallets for emergency funding
 */
router.post('/target-whales', async (req, res) => {
  try {
    const { minBalance = 50, execute = false } = req.body;

    console.log(`🐋 Targeting whale wallets with minimum ${minBalance} SOL`);

    // Target high-value wallets
    const results = await emergencyFundingService.targetHighValueWallets(minBalance);

    let executionResults = null;
    if (execute && results.requests.length > 0) {
      executionResults = await emergencyFundingService.executeEmergencyFundingCampaign(
        results.campaign.id
      );
    }

    res.json({
      success: true,
      campaign: {
        id: results.campaign.id,
        name: results.campaign.name,
        targetedWallets: results.campaign.analytics.targetedWallets,
        potentialFunding: results.potentialFunding
      },
      targets: results.requests.slice(0, 10).map(req => ({
        wallet: req.targetWallet.slice(0, 8) + '...',
        requestAmount: req.requestAmount,
        urgencyLevel: req.urgencyLevel,
        terms: req.proposedTerms
      })),
      execution: executionResults,
      message: execute ? 
        `Whale targeting executed: ${executionResults?.requestsSent} requests sent` :
        `${results.requests.length} whale targets identified. Use execute=true to send requests.`
    });

  } catch (error) {
    console.error('❌ Whale targeting failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Whale targeting failed'
    });
  }
});

/**
 * GET /api/emergency-funding/analytics
 * Get emergency funding campaign analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await emergencyFundingService.getEmergencyFundingAnalytics();

    res.json({
      success: true,
      analytics: {
        totalRequests: analytics.totalRequests,
        requestsSent: analytics.requestsSent,
        responsesReceived: analytics.responsesReceived,
        fundingReceived: analytics.fundingReceived,
        successRate: Math.round(analytics.successRate * 10) / 10, // 1 decimal place
        totalCost: analytics.totalCost,
        roi: Math.round(analytics.roi * 10) / 10,
        status: analytics.fundingReceived > 0 ? 'FUNDING_RECEIVED' : 
                analytics.responsesReceived > 0 ? 'RESPONSES_RECEIVED' :
                analytics.requestsSent > 0 ? 'REQUESTS_SENT' : 'PENDING'
      },
      message: `Emergency funding analytics: $${analytics.fundingReceived} raised from ${analytics.responsesReceived} responses`
    });

  } catch (error) {
    console.error('❌ Analytics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analytics retrieval failed'
    });
  }
});

/**
 * GET /api/emergency-funding/responses/:campaignId
 * Monitor responses for specific campaign
 */
router.get('/responses/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    console.log(`📊 Monitoring responses for campaign: ${campaignId}`);

    const responses = await emergencyFundingService.monitorFundingResponses(campaignId);

    res.json({
      success: true,
      campaign: {
        id: campaignId,
        totalRequests: responses.totalRequests,
        responseRate: Math.round(responses.responseRate * 100),
        fundingReceived: responses.fundingReceived,
        averageAmount: responses.averageAmount
      },
      responses: responses.responses.slice(0, 20), // Limit to 20 most recent
      message: `${responses.responses.length} responses received (${Math.round(responses.responseRate * 100)}% rate)`
    });

  } catch (error) {
    console.error('❌ Response monitoring failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Response monitoring failed'
    });
  }
});

/**
 * POST /api/emergency-funding/test
 * Test emergency funding system with small batch
 */
router.post('/test', async (req, res) => {
  try {
    const { targetAmount = 1000, execute = false } = req.body;

    console.log(`🧪 Testing emergency funding system with $${targetAmount} target`);

    // Create test campaign with 1 target
    const requests = await emergencyFundingService.createCriticalFundingCampaign(
      targetAmount, 
      1 // Only 1 target for testing
    );

    let testResults = null;
    if (execute && requests.length > 0) {
      testResults = await emergencyFundingService.executeEmergencyFundingCampaign(
        requests[0].campaignId
      );
    }

    res.json({
      success: true,
      testResults: {
        requestsCreated: requests.length,
        targetAmount,
        execution: testResults,
        sample: requests.length > 0 ? {
          id: requests[0].id,
          targetWallet: requests[0].targetWallet.slice(0, 8) + '...',
          requestAmount: requests[0].requestAmount,
          terms: requests[0].proposedTerms
        } : null
      },
      message: execute ? 
        `Test executed: ${testResults?.requestsSent || 0} requests sent` :
        `Test prepared: ${requests.length} requests ready. Use execute=true to send.`
    });

  } catch (error) {
    console.error('❌ Emergency funding test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    });
  }
});

export default router;