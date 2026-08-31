import { Router } from 'express';
import { SolanaOutreachCampaignService } from '../services/solanaOutreachCampaignService.js';
import { realWalletDiscoveryService } from '../services/realWalletDiscoveryService.js';

const router = Router();

/**
 * Execute targeted outreach to specific verified wallets (PumpFun, Solana Foundation, etc.)
 */
router.post('/pumpfun-solana-foundation', async (req, res) => {
  try {
    console.log('🎯 Starting targeted outreach to PumpFun and Solana Foundation...');
    
    const outreachService = new SolanaOutreachCampaignService();
    
    // Set to dry-run mode first for safety
    await outreachService.setOutreachMode(true, 0.05, true); // Max 0.05 SOL budget, dry-run enabled
    
    // Get verified targets
    const verifiedTargets = await realWalletDiscoveryService.getVerifiedOutreachTargets(10);
    
    if (verifiedTargets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No verified wallets found',
        message: 'Discovery pipeline must be run first'
      });
    }
    
    // Filter for PumpFun and Solana Foundation specifically
    const priorityTargets = verifiedTargets.filter(wallet => 
      wallet.labels.includes('pump.fun') || 
      wallet.labels.includes('solana_foundation') ||
      wallet.labels.includes('raydium') ||
      wallet.labels.includes('jupiter') ||
      wallet.labels.includes('orca')
    );
    
    console.log(`🎯 Found ${priorityTargets.length} priority targets:`, priorityTargets.map(t => ({
      address: t.address.slice(0, 8) + '...',
      labels: t.labels,
      entityType: t.entityType,
      balanceSOL: t.balanceSOL
    })));
    
    // Create partnership message for premium trading platform
    const message = `🚀 Partnership Opportunity: Coin Railz Premium Trading Platform

Hi! We're launching a premium Solana trading platform with PumpFun copy trading and would love to explore partnership opportunities.

Key Features:
• Real-time copy trading of top PumpFun HFT wallets
• Advanced portfolio analytics and whale tracking 
• 1 SOL subscription for professional traders
• Automated trade execution with risk management

We're reaching out to top Solana protocols and foundations to discuss:
• Technical integrations and API partnerships
• Revenue sharing opportunities  
• Ecosystem development collaboration

Contact: support@coinrailz.com
Platform: https://coinrailz.com

Looking forward to connecting!
- Coin Railz Team`;

    // Execute campaign (starts in dry-run mode)
    const campaignResult = await outreachService.launchPremiumTradingCampaign();
    
    const response = {
      success: true,
      mode: 'DRY_RUN',
      campaign_id: campaignResult.campaign?.id,
      targets_count: priorityTargets.length,
      priority_targets: priorityTargets.map(target => ({
        address: target.address,
        entity_type: target.entityType,
        labels: target.labels,
        balance_sol: target.balanceSOL,
        verification_level: target.verificationLevel
      })),
      estimated_cost: '~0.00125 SOL (0.00025 SOL per message)',
      message_preview: message,
      next_steps: {
        instruction: 'Review the targets and message above. To proceed with LIVE sends:',
        approval_endpoint: 'POST /api/targeted-outreach/approve-live-sends',
        cost_breakdown: '5 messages × 0.00025 SOL = 0.00125 SOL total'
      }
    };
    
    console.log('✅ Dry-run complete. Awaiting user approval for live sends.');
    res.json(response);
    
  } catch (error: any) {
    console.error('❌ Targeted outreach failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Outreach execution failed'
    });
  }
});

/**
 * Approve and execute live sends after review
 */
router.post('/approve-live-sends', async (req, res) => {
  try {
    const { approved } = req.body;
    
    if (!approved) {
      return res.json({
        success: false,
        message: 'Outreach cancelled by user'
      });
    }
    
    console.log('🔴 USER APPROVED LIVE SENDS - Switching to live mode...');
    
    const outreachService = new SolanaOutreachCampaignService();
    
    // Switch to LIVE mode (disable dry-run)
    await outreachService.setOutreachMode(false, 0.01, false); // 0.01 SOL max, live mode, no manual approval needed
    
    // Re-execute with live sends
    const verifiedTargets = await realWalletDiscoveryService.getVerifiedOutreachTargets(10);
    const priorityTargets = verifiedTargets.filter(wallet => 
      wallet.labels.includes('pump.fun') || 
      wallet.labels.includes('solana_foundation') ||
      wallet.labels.includes('raydium') ||
      wallet.labels.includes('jupiter') ||
      wallet.labels.includes('orca')
    );
    
    const message = `🚀 Partnership Opportunity: Coin Railz Premium Trading Platform

Hi! We're launching a premium Solana trading platform with PumpFun copy trading and would love to explore partnership opportunities.

Key Features:
• Real-time copy trading of top PumpFun HFT wallets
• Advanced portfolio analytics and whale tracking 
• 1 SOL subscription for professional traders
• Automated trade execution with risk management

We're reaching out to top Solana protocols and foundations to discuss:
• Technical integrations and API partnerships
• Revenue sharing opportunities  
• Ecosystem development collaboration

Contact: support@coinrailz.com
Platform: https://coinrailz.com

Looking forward to connecting!
- Coin Railz Team`;

    const campaignResult = await outreachService.launchPremiumTradingCampaign();
    
    res.json({
      success: true,
      mode: 'LIVE',
      campaign_id: campaignResult.campaign?.id,
      messages_sent: campaignResult.campaign?.results.messagesSent || 0,
      total_cost: campaignResult.campaign?.results.totalCost || 0,
      targets_reached: priorityTargets.slice(0, 5).map(t => ({
        address: t.address.slice(0, 8) + '...',
        labels: t.labels,
        status: 'sent'
      })),
      message: 'Live outreach campaign executed successfully!'
    });
    
  } catch (error: any) {
    console.error('❌ Live outreach failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Live outreach execution failed'
    });
  }
});

export default router;