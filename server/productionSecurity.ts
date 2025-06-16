/**
 * Production-Ready DDoS Protection
 * Designed specifically for production deployment environments
 */
import { Request, Response, NextFunction } from 'express';

// Production DDoS protection maps
const productionRateMap = new Map<string, { count: number; resetTime: number }>();
const productionBurstMap = new Map<string, { timestamps: number[] }>();
const blockedIPs = new Map<string, { blockedUntil: number; violations: number }>();

interface ProductionDDoSConfig {
  enabled: boolean;
  globalLimit: { window: number; max: number };
  burstLimit: { window: number; max: number };
  blockConfig: { violations: number; duration: number };
}

const isProduction = process.env.NODE_ENV === 'production';

const productionConfig: ProductionDDoSConfig = {
  enabled: isProduction,
  globalLimit: {
    window: 60 * 1000, // 1 minute
    max: isProduction ? 100 : 1000 // Strict in production, relaxed in development
  },
  burstLimit: {
    window: 10 * 1000, // 10 seconds
    max: isProduction ? 15 : 100 // Strict in production, relaxed in development
  },
  blockConfig: {
    violations: 3,
    duration: 10 * 60 * 1000 // 10 minutes
  }
};

function getProductionIP(req: Request): string {
  // Enhanced IP detection for production environments
  return req.headers['cf-connecting-ip']?.toString() || // Cloudflare
         req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || // Load balancer
         req.headers['x-real-ip']?.toString() || // Nginx
         req.connection.remoteAddress ||
         'unknown';
}

// Production-aware global rate limiting
export const productionGlobalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (!productionConfig.enabled) {
    return next(); // Skip in development
  }

  const ip = getProductionIP(req);
  const now = Date.now();
  const { window, max } = productionConfig.globalLimit;

  // Check if IP is blocked
  const blocked = blockedIPs.get(ip);
  if (blocked && blocked.blockedUntil > now) {
    return res.status(403).json({
      success: false,
      message: 'Access temporarily restricted',
      code: 'IP_BLOCKED_DDOS'
    });
  }

  const key = `prod_global_${ip}`;
  const entry = productionRateMap.get(key);

  if (!entry || now > entry.resetTime) {
    productionRateMap.set(key, { count: 1, resetTime: now + window });
    return next();
  }

  if (entry.count >= max) {
    recordProductionViolation(ip);
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
      code: 'PRODUCTION_RATE_LIMIT',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
  }

  entry.count++;
  next();
};

// Production burst protection
export const productionBurstProtection = (req: Request, res: Response, next: NextFunction) => {
  if (!productionConfig.enabled) {
    return next(); // Skip in development
  }

  const ip = getProductionIP(req);
  const now = Date.now();
  const { window, max } = productionConfig.burstLimit;

  const key = `prod_burst_${ip}`;
  const entry = productionBurstMap.get(key) || { timestamps: [] };

  // Clean old timestamps
  entry.timestamps = entry.timestamps.filter(ts => ts > now - window);

  if (entry.timestamps.length >= max) {
    recordProductionViolation(ip);
    return res.status(429).json({
      success: false,
      message: 'Too many rapid requests',
      code: 'PRODUCTION_BURST_LIMIT',
      retryAfter: Math.ceil(window / 1000)
    });
  }

  entry.timestamps.push(now);
  productionBurstMap.set(key, entry);
  next();
};

// Record violations and implement progressive blocking
function recordProductionViolation(ip: string): void {
  const now = Date.now();
  const entry = blockedIPs.get(ip) || { blockedUntil: 0, violations: 0 };
  
  entry.violations++;
  
  if (entry.violations >= productionConfig.blockConfig.violations) {
    entry.blockedUntil = now + productionConfig.blockConfig.duration;
    console.log(`[PRODUCTION-DDOS] IP ${ip} blocked for ${productionConfig.blockConfig.duration / 60000} minutes (${entry.violations} violations)`);
  }
  
  blockedIPs.set(ip, entry);
}

// Production security headers
export const productionSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (isProduction) {
    // Strict production headers
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  } else {
    // Development-friendly headers
    res.header('X-Content-Type-Options', 'nosniff');
  }
  
  next();
};

// Production CORS policy
export const productionCORS = (req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = isProduction 
    ? ['https://coinrailz.com', 'https://www.coinrailz.com']
    : ['http://localhost:5000', 'http://127.0.0.1:5000', '*'];
  
  const origin = req.headers.origin;
  
  if (!isProduction || !origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// Cleanup function
const cleanupProductionMaps = () => {
  const now = Date.now();
  
  // Clean rate limiting maps
  productionRateMap.forEach((entry, key) => {
    if (now > entry.resetTime) {
      productionRateMap.delete(key);
    }
  });
  
  // Clean burst protection maps
  productionBurstMap.forEach((entry, key) => {
    entry.timestamps = entry.timestamps.filter(ts => ts > now - productionConfig.burstLimit.window);
    if (entry.timestamps.length === 0) {
      productionBurstMap.delete(key);
    }
  });
  
  // Clean expired IP blocks
  blockedIPs.forEach((entry, key) => {
    if (now > entry.blockedUntil) {
      blockedIPs.delete(key);
    }
  });
};

// Setup production DDoS protection
export const setupProductionSecurity = (app: any) => {
  // Apply production-aware middleware
  app.use(productionSecurityHeaders);
  app.use(productionBurstProtection);
  app.use(productionGlobalRateLimit);
  
  // Start cleanup interval
  setInterval(cleanupProductionMaps, 60000); // Clean every minute
  
  console.log(`✅ Production security configured (${isProduction ? 'ACTIVE' : 'DEVELOPMENT MODE'})`);
  if (isProduction) {
    console.log(`   - Global rate limit: ${productionConfig.globalLimit.max} requests/minute`);
    console.log(`   - Burst protection: ${productionConfig.burstLimit.max} requests/10 seconds`);
    console.log(`   - IP blocking: ${productionConfig.blockConfig.violations} violations = ${productionConfig.blockConfig.duration / 60000} min block`);
  } else {
    console.log('   - DDoS protection relaxed for development');
  }
};

// Export status for monitoring
export const getProductionSecurityStatus = () => {
  return {
    environment: isProduction ? 'production' : 'development',
    ddosEnabled: productionConfig.enabled,
    activeRateLimits: productionRateMap.size,
    blockedIPs: Array.from(blockedIPs.entries()).filter(([, entry]) => entry.blockedUntil > Date.now()).length,
    config: productionConfig
  };
};