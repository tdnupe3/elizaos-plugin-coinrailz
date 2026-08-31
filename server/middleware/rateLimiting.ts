import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiting configurations for different endpoint types
export const rateLimitConfigs = {
  // DEX trading endpoints (strict limits for high-value operations)
  dexTrading: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 trades per minute max
    message: {
      error: 'Too many trading requests. Please wait before placing another trade.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit by user ID if available, otherwise by IP
      return req.body?.userId || req.ip;
    }
  }),

  // Quote requests (more lenient since they're read-only)
  dexQuotes: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 quote requests per minute
    message: {
      error: 'Too many quote requests. Please wait before requesting another quote.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // P2P transfers (moderate limits)
  p2pTransfers: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 transfers per 5 minutes
    message: {
      error: 'Too many transfer requests. Please wait before sending another transfer.',
      retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.body?.fromUserId || req.ip;
    }
  }),

  // General API endpoints
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
      error: 'Too many API requests. Please wait before making more requests.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Authentication endpoints (stricter for security)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts. Please wait before trying again.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Fee recording (moderate limits to prevent spam)
  feeRecording: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 fee recordings per minute
    message: {
      error: 'Too many fee recording requests. Please wait before recording another fee.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.body?.userAddress || req.ip;
    }
  })
};

// Middleware to apply rate limiting with logging
export const applyRateLimit = (limitType: keyof typeof rateLimitConfigs) => {
  return (req: Request, res: Response, next: Function) => {
    const limiter = rateLimitConfigs[limitType];
    
    // Log rate limit application
    console.log(`🛡️ Applying ${limitType} rate limit to ${req.path}`);
    
    limiter(req, res, (err) => {
      if (err) {
        console.warn(`⚠️ Rate limit exceeded for ${limitType} on ${req.path}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
      next(err);
    });
  };
};

// Helper function to check if request is rate limited
export const isRateLimited = (req: Request): boolean => {
  const rateLimitInfo = (req as Request & { rateLimit?: { remaining: number } }).rateLimit;
  return rateLimitInfo?.remaining === 0;
};

// Business logic validation middleware
export const validateBusinessRules = {
  // Minimum transaction amounts for profitability
  minimumAmounts: async (req: Request, res: Response, next: Function) => {
    const { amount, fromAsset } = req.body;
    
    if (amount) {
      let tradeValueUSD = parseFloat(amount);
      
      // Convert crypto amounts to USD for validation
      if (fromAsset === 'ETH') {
        try {
          const ethPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
          const ethData = await ethPriceResponse.json();
          const ethPrice = ethData.ethereum?.usd || 4500;
          tradeValueUSD = parseFloat(amount) * ethPrice;
        } catch (error) {
          tradeValueUSD = parseFloat(amount) * 4500; // Fallback price
        }
      } else if (fromAsset === 'BTC') {
        try {
          const btcPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
          const btcData = await btcPriceResponse.json();
          const btcPrice = btcData.bitcoin?.usd || 65000;
          tradeValueUSD = parseFloat(amount) * btcPrice;
        } catch (error) {
          tradeValueUSD = parseFloat(amount) * 65000; // Fallback price
        }
      }
      // USDC, USDT are already in USD
      
      if (tradeValueUSD < 10) {
        return res.status(400).json({
          error: 'Minimum purchase is $10',
          minimumAmount: 10,
          providedAmount: tradeValueUSD
        });
      }
    }
    
    next();
  },

  // Maximum transaction amounts for security
  maximumAmounts: (req: Request, res: Response, next: Function) => {
    const { amount } = req.body;
    
    if (amount && parseFloat(amount) > 50000) {
      return res.status(400).json({
        error: 'Maximum transaction amount is $50,000 per transaction for security',
        maximumAmount: 50000,
        providedAmount: parseFloat(amount)
      });
    }
    
    next();
  },

  // Validate wallet addresses
  walletAddress: (req: Request, res: Response, next: Function) => {
    const { walletAddress, toWalletAddress } = req.body;
    const address = walletAddress || toWalletAddress;
    
    if (address && (address.length < 20 || address.length > 100)) {
      return res.status(400).json({
        error: 'Invalid wallet address format',
        providedAddress: address
      });
    }
    
    next();
  },

  // Validate required user identification
  userIdentification: (req: Request, res: Response, next: Function) => {
    const { userId, userAddress } = req.body;
    
    if (!userId && !userAddress) {
      return res.status(400).json({
        error: 'User identification required (userId or userAddress)',
        requiredFields: ['userId', 'userAddress']
      });
    }
    
    next();
  }
};