/**
 * 🎯 PUMPFUN COPY TRADING API ROUTES
 * 
 * Real-time copy trading system for PumpFun high-frequency trading wallets
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage.js';
import { pumpfunCopyTradingService } from '../services/pumpfunCopyTradingService.js';
import { z } from 'zod';

const router = Router();

/**
 * 🔍 GET /api/pumpfun-copy-trading/wallets
 * Get discovered HFT wallets ranked by performance
 */
router.get('/wallets', async (req: Request, res: Response) => {
  try {
    const wallets = await storage.getPumpfunHftWallets();
    
    const walletsWithStats = wallets.map(wallet => ({
      ...wallet,
      performanceScore: calculatePerformanceScore(wallet),
      isActive: Date.now() - new Date(wallet.lastActiveTime).getTime() < 24 * 60 * 60 * 1000, // Active in last 24h
    }));

    res.json({
      success: true,
      count: wallets.length,
      wallets: walletsWithStats
    });

  } catch (error) {
    console.error('❌ Error fetching HFT wallets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch HFT wallets' 
    });
  }
});

/**
 * 🏆 GET /api/pumpfun-copy-trading/top-wallets
 * Get top 20 performing HFT wallets
 */
router.get('/top-wallets', async (req: Request, res: Response) => {
  try {
    const allWallets = await storage.getPumpfunHftWallets();
    const topWallets = allWallets.slice(0, 20);

    res.json({
      success: true,
      topWallets: topWallets.map(wallet => ({
        address: wallet.address,
        rating: wallet.rating,
        winRate: parseFloat(wallet.winRate),
        totalPnL: parseFloat(wallet.totalPnL),
        tradingVolume24h: parseFloat(wallet.tradingVolume24h),
        specializations: wallet.specializations,
        isMonitored: wallet.isMonitored,
        lastActiveTime: wallet.lastActiveTime
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching top wallets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch top wallets' 
    });
  }
});

/**
 * 🎯 POST /api/pumpfun-copy-trading/discover-wallets
 * Discover new HFT wallets from trending tokens
 */
router.post('/discover-wallets', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Starting HFT wallet discovery...');
    
    const discoveredWallets = await pumpfunCopyTradingService.discoverTopHFTWallets();
    
    res.json({
      success: true,
      discovered: discoveredWallets.length,
      wallets: discoveredWallets.slice(0, 10), // Return top 10
      message: `Discovered ${discoveredWallets.length} high-performance trading wallets`
    });

  } catch (error) {
    console.error('❌ Error discovering wallets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to discover wallets' 
    });
  }
});

/**
 * 📊 POST /api/pumpfun-copy-trading/start-monitoring
 * Start monitoring specific wallet or all top wallets
 */
const startMonitoringSchema = z.object({
  walletAddress: z.string().optional(),
  monitorAll: z.boolean().optional()
});

router.post('/start-monitoring', async (req: Request, res: Response) => {
  try {
    const { walletAddress, monitorAll } = startMonitoringSchema.parse(req.body);

    if (monitorAll) {
      await pumpfunCopyTradingService.startMonitoringAllTopWallets();
      res.json({
        success: true,
        message: 'Started monitoring all top-rated wallets'
      });
    } else if (walletAddress) {
      await pumpfunCopyTradingService.startMonitoringWallet(walletAddress);
      
      // Update database to mark as monitored
      await storage.updatePumpfunHftWallet(walletAddress, { isMonitored: true });
      
      res.json({
        success: true,
        message: `Started monitoring wallet ${walletAddress.slice(0, 8)}...`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Either walletAddress or monitorAll must be provided'
      });
    }

  } catch (error) {
    console.error('❌ Error starting monitoring:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start monitoring' 
    });
  }
});

/**
 * 📈 GET /api/pumpfun-copy-trading/copy-trades
 * Get recent copy trades with performance data
 */
router.get('/copy-trades', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const copyTrades = await storage.getPumpfunCopyTrades(limit);

    const tradesWithPnL = copyTrades.map(trade => {
      const executedAmountNum = parseFloat(trade.executedAmount);
      const gasFeeNum = parseFloat(trade.gasFee || '0');
      
      return {
        ...trade,
        executedAmount: executedAmountNum,
        gasFee: gasFeeNum,
        success: trade.success,
        profitLoss: trade.success ? null : -gasFeeNum // Will be calculated when positions close
      };
    });

    res.json({
      success: true,
      count: copyTrades.length,
      copyTrades: tradesWithPnL
    });

  } catch (error) {
    console.error('❌ Error fetching copy trades:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch copy trades' 
    });
  }
});

