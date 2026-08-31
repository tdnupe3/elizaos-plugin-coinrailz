/**
 * 🎯 PREMIUM API ROUTES - PROTECTED ENDPOINTS
 * These are the actual APIs that customers purchase access to
 * CRITICAL: Only accessible with valid paid API keys
 */

import { Router } from 'express';
import { validateAPIKey, requireTier, AuthenticatedRequest } from '../middleware/apiAuthentication.js';
import { EnterpriseDataService } from '../services/enterpriseDataService.js';

const router = Router();

// Apply API key validation to ALL premium routes
router.use(validateAPIKey);

/**
 * 🚀 STARTER TIER ENDPOINTS ($9.99)
 * Basic crypto data and wallet creation
 */

// Real-time crypto prices
router.get('/crypto/prices', async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`📊 Crypto prices requested by agent ${req.agentId}`);
    
    const symbols = req.query.symbols as string || 'BTC,ETH,SOL,USDC';
    const symbolArray = symbols.split(',');
    
    // Fetch real crypto prices (this would use CoinGecko API)
    const prices = await fetchCryptoPrices(symbolArray);
    
    res.json({
      success: true,
      data: prices,
      timestamp: new Date().toISOString(),
      usage_remaining: req.usageRemaining,
      agent_id: req.agentId
    });
    
  } catch (error) {
    console.error('Crypto prices error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto prices' });
  }
});

// Circle wallet creation (Starter tier)
router.post('/circle/wallet/create', async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`💳 Wallet creation requested by agent ${req.agentId}`);
    
    // Create Circle wallet (this would use actual Circle SDK)
    const wallet = await createCircleWallet(req.agentId ?? 'unknown-agent');
    
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        blockchain: 'ETH',
        created_for: req.agentId
      },
      usage_remaining: req.usageRemaining
    });
    
  } catch (error) {
    console.error('Wallet creation error:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

// Market data endpoint
router.get('/market/data', async (req: AuthenticatedRequest, res) => {
  try {
    const marketData = await getMarketData();
    
    res.json({
      success: true,
      data: marketData,
      agent_id: req.agentId,
      usage_remaining: req.usageRemaining
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

/**
 * 💰 PRO TIER ENDPOINTS ($49.99)
 * Advanced features including DEX aggregation and on-chain messaging
 */

// DEX aggregation (Pro tier and above)
router.get('/dex/aggregate', requireTier(2), async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`🔀 DEX aggregation requested by agent ${req.agentId}`);
    
    const { tokenIn, tokenOut, amount } = req.query;
    
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ 
        error: 'Missing required parameters: tokenIn, tokenOut, amount' 
      });
    }
    
    // Aggregate DEX prices
    const quotes = await aggregateDEXPrices(tokenIn as string, tokenOut as string, amount as string);
    
    res.json({
      success: true,
      quotes,
      best_price: quotes[0],
      agent_id: req.agentId,
      usage_remaining: req.usageRemaining
    });
    
  } catch (error) {
    console.error('DEX aggregation error:', error);
    res.status(500).json({ error: 'Failed to aggregate DEX prices' });
  }
});

// On-chain messaging (Pro tier and above)
router.post('/messaging/send', requireTier(2), async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`📨 On-chain message requested by agent ${req.agentId}`);
    
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        error: 'Missing required parameters: to, message' 
      });
    }
    
    // Send on-chain message
    const result = await sendOnChainMessage(to, message, req.agentId ?? 'unknown-agent');
    
    res.json({
      success: true,
      message_id: result.messageId,
      sent_at: result.timestamp,
      agent_id: req.agentId,
      usage_remaining: req.usageRemaining
    });
    
  } catch (error) {
    console.error('On-chain message error:', error);
    res.status(500).json({ error: 'Failed to send on-chain message' });
  }
});

// P2P transfer (Pro tier and above)
router.post('/p2p/transfer', requireTier(2), async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`💸 P2P transfer requested by agent ${req.agentId}`);
    
    const { to, amount, currency } = req.body;
    
    // Process P2P transfer
    const transfer = await processP2PTransfer(to, amount, currency, req.agentId ?? 'unknown-agent');
    
    res.json({
      success: true,
      transfer_id: transfer.id,
      status: transfer.status,
      agent_id: req.agentId,
      usage_remaining: req.usageRemaining
    });
    
  } catch (error) {
    console.error('P2P transfer error:', error);
    res.status(500).json({ error: 'Failed to process P2P transfer' });
  }
});

/**
 * 🏢 ENTERPRISE TIER ENDPOINTS ($199.99)
 * Unlimited access to all features including trading signals
 */

