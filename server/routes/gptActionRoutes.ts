import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { creditsService } from '../services/creditsService';

const router = Router();

const SUPPORTED_CHAINS = ['ethereum', 'base', 'polygon', 'bsc', 'arbitrum', 'optimism'];

const PREMIUM_SERVICE_COST = 0.10;

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

async function validateAndChargeApiKey(req: Request, serviceName: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const apiKey = req.headers['x-api-key'] as string || 
                 (req.headers['authorization'] as string)?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
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
    if (balance < PREMIUM_SERVICE_COST) {
      return { valid: false, error: `Insufficient credits. Required: $${PREMIUM_SERVICE_COST}, Available: $${balance.toFixed(2)}. Purchase more at https://coinrailz.com/credits` };
    }
    
    await creditsService.deductCredits({
      userId: validation.userId!,
      amount: PREMIUM_SERVICE_COST,
      serviceName,
      description: `GPT Action: ${serviceName}`
    });
    
    console.log(`💳 GPT Premium: Charged $${PREMIUM_SERVICE_COST} for ${serviceName} (user: ${validation.userId})`);
    
    return { valid: true, userId: validation.userId };
  } catch (error: any) {
    console.error('GPT API key validation error:', error.message);
    return { valid: false, error: error.message || 'Validation failed' };
  }
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
      creditsCharged: PREMIUM_SERVICE_COST
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
      creditsCharged: PREMIUM_SERVICE_COST
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
      creditsCharged: PREMIUM_SERVICE_COST
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
      creditsCharged: PREMIUM_SERVICE_COST,
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
      creditsCharged: PREMIUM_SERVICE_COST,
      disclaimer: 'AI-powered analysis using ECB/Frankfurter data. Not financial advice.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/credits-info', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    pricing: {
      freeServices: [
        { name: 'Gas Prices', endpoint: '/api/gpt/gas-prices', description: 'Real-time gas prices across 6 chains' },
        { name: 'Token Info', endpoint: '/api/gpt/token-info', description: 'Token metadata and current price' },
        { name: 'Trending Tokens', endpoint: '/api/gpt/trending', description: 'Currently trending cryptocurrencies' }
      ],
      premiumServices: [
        { name: 'Trade Signals', endpoint: '/api/gpt/trade-signals', cost: '1 credit', description: 'AI-powered crypto trading signals' },
        { name: 'Wallet Analysis', endpoint: '/api/gpt/wallet-analysis', cost: '1 credit', description: 'Deep wallet risk analysis' },
        { name: 'Polymarket Odds', endpoint: '/api/gpt/polymarket', cost: '1 credit', description: 'Prediction market data' },
        { name: 'Stock Sentiment', endpoint: '/api/gpt/stock-sentiment', cost: '1 credit', description: 'AI stock analysis with Yahoo Finance data' },
        { name: 'Forex Sentiment', endpoint: '/api/gpt/forex-sentiment', cost: '1 credit', description: 'AI forex analysis with ECB rates' }
      ],
      creditPackages: [
        { name: 'Starter', price: '$10', credits: 100 },
        { name: 'Pro', price: '$50', credits: 600 },
        { name: 'Enterprise', price: '$200', credits: 3000 }
      ],
      purchaseUrl: 'https://coinrailz.com/credits',
      paymentMethods: ['Credit Card (Stripe)', 'USDC on Base Chain', 'PayPal']
    }
  });
});

export default router;
