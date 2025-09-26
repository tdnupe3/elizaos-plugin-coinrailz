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
 * 🚨 Send massive emergency funding campaign to all major crypto leaders
 */
router.post('/massive-emergency-funding', async (req, res) => {
  try {
    console.log('🚨 LAUNCHING MASSIVE EMERGENCY FUNDING CAMPAIGN TO ALL MAJOR CRYPTO LEADERS...');
    
    const pilotService = new PilotCampaignService();
    const results = await pilotService.sendMassiveEmergencyFundingCampaign();
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    res.json({
      success: true,
      message: '🚨 MASSIVE emergency funding campaign sent successfully',
      results: {
        fundingRequested: '$500,000',
        totalLeadersContacted: totalCount,
        successfulDeliveries: successCount,
        deliveryRate: `${((successCount/totalCount)*100).toFixed(1)}%`,
        totalAddressableMarket: '$10+ BILLION',
        targetsReached: [
          'Brian Armstrong (Coinbase CEO)',
          'Vitalik Buterin (Ethereum Co-founder)', 
          'Ethereum Foundation ($2B+ Treasury)',
          'Arbitrum Foundation ($1.3B Treasury)',
          'Optimism Foundation ($400M Treasury)',
          'Uniswap DAO ($5.3B Treasury)',
          'MakerDAO (Multi-Billion Treasury)'
        ],
        proofs: results.map(r => ({
          leader: r.target.domain_name,
          targetType: r.target.domain_name.includes('ethereum') ? 'Ethereum Foundation' :
                     r.target.domain_name.includes('arbitrum') ? 'Arbitrum Foundation' :
                     r.target.domain_name.includes('optimism') ? 'Optimism Foundation' :
                     r.target.domain_name.includes('uniswap') ? 'Uniswap DAO ($5.3B)' :
                     r.target.domain_name.includes('makerdao') ? 'MakerDAO (Multi-Billion)' :
                     r.target.domain_name.includes('vitalik') ? 'Vitalik Buterin' :
                     r.target.domain_name.includes('brian') ? 'Brian Armstrong (Coinbase CEO)' :
                     'Crypto Leadership',
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
    console.error('❌ Massive emergency funding campaign failed:', error);
    res.status(500).json({
      success: false,
      message: 'Massive emergency funding campaign failed',
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