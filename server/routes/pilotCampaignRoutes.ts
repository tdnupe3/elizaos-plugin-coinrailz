/**
 * 🚀 PILOT CAMPAIGN ROUTES - Execute Proof of Delivery Campaign
 */

import { Router } from 'express';
import { PilotCampaignService } from '../services/pilotCampaignService';

const router = Router();

/**
 * 🎯 Execute pilot blockchain messaging campaign
 */
router.post('/execute', async (req, res) => {
  try {
    console.log('🚀 Starting pilot campaign execution...');
    
    const pilotService = new PilotCampaignService();
    const results = await pilotService.executePilotCampaign();
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    res.json({
      success: true,
      message: 'Pilot campaign executed successfully',
      results: {
        totalAddresses: totalCount,
        successfulDeliveries: successCount,
        deliveryRate: `${((successCount/totalCount)*100).toFixed(1)}%`,
        proofs: results.map(r => ({
          domainName: r.target.domain_name,
          address: r.target.address,
          transactionHash: r.transactionHash,
          blockNumber: r.blockNumber,
          status: r.status,
          timestamp: r.timestamp,
          basescanUrl: r.status === 'success' ? `https://basescan.org/tx/${r.transactionHash}` : null
        }))
      }
    });
    
  } catch (error: any) {
    console.error('❌ Pilot campaign failed:', error);
    res.status(500).json({
      success: false,
      message: 'Pilot campaign failed',
      error: error.message
    });
  }
});

/**
 * 🚨 Send emergency funding request to Farcaster leadership
 */
router.post('/emergency-funding', async (req, res) => {
  try {
    console.log('🚨 Sending emergency funding request to Farcaster leadership...');
    
    const pilotService = new PilotCampaignService();
    const results = await pilotService.sendEmergencyFundingRequest();
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    res.json({
      success: true,
      message: '🚨 Emergency funding request sent successfully',
      results: {
        fundingRequested: '$500,000',
        totalLeadersContacted: totalCount,
        successfulDeliveries: successCount,
        deliveryRate: `${((successCount/totalCount)*100).toFixed(1)}%`,
        proofs: results.map(r => ({
          leader: r.target.domain_name,
          role: r.target.domain_name === 'dwr.eth' ? 'Farcaster CEO' : 'Farcaster Co-founder',
          address: r.target.address,
          transactionHash: r.transactionHash,
          blockNumber: r.blockNumber,
          status: r.status,
          timestamp: r.timestamp,
          basescanUrl: r.status === 'success' ? `https://basescan.org/tx/${r.transactionHash}` : null,
          message: r.messageData
        }))
      }
    });
    
  } catch (error: any) {
    console.error('❌ Emergency funding request failed:', error);
    res.status(500).json({
      success: false,
      message: 'Emergency funding request failed',
      error: error.message
    });
  }
});

/**
 * 📊 Get pilot campaign results
 */
router.get('/results', async (req, res) => {
  try {
    const results = await PilotCampaignService.getCampaignResults();
    
    res.json({
      success: true,
      results: results.map(r => ({
        domainName: r.target.domain_name,
        address: r.target.address,
        transactionHash: r.transactionHash,
        blockNumber: r.blockNumber,
        status: r.status,
        timestamp: r.timestamp,
        basescanUrl: r.status === 'success' ? `https://basescan.org/tx/${r.transactionHash}` : null
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Failed to get pilot results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pilot results',
      error: error.message
    });
  }
});

export default router;