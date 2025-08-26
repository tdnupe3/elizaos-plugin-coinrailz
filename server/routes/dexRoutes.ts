/**
 * DEX Trading Routes - Coinbase CDP Integration
 * Supports both guest users and registered users
 * Revenue generation through 0.25% trading fees and 0.5% cross-chain fees
 */

import { Request, Response, Router } from 'express';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { z } from 'zod';
import { db } from '../db';
import { dexTrades, crossChainTrades, dexRevenue } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

// ========================================
// Validation Schemas
// ========================================

const QuoteRequestSchema = z.object({
  fromAsset: z.string().min(1).max(10),
  toAsset: z.string().min(1).max(10),
  amount: z.string().regex(/^\d+\.?\d*$/),
  chain: z.string().optional().default('base-mainnet'),
  walletAddress: z.string().optional(),
  userId: z.string().optional()
});

const TradeRequestSchema = z.object({
  fromAsset: z.string().min(1).max(10),
  toAsset: z.string().min(1).max(10),
  amount: z.string().regex(/^\d+\.?\d*$/),
  walletAddress: z.string().min(10),
  userId: z.string().optional(),
  slippage: z.number().min(0.1).max(50).optional().default(2.0),
  chain: z.string().optional().default('base-mainnet')
});

const CrossChainRequestSchema = z.object({
  sourceChain: z.string().min(1),
  targetChain: z.string().min(1),
  asset: z.string().min(1).max(10),
  amount: z.string().regex(/^\d+\.?\d*$/),
  walletAddress: z.string().min(10),
  userId: z.string().optional()
});

const CustomTokenRequestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.string().min(1)
});

// ========================================
// DEX Trading Endpoints - Guest & User Support
// ========================================

/**
 * GET /api/dex/quote - Get trading quote with fees
 * Open to all users (no authentication required)
 */
router.get('/quote', async (req: Request, res: Response) => {
  try {
    const validation = QuoteRequestSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validation.error.errors
      });
    }

    const { fromAsset, toAsset, amount, chain, walletAddress, userId } = validation.data;

    // Get quote with platform fees included
    const quoteResult = await coinbaseCDPService.getDEXQuoteWithFees({
      fromAsset,
      toAsset,
      amount,
      chain,
      walletAddress,
      userId
    });

    res.json({
      success: true,
      quote: quoteResult.quote,
      isGuestQuote: quoteResult.isGuestQuote,
      estimatedGas: quoteResult.estimatedGas,
      supportedChains: await coinbaseCDPService.getSupportedNetworks()
    });

  } catch (error: any) {
    console.error('❌ DEX Quote Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trading quote',
      message: error.message
    });
  }
});

/**
 * POST /api/dex/trade - Execute DEX trade
 * Open to all users (guest + registered)
 */
router.post('/trade', async (req: Request, res: Response) => {
  try {
    const validation = TradeRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade parameters',
        details: validation.error.errors
      });
    }

    const { fromAsset, toAsset, amount, walletAddress, userId, slippage, chain } = validation.data;

    // Execute trade through CDP service
    const tradeResult = await coinbaseCDPService.executeDEXTrade({
      fromAsset,
      toAsset,
      amount,
      walletAddress,
      userId,
      slippage,
      chain
    });

    // Record trade in database for revenue tracking
    await db.insert(dexTrades).values({
      tradeId: tradeResult.tradeId,
      userId: userId || null,
      walletAddress,
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: tradeResult.toAmount,
      platformFee: tradeResult.platformFee,
      networkFee: tradeResult.networkFee,
      slippagePercent: slippage.toString(),
      chain,
      dexProtocol: 'coinbase-cdp',
      transactionHash: tradeResult.transactionHash,
      status: tradeResult.status,
      isGuestTrade: tradeResult.isGuestTrade,
      metadata: { 
        timestamp: tradeResult.timestamp,
        estimatedGas: '0.002' 
      }
    });

    // Update daily revenue tracking
    await updateDailyRevenue('trading', parseFloat(tradeResult.platformFee), tradeResult.isGuestTrade);

    res.json({
      success: true,
      trade: tradeResult,
      message: tradeResult.isGuestTrade ? 
        'Trade executed successfully as guest user' : 
        'Trade executed successfully'
    });

  } catch (error: any) {
    console.error('❌ DEX Trade Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute trade',
      message: error.message
    });
  }
});

