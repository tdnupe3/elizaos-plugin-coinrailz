import { Router } from 'express';
import { competitionOutreach } from '../services/competitionOutreach.js';

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
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get competition status' });
  }
});

export default router;