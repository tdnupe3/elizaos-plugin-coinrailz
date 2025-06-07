/**
 * Production Security Service
 * Comprehensive security hardening for production deployment
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

export class ProductionSecurityService {
  /**
   * Enhanced rate limiting with tiered restrictions
   */
  static createTieredRateLimit() {
    // Standard API rate limiting
    const standardLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: 900
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Strict rate limiting for authentication endpoints
    const authLimit = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5, // Only 5 auth attempts per window
      message: {
        error: 'Authentication rate limit exceeded',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: 900
      },
      skipSuccessfulRequests: true,
    });

    // Financial transaction rate limiting
    const transactionLimit = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 transactions per minute
      message: {
        error: 'Transaction rate limit exceeded',
        message: 'Too many transaction requests. Please wait before trying again.',
        retryAfter: 60
      },
    });

    return { standardLimit, authLimit, transactionLimit };
  }

  /**
   * Production-grade security headers
   */
  static configureSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.stripe.com", "https://api.coingecko.com"],
          frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    });
  }

  /**
   * Enhanced input validation middleware
   */
  static validateFinancialInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      const { amount, currency } = req.body;

      if (amount !== undefined) {
        // Validate amount format and limits
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 1000000) {
          return res.status(400).json({
            error: 'Invalid amount',
            message: 'Amount must be a positive number less than $1,000,000'
          });
        }

        // Check for decimal precision (max 8 decimal places for crypto)
        const decimalPrecision = (amount.toString().split('.')[1] || '').length;
        if (decimalPrecision > 8) {
          return res.status(400).json({
            error: 'Invalid precision',
            message: 'Amount cannot have more than 8 decimal places'
          });
        }
      }

      if (currency !== undefined) {
        // Validate currency format
        const validCurrencies = ['USD', 'BTC', 'ETH', 'SOL', 'USDC', 'USDT'];
        if (!validCurrencies.includes(currency.toUpperCase())) {
          return res.status(400).json({
            error: 'Invalid currency',
            message: 'Currency not supported'
          });
        }
      }

      next();
    };
  }

  /**
   * Enhanced user validation middleware
   */
  static validateUserOperations() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please log in to continue'
        });
      }

      // Check if user account is in good standing
      if (user.status === 'suspended') {
        return res.status(403).json({
          error: 'Account suspended',
          message: 'Your account has been suspended. Please contact support.'
        });
      }

      // Check KYC status for financial operations
      if (req.path.includes('/api/transaction') || req.path.includes('/api/wallet')) {
        if (user.kycStatus !== 'verified') {
          return res.status(403).json({
            error: 'KYC verification required',
            message: 'Please complete identity verification to perform this action'
          });
        }
      }

      next();
    };
  }

  /**
   * API endpoint monitoring and logging
   */
  static logSecurityEvents() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req as any).user?.id
        };

        // Log security-relevant events
        if (res.statusCode >= 400) {
          console.warn('Security event:', logData);
        }

        // Log slow requests
        if (duration > 5000) {
          console.warn('Slow request:', logData);
        }
      });

      next();
    };
  }

  /**
   * Environment variable validation for production
   */
  static validateProductionEnvironment(): boolean {
    const requiredVars = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'STRIPE_SECRET_KEY',
      'NODE_ENV'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      return false;
    }

    // Validate environment-specific requirements
    if (process.env.NODE_ENV === 'production') {
      const productionVars = [
        'PGHOST',
        'PGUSER',
        'PGPASSWORD',
        'PGDATABASE'
      ];

      const missingProd = productionVars.filter(varName => !process.env[varName]);
      if (missingProd.length > 0) {
        console.error('Missing production environment variables:', missingProd);
        return false;
      }
    }

    return true;
  }
}