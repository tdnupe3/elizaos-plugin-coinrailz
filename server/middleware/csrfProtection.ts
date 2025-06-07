/**
 * CSRF Protection Middleware
 * Prevents cross-site request forgery attacks on financial endpoints
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface CSRFSession {
  token: string;
  expires: number;
}

export class CSRFProtection {
  private static sessions = new Map<string, CSRFSession>();
  private static readonly TOKEN_LIFETIME = 3600000; // 1 hour

  /**
   * Generate CSRF token for session
   */
  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    
    this.sessions.set(sessionId, {
      token,
      expires: Date.now() + this.TOKEN_LIFETIME
    });
    
    // Clean up expired tokens
    this.cleanupExpiredTokens();
    
    return token;
  }

  /**
   * Validate CSRF token
   */
  static validateToken(sessionId: string, providedToken: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.expires < Date.now()) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    return session.token === providedToken;
  }

  /**
   * Clean up expired tokens
   */
  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expires < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Middleware to protect financial endpoints
   */
  static protectFinancialEndpoints() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip GET requests and non-financial endpoints
      if (req.method === 'GET' || !this.isFinancialEndpoint(req.path)) {
        return next();
      }

      const sessionId = req.sessionID || req.headers['x-session-id'] as string;
      const csrfToken = req.headers['x-csrf-token'] as string || req.body.csrfToken;

      if (!sessionId || !csrfToken) {
        return res.status(403).json({
          error: 'CSRF token required',
          message: 'Missing CSRF protection headers'
        });
      }

      if (!this.validateToken(sessionId, csrfToken)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'CSRF token validation failed'
        });
      }

      next();
    };
  }

  /**
   * Check if endpoint handles financial transactions
   */
  private static isFinancialEndpoint(path: string): boolean {
    const financialPaths = [
      '/api/transactions',
      '/api/transfer',
      '/api/swap',
      '/api/buy',
      '/api/sell',
      '/api/withdraw',
      '/api/deposit',
      '/api/referrals/reward'
    ];
    
    return financialPaths.some(fp => path.startsWith(fp));
  }

  /**
   * Endpoint to get CSRF token
   */
  static getTokenEndpoint() {
    return (req: Request, res: Response) => {
      const sessionId = req.sessionID || req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Session required',
          message: 'Valid session required to generate CSRF token'
        });
      }

      const token = this.generateToken(sessionId);
      
      res.json({
        csrfToken: token,
        expires: Date.now() + this.TOKEN_LIFETIME
      });
    };
  }
}

export default CSRFProtection;