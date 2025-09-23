import { Router } from 'express';
import { realWalletDiscoveryService } from '../services/realWalletDiscoveryService.js';
import { storage } from '../storage.js';

const router = Router();

/**
 * Test the real wallet discovery pipeline
 * This endpoint allows us to verify that we're discovering real wallets
 */
router.post('/test-discovery', async (req, res) => {
  try {
    console.log('🧪 Testing real wallet discovery pipeline...');
    
    // Run the discovery pipeline
    const results = await realWalletDiscoveryService.runDiscoveryPipeline();
    
    // Get some sample verified wallets
    const sampleWallets = await realWalletDiscoveryService.getVerifiedOutreachTargets(10);
    
    // Get database stats
    const allWallets = await storage.getVerifiedSolanaWallets();
    const reachableWallets = await storage.getReachableVerifiedWallets(50);
    
    const response = {
      success: true,
      discovery_results: results,
      total_verified_wallets: allWallets.length,
      reachable_wallets: reachableWallets.length,
      sample_wallets: sampleWallets.map(wallet => ({
        address: wallet.address,
        entity_type: wallet.entityType,
        labels: wallet.labels,
        verification_level: wallet.verificationLevel,
        balance_sol: wallet.balanceSOL,
        last_active: wallet.lastActive
      })),
      database_stats: {
        known_entities: allWallets.filter(w => w.verificationLevel === 'official').length,
        indexed_wallets: allWallets.filter(w => w.verificationLevel === 'indexed').length,
        by_entity_type: {
          protocol_treasury: allWallets.filter(w => w.entityType === 'protocol_treasury').length,
          trader: allWallets.filter(w => w.entityType === 'trader').length,
          exchange_wallet: allWallets.filter(w => w.entityType === 'exchange_wallet').length,
        }
      }
    };
    
    console.log('✅ Discovery test complete:', {
      total: results.totalVerifiedWallets,
      known_entities: results.knownEntitiesAdded,
      traders: results.tradersDiscovered
    });
    
    res.json(response);
    
  } catch (error: any) {
    console.error('❌ Discovery test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Real wallet discovery failed - check Helius API key and connection'
    });
  }
});

/**
 * Get verified wallet targets for outreach
 */
router.get('/targets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const verificationLevel = req.query.verification_level as string;
    const entityType = req.query.entity_type as string;
    
    const filters: any = {};
    if (verificationLevel) filters.verificationLevel = verificationLevel;
    if (entityType) filters.entityType = entityType;
    filters.reachable = true;
    filters.minBalance = 0.001; // At least 0.001 SOL
    
    const wallets = await storage.getVerifiedSolanaWallets(filters);
    
    res.json({
      success: true,
      count: wallets.length,
      wallets: wallets.slice(0, limit).map(wallet => ({
        address: wallet.address,
        entity_type: wallet.entityType,
        labels: wallet.labels,
        verification_level: wallet.verificationLevel,
        balance_sol: wallet.balanceSOL,
        tx_count_30d: wallet.txCount30d,
        dex_swaps_30d: wallet.dexSwaps30d,
        last_active: wallet.lastActive,
        is_signer_rate: wallet.isSignerRate
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching verified targets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Manual wallet verification endpoint
 */
router.post('/verify-wallet', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    // Check if already verified
    const existing = await storage.getVerifiedSolanaWalletByAddress(address);
    if (existing) {
      return res.json({
        success: true,
        already_verified: true,
        wallet: existing
      });
    }
    
    // TODO: Add manual verification logic here
    // For now, return info about whether it would be valid
    
    res.json({
      success: true,
      message: 'Manual verification not yet implemented',
      address,
      suggestion: 'Use the discovery pipeline to find real wallets automatically'
    });
    
  } catch (error: any) {
    console.error('❌ Error verifying wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;