/**
 * Comprehensive DDoS Protection System
 * Multi-layer defense against distributed denial of service attacks
 */
import { Request, Response, NextFunction } from 'express';

// Global rate limiting maps
const globalRateMap = new Map<string, { count: number; resetTime: number }>();
const burstProtectionMap = new Map<string, { timestamps: number[] }>();
const suspiciousIPMap = new Map<string, { violations: number; blockedUntil: number }>();

interface DDoSConfig {
  globalRateLimit: { window: number; max: number };
  burstProtection: { window: number; max: number };
  ipBlocking: { violations: number; blockDuration: number };
}

const ddosConfig: DDoSConfig = {
  globalRateLimit: { 
    window: 60 * 1000, // 1 minute
    max: 120 // 120 requests per minute per IP (doubled for frontend needs)
  },
  burstProtection: {
    window: 10 * 1000, // 10 seconds
    max: 20 // max 20 requests in 10 seconds
  },
  ipBlocking: {
    violations: 3, // 3 violations = temporary block
    blockDuration: 15 * 60 * 1000 // 15 minutes
  }
};

// Enhanced IP extraction
function getClientIP(req: Request): string {
  return req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
         req.headers['x-real-ip']?.toString() ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

// Global rate limiting
export const globalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // EXEMPT HEALTH AND MONITORING ENDPOINTS
  const exemptPaths = [
    '/api/platform/health',
    '/api/health',
    '/health',
    '/api/status',
    '/api/monitoring/ping'
  ];
  
  if (exemptPaths.some(path => req.path === path)) {
    return next();
  }

  const ip = getClientIP(req);
  const now = Date.now();
  const { window, max } = ddosConfig.globalRateLimit;

  const key = `global_${ip}`;
  const entry = globalRateMap.get(key);

  if (!entry || now > entry.resetTime) {
    globalRateMap.set(key, { count: 1, resetTime: now + window });
    return next();
  }

  if (entry.count >= max) {
    // Record violation
    recordViolation(ip);
    
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please slow down.',
      code: 'DDOS_PROTECTION',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
  }

  entry.count++;
  next();
};

// Burst protection - prevents rapid fire requests
export const burstProtection = (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIP(req);
  const now = Date.now();
  const { window, max } = ddosConfig.burstProtection;

  const key = `burst_${ip}`;
  let timestamps = burstProtectionMap.get(key) || { timestamps: [] };

  // Remove old timestamps outside the window
  timestamps.timestamps = timestamps.timestamps.filter(ts => ts > now - window);

  if (timestamps.timestamps.length >= max) {
    // Record violation
    recordViolation(ip);
    
    return res.status(429).json({
      success: false,
      message: 'Too many rapid requests detected. Please slow down.',
      code: 'BURST_PROTECTION',
      retryAfter: Math.ceil(window / 1000)
    });
  }

  timestamps.timestamps.push(now);
  burstProtectionMap.set(key, timestamps);
  next();
};

// IP blocking for repeat offenders
export const ipBlocking = (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIP(req);
  const now = Date.now();
  
  const suspiciousEntry = suspiciousIPMap.get(ip);
  
  if (suspiciousEntry && suspiciousEntry.blockedUntil > now) {
    return res.status(403).json({
      success: false,
      message: 'IP temporarily blocked due to suspicious activity.',
      code: 'IP_BLOCKED',
      unblockTime: new Date(suspiciousEntry.blockedUntil).toISOString()
    });
  }

  // Clean expired blocks
  if (suspiciousEntry && suspiciousEntry.blockedUntil <= now) {
    suspiciousIPMap.delete(ip);
  }

  next();
};

// Record security violations
function recordViolation(ip: string): void {
  const now = Date.now();
  const entry = suspiciousIPMap.get(ip) || { violations: 0, blockedUntil: 0 };
  
  entry.violations++;
  
  if (entry.violations >= ddosConfig.ipBlocking.violations) {
    entry.blockedUntil = now + ddosConfig.ipBlocking.blockDuration;
    console.log(`[DDOS-PROTECTION] IP ${ip} temporarily blocked after ${entry.violations} violations`);
  }
  
  suspiciousIPMap.set(ip, entry);
}

// Connection limiting middleware
export const connectionLimiting = (req: Request, res: Response, next: NextFunction) => {
  // Set connection timeout
  req.setTimeout(30000, () => {
    console.log(`[DDOS-PROTECTION] Request timeout for IP: ${getClientIP(req)}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout',
        code: 'TIMEOUT'
      });
    }
  });

  next();
};

// DDoS monitoring and cleanup
export const ddosMonitoring = () => {
  setInterval(() => {
    const now = Date.now();
    
    // Clean expired global rate entries
    globalRateMap.forEach((entry, key) => {
      if (now > entry.resetTime) {
        globalRateMap.delete(key);
      }
    });
    
    // Clean expired burst protection entries
    burstProtectionMap.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter(ts => ts > now - ddosConfig.burstProtection.window);
      if (entry.timestamps.length === 0) {
        burstProtectionMap.delete(key);
      }
    });
    
    // Clean expired IP blocks
    suspiciousIPMap.forEach((entry, key) => {
      if (now > entry.blockedUntil && entry.violations < ddosConfig.ipBlocking.violations) {
        suspiciousIPMap.delete(key);
      }
    });
  }, 60000); // Clean every minute
};

// Setup comprehensive DDoS protection
export const setupDDoSProtection = (app: any) => {
  // Apply in order of importance
  app.use(ipBlocking);           // Block known bad actors first
  app.use(connectionLimiting);   // Set timeouts
  app.use(burstProtection);      // Prevent rapid fire
  app.use(globalRateLimit);      // General rate limiting
  
  // Start monitoring
  ddosMonitoring();
  
  console.log('✅ Comprehensive DDoS protection activated');
  console.log(`   - Global rate limit: ${ddosConfig.globalRateLimit.max} requests/minute`);
  console.log(`   - Burst protection: ${ddosConfig.burstProtection.max} requests/10 seconds`);
  console.log(`   - IP blocking: ${ddosConfig.ipBlocking.violations} violations = 15min block`);
};

// Export current protection status
export const getDDoSStatus = () => {
  return {
    activeConnections: globalRateMap.size,
    blockedIPs: Array.from(suspiciousIPMap.entries()).filter(([, entry]) => entry.blockedUntil > Date.now()).length,
    burstProtectedIPs: burstProtectionMap.size,
    config: ddosConfig
  };
};