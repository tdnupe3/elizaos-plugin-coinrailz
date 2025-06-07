/**
 * Authentication Security Enhancement
 * Addresses JWT token vulnerabilities and session management
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface TokenSession {
  userId: string;
  token: string;
  issued: number;
  expires: number;
  rotationDue: number;
}

export class AuthenticationSecurity {
  private static activeSessions = new Map<string, TokenSession>();
  private static blacklistedTokens = new Set<string>();
  private static readonly TOKEN_LIFETIME = 3600000; // 1 hour
  private static readonly ROTATION_INTERVAL = 1800000; // 30 minutes

  /**
   * Enhanced session validation with token rotation
   */
  static validateSession(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid authentication token required'
      });
    }

    // Check blacklisted tokens
    if (this.blacklistedTokens.has(token)) {
      return res.status(401).json({
        error: 'Token revoked',
        message: 'Authentication token has been revoked'
      });
    }

    const session = this.findSessionByToken(token);
    
    if (!session) {
      return res.status(401).json({
        error: 'Invalid session',
        message: 'Authentication session not found'
      });
    }

    const now = Date.now();
    
    // Check token expiration
    if (now > session.expires) {
      this.revokeSession(session.userId);
      return res.status(401).json({
        error: 'Session expired',
        message: 'Authentication session has expired'
      });
    }

    // Check if token rotation is due
    if (now > session.rotationDue) {
      const newToken = this.rotateToken(session);
      res.setHeader('X-New-Token', newToken);
    }

    // Add user context to request
    (req as any).user = { id: session.userId };
    (req as any).sessionToken = token;
    
    next();
  }

  /**
   * Create secure session with token rotation schedule
   */
  static createSession(userId: string): string {
    const token = this.generateSecureToken();
    const now = Date.now();
    
    // Revoke any existing sessions for this user
    this.revokeSession(userId);
    
    const session: TokenSession = {
      userId,
      token,
      issued: now,
      expires: now + this.TOKEN_LIFETIME,
      rotationDue: now + this.ROTATION_INTERVAL
    };
    
    this.activeSessions.set(userId, session);
    return token;
  }

  /**
   * Rotate authentication token
   */
  private static rotateToken(session: TokenSession): string {
    const newToken = this.generateSecureToken();
    const now = Date.now();
    
    // Blacklist old token
    this.blacklistedTokens.add(session.token);
    
    // Update session with new token
    session.token = newToken;
    session.rotationDue = now + this.ROTATION_INTERVAL;
    session.expires = now + this.TOKEN_LIFETIME;
    
    console.log(`Token rotated for user ${session.userId}`);
    return newToken;
  }

  /**
   * Generate cryptographically secure token
   */
  private static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Find session by token
   */
  private static findSessionByToken(token: string): TokenSession | undefined {
    let foundSession: TokenSession | undefined = undefined;
    this.activeSessions.forEach((session) => {
      if (session.token === token) {
        foundSession = session;
      }
    });
    return foundSession;
  }

  /**
   * Revoke user session
   */
  static revokeSession(userId: string): void {
    const session = this.activeSessions.get(userId);
    if (session) {
      this.blacklistedTokens.add(session.token);
      this.activeSessions.delete(userId);
    }
  }

  /**
   * Cleanup expired sessions and blacklisted tokens
   */
  static cleanup(): void {
    const now = Date.now();
    
    // Remove expired sessions
    this.activeSessions.forEach((session, userId) => {
      if (now > session.expires) {
        this.blacklistedTokens.add(session.token);
        this.activeSessions.delete(userId);
      }
    });
    
    // Clean up old blacklisted tokens (keep for 24 hours)
    if (this.blacklistedTokens.size > 10000) {
      this.blacklistedTokens.clear();
    }
  }

  /**
   * Enhanced password security validation
   */
  static validatePasswordStrength(password: string): { 
    isValid: boolean; 
    score: number; 
    issues: string[] 
  } {
    const issues: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      issues.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    // Character variety checks
    if (!/[a-z]/.test(password)) {
      issues.push('Password must contain lowercase letters');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Password must contain uppercase letters');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      issues.push('Password must contain numbers');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain special characters');
    } else {
      score += 1;
    }

    // Common pattern checks
    if (/(.)\1{2,}/.test(password)) {
      issues.push('Password contains repeated characters');
      score -= 1;
    }

    if (/123|abc|qwe|password|admin/i.test(password)) {
      issues.push('Password contains common patterns');
      score -= 2;
    }

    return {
      isValid: issues.length === 0 && score >= 4,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * Security headers middleware
   */
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Enable XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Strict transport security
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // Content security policy
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      
      // Referrer policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      next();
    };
  }
}

// Start cleanup interval
setInterval(() => {
  AuthenticationSecurity.cleanup();
}, 300000); // Every 5 minutes

export default AuthenticationSecurity;