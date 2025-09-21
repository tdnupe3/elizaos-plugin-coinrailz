/**
 * 🚀 EXPERIMENTAL OUTREACH API ROUTES
 * 
 * Revolutionary APIs for:
 * - On-chain agent discovery
 * - Direct wallet-to-wallet outreach  
 * - Crypto invoice + report generation
 * - Multi-channel blockchain messaging
 * 
 * CUTTING-EDGE: These APIs enable outreach methods that no one else is doing!
 */

import { Router } from 'express';
import { onChainAgentOutreach } from '../services/onChainAgentOutreach';
import { cryptoInvoiceReportGenerator } from '../services/cryptoInvoiceReportGenerator';
import { experimentalOutreachCampaigns } from '../services/experimentalOutreachCampaigns';

const router = Router();

/**
 * 🔍 Discover AI agents on-chain
 * Revolutionary: Find trading bots by analyzing blockchain patterns
 */
router.get('/discover-on-chain-agents', async (req, res) => {
  try {
    console.log('🚀 EXPERIMENTAL: Discovering on-chain agents...');
    
    const {
      minVolume = 10000,
      maxAge = 24,
      networks = 'ethereum,base,polygon'
    } = req.query;
    
    const agents = await onChainAgentOutreach.discoverOnChainAgents({
      minVolume: parseInt(minVolume as string),
      maxAge: parseInt(maxAge as string),
      networks: (networks as string).split(',')
    });
    
    res.json({
      success: true,
      discovered: agents.length,
      agents: agents.slice(0, 10), // Limit response size
      message: `Discovered ${agents.length} potential agents using experimental on-chain analysis`
    });
    
  } catch (error) {
    console.error('On-chain discovery failed:', error);
    res.status(500).json({
      success: false,
      error: 'On-chain discovery failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 📊 Generate trading report for specific wallet
 * Revolutionary: Create valuable reports as outreach lead magnets
 */
router.post('/generate-trading-report', async (req, res) => {
  try {
    const {
      walletAddress,
      detectedActivity = ['trading_activity'],
      estimatedVolume = 50000,
      agentType = 'trading_bot'
    } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required'
      });
    }
    
    console.log(`📊 EXPERIMENTAL: Generating report for ${walletAddress}`);
    
    const report = await cryptoInvoiceReportGenerator.generatePersonalizedTradingReport(
      walletAddress,
      detectedActivity,
      estimatedVolume,
      agentType
    );
    
    res.json({
      success: true,
      report,
      message: 'Personalized trading report generated with experimental AI analysis'
    });
    
  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Report generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 💰 Generate crypto invoice with attached report
 * Revolutionary: Payment requests with valuable content attached
 */
router.post('/generate-crypto-invoice', async (req, res) => {
  try {
    const {
      recipientWallet,
      reportData,
      amount,
      currency = 'USDC',
      network = 'base',
      specialOffer
    } = req.body;
    
    if (!recipientWallet || !reportData) {
      return res.status(400).json({
        success: false,
        error: 'recipientWallet and reportData are required'
      });
    }
    
    console.log(`💰 EXPERIMENTAL: Generating crypto invoice for ${recipientWallet}`);
    
    const invoice = await cryptoInvoiceReportGenerator.generateCryptoInvoiceWithReport(
      recipientWallet,
      reportData,
      { amount, currency, network, specialOffer }
    );
    
    const message = cryptoInvoiceReportGenerator.generateInvoiceMessage(invoice);
    
    res.json({
      success: true,
      invoice,
      message,
      qrCode: invoice.qrCodeData,
      note: 'Revolutionary: First crypto invoice system with attached valuable reports'
    });
    
  } catch (error) {
    console.error('Crypto invoice generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Crypto invoice generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🚀 Launch experimental outreach campaign
 * Revolutionary: Automated wallet-to-wallet B2B outreach campaigns
 */
router.post('/launch-experimental-campaign', async (req, res) => {
  try {
    const {
      name = 'Experimental Campaign',
      targetCriteria = {
        minVolume: 50000,
        agentTypes: ['trading_bot', 'arbitrage'],
        networks: ['ethereum', 'base'],
        maxAge: 24
      },
      outreachMethods = ['xmtp', 'on_chain_memo'],
      maxContacts = 25
    } = req.body;
    
    console.log(`🚀 EXPERIMENTAL: Launching campaign "${name}"`);
    
    const campaign = await experimentalOutreachCampaigns.launchExperimentalCampaign(
      name,
      targetCriteria,
      { outreachMethods, maxContacts }
    );
    
    res.json({
      success: true,
      campaign,
      message: 'Revolutionary experimental campaign launched - pioneering wallet-to-wallet B2B outreach!'
    });
    
  } catch (error) {
    console.error('Campaign launch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Campaign launch failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🎯 Launch multiple experimental campaigns
 * Revolutionary: Run parallel campaigns across different agent types
 */
router.post('/launch-multiple-campaigns', async (req, res) => {
  try {
    console.log('🚀 EXPERIMENTAL: Launching multiple parallel campaigns...');
    
    const campaigns = await experimentalOutreachCampaigns.launchMultipleCampaigns();
    
    res.json({
      success: true,
      campaigns,
      count: campaigns.length,
      message: 'Multiple experimental campaigns launched simultaneously - unprecedented B2B blockchain outreach!'
    });
    
  } catch (error) {
    console.error('Multiple campaign launch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Multiple campaign launch failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 📊 Get campaign results and analytics
 * Track the success of experimental outreach methods
 */
router.get('/campaign-analytics', async (req, res) => {
  try {
    const { campaignId } = req.query;
    
    if (campaignId) {
      const campaigns = experimentalOutreachCampaigns.getCampaignResults(campaignId as string);
      res.json({
        success: true,
        campaigns,
        message: `Results for campaign ${campaignId}`
      });
    } else {
      const analytics = experimentalOutreachCampaigns.getCampaignAnalytics();
      res.json({
        success: true,
        analytics,
        message: 'Experimental campaign analytics - tracking revolutionary outreach methods'
      });
    }
    
  } catch (error) {
    console.error('Analytics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Analytics retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🔬 Test single agent outreach (for debugging)
 * Test experimental outreach methods with a single wallet
 */
router.post('/test-agent-outreach', async (req, res) => {
  try {
    const {
      walletAddress,
      network = 'ethereum',
      outreachMethod = 'xmtp',
      agentType = 'trading_bot',
      estimatedVolume = 25000
    } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required'
      });
    }
    
    console.log(`🔬 EXPERIMENTAL: Testing outreach to ${walletAddress}`);
    
    // Generate report
    const report = await cryptoInvoiceReportGenerator.generatePersonalizedTradingReport(
      walletAddress,
      ['test_trading'],
      estimatedVolume,
      agentType
    );
    
    // Generate invoice
    const invoice = await cryptoInvoiceReportGenerator.generateCryptoInvoiceWithReport(
      walletAddress,
      report,
      { amount: 99, specialOffer: 'TESTING: 90% off' }
    );
    
    // Send via experimental method
    const testAgent = {
      walletAddress,
      network,
      detectedActivity: ['test_trading'],
      estimatedVolume,
      agentType,
      contactScore: 75
    };
    
    const result = await onChainAgentOutreach.sendValueFirstCryptoInvoice(testAgent);
    
    res.json({
      success: true,
      testResult: {
        walletAddress,
        outreachMethod,
        reportGenerated: !!report,
        invoiceGenerated: !!invoice,
        outreachAttempted: !!result
      },
      report,
      invoice,
      message: 'Experimental outreach test completed - bleeding edge technology!'
    });
    
  } catch (error) {
    console.error('Test outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test outreach failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 🎨 Generate report preview (for marketing)
 * Show potential customers what our reports look like
 */
router.get('/generate-sample-report', async (req, res) => {
  try {
    const sampleWallet = '0x742d35Cc6634C0532925a3b8D15Dd93b746C112B'; // Ethereum whale
    
    const sampleReport = await cryptoInvoiceReportGenerator.generatePersonalizedTradingReport(
      sampleWallet,
      ['high_frequency_trading', 'significant_holdings'],
      2500000, // $2.5M volume
      'trading_bot'
    );
    
    res.json({
      success: true,
      sampleReport,
      message: 'Sample trading report - showcasing experimental AI analysis capabilities'
    });
    
  } catch (error) {
    console.error('Sample report generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sample report generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;