/**
 * POST /api/dex/cross-chain - Execute cross-chain bridge
 * 0.5% fee for cross-chain transactions
 */
router.post('/cross-chain', async (req: Request, res: Response) => {
  try {
    const validation = CrossChainRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cross-chain parameters',
        details: validation.error.errors
      });
    }

    const { sourceChain, targetChain, asset, amount, walletAddress, userId } = validation.data;

    // Execute cross-chain bridge
    const bridgeResult = await coinbaseCDPService.executeCrossChainBridge({
      sourceChain,
      targetChain,
      asset,
      amount,
      walletAddress,
      userId
    });

    // Record cross-chain trade in database
    await db.insert(crossChainTrades).values({
      tradeId: bridgeResult.tradeId,
      userId: userId || null,
      walletAddress,
      sourceChain,
      targetChain,
      asset,
      sourceAmount: amount,
      targetAmount: bridgeResult.targetAmount,
      bridgeFee: bridgeResult.bridgeFee,
      status: bridgeResult.status,
      bridgeProvider: bridgeResult.bridgeProvider,
      isGuestTrade: bridgeResult.isGuestTrade,
      metadata: { 
        timestamp: bridgeResult.timestamp 
      }
    });

    // Update daily revenue tracking for cross-chain
    await updateDailyRevenue('cross-chain', parseFloat(bridgeResult.bridgeFee), bridgeResult.isGuestTrade);

    res.json({
      success: true,
      bridge: bridgeResult,
      message: 'Cross-chain bridge initiated successfully'
    });

  } catch (error: any) {
    console.error('❌ Cross-Chain Bridge Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute cross-chain bridge',
      message: error.message
    });
  }
});

/**
 * GET /api/dex/trading-pairs - Get supported trading pairs
 */
router.get('/trading-pairs', async (req: Request, res: Response) => {
  try {
    const chain = req.query.chain as string || 'base-mainnet';
    
    const tradingPairs = await coinbaseCDPService.getSupportedTradingPairs(chain);
    
    res.json({
      success: true,
      chain,
      pairs: tradingPairs,
      supportedChains: await coinbaseCDPService.getSupportedNetworks()
    });

  } catch (error: any) {
    console.error('❌ Trading Pairs Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trading pairs',
      message: error.message
    });
  }
});

/**
 * POST /api/dex/add-custom-token - Add custom token by contract address
 * Validates token contract and fetches metadata
 */
router.post('/add-custom-token', async (req: Request, res: Response) => {
  try {
    const validation = CustomTokenRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token parameters',
        details: validation.error.errors
      });
    }

    const { contractAddress, network } = validation.data;

    // Fetch token details using Coinbase CDP service
    const tokenDetails = await coinbaseCDPService.getTokenDetails({
      contractAddress,
      network
    });

    if (!tokenDetails) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        message: 'Could not fetch token details from the provided contract address'
      });
    }

    // Return token metadata for frontend usage
    res.json({
      success: true,
      token: {
        symbol: tokenDetails.symbol,
        name: tokenDetails.name,
        decimals: tokenDetails.decimals,
        logoURI: tokenDetails.logoURI || `https://via.placeholder.com/32x32/666/fff?text=${tokenDetails.symbol.charAt(0)}`,
        priceUSD: tokenDetails.priceUSD || '0.00',
        contractAddress,
        network,
        verified: tokenDetails.verified || false
      },
      message: 'Token details fetched successfully'
    });

  } catch (error: any) {
    console.error('❌ Custom Token Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add custom token',
      message: error.message || 'Could not validate or fetch token details'
    });
  }
});

