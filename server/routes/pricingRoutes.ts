/**
 * 💰 PRICING API ROUTES
 * Real-time cryptocurrency pricing endpoints for frontend
 */

import { Router } from 'express';
import { coinGeckoPricingService } from '../services/pricing/CoinGeckoPricingService';

const router = Router();

/**
 * GET /api/prices
 * Get current prices for all major cryptocurrencies
 */
router.get('/', async (req, res) => {
  try {
    const assets = ['ETH', 'SOL', 'USDC', 'USDT', 'XRP', 'BNB'];
    const prices = await coinGeckoPricingService.getPrices(assets);
    
    res.json({
      success: true,
      timestamp: Date.now(),
      prices,
      cacheStats: coinGeckoPricingService.getCacheStats()
    });
  } catch (error) {
    console.error('❌ Failed to get prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current prices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/prices/:asset
 * Get current price for specific asset (e.g., ETH, SOL)
 */
router.get('/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const price = await coinGeckoPricingService.getPrice(asset.toUpperCase());
    
    res.json({
      success: true,
      asset: asset.toUpperCase(),
      price,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`❌ Failed to get price for ${req.params.asset}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch price for ${req.params.asset}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/prices/convert/:amount/:from
 * Convert crypto amount to USD (e.g., /api/prices/convert/5/ETH)
 */
router.get('/convert/:amount/:from', async (req, res) => {
  try {
    const amount = parseFloat(req.params.amount);
    const from = req.params.from.toUpperCase();
    
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount - must be a positive number'
      });
    }

    const usdValue = await coinGeckoPricingService.getUSDValue(amount, from);
    const formattedValue = coinGeckoPricingService.formatUSD(usdValue);
    
    res.json({
      success: true,
      conversion: {
        amount,
        from,
        usdValue,
        formattedValue
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`❌ Failed to convert ${req.params.amount} ${req.params.from}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert amount',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/prices/categories/eth
 * Get ETH whale categories with current USD values
 */
router.get('/categories/eth', async (req, res) => {
  try {
    const categories = await coinGeckoPricingService.getCategoryDescriptions();
    
    res.json({
      success: true,
      categories,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Failed to get ETH categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ETH categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;