// Trading signals (Enterprise tier only)
router.get('/trading/signals', requireTier(3), async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`📈 Trading signals requested by agent ${req.agentId}`);
    
    const signals = await getTradingSignals();
    
    res.json({
      success: true,
      signals,
      generated_at: new Date().toISOString(),
      agent_id: req.agentId,
      tier: 'enterprise'
    });
    
  } catch (error) {
    console.error('Trading signals error:', error);
    res.status(500).json({ error: 'Failed to fetch trading signals' });
  }
});

// XRP operations (Enterprise tier only)
router.post('/xrp/transfer', requireTier(3), async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`💎 XRP transfer requested by agent ${req.agentId}`);
    
    const { to, amount } = req.body;
    
    // Process XRP transfer
    const transfer = await processXRPTransfer(to, amount, req.agentId ?? 'unknown-agent');
    
    res.json({
      success: true,
      transaction_hash: transfer.hash,
      status: transfer.status,
      agent_id: req.agentId,
      tier: 'enterprise'
    });
    
  } catch (error) {
    console.error('XRP transfer error:', error);
    res.status(500).json({ error: 'Failed to process XRP transfer' });
  }
});

// Advanced analytics (Enterprise tier only)
router.get('/analytics/advanced', requireTier(3), async (req: AuthenticatedRequest, res) => {
  try {
    const analytics = await getAdvancedAnalytics(req.agentId ?? 'unknown-agent');
    
    res.json({
      success: true,
      analytics,
      agent_id: req.agentId,
      tier: 'enterprise'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch advanced analytics' });
  }
});

/**
 * 📊 IMPLEMENTATION FUNCTIONS
 * These would use actual APIs in production
 */

async function fetchCryptoPrices(symbols: string[]): Promise<any> {
  // In production, this would call CoinGecko API
  const mockPrices: Record<string, { price: number; change_24h: number }> = {
    BTC: { price: 67500, change_24h: 2.5 },
    ETH: { price: 3200, change_24h: 1.8 },
    SOL: { price: 155, change_24h: 4.2 },
    USDC: { price: 1.00, change_24h: 0.1 }
  };
  
  return symbols.map(symbol => ({
    symbol,
    ...mockPrices[symbol] || { price: 0, change_24h: 0 }
  }));
}

async function createCircleWallet(agentId: string): Promise<any> {
  // In production, this would use Circle SDK
  return {
    id: `wallet_${agentId}_${Date.now()}`,
    address: `0x${Math.random().toString(16).substr(2, 40)}`
  };
}

async function getMarketData(): Promise<any> {
  return {
    total_market_cap: '$2.5T',
    market_dominance: { BTC: '42%', ETH: '18%' },
    fear_greed_index: 65,
    trending_tokens: ['BTC', 'ETH', 'SOL']
  };
}

async function aggregateDEXPrices(tokenIn: string, tokenOut: string, amount: string): Promise<any[]> {
  // In production, this would call 1inch, Uniswap, etc.
  return [
    { dex: 'Uniswap', price: '3200.50', gas_estimate: '0.005 ETH' },
    { dex: '1inch', price: '3198.30', gas_estimate: '0.004 ETH' },
    { dex: 'SushiSwap', price: '3195.80', gas_estimate: '0.006 ETH' }
  ];
}

async function sendOnChainMessage(to: string, message: string, fromAgent: string): Promise<any> {
  // In production, this would use on-chain messaging
  return {
    messageId: `msg_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
}

async function processP2PTransfer(to: string, amount: string, currency: string, fromAgent: string): Promise<any> {
  // In production, this would use Circle or similar
  return {
    id: `transfer_${Date.now()}`,
    status: 'pending'
  };
}

async function getTradingSignals(): Promise<any[]> {
  // In production, this would generate real trading signals
  return [
    { symbol: 'BTC', signal: 'BUY', confidence: 0.85, target: 70000 },
    { symbol: 'ETH', signal: 'HOLD', confidence: 0.72, target: 3400 },
    { symbol: 'SOL', signal: 'BUY', confidence: 0.91, target: 180 }
  ];
}

async function processXRPTransfer(to: string, amount: string, fromAgent: string): Promise<any> {
  // In production, this would use XRP Ledger
  return {
    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    status: 'success'
  };
}

async function getAdvancedAnalytics(agentId: string): Promise<any> {
  return {
    portfolio_performance: '+15.2%',
    risk_score: 'Medium',
    recommendations: ['Increase BTC allocation', 'Consider DeFi yield farming'],
    predictive_models: {
      btc_7d: '+8%',
      eth_7d: '+12%'
    }
  };
}

export default router;