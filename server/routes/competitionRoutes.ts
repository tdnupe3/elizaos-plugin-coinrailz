import { Router } from 'express';
import { competitionOutreach } from '../services/competitionOutreach.js';
import { targetedProductOutreach } from '../services/targetedProductOutreach.js';

const router = Router();

/**
 * 🏆 LAUNCH COMPETITION OUTREACH TO KNOWN AGENTS
 */
router.post('/launch-competition-outreach', async (req, res) => {
  try {
    console.log('🏆 MANUAL TRIGGER: Best Agent Competition Outreach');
    
    // Send competition invites to all 4 known agents
    await competitionOutreach.sendCompetitionInvites();
    
    // Start viral recruitment campaign
    await competitionOutreach.startViralRecruitment();
    
    res.json({
      success: true,
      message: 'Competition outreach launched to all 4 known agents',
      agents_contacted: 4,
      viral_campaign: 'activated'
    });
    
  } catch (error) {
    console.error('❌ Competition outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to launch competition outreach'
    });
  }
});

/**
 * 💎 LAUNCH TARGETED PRODUCT OUTREACH TO ALL DISCOVERED AGENTS
 */
router.post('/launch-product-outreach', async (req, res) => {
  try {
    console.log('💎 MANUAL TRIGGER: Targeted Product Outreach to All Discovered Agents');
    
    // Send targeted product offers to all discovered agents
    await targetedProductOutreach.sendTargetedProductOffers();
    
    res.json({
      success: true,
      message: 'Targeted product outreach launched to all discovered agents',
      products_offered: [
        'API Credit Packages ($9.99-$199.99)',
        'SDK Licensing ($2K-$200K/year)',
        'Enterprise Data Solutions ($25K/month)',
        'Best Agent Competition (FREE + $50K prizes)'
      ],
      targeting: 'Based on agent capabilities and purchase likelihood'
    });
    
  } catch (error) {
    console.error('❌ Product outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to launch product outreach'
    });
  }
});

/**
 * 🚀 LAUNCH COMBINED COMPETITION + PRODUCT OUTREACH
 */
router.post('/launch-combined-outreach', async (req, res) => {
  try {
    console.log('🚀 MANUAL TRIGGER: Combined Competition + Product Outreach');
    
    // Known agents get competition + targeted products
    await competitionOutreach.sendCompetitionInvites();
    await competitionOutreach.startViralRecruitment();
    
    // All discovered agents get targeted product offers
    await targetedProductOutreach.sendTargetedProductOffers();
    
    res.json({
      success: true,
      message: 'Combined outreach launched to known agents + all discovered agents',
      known_agents: 4,
      discovered_agents: 'all with targeted products',
      competition: '$50K prize pool + $500 referral bonuses',
      products: 'Personalized based on agent capabilities'
    });
    
  } catch (error) {
    console.error('❌ Combined outreach failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to launch combined outreach'
    });
  }
});

/**
 * 🎯 GET COMPETITION STATUS
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      competition: {
        name: 'Best Agent in the World Competition',
        status: 'active',
        prize_pool: '$50,000',
        participants: 'recruiting',
        duration: '30 days',
        categories: [
          'Quantum Computing & AI Integration',
          'Advanced Trading & DeFi Strategies',
          'Cross-Chain Automation Excellence', 
          'Revenue Generation Innovation',
          'Multi-Platform Agent Coordination'
        ]
      },
      outreach: {
        known_agents_contacted: 4,
        viral_recruitment: 'active',
        referral_bonus: '$500 per agent (up to $10K)'
      },
      products: {
        api_credits: '$9.99-$199.99 (Starter, Pro, Enterprise)',
        sdk_licensing: '$2K-$200K/year (5 tiers)',
        enterprise_data: '$25K/month (Crypto flow intelligence)',
        targeting: 'Personalized based on capabilities'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get competition status' });
  }
});

export default router;