/**
 * GET /api/dex/history - Get trade history (supports both guest and user)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { walletAddress, userId, limit = '50', offset = '0' } = req.query;

    if (!walletAddress && !userId) {
      return res.status(400).json({
        success: false,
        error: 'Either walletAddress or userId is required'
      });
    }

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Build query conditions
    let whereCondition = sql`1=1`;
    
    if (walletAddress) {
      whereCondition = sql`${whereCondition} AND ${dexTrades.walletAddress} = ${walletAddress}`;
    }
    
    if (userId) {
      whereCondition = sql`${whereCondition} AND ${dexTrades.userId} = ${userId}`;
    }

    // Get trade history
    const trades = await db
      .select()
      .from(dexTrades)
      .where(whereCondition)
      .orderBy(sql`${dexTrades.createdAt} DESC`)
      .limit(limitNum)
      .offset(offsetNum);

    res.json({
      success: true,
      trades,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: trades.length === limitNum
      }
    });

  } catch (error: any) {
    console.error('❌ Trade History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trade history',
      message: error.message
    });
  }
});

/**
 * GET /api/dex/stats - Get DEX usage statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get today's stats - Use direct SQL to avoid schema mismatch
    const today = new Date().toISOString().split('T')[0];
    
    const dailyStatsResult = await db.execute(sql`
      SELECT * FROM dex_revenue WHERE date = ${today} LIMIT 1
    `);

    // Get total platform stats - Use direct SQL to avoid schema mismatch
    const totalStatsResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_volume), 0) as totalVolume,
        COALESCE(SUM(trading_revenue + cross_chain_revenue), 0) as totalFees,
        COALESCE(SUM(trade_count), 0) as totalTrades
      FROM dex_revenue
    `);

    res.json({
      success: true,
      today: (dailyStatsResult.rows[0] as any) || {
        total_volume: '0.00',
        trading_revenue: '0.000000',
        trade_count: 0,
        unique_users: 0
      },
      allTime: totalStatsResult.rows[0] || {
        totalvolume: 0,
        totalfees: 0,
        totaltrades: 0
      }
    });

  } catch (error: any) {
    console.error('❌ DEX Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get DEX statistics',
      message: error.message
    });
  }
});

// ========================================
// Helper Functions
// ========================================

/**
 * Update daily revenue tracking
 */
async function updateDailyRevenue(type: 'trading' | 'cross-chain', feeAmount: number, isGuestTrade: boolean) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Check if today's record exists using raw SQL
    const existingRecordResult = await db.execute(sql`
      SELECT * FROM dex_revenue WHERE date = ${today} LIMIT 1
    `);

    if (existingRecordResult.rows.length > 0) {
      // Update existing record using raw SQL to avoid schema conflicts
      if (type === 'trading') {
        await db.execute(sql`
          UPDATE dex_revenue 
          SET trading_revenue = trading_revenue + ${feeAmount}, 
              trade_count = trade_count + 1,
              total_volume = total_volume + ${feeAmount * 40} 
          WHERE date = ${today}
        `);
      } else {
        await db.execute(sql`
          UPDATE dex_revenue 
          SET cross_chain_revenue = cross_chain_revenue + ${feeAmount}, 
              trade_count = trade_count + 1 
          WHERE date = ${today}
        `);
      }
    } else {
      // Create new record using direct SQL to avoid schema mismatch
      await db.execute(sql`
        INSERT INTO dex_revenue (date, trading_revenue, cross_chain_revenue, trade_count)
        VALUES (${today}, ${type === 'trading' ? feeAmount : 0}, ${type === 'cross-chain' ? feeAmount : 0}, 1)
      `);
    }

    console.log(`💰 Revenue updated: ${type} fee $${feeAmount.toFixed(6)} | Guest: ${isGuestTrade}`);
  } catch (error) {
    console.error('❌ Failed to update daily revenue:', error);
  }
}

export default router;