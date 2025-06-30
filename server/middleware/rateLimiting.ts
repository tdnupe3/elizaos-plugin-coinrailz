/**
 * Rate Limiting Middleware for AI Marketplace Security
 * Prevents abuse and DoS attacks on critical endpoints
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  createLimiter(windowMs: number, maxRequests: number) {
    return (req: any, res: any, next: any) => {
      const key = `${req.ip}_${req.path}`;
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return next();
      }

      if (this.store[key].count >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
        });
      }

      this.store[key].count++;
      next();
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const rateLimiter = new RateLimiter();

// Different rate limits for different endpoint types
export const searchRateLimit = rateLimiter.createLimiter(60 * 1000, 30); // 30 requests per minute
export const registrationRateLimit = rateLimiter.createLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes
export const orderRateLimit = rateLimiter.createLimiter(5 * 60 * 1000, 10); // 10 orders per 5 minutes
export const authRateLimit = rateLimiter.createLimiter(15 * 60 * 1000, 5); // 5 auth attempts per 15 minutes