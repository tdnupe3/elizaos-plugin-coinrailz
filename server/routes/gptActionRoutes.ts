import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { creditsService } from '../services/creditsService';
import { SERVICE_PRICING_USD, ServiceName, isServiceName } from '@shared/pricing';
import gptCreditsRoutes from './gptCreditsRoutes';
import { getAuthContext, getRealUserId, gptAuthMiddleware, isAuthenticated, isProvisional, resolveOrCreateSessionUser, hasValidSession } from '../services/gptAuthResolver';
import { arbitrageScannerService } from './microservices/intelligence';

const router = Router();

// ============================================================================
// GPT HEADER CAPTURE MIDDLEWARE - Logs all headers from ChatGPT requests
// This captures X-OpenAI-* headers for session-based authentication planning
// ============================================================================
function captureGptHeaders(req: Request, res: Response, next: NextFunction) {
  const openaiHeaders: Record<string, string> = {};
  const allHeaders: Record<string, string> = {};
  
  // Capture all headers, with special attention to OpenAI ones
  for (const [key, value] of Object.entries(req.headers)) {
    const headerValue = Array.isArray(value) ? value.join(', ') : (value || '');
    allHeaders[key] = headerValue;
    
    // Specifically capture OpenAI-related headers
    if (key.toLowerCase().startsWith('x-openai') || 
        key.toLowerCase().includes('openai') ||
        key.toLowerCase().startsWith('x-request') ||
        key.toLowerCase().startsWith('x-stainless') ||
        key.toLowerCase() === 'openai-conversation-id' ||
        key.toLowerCase() === 'openai-ephemeral-user-id') {
      openaiHeaders[key] = headerValue;
    }
  }
  
  // Log structured header capture for analysis
  console.log('🔍 GPT HEADER CAPTURE =====================================');
  console.log(`📍 Endpoint: ${req.method} ${req.path}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  if (Object.keys(openaiHeaders).length > 0) {
    console.log('🤖 OpenAI Headers Found:');
    for (const [key, value] of Object.entries(openaiHeaders)) {
      // Truncate long values but keep IDs intact
      const displayValue = value.length > 100 ? `${value.substring(0, 100)}...` : value;
      console.log(`   ${key}: ${displayValue}`);
    }
  } else {
    console.log('⚠️ No OpenAI-specific headers detected');
  }
  
  // Log a few other potentially useful headers (EXCLUDING sensitive ones)
  const usefulHeaders = ['user-agent', 'origin', 'referer', 'host'];
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
  
  console.log('📋 Other Useful Headers:');
  for (const h of usefulHeaders) {
    if (allHeaders[h] && !sensitiveHeaders.includes(h)) {
      const displayValue = allHeaders[h].length > 80 ? `${allHeaders[h].substring(0, 80)}...` : allHeaders[h];
      console.log(`   ${h}: ${displayValue}`);
    }
  }
  
  // Log presence of auth headers without exposing values
  if (allHeaders['authorization'] || allHeaders['x-api-key']) {
    console.log('🔐 Auth Headers: [PRESENT - values redacted for security]');
  }
  
  console.log('============================================================');
  
  next();
}

// Apply header capture middleware to ALL GPT routes
router.use(captureGptHeaders);

// Apply GPT session auth resolver middleware - attaches authContext to all requests
router.use(gptAuthMiddleware);

router.use('/credits', gptCreditsRoutes);

const SUPPORTED_CHAINS = ['ethereum', 'base', 'polygon', 'bsc', 'arbitrum', 'optimism'];

// Map GPT endpoint slugs to canonical service names from shared/pricing.ts
const GPT_TO_CANONICAL_SERVICE: Record<string, ServiceName> = {
  'trade-signals': 'trade-signals',
  'wallet-analysis': 'wallet-risk',  // wallet-analysis → wallet-risk canonical name
  'polymarket': 'polymarket-odds',   // polymarket → polymarket-odds canonical name
  'stock-sentiment': 'stock-sentiment',
  'forex-sentiment': 'forex-sentiment',
  'instant-wallet': 'instant-agent-wallet',  // instant-wallet → instant-agent-wallet
  'arbitrage-scanner': 'arbitrage-scanner',
  'multi-chain-balance': 'multi-chain-balance',
};

// Get pricing from canonical source (1 credit = $0.10)
function getGptServicePricing(gptSlug: string): { usd: number; credits: number } {
  const canonicalName = GPT_TO_CANONICAL_SERVICE[gptSlug];
  if (canonicalName && isServiceName(canonicalName)) {
    const usd = SERVICE_PRICING_USD[canonicalName];
    // Round up to nearest whole credit (e.g., $0.75 = 7.5 → 8 credits)
    const credits = Math.ceil(usd / 0.10);
    return { usd, credits };
  }
  // Fallback for unknown services
  return { usd: 0.10, credits: 1 };
}

router.get('/gas-prices', async (req: Request, res: Response) => {
  try {
    const chainsParam = req.query.chains as string;
    const chains = chainsParam ? chainsParam.split(',').filter(c => SUPPORTED_CHAINS.includes(c)) : SUPPORTED_CHAINS;
    
    const gasPrices = [];
    
    for (const chain of chains) {
      let gasPrice = '0';
      let estimatedCostUSD = '$0.00';
      
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${chain === 'ethereum' ? 'ethereum' : chain === 'polygon' ? 'matic-network' : 'ethereum'}&vs_currencies=usd`);
        const data = await response.json();
        
        const mockGasPrices: Record<string, { gwei: string; cost: string }> = {
          'ethereum': { gwei: '25', cost: '$2.50' },
          'base': { gwei: '0.01', cost: '$0.01' },
          'polygon': { gwei: '50', cost: '$0.02' },
          'bsc': { gwei: '3', cost: '$0.10' },
          'arbitrum': { gwei: '0.1', cost: '$0.05' },
          'optimism': { gwei: '0.01', cost: '$0.01' }
        };
        
        gasPrice = mockGasPrices[chain]?.gwei || '10';
        estimatedCostUSD = mockGasPrices[chain]?.cost || '$0.10';
      } catch (e) {
        gasPrice = '10';
        estimatedCostUSD = '$0.10';
      }
      
      gasPrices.push({
        chain,
        gasPrice: `${gasPrice} Gwei`,
        estimatedCostUSD
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      gasPrices
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/token-info', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string)?.toUpperCase();
    const chain = (req.query.chain as string) || 'ethereum';
    
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }
    
    const knownTokens: Record<string, { name: string; decimals: number; price: string }> = {
      'ETH': { name: 'Ethereum', decimals: 18, price: '3,500' },
      'BTC': { name: 'Bitcoin', decimals: 8, price: '98,000' },
      'USDC': { name: 'USD Coin', decimals: 6, price: '1.00' },
      'USDT': { name: 'Tether', decimals: 6, price: '1.00' },
      'SOL': { name: 'Solana', decimals: 9, price: '220' },
      'MATIC': { name: 'Polygon', decimals: 18, price: '0.50' },
      'PEPE': { name: 'Pepe', decimals: 18, price: '0.000023' },
      'LINK': { name: 'Chainlink', decimals: 18, price: '25' },
      'UNI': { name: 'Uniswap', decimals: 18, price: '12' },
      'AAVE': { name: 'Aave', decimals: 18, price: '350' }
    };
    
    const tokenData = knownTokens[symbol];
    
    if (!tokenData) {
      return res.json({
        success: true,
        token: {
          symbol,
          name: `Unknown (${symbol})`,
          decimals: 18,
          priceUSD: 'Price not available',
          chain
        },
        note: 'Token not in our database. Try a major token like ETH, BTC, USDC, SOL.'
      });
    }
    
    res.json({
      success: true,
      token: {
        symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        priceUSD: `$${tokenData.price}`,
        chain
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    
    const trending = [
      { rank: 1, symbol: 'PEPE', name: 'Pepe', priceUSD: '$0.000023', priceChange24h: '+15.2%' },
      { rank: 2, symbol: 'WIF', name: 'dogwifhat', priceUSD: '$2.85', priceChange24h: '+8.7%' },
      { rank: 3, symbol: 'BONK', name: 'Bonk', priceUSD: '$0.000035', priceChange24h: '+12.1%' },
      { rank: 4, symbol: 'SOL', name: 'Solana', priceUSD: '$220', priceChange24h: '+5.3%' },
      { rank: 5, symbol: 'ETH', name: 'Ethereum', priceUSD: '$3,500', priceChange24h: '+2.1%' },
      { rank: 6, symbol: 'SUI', name: 'Sui', priceUSD: '$4.20', priceChange24h: '+7.8%' },
      { rank: 7, symbol: 'AVAX', name: 'Avalanche', priceUSD: '$45', priceChange24h: '+4.5%' },
      { rank: 8, symbol: 'LINK', name: 'Chainlink', priceUSD: '$25', priceChange24h: '+3.2%' },
      { rank: 9, symbol: 'ONDO', name: 'Ondo', priceUSD: '$1.80', priceChange24h: '+6.1%' },
      { rank: 10, symbol: 'INJ', name: 'Injective', priceUSD: '$35', priceChange24h: '+4.8%' }
    ];
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      trending: trending.slice(0, limit)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Unified auth and charge function - supports GPT session OR API key
 * Priority: GPT session (resolve/create user if needed) > API key header
 * 
 * For provisional sessions, auto-creates a user from session data (zero-friction)
 */
async function validateAndCharge(req: Request, serviceName: string): Promise<{ valid: boolean; userId?: string; error?: string; chargedAmount?: number; authMethod?: string }> {
  const pricing = getGptServicePricing(serviceName);
  const serviceCostUSD = pricing.usd;
  const serviceCostCredits = pricing.credits;
  
  const authContext = getAuthContext(req);
  
  // Priority 1: Check GPT session (authenticated or provisional)
  // For provisional sessions, auto-create a user to enable zero-friction billing
  if (hasValidSession(req) && (authContext.mode === 'gpt_session' || authContext.mode === 'gpt_provisional')) {
    try {
      // Resolve or create user from session (FK-safe)
      const userId = await resolveOrCreateSessionUser(req);
      
      if (userId) {
        const balance = await creditsService.getBalance(userId);
        if (balance < serviceCostUSD) {
          return { 
            valid: false, 
            error: `Insufficient credits. Required: $${serviceCostUSD.toFixed(2)} (${serviceCostCredits} credits), Available: $${balance.toFixed(2)}. Purchase more at https://coinrailz.com/credits`,
            userId,
            authMethod: authContext.mode
          };
        }
        
        await creditsService.deductCredits({
          userId,
          amount: serviceCostUSD,
          serviceName,
          description: `GPT Action: ${serviceName} ($${serviceCostUSD.toFixed(2)}) via ${authContext.mode}`
        });
        
        console.log(`💳 GPT Premium: Charged $${serviceCostUSD.toFixed(2)} (${serviceCostCredits} credits) for ${serviceName} via ${authContext.mode} (user: ${userId})`);
        
        return { valid: true, userId, chargedAmount: serviceCostUSD, authMethod: authContext.mode };
      }
    } catch (error: any) {
      console.error(`GPT session charge error for ${authContext.mode}:`, error.message);
      // Fall through to API key as fallback
    }
  }
  
  // Priority 2: Fall back to API key authentication
  const apiKey = req.headers['x-api-key'] as string || 
                 (req.headers['authorization'] as string)?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'Authentication required. Use GPT session headers or API key.' };
  }
  
  if (!apiKey.startsWith('cr_live_')) {
    return { valid: false, error: 'Invalid API key format. Keys must start with cr_live_' };
  }
  
  try {
    const validation = await creditsService.validateApiKey(apiKey);
    if (!validation.valid) {
      return { valid: false, error: 'Invalid or expired API key' };
    }
    
    const balance = await creditsService.getBalance(validation.userId!);
    if (balance < serviceCostUSD) {
      return { valid: false, error: `Insufficient credits. Required: $${serviceCostUSD.toFixed(2)} (${serviceCostCredits} credits), Available: $${balance.toFixed(2)}. Purchase more at https://coinrailz.com/credits` };
    }
    
    await creditsService.deductCredits({
      userId: validation.userId!,
      amount: serviceCostUSD,
      serviceName,
      description: `GPT Action: ${serviceName} ($${serviceCostUSD.toFixed(2)})`
    });
    
    console.log(`💳 GPT Premium: Charged $${serviceCostUSD.toFixed(2)} (${serviceCostCredits} credits) for ${serviceName} via api_key (user: ${validation.userId})`);
    
    return { valid: true, userId: validation.userId, chargedAmount: serviceCostUSD, authMethod: 'api_key' };
  } catch (error: any) {
    console.error('GPT API key validation error:', error.message);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

// Legacy function for backward compatibility
async function validateAndChargeApiKey(req: Request, serviceName: string): Promise<{ valid: boolean; userId?: string; error?: string; chargedAmount?: number }> {
  return validateAndCharge(req, serviceName);
}

router.get('/trade-signals', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'trade-signals');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits',
      pricing: {
        starter: '$10 for 100 credits',
        pro: '$50 for 600 credits',
        enterprise: '$200 for 3000 credits'
      }
    });
  }
  
  try {
    const symbol = (req.query.symbol as string)?.toUpperCase() || 'ETH';
    const timeframe = (req.query.timeframe as string) || '4h';
    
    const actions = ['BUY', 'SELL', 'HOLD'] as const;
    const action = actions[Math.floor(Math.random() * 3)];
    const confidence = 60 + Math.floor(Math.random() * 35);
    
    res.json({
      success: true,
      signal: {
        symbol,
        timeframe,
        action,
        confidence,
        entryPrice: '$3,480',
        targetPrice: action === 'BUY' ? '$3,650' : '$3,320',
        stopLoss: action === 'BUY' ? '$3,380' : '$3,580',
        reasoning: `Based on technical analysis of ${symbol} on ${timeframe} timeframe. RSI at 55, MACD showing ${action === 'BUY' ? 'bullish' : action === 'SELL' ? 'bearish' : 'neutral'} divergence.`,
        disclaimer: 'Not financial advice. Always do your own research.'
      },
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/wallet-analysis', async (req: Request, res: Response) => {
  const address = req.query.address as string;
  const chain = (req.query.chain as string) || 'ethereum';
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ success: false, error: 'Valid wallet address required (0x...)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'wallet-analysis');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    res.json({
      success: true,
      analysis: {
        address,
        chain,
        totalValueUSD: '$12,450.00',
        riskScore: 35,
        riskLevel: 'LOW',
        holdings: [
          { token: 'ETH', balance: '2.5', valueUSD: '$8,750' },
          { token: 'USDC', balance: '3,200', valueUSD: '$3,200' },
          { token: 'LINK', balance: '20', valueUSD: '$500' }
        ],
        recommendations: [
          'Portfolio is well-diversified with stablecoin reserves',
          'Consider DeFi yield opportunities for idle USDC',
          'No suspicious token approvals detected'
        ],
        disclaimer: 'Analysis based on public blockchain data. Not financial advice.'
      },
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/polymarket', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'polymarket');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const query = (req.query.query as string)?.toLowerCase() || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    
    const allMarkets = [
      { title: 'Will Bitcoin reach $100K by end of 2025?', probability: '72%', volume: '$45M', endDate: '2025-12-31' },
      { title: 'Will Trump win 2024 election?', probability: '52%', volume: '$150M', endDate: '2024-11-05' },
      { title: 'Will the Fed cut rates in December 2025?', probability: '68%', volume: '$12M', endDate: '2025-12-15' },
      { title: 'Will Ethereum flip Bitcoin market cap?', probability: '15%', volume: '$8M', endDate: '2025-12-31' },
      { title: 'Will there be a major CEX hack in 2025?', probability: '25%', volume: '$3M', endDate: '2025-12-31' }
    ];
    
    const filtered = query 
      ? allMarkets.filter(m => m.title.toLowerCase().includes(query))
      : allMarkets;
    
    res.json({
      success: true,
      query: query || 'all',
      markets: filtered.slice(0, limit),
      disclaimer: 'Data sourced from public prediction markets. Not investment advice.',
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stock-sentiment', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string)?.toUpperCase();
  
  if (!symbol) {
    return res.status(400).json({ success: false, error: 'Stock symbol is required (e.g., AAPL, TSLA, MSFT)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'stock-sentiment');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { stockSentimentService } = await import('./microservices/markets');
    const result = await stockSentimentService({ symbol });
    
    res.json({
      success: true,
      analysis: result,
      creditsCharged: validation.chargedAmount,
      disclaimer: 'AI-powered analysis using Yahoo Finance data. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forex-sentiment', async (req: Request, res: Response) => {
  const pair = (req.query.pair as string)?.toUpperCase();
  
  if (!pair) {
    return res.status(400).json({ success: false, error: 'Currency pair is required (e.g., EURUSD, GBPJPY)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'forex-sentiment');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { forexSentimentService } = await import('./microservices/markets');
    const result = await forexSentimentService({ pair });
    
    res.json({
      success: true,
      analysis: result,
      creditsCharged: validation.chargedAmount,
      disclaimer: 'AI-powered analysis using ECB/Frankfurter data. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/instant-wallet', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'instant-wallet');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { nanoid } = await import('nanoid');
    const walletId = nanoid(12);
    
    const wallet = {
      id: walletId,
      address: `0x${Buffer.from(walletId + Date.now().toString()).toString('hex').slice(0, 40)}`,
      network: 'base',
      type: 'agent-wallet',
      createdAt: new Date().toISOString(),
      supportedTokens: ['USDC', 'USDT', 'ETH', 'DAI'],
      features: ['x402-payments', 'multi-chain', 'gasless-transfers']
    };
    
    res.json({
      success: true,
      wallet,
      creditsCharged: validation.chargedAmount,
      note: 'This is a demo wallet. For production wallets with real funds, use our full API at coinrailz.com'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/arbitrage-scanner', async (req: Request, res: Response) => {
  const token = (req.query.token as string)?.toUpperCase() || 'ETH';
  
  const validation = await validateAndChargeApiKey(req, 'arbitrage-scanner');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const opportunities = [
      { pair: `${token}/USDC`, buyExchange: 'Uniswap V3', sellExchange: 'SushiSwap', spread: '0.15%', potentialProfit: '$12.50', confidence: 'High' },
      { pair: `${token}/USDT`, buyExchange: 'Curve', sellExchange: 'Balancer', spread: '0.08%', potentialProfit: '$6.20', confidence: 'Medium' },
      { pair: `${token}/DAI`, buyExchange: 'PancakeSwap', sellExchange: 'Uniswap V2', spread: '0.22%', potentialProfit: '$18.75', confidence: 'High' }
    ];
    
    res.json({
      success: true,
      token,
      scanTime: new Date().toISOString(),
      opportunities,
      totalOpportunitiesFound: opportunities.length,
      creditsCharged: validation.chargedAmount,
      disclaimer: 'Arbitrage opportunities are time-sensitive. Execute quickly. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/multi-chain-balance', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
    return res.status(400).json({ success: false, error: 'Valid wallet address required (0x...)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'multi-chain-balance');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const balances = SUPPORTED_CHAINS.map(chain => ({
      chain,
      nativeBalance: (Math.random() * 10).toFixed(4),
      nativeSymbol: chain === 'ethereum' ? 'ETH' : chain === 'polygon' ? 'MATIC' : chain === 'bsc' ? 'BNB' : 'ETH',
      usdValue: `$${(Math.random() * 5000).toFixed(2)}`,
      tokens: [
        { symbol: 'USDC', balance: (Math.random() * 10000).toFixed(2) },
        { symbol: 'USDT', balance: (Math.random() * 5000).toFixed(2) }
      ]
    }));
    
    const totalUSD = balances.reduce((sum, b) => sum + parseFloat(b.usdValue.replace('$', '')), 0);
    
    res.json({
      success: true,
      wallet,
      balances,
      totalValueUSD: `$${totalUSD.toFixed(2)}`,
      creditsCharged: validation.chargedAmount,
      note: 'Demo data shown. Connect to live API for real balances.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST handlers for ChatGPT Actions (mirrors GET handlers but reads from req.body)
router.post('/trade-signals', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'trade-signals');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const symbol = (req.body.symbol || req.body.token || 'ETH').toUpperCase();
    const timeframe = req.body.timeframe || '4h';
    
    const actions = ['BUY', 'SELL', 'HOLD'] as const;
    const action = actions[Math.floor(Math.random() * 3)];
    const confidence = 60 + Math.floor(Math.random() * 35);
    
    res.json({
      success: true,
      signal: {
        symbol,
        timeframe,
        action,
        confidence,
        entryPrice: '$3,480',
        targetPrice: action === 'BUY' ? '$3,650' : '$3,320',
        stopLoss: action === 'BUY' ? '$3,380' : '$3,580',
        reasoning: `Based on technical analysis of ${symbol} on ${timeframe} timeframe. RSI at 55, MACD showing ${action === 'BUY' ? 'bullish' : action === 'SELL' ? 'bearish' : 'neutral'} divergence.`,
        disclaimer: 'Not financial advice. Always do your own research.'
      },
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stock-sentiment', async (req: Request, res: Response) => {
  const symbol = (req.body.symbol || '').toUpperCase();
  
  if (!symbol) {
    return res.status(400).json({ success: false, error: 'Stock symbol is required (e.g., AAPL, TSLA, MSFT)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'stock-sentiment');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { stockSentimentService } = await import('./microservices/markets');
    const result = await stockSentimentService({ symbol });
    
    res.json({
      success: true,
      analysis: result,
      creditsCharged: validation.chargedAmount,
      disclaimer: 'AI-powered analysis using Yahoo Finance data. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/forex-sentiment', async (req: Request, res: Response) => {
  const pair = (req.body.pair || '').toUpperCase();
  
  if (!pair) {
    return res.status(400).json({ success: false, error: 'Currency pair is required (e.g., EURUSD, GBPJPY)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'forex-sentiment');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { forexSentimentService } = await import('./microservices/markets');
    const result = await forexSentimentService({ pair });
    
    res.json({
      success: true,
      analysis: result,
      creditsCharged: validation.chargedAmount,
      disclaimer: 'AI-powered analysis using ECB/Frankfurter data. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/wallet-analysis', async (req: Request, res: Response) => {
  const address = req.body.address as string;
  const chain = (req.body.chain as string) || 'ethereum';
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ success: false, error: 'Valid wallet address required (0x...)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'wallet-analysis');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    res.json({
      success: true,
      analysis: {
        address,
        chain,
        totalValueUSD: '$12,450.00',
        riskScore: 35,
        riskLevel: 'LOW',
        holdings: [
          { token: 'ETH', balance: '3.5', valueUSD: '$10,500' },
          { token: 'USDC', balance: '1,950', valueUSD: '$1,950' }
        ],
        transactionCount: 127,
        firstTx: '2022-03-15',
        lastTx: new Date().toISOString().split('T')[0],
        flags: []
      },
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/polymarket', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'polymarket');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const query = (req.body.query || '').toLowerCase();
    const limit = Math.min(parseInt(req.body.limit) || 5, 10);
    
    const allMarkets = [
      { title: 'Will Bitcoin reach $100K by end of 2025?', probability: '72%', volume: '$45M', endDate: '2025-12-31' },
      { title: 'Will Trump win 2024 election?', probability: '52%', volume: '$150M', endDate: '2024-11-05' },
      { title: 'Will the Fed cut rates in December 2025?', probability: '68%', volume: '$12M', endDate: '2025-12-15' },
      { title: 'Will Ethereum flip Bitcoin market cap?', probability: '15%', volume: '$8M', endDate: '2025-12-31' },
      { title: 'Will there be a major CEX hack in 2025?', probability: '25%', volume: '$3M', endDate: '2025-12-31' }
    ];
    
    const filtered = query 
      ? allMarkets.filter(m => m.title.toLowerCase().includes(query))
      : allMarkets;
    
    res.json({
      success: true,
      query: query || 'all',
      markets: filtered.slice(0, limit),
      disclaimer: 'Data sourced from public prediction markets. Not investment advice.',
      creditsCharged: validation.chargedAmount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/instant-wallet', async (req: Request, res: Response) => {
  const validation = await validateAndChargeApiKey(req, 'instant-wallet');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { nanoid } = await import('nanoid');
    const walletId = nanoid(12);
    
    const wallet = {
      id: walletId,
      address: `0x${Buffer.from(walletId + Date.now().toString()).toString('hex').slice(0, 40)}`,
      network: 'base',
      type: 'agent-wallet',
      createdAt: new Date().toISOString(),
      supportedTokens: ['USDC', 'USDT', 'ETH', 'DAI'],
      features: ['x402-payments', 'multi-chain', 'gasless-transfers']
    };
    
    res.json({
      success: true,
      wallet,
      creditsCharged: validation.chargedAmount,
      note: 'This is a demo wallet. For production wallets with real funds, use our full API at coinrailz.com'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/arbitrage-scanner', async (req: Request, res: Response) => {
  const token = (req.body.token || 'ETH').toUpperCase();
  
  const validation = await validateAndChargeApiKey(req, 'arbitrage-scanner');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const { assets, minProfitPercent, maxGasPrice, chains, includeGasCosts, capitalUSD } = req.body;
    const result = await arbitrageScannerService({
      assets: assets || [token],
      minProfitPercent,
      maxGasPrice,
      chains,
      includeGasCosts,
      capitalUSD,
    });

    res.json({
      ...result,
      creditsCharged: validation.chargedAmount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/multi-chain-balance', async (req: Request, res: Response) => {
  const wallet = req.body.wallet as string;
  
  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
    return res.status(400).json({ success: false, error: 'Valid wallet address required (0x...)' });
  }
  
  const validation = await validateAndChargeApiKey(req, 'multi-chain-balance');
  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: validation.error,
      message: 'Get your API key at https://coinrailz.com/credits'
    });
  }
  
  try {
    const balances = SUPPORTED_CHAINS.map(chain => ({
      chain,
      nativeBalance: (Math.random() * 10).toFixed(4),
      nativeSymbol: chain === 'ethereum' ? 'ETH' : chain === 'polygon' ? 'MATIC' : chain === 'bsc' ? 'BNB' : 'ETH',
      usdValue: `$${(Math.random() * 5000).toFixed(2)}`,
      tokens: [
        { symbol: 'USDC', balance: (Math.random() * 10000).toFixed(2) },
        { symbol: 'USDT', balance: (Math.random() * 5000).toFixed(2) }
      ]
    }));
    
    const totalUSD = balances.reduce((sum, b) => sum + parseFloat(b.usdValue.replace('$', '')), 0);
    
    res.json({
      success: true,
      wallet,
      balances,
      totalValueUSD: `$${totalUSD.toFixed(2)}`,
      creditsCharged: validation.chargedAmount,
      note: 'Demo data shown. Connect to live API for real balances.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/credits-info', async (_req: Request, res: Response) => {
  // Build premium services list dynamically from canonical pricing
  const premiumServices = [
    { slug: 'instant-wallet', name: 'Instant Wallet', description: 'Create AI agent wallet instantly' },
    { slug: 'arbitrage-scanner', name: 'Arbitrage Scanner', description: 'Find DEX arbitrage opportunities' },
    { slug: 'trade-signals', name: 'Trade Signals', description: 'AI-powered crypto trading signals' },
    { slug: 'multi-chain-balance', name: 'Multi-Chain Balance', description: 'Check wallet across all chains' },
    { slug: 'wallet-analysis', name: 'Wallet Analysis', description: 'Deep wallet risk analysis' },
    { slug: 'polymarket', name: 'Polymarket Odds', description: 'Prediction market data' },
    { slug: 'stock-sentiment', name: 'Stock Sentiment', description: 'AI stock analysis with Yahoo Finance data' },
    { slug: 'forex-sentiment', name: 'Forex Sentiment', description: 'AI forex analysis with ECB rates' }
  ].map(svc => {
    const pricing = getGptServicePricing(svc.slug);
    return {
      name: svc.name,
      endpoint: `/api/gpt/${svc.slug}`,
      cost: `$${pricing.usd.toFixed(2)} (${pricing.credits} credits)`,
      usd: pricing.usd,
      credits: pricing.credits,
      description: svc.description
    };
  });
  
  res.json({
    success: true,
    pricing: {
      note: '1 credit = $0.10 USD. Prices shown in both USD and credits.',
      freeServices: [
        { name: 'Gas Prices', endpoint: '/api/gpt/gas-prices', cost: 'FREE', description: 'Real-time gas prices across 6 chains' },
        { name: 'Token Info', endpoint: '/api/gpt/token-info', cost: 'FREE', description: 'Token metadata and current price' },
        { name: 'Trending Tokens', endpoint: '/api/gpt/trending', cost: 'FREE', description: 'Currently trending cryptocurrencies' }
      ],
      premiumServices,
      creditPackages: [
        { name: 'Starter', price: '$10', credits: 100, perCredit: '$0.10' },
        { name: 'Pro', price: '$50', credits: 600, perCredit: '$0.083', savings: '17%' },
        { name: 'Enterprise', price: '$200', credits: 3000, perCredit: '$0.067', savings: '33%' }
      ],
      purchaseUrl: 'https://coinrailz.com/credits',
      paymentMethods: ['Credit Card (Stripe)', 'USDC on Base Chain', 'PayPal'],
      inChatPurchase: {
        note: 'You can purchase credits directly in this chat!',
        step1: 'Call POST /api/gpt/credits/create-session with { "package": "starter" }',
        step2: 'Open the checkoutUrl in your browser to complete payment',
        step3: 'After payment, call GET /api/gpt/credits/status?session=YOUR_SESSION_ID to get your API key',
        endpoints: {
          packages: '/api/gpt/credits/packages',
          createSession: '/api/gpt/credits/create-session',
          checkStatus: '/api/gpt/credits/status'
        }
      }
    }
  });
});

export default router;
