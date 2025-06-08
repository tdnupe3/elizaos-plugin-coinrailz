/**
 * Comprehensive Security Hardening Middleware
 * Addresses all critical vulnerabilities from security audit
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Session management for preventing concurrent sessions
interface UserSession {
  sessionId: string;
  userId: string;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

export class SecurityHardening {
  private static activeSessions = new Map<string, UserSession>();
  private static userSessionMap = new Map<string, Set<string>>();
  private static blockedIPs = new Set<string>();
  private static suspiciousActivity = new Map<string, number>();
  private static isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Prevent session fixation and limit concurrent sessions
   */
  static sessionSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as any).user?.id;
      if (!userId) return next();

      const sessionId = req.sessionID;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Check for session fixation attack
      if (this.detectSessionFixation(sessionId, userId, ipAddress)) {
        return res.status(401).json({
          error: 'Security violation detected',
          message: 'Session security check failed'
        });
      }

      // Limit concurrent sessions (max 3 per user)
      this.manageConcurrentSessions(userId, sessionId, ipAddress, userAgent);

      next();
    };
  }

  /**
   * Detect session fixation attempts
   */
  private static detectSessionFixation(sessionId: string, userId: string, ipAddress: string): boolean {
    const existingSession = this.activeSessions.get(sessionId);
    
    if (existingSession && existingSession.userId !== userId) {
      console.warn(`Session fixation attempt detected: ${sessionId} for user ${userId}`);
      return true;
    }

    if (existingSession && existingSession.ipAddress !== ipAddress) {
      console.warn(`Session hijacking attempt detected: ${sessionId} from ${ipAddress}`);
      return true;
    }

    return false;
  }

  /**
   * Manage concurrent sessions per user
   */
  private static manageConcurrentSessions(userId: string, sessionId: string, ipAddress: string, userAgent: string): void {
    // Update current session
    this.activeSessions.set(sessionId, {
      sessionId,
      userId,
      lastActivity: Date.now(),
      ipAddress,
      userAgent
    });

    // Add to user session map
    if (!this.userSessionMap.has(userId)) {
      this.userSessionMap.set(userId, new Set());
    }

    const userSessions = this.userSessionMap.get(userId)!;
    userSessions.add(sessionId);

    // Limit to 3 concurrent sessions
    if (userSessions.size > 3) {
      const oldestSession = this.findOldestSession(Array.from(userSessions));
      if (oldestSession) {
        this.invalidateSession(oldestSession);
        userSessions.delete(oldestSession);
      }
    }
  }

  /**
   * Find oldest session for cleanup
   */
  private static findOldestSession(sessionIds: string[]): string | null {
    let oldestSession = null;
    let oldestTime = Date.now();

    for (const sessionId of sessionIds) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.lastActivity < oldestTime) {
        oldestTime = session.lastActivity;
        oldestSession = sessionId;
      }
    }

    return oldestSession;
  }

  /**
   * Invalidate a session
   */
  private static invalidateSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      console.log(`Invalidating session ${sessionId} for user ${session.userId}`);
      this.activeSessions.delete(sessionId);
      
      const userSessions = this.userSessionMap.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessionMap.delete(session.userId);
        }
      }
    }
  }

  /**
   * Advanced DDoS protection with behavioral analysis
   */
  static advancedDDoSProtection() {
    return rateLimit({
      windowMs: this.isDevelopment ? 30 * 60 * 1000 : 15 * 60 * 1000, // 30 min dev, 15 min prod
      max: (req) => {
        const ip = req.ip || 'unknown';
        
        // Skip rate limiting for localhost in development
        if (this.isDevelopment && this.isLocalhost(ip)) {
          return 10000; // Very high limit for localhost
        }
        
        // Development has higher limits
        const multiplier = this.isDevelopment ? 10 : 1;
        
        // Different limits based on endpoint sensitivity
        if (req.path.includes('/api/transactions')) return 10 * multiplier;
        if (req.path.includes('/api/auth')) return 5 * multiplier;
        if (req.path.includes('/api/admin')) return 3 * multiplier;
        
        return 100 * multiplier; // Default limit
      },
      message: {
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting completely for Vite HMR and development tools
        if (this.isDevelopment) {
          const ip = req.ip || 'unknown';
          const userAgent = req.get('User-Agent') || '';
          
          if (this.isLocalhost(ip) || 
              userAgent.includes('node') || 
              userAgent.includes('vite') ||
              req.path.includes('/@vite') ||
              req.path.includes('/__vite')) {
            return true;
          }
        }
        return false;
      },
      handler: (req, res) => {
        const ip = req.ip || 'unknown';
        if (!this.isDevelopment || !this.isLocalhost(ip)) {
          this.trackSuspiciousActivity(ip);
        }
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: this.isDevelopment 
            ? 'Rate limit exceeded (development mode with higher limits)'
            : 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(this.isDevelopment ? 30 * 60 : 15 * 60),
          development: this.isDevelopment
        });
      }
    });
  }

  /**
   * Check if IP is localhost or private network
   */
  private static isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip === '::ffff:127.0.0.1' ||
           ip.startsWith('192.168.') || 
           ip.startsWith('10.') ||
           ip.startsWith('172.16.') ||
           ip === 'unknown';
  }

  /**
   * Track and block suspicious IPs
   */
  private static trackSuspiciousActivity(ip: string): void {
    // Skip tracking for localhost in development
    if (this.isDevelopment && this.isLocalhost(ip)) {
      return;
    }

    const current = this.suspiciousActivity.get(ip) || 0;
    this.suspiciousActivity.set(ip, current + 1);

    // Block IP after more violations in development
    const threshold = this.isDevelopment ? 20 : 5;
    if (current >= threshold) {
      this.blockedIPs.add(ip);
      console.warn(`IP ${ip} blocked due to excessive rate limiting (threshold: ${threshold})`);
    }
  }

  /**
   * IP blocking middleware
   */
  static ipBlockingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress;
      
      // Skip IP blocking for localhost in development
      if (this.isDevelopment && ip && this.isLocalhost(ip)) {
        return next();
      }
      
      if (ip && this.blockedIPs.has(ip)) {
        return res.status(403).json({
          error: 'Access forbidden',
          message: 'IP address has been blocked due to suspicious activity',
          development: this.isDevelopment
        });
      }
      
      next();
    };
  }

  /**
   * Comprehensive security headers
   */
  static securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * Enhanced CSRF protection
   */
  static enhancedCSRFProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Financial endpoints require CSRF protection
      const sensitiveEndpoints = [
        '/api/transactions',
        '/api/transfer',
        '/api/crypto',
        '/api/agents/transaction'
      ];

      const requiresCSRF = sensitiveEndpoints.some(endpoint => 
        req.path.startsWith(endpoint)
      );

      if (requiresCSRF) {
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        const sessionToken = (req.session as any).csrfToken;

        if (!token || !sessionToken || token !== sessionToken) {
          return res.status(403).json({
            error: 'CSRF token validation failed',
            message: 'Invalid or missing CSRF token'
          });
        }
      }

      next();
    };
  }

  /**
   * Generate CSRF token for session
   */
  static generateCSRFToken(req: Request): string {
    const token = crypto.randomBytes(32).toString('hex');
    (req.session as any).csrfToken = token;
    return token;
  }

  /**
   * Memory exhaustion protection
   */
  static memoryProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Limit request body size
      if (req.headers['content-length']) {
        const size = parseInt(req.headers['content-length'], 10);
        if (size > 10 * 1024 * 1024) { // 10MB limit
          return res.status(413).json({
            error: 'Request too large',
            message: 'Request body exceeds size limit'
          });
        }
      }

      // Monitor memory usage
      const memUsage = process.memoryUsage();
      const memThreshold = 500 * 1024 * 1024; // 500MB threshold

      if (memUsage.heapUsed > memThreshold) {
        console.warn(`High memory usage detected: ${memUsage.heapUsed / 1024 / 1024}MB`);
        
        // Reject resource-intensive operations under high memory pressure
        if (req.path.includes('/api/reports') || req.path.includes('/api/analytics')) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'System under high load, please try again later'
          });
        }
      }

      next();
    };
  }

  /**
   * Log injection prevention
   */
  static sanitizeLogInput(input: any): string {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    
    // Remove potentially dangerous characters for log injection
    return input
      .replace(/[\r\n]/g, '') // Remove newlines
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x1f\x7f]/g, '') // Remove control characters
      .substring(0, 1000); // Limit length
  }

  /**
   * Cleanup expired sessions and blocked IPs
   */
  static cleanup(): void {
    const now = Date.now();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    const ipBlockTimeout = 60 * 60 * 1000; // 1 hour

    // Clean expired sessions
    this.activeSessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > sessionTimeout) {
        this.invalidateSession(sessionId);
      }
    });

    // Reset suspicious activity tracking
    this.suspiciousActivity.clear();
    
    // Clear blocked IPs (they can try again after timeout)
    if (this.blockedIPs.size > 0) {
      this.blockedIPs.clear();
      console.log('Cleared blocked IP list');
    }
  }
}

// Run cleanup every hour
setInterval(() => {
  SecurityHardening.cleanup();
}, 60 * 60 * 1000);

export default SecurityHardening;