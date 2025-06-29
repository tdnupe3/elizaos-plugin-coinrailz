import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    fingerprint: string;
    suspiciousActivity: number;
  }
}

class RateLimiter {
  private store: RateLimitStore = {};
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private suspiciousIPs = new Set<string>();
  private readonly isDevelopment: boolean;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Adjust limits for development environment
    if (this.isDevelopment) {
      this.windowMs = windowMs * 2; // Double the window
      this.maxRequests = maxRequests * 5; // 5x more requests allowed
    } else {
      this.windowMs = windowMs;
      this.maxRequests = maxRequests;
    }
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private generateFingerprint(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    
    // Create a more robust fingerprint
    const fingerprint = `${ip}:${userAgent}:${acceptLanguage}:${acceptEncoding}`;
    
    // Hash the fingerprint for privacy
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  private detectSuspiciousActivity(req: Request, fingerprint: string): boolean {
    // Skip suspicious activity detection in development
    if (this.isDevelopment) {
      return false;
    }
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Allow localhost/development IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return false;
    }
    
    // Check for rapid User-Agent rotation (common bypass technique)
    const recentEntries = Object.values(this.store).filter(entry => 
      entry.fingerprint !== fingerprint && 
      Date.now() - entry.resetTime < this.windowMs
    );
    
    if (recentEntries.length > 10) { // Increased threshold
      this.suspiciousIPs.add(ip);
      return true;
    }
    
    // More lenient bot detection
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.length < 5 || userAgent.includes('malicious')) {
      return true;
    }
    
    return this.suspiciousIPs.has(ip);
  }

  private getKey(req: Request): string {
    const fingerprint = this.generateFingerprint(req);
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Use IP + fingerprint hash for more secure tracking
    return `${ip}:${fingerprint.substring(0, 16)}`;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // DEVELOPMENT MODE: BYPASS ALL RATE LIMITING
      if (this.isDevelopment) {
        return next();
      }
      
      // EXEMPT HEALTH AND MONITORING ENDPOINTS FROM RATE LIMITING
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
      
      // PRODUCTION MODE: Apply full rate limiting
      const key = this.getKey(req);
      const fingerprint = this.generateFingerprint(req);
      const now = Date.now();
      
      if (this.detectSuspiciousActivity(req, fingerprint)) {
        return res.status(429).json({
          error: 'Suspicious activity detected',
          message: 'Request blocked due to suspicious patterns',
          retryAfter: 3600
        });
      }
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs,
          fingerprint: fingerprint,
          suspiciousActivity: 0
        };
        return next();
      }

      if (this.store[key].count >= this.maxRequests) {
        this.store[key].suspiciousActivity++;
        
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
        });
      }

      this.store[key].count++;
      next();
    };
  }
}

// Different rate limits for different endpoint types
export const generalRateLimit = new RateLimiter(60000, 100); // 100 requests per minute
export const apiRateLimit = new RateLimiter(60000, 60);     // 60 API calls per minute
export const transactionRateLimit = new RateLimiter(60000, 20); // 20 transactions per minute
export const authRateLimit = new RateLimiter(300000, 5);    // 5 auth attempts per 5 minutes