/**
 * 📡 GET /api/pumpfun-copy-trading/trade-signals
 * Get recent trade signals from monitored wallets
 */
router.get('/trade-signals', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const signals = await storage.getPumpfunTradeSignals(limit);

    const signalsWithMetadata = signals.map(signal => ({
      ...signal,
      amount: parseFloat(signal.amount),
      price: signal.price ? parseFloat(signal.price) : null,
      ageMinutes: Math.floor((Date.now() - new Date(signal.signalTime).getTime()) / 60000)
    }));

    res.json({
      success: true,
      count: signals.length,
      signals: signalsWithMetadata
    });

  } catch (error) {
    console.error('❌ Error fetching trade signals:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trade signals' 
    });
  }
});

/**
 * 📊 GET /api/pumpfun-copy-trading/dashboard
 * Get copy trading dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboardData = await pumpfunCopyTradingService.getDashboardData();
    
    // Get recent performance stats
    const recentTrades = await storage.getPumpfunCopyTrades(20);
    const recentSignals = await storage.getPumpfunTradeSignals(50);
    
    const performanceStats = {
      totalTrades: recentTrades.length,
      successfulTrades: recentTrades.filter(t => t.success).length,
      successRate: recentTrades.length > 0 ? 
        (recentTrades.filter(t => t.success).length / recentTrades.length * 100).toFixed(1) : '0',
      totalSignals: recentSignals.length,
      executedSignals: recentSignals.filter(s => s.wasExecuted).length,
      executionRate: recentSignals.length > 0 ? 
        (recentSignals.filter(s => s.wasExecuted).length / recentSignals.length * 100).toFixed(1) : '0'
    };

    res.json({
      success: true,
      dashboard: {
        ...dashboardData,
        performance: performanceStats,
        systemStatus: 'operational',
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard data' 
    });
  }
});

/**
 * 🎯 GET /api/pumpfun-copy-trading/wallet/:address
 * Get detailed information about a specific wallet
 */
router.get('/wallet/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    const wallet = await storage.getPumpfunHftWalletByAddress(address);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const copyTrades = await storage.getPumpfunCopyTradesByWallet(address);
    
    const walletDetails = {
      ...wallet,
      winRate: parseFloat(wallet.winRate),
      totalPnL: parseFloat(wallet.totalPnL),
      tradingVolume24h: parseFloat(wallet.tradingVolume24h),
      avgTradeSize: parseFloat(wallet.avgTradeSize),
      copyTrades: copyTrades.length,
      lastCopyTrade: copyTrades[0]?.executedAt || null,
      recentTrades: copyTrades.slice(0, 10)
    };

    res.json({
      success: true,
      wallet: walletDetails
    });

  } catch (error) {
    console.error('❌ Error fetching wallet details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch wallet details' 
    });
  }
});

/**
 * ⚙️ POST /api/pumpfun-copy-trading/execute-trade
 * Manually execute a copy trade (for testing)
 */
const executeTradeSchema = z.object({
  walletAddress: z.string(),
  tokenMint: z.string(),
  action: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  confidence: z.number().min(0).max(100).optional().default(75)
});

router.post('/execute-trade', async (req: Request, res: Response) => {
  try {
    const tradeData = executeTradeSchema.parse(req.body);
    
    const signal = {
      walletAddress: tradeData.walletAddress,
      tokenMint: tradeData.tokenMint,
      action: tradeData.action,
      amount: tradeData.amount,
      price: 0, // Will be determined at execution
      timestamp: new Date(),
      confidence: tradeData.confidence,
      reasoning: `Manual execution via API for testing`
    };

    const result = await pumpfunCopyTradingService.executeCopyTrade(signal);
    
    res.json({
      success: result.success,
      result,
      message: result.success ? 
        `Copy trade executed: ${result.txHash}` : 
        `Copy trade failed: ${result.error}`
    });

  } catch (error) {
    console.error('❌ Error executing manual trade:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to execute trade' 
    });
  }
});

// Helper function to calculate performance score
function calculatePerformanceScore(wallet: any): number {
  const winRate = parseFloat(wallet.winRate);
  const totalPnL = parseFloat(wallet.totalPnL);
  const volume24h = parseFloat(wallet.tradingVolume24h);
  const totalTrades = wallet.totalTrades;
  
  return (winRate * 0.3) + 
         (Math.min(totalPnL, 100) * 0.3) + 
         (Math.min(totalTrades, 1000) * 0.2) + 
         (Math.min(volume24h, 100) * 0.2);
}

export default router;