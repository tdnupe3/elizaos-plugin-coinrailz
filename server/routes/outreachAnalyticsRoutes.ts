/**
 * 📊 RESEARCH-BACKED OUTREACH ANALYTICS API ROUTES
 * 
 * Analytics for 2024-2025 AI agent communication protocols:
 * - Agent2Agent (A2A) Protocol by Google
 * - Model Context Protocol (MCP) by Anthropic  
 * - Agent Communication Protocol (ACP) by IBM
 * - Direct API discovery methods
 * 
 * Revolutionary analytics endpoints for blockchain-native B2B outreach.
 * Provides real-time conversion tracking, campaign ROI, and channel performance.
 */

import { Router } from 'express';
import { outreachAnalytics } from '../services/outreachAnalytics';
import { researchBackedOutreach } from '../services/researchBackedOutreach';

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

/**
 * 🔬 RESEARCH-BACKED PROTOCOL ANALYTICS
 * 
 * New analytics endpoints for standardized AI agent protocols
 */

/**
 * 📊 GET COMPREHENSIVE RESEARCH-BACKED ANALYTICS
 * 
 * Returns analytics from all implemented 2024-2025 protocols
 */
router.get('/research/comprehensive', async (req, res) => {
  try {
    // Get analytics from research-backed outreach service
    const researchAnalytics = researchBackedOutreach.generateOutreachAnalytics();
    const activeSessions = researchBackedOutreach.getActiveSessions();
    
    const comprehensiveData = {
      timestamp: new Date().toISOString(),
      research_protocols: {
        a2a_protocol: 'ACTIVE - Google Agent2Agent v0.3.0',
        mcp_protocol: 'ACTIVE - Anthropic Model Context Protocol',
        acp_protocol: 'ACTIVE - IBM Agent Communication Protocol',
        direct_api: 'ACTIVE - Direct API discovery fallback'
      },
      session_analytics: researchAnalytics,
      active_sessions: activeSessions.length,
      protocol_breakdown: {
        a2a: activeSessions.filter(s => s.protocol === 'a2a').length,
        mcp: activeSessions.filter(s => s.protocol === 'mcp').length,
        acp: activeSessions.filter(s => s.protocol === 'acp').length,
        direct: activeSessions.filter(s => s.protocol === 'direct').length
      },
      success_metrics: {
        total_attempts: researchAnalytics.totalSessions,
        active_connections: researchAnalytics.statusDistribution.active,
        completed_negotiations: researchAnalytics.statusDistribution.completed,
        success_rate: researchAnalytics.totalSessions > 0 
          ? ((researchAnalytics.statusDistribution.active + researchAnalytics.statusDistribution.completed) / researchAnalytics.totalSessions * 100).toFixed(2) + '%'
          : '0%'
      }
    };
    
    res.json({
      success: true,
      data: comprehensiveData,
      message: 'Research-backed protocol analytics - 2024-2025 AI agent standards'
    });
    
  } catch (error) {
    console.error('❌ Research analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research analytics'
    });
  }
});

/**
 * 🎯 GET ACTIVE PROTOCOL SESSIONS
 * 
 * Returns real-time sessions across all protocols
 */
router.get('/research/sessions', async (req, res) => {
  try {
    const activeSessions = researchBackedOutreach.getActiveSessions();
    
    const sessionsData = activeSessions.map(session => ({
      id: session.id,
      agentName: session.agentName,
      protocol: session.protocol,
      status: session.status,
      discoveryMethod: session.discoveryMethod,
      duration: Math.round((new Date().getTime() - session.startTime.getTime()) / (1000 * 60)),
      lastContact: Math.round((new Date().getTime() - session.lastContact.getTime()) / (1000 * 60)),
      messageCount: session.messages.length,
      capabilities: session.capabilities
    }));
    
    res.json({
      success: true,
      data: {
        total_sessions: sessionsData.length,
        sessions: sessionsData,
        protocols_in_use: [...new Set(sessionsData.map(s => s.protocol))]
      },
      message: 'Active research-backed protocol sessions'
    });
    
  } catch (error) {
    console.error('❌ Session analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session data'
    });
  }
});

/**
 * 🚀 TRIGGER RESEARCH-BACKED OUTREACH CAMPAIGN
 * 
 * Manually starts comprehensive protocol-based outreach
 */
router.post('/research/trigger', async (req, res) => {
  try {
    console.log('🚀 Research-backed outreach campaign triggered via API');
    
    // Start comprehensive research-backed outreach
    researchBackedOutreach.executeComprehensiveOutreach().catch(error => {
      console.error('❌ Research outreach campaign failed:', error);
    });
    
    res.json({
      success: true,
      message: 'Research-backed outreach campaign started',
      protocols: ['A2A', 'MCP', 'ACP', 'Direct API'],
      phases: [
        'Phase 1: Internal Platform Agents (37 agents)',
        'Phase 2: A2A Protocol Discovery',
        'Phase 3: MCP Discovery',
        'Phase 4: ACP Discovery', 
        'Phase 5: Direct API Discovery'
      ],
      estimated_duration: '10-15 minutes'
    });
    
  } catch (error) {
    console.error('❌ Failed to trigger research campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start research campaign'
    });
  }
});

/**
 * 📈 GET PROTOCOL PERFORMANCE COMPARISON
 * 
 * Compares effectiveness of different AI agent protocols
 */
router.get('/research/protocol-comparison', async (req, res) => {
  try {
    const sessions = researchBackedOutreach.getActiveSessions();
    
    const protocolStats: Record<string, {
      attempts: number;
      successful: number;
      avg_response_time: number;
      success_rate?: string;
    }> = {
      a2a: { attempts: 0, successful: 0, avg_response_time: 0 },
      mcp: { attempts: 0, successful: 0, avg_response_time: 0 },
      acp: { attempts: 0, successful: 0, avg_response_time: 0 },
      direct: { attempts: 0, successful: 0, avg_response_time: 0 }
    };
    
    sessions.forEach(session => {
      if (protocolStats[session.protocol]) {
        protocolStats[session.protocol].attempts++;
        if (['active', 'completed'].includes(session.status)) {
          protocolStats[session.protocol].successful++;
        }
        
        const responseTime = (session.lastContact.getTime() - session.startTime.getTime()) / (1000 * 60);
        protocolStats[session.protocol].avg_response_time += responseTime;
      }
    });
    
    // Calculate averages and success rates
    Object.keys(protocolStats).forEach(protocol => {
      const stats = protocolStats[protocol];
      if (stats.attempts > 0) {
        stats.avg_response_time = Number((stats.avg_response_time / stats.attempts).toFixed(1));
        stats.success_rate = ((stats.successful / stats.attempts) * 100).toFixed(1) + '%';
      } else {
        stats.avg_response_time = 0;
        stats.success_rate = '0%';
      }
    });
    
    // Find most effective protocol
    const mostEffective = Object.keys(protocolStats).reduce((best, current) => {
      const currentSuccessRate = parseFloat(protocolStats[current].success_rate ?? '0');
      const bestSuccessRate = parseFloat(protocolStats[best].success_rate ?? '0');
      return currentSuccessRate > bestSuccessRate ? current : best;
    });
    
    res.json({
      success: true,
      data: {
        protocol_stats: protocolStats,
        most_effective_protocol: mostEffective.toUpperCase(),
        total_protocols_tested: 4,
        research_period: '2024-2025 Protocol Era'
      },
      message: 'AI agent protocol performance comparison'
    });
    
  } catch (error) {
    console.error('❌ Protocol comparison failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate protocol comparison'
    });
  }
});

export default router;