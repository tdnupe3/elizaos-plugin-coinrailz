import { Express } from 'express';
import { emergencyFundRecovery } from '../services/emergencyFundRecovery';
import { isAuthenticated } from '../replitAuth';

/**
 * EMERGENCY ROUTES FOR FUND RECOVERY
 * Critical routes to investigate and recover missing $50 USDC
 */
export function registerEmergencyRoutes(app: Express) {
  
  // Emergency fund location endpoint
  app.post('/api/emergency/locate-funds', isAuthenticated, async (req, res) => {
    try {
      const { userId, walletId } = req.body;
      
      console.log(`🚨 EMERGENCY: Locating funds for user ${userId}, wallet ${walletId}`);
      
      const result = await emergencyFundRecovery.locateMissingFunds(userId, walletId);
      
      res.json({
        success: true,
        message: 'Fund location complete',
        data: result
      });
      
    } catch (error: any) {
      console.error('Emergency fund location failed:', error);
      res.status(500).json({
        success: false,
        error: 'Fund location failed',
        message: error.message
      });
    }
  });

  // Emergency balance sync endpoint
  app.post('/api/emergency/sync-balance', isAuthenticated, async (req, res) => {
    try {
      const { userId, walletId } = req.body;
      
      console.log(`🔄 EMERGENCY: Force syncing balance for user ${userId}`);
      
      // Get real balance from Circle
      const realBalance = await emergencyFundRecovery.checkCircleWalletBalance(walletId);
      
      if (realBalance && parseFloat(realBalance) > 0) {
        // Sync to database
        const synced = await emergencyFundRecovery.forceSyncBalance(userId, walletId, realBalance);
        
        res.json({
          success: true,
          message: 'Balance synced successfully',
          realBalance,
          synced
        });
      } else {
        res.json({
          success: false,
          message: 'No balance found in Circle wallet',
          realBalance: realBalance || '0'
        });
      }
      
    } catch (error: any) {
      console.error('Emergency balance sync failed:', error);
      res.status(500).json({
        success: false,
        error: 'Balance sync failed',
        message: error.message
      });
    }
  });

  // A1 Digital specific recovery endpoint
  app.post('/api/emergency/recover-a1digital-funds', async (req, res) => {
    try {
      console.log('🚨 CRITICAL: A1 Digital fund recovery initiated');
      
      const a1digitalUserId = 'user_1753383199338_eg8z8le17';
      const a1digitalWalletId = '540d451e-d4b5-5abc-9f29-7a41214d37e0';
      
      // Step 1: Check Circle API directly
      const realBalance = await emergencyFundRecovery.checkCircleWalletBalance(a1digitalWalletId);
      console.log(`Circle API balance for A1 Digital: ${realBalance}`);
      
      // Step 2: Get transaction history
      const fundResult = await emergencyFundRecovery.locateMissingFunds(a1digitalUserId, a1digitalWalletId);
      
      // Step 3: If real balance exists but not in DB, sync it
      if (realBalance && parseFloat(realBalance) >= 50) {
        await emergencyFundRecovery.forceSyncBalance(a1digitalUserId, a1digitalWalletId, realBalance);
        
        res.json({
          success: true,
          message: 'A1 Digital funds recovered successfully',
          action: 'synced_from_circle',
          realBalance,
          fundResult
        });
      } 
      // Step 4: If no balance found, apply emergency credit (pending investigation)
      else {
        res.json({
          success: false,
          message: 'Funds not found in Circle wallet - manual investigation required',
          action: 'investigation_needed',
          realBalance: realBalance || '0',
          fundResult,
          recommendation: 'Check blockchain directly for USDC at 0xb1dda3d0a398b92ef5c1085317ebb0b63e2bcc4d'
        });
      }
      
    } catch (error: any) {
      console.error('A1 Digital fund recovery failed:', error);
      res.status(500).json({
        success: false,
        error: 'A1 Digital fund recovery failed',
        message: error.message
      });
    }
  });

  console.log('🚨 Emergency routes registered for fund recovery');
}