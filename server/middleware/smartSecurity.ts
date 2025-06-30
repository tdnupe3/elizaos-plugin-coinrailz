/**
 * Smart Security Middleware - Balanced Protection
 * Provides comprehensive security while maintaining payment functionality
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Critical SQL injection patterns only (highly specific)
const CRITICAL_SQL_PATTERNS = [
  /(\bUNION\s+(ALL\s+)?SELECT\b.*\bFROM\b)/i,
  /(\bDROP\s+(TABLE|DATABASE|INDEX)\b)/i,
  /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b)/i,
  /(\'\s*(OR|AND)\s+\'\d+\'\s*=\s*\'\d+\')/i
];

// Critical XSS patterns only 
const CRITICAL_XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /<iframe/gi
];

class SmartSecurity {
  static isPaymentEndpoint(path: string): boolean {
    const paymentPaths = [
      '/api/p2p/',
      '/api/payments/',
      '/api/stripe/',
      '/api/paypal/',
      '/api/crypto/',
      '/api/xrp/',
      '/api/send-money',
      '/api/transfer',
      '/api/marketplace/orders'
    ];
    return paymentPaths.some(p => path.startsWith(p));
  }

  static basicSanitize(input: string): string {
    if (typeof input !== 'string') return input;
    
    // Only remove critical threats for payment endpoints
    let sanitized = input;
    CRITICAL_XSS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  }

  static fullSanitize(input: string): string {
    if (typeof input !== 'string') return input;
    
    // Check for critical patterns first
    for (const pattern of CRITICAL_SQL_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Security threat detected');
      }
    }
    
    for (const pattern of CRITICAL_XSS_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Security threat detected');
      }
    }
    
    return DOMPurify.sanitize(input);
  }

  static sanitizeObject(obj: any, isPayment: boolean = false): any {
    if (typeof obj === 'string') {
      return isPayment ? this.basicSanitize(obj) : this.fullSanitize(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, isPayment));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value, isPayment);
      }
      return sanitized;
    }
    
    return obj;
  }
}

export function smartSecurity(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip for non-API routes
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Skip for health checks
    if (req.path.includes('/health') || req.path === '/') {
      return next();
    }

    const isPayment = SmartSecurity.isPaymentEndpoint(req.path);
    
    // For payment endpoints, apply minimal security to avoid blocking
    if (isPayment) {
      if (req.body && typeof req.body === 'object') {
        // Only basic script tag removal for payment endpoints
        req.body = SmartSecurity.sanitizeObject(req.body, true);
      }
      return next();
    }
    
    // Apply full security for non-payment endpoints
    if (req.body && typeof req.body === 'object') {
      try {
        req.body = SmartSecurity.sanitizeObject(req.body, false);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: 'Security validation failed',
          message: 'Invalid input detected'
        });
      }
    }

    if (req.query && typeof req.query === 'object') {
      try {
        req.query = SmartSecurity.sanitizeObject(req.query, false);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: 'Security validation failed',
          message: 'Invalid query parameters'
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('Smart security middleware error:', error.message);
    // Always allow requests to proceed rather than blocking legitimate traffic
    next();
  }
}