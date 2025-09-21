/**
 * 📊 EXPERIMENTAL OUTREACH ANALYTICS API ROUTES
 * 
 * Revolutionary analytics endpoints for blockchain-native B2B outreach.
 * Provides real-time conversion tracking, campaign ROI, and channel performance.
 */

import { Router } from 'express';
import { outreachAnalytics } from '../services/outreachAnalytics';

const router = Router();

/**
 * 📈 Get overall performance metrics
 */
router.get('/performance/overall', async (req, res) => {
  try {
    const performance = outreachAnalytics.getOverallPerformance();
    
    res.json({
      success: true,
      performance,
      message: 'Revolutionary blockchain outreach analytics - nobody else has this data!'
    });
  } catch (error) {
    console.error('Overall performance analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Analytics retrieval failed'
    });
  }
});

/**
 * 📊 Get real-time dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = outreachAnalytics.getDashboardData();
    
    res.json({
      success: true,
      dashboard: dashboardData,
      message: 'Real-time blockchain outreach dashboard - cutting-edge analytics'
    });
  } catch (error) {
    console.error('Dashboard analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Dashboard retrieval failed'
    });
  }
});

/**
 * 🎯 Get specific campaign analytics
 */
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const analytics = outreachAnalytics.getCampaignAnalytics(campaignId);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        campaignId
      });
    }
    
    res.json({
      success: true,
      campaign: analytics,
      message: `Detailed analytics for campaign ${campaignId}`
    });
  } catch (error) {
    console.error('Campaign analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Campaign analytics retrieval failed'
    });
  }
});

/**
 * 📱 Track manual response from target wallet
 */
router.post('/track/response', async (req, res) => {
  try {
    const { campaignId, walletAddress, channel, responseContent } = req.body;
    
    if (!campaignId || !walletAddress || !channel) {
      return res.status(400).json({
        success: false,
        error: 'campaignId, walletAddress, and channel are required'
      });
    }
    
    outreachAnalytics.trackResponse(campaignId, walletAddress, channel, responseContent || 'Manual response tracked');
    
    res.json({
      success: true,
      message: 'Response tracked successfully',
      walletAddress,
      channel
    });
  } catch (error) {
    console.error('Response tracking failed:', error);
    res.status(500).json({
      success: false,
      error: 'Response tracking failed'
    });
  }
});

/**
 * 💰 Track successful payment
 */
router.post('/track/payment', async (req, res) => {
  try {
    const { campaignId, walletAddress, amount, currency, invoiceId } = req.body;
    
    if (!campaignId || !walletAddress || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'campaignId, walletAddress, amount, and currency are required'
      });
    }
    
    outreachAnalytics.trackPayment(campaignId, walletAddress, amount, currency, invoiceId || 'manual');
    
    res.json({
      success: true,
      message: 'Payment conversion tracked successfully',
      conversion: {
        walletAddress,
        amount,
        currency,
        invoiceId
      }
    });
  } catch (error) {
    console.error('Payment tracking failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment tracking failed'
    });
  }
});

/**
 * 🧪 Simulate successful conversion for testing
 */
router.post('/simulate/conversion', async (req, res) => {
  try {
    const { campaignId, walletAddress, amount = 999 } = req.body;
    
    if (!campaignId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'campaignId and walletAddress are required'
      });
    }
    
    outreachAnalytics.simulateConversion(campaignId, walletAddress, amount);
    
    res.json({
      success: true,
      message: 'Conversion simulation completed',
      simulation: {
        campaignId,
        walletAddress,
        amount,
        steps: ['contact_attempted', 'message_delivered', 'report_viewed', 'response_received', 'payment_received']
      }
    });
  } catch (error) {
    console.error('Conversion simulation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Conversion simulation failed'
    });
  }
});

/**
 * 📊 Get channel performance comparison
 */
router.get('/performance/channels', async (req, res) => {
  try {
    const dashboardData = outreachAnalytics.getDashboardData();
    const channelComparison = dashboardData.channelComparison;
    
    // Add recommendations based on performance
    const recommendations = channelComparison.map(channel => {
      let recommendation = '';
      if (channel.conversionRate > 5) {
        recommendation = 'Excellent performance - scale this channel';
      } else if (channel.conversionRate > 2) {
        recommendation = 'Good performance - optimize messaging';
      } else if (channel.conversionRate > 0) {
        recommendation = 'Low performance - test new approaches';
      } else {
        recommendation = 'No conversions yet - review targeting';
      }
      
      return {
        ...channel,
        recommendation
      };
    });
    
    res.json({
      success: true,
      channels: recommendations,
      message: 'Channel performance analysis with AI recommendations'
    });
  } catch (error) {
    console.error('Channel performance analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Channel analysis failed'
    });
  }
});

/**
 * 💡 Get optimization suggestions based on analytics
 */
router.get('/optimization/suggestions', async (req, res) => {
  try {
    const overall = outreachAnalytics.getOverallPerformance();
    const dashboard = outreachAnalytics.getDashboardData();
    
    const suggestions = [];
    
    // Analyze conversion rates
    if (overall.averageConversionRate < 1) {
      suggestions.push({
        type: 'targeting',
        priority: 'high',
        suggestion: 'Conversion rate is very low. Consider improving target wallet selection criteria.',
        impact: 'Could improve conversion rate by 200-400%'
      });
    }
    
    if (overall.averageConversionRate > 5) {
      suggestions.push({
        type: 'scaling',
        priority: 'high',
        suggestion: 'Excellent conversion rate! Scale up contact volume to maximize revenue.',
        impact: 'Could increase revenue by 300-500% with more contacts'
      });
    }
    
    // Analyze channel performance
    const bestChannel = dashboard.channelComparison.sort((a, b) => b.conversionRate - a.conversionRate)[0];
    if (bestChannel && bestChannel.conversionRate > 0) {
      suggestions.push({
        type: 'channel_optimization',
        priority: 'medium',
        suggestion: `${bestChannel.channel} is your best performing channel. Focus 70% of efforts here.`,
        impact: `Could improve overall conversion rate by focusing on ${bestChannel.channel}`
      });
    }
    
    // Revenue optimization
    if (overall.totalRevenue > 1000) {
      suggestions.push({
        type: 'pricing',
        priority: 'medium',
        suggestion: 'Consider testing higher pricing tiers for proven high-value prospects.',
        impact: 'Could increase average deal size by 50-100%'
      });
    }
    
    // Activity suggestions
    if (dashboard.todayStats.contacts < 5) {
      suggestions.push({
        type: 'activity',
        priority: 'high',
        suggestion: 'Daily contact volume is low. Aim for 10-20 high-quality contacts per day.',
        impact: 'Consistent activity drives sustainable revenue growth'
      });
    }
    
    res.json({
      success: true,
      suggestions,
      currentMetrics: {
        conversionRate: overall.averageConversionRate,
        totalRevenue: overall.totalRevenue,
        bestChannel: overall.bestPerformingChannel,
        roi: overall.totalROI
      },
      message: 'AI-powered optimization recommendations based on real performance data'
    });
  } catch (error) {
    console.error('Optimization suggestions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Optimization analysis failed'
    });
  }
});

export default router;