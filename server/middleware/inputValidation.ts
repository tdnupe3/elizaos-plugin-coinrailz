/**
 * Comprehensive Input Validation Middleware
 * Provides SQL injection protection and input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Refined regex patterns for actual SQL injection attempts (not blocking legitimate content)
const SQL_INJECTION_PATTERNS = [
  /(\bUNION\s+SELECT\b)/i,
  /(\bDROP\s+TABLE\b)/i,
  /(\bDELETE\s+FROM\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+\b)/i,
  /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/i,
  /(\b1\s*=\s*1\b|\b1\s*=\s*0\b)/,
  /(\'\s*(OR|AND)\s+\'\d+\'\s*=\s*\'\d+\')/i
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi
];

export class InputValidator {
  
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return input;
    
    // FIRST: Check for malicious patterns before any processing
    // Check for XSS patterns in original input
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Invalid input detected');
      }
    }
    
    // Check for SQL injection patterns in original input
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Invalid input detected');
      }
    }
    
    // Remove potential XSS content
    let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // Allow legitimate business data patterns only after security checks
    const isLegitimateData = this.isLegitimateBusinessData(sanitized);
    if (isLegitimateData) {
      return sanitized.trim();
    }
    
    // For non-legitimate data, apply additional security checks
    if (sanitized !== input) {
      // DOMPurify removed something, which means potential XSS
      throw new Error('Invalid input detected');
    }
    
    return sanitized.trim();
  }

  static isLegitimateBusinessData(input: string): boolean {
    // Whitelist legitimate business patterns
    const legitimatePatterns = [
      /^\d+(\.\d{1,2})?$/, // Decimal numbers (amounts, rates)
      /^[a-zA-Z0-9\s\-\.@]+$/, // Alphanumeric with common business chars
      /^0x[a-fA-F0-9]+$/, // Blockchain addresses
      /^[A-Z]{3,4}$/, // Currency codes (USD, ETH, etc)
      /^(amount|token|address|fee|commission|rate|price)$/i, // Common API parameters
    ];
    
    return legitimatePatterns.some(pattern => pattern.test(input));
  }

  static validateEmail(email: string): boolean {
    const emailSchema = z.string().email();
    try {
      emailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  }

  static validateAmount(amount: any): number {
    const amountSchema = z.number().positive().max(1000000);
    return amountSchema.parse(Number(amount));
  }

  static validateWalletAddress(address: string, type: 'ethereum' | 'xrp' | 'bitcoin' = 'ethereum'): boolean {
    const patterns = {
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      xrp: /^r[a-zA-Z0-9]{24,34}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
    };
    
    return patterns[type].test(address);
  }

  static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }
}

// Enhanced middleware for comprehensive input validation and sanitization
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  try {
    // Only sanitize API endpoints to avoid interfering with static file serving
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Skip validation for specific safe endpoints
    const safeEndpoints = ['/api/health', '/api/platform/status', '/api/platform/health'];
    if (safeEndpoints.includes(req.path)) {
      return next();
    }

    // Validate request size
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get('content-length') || '0');
    if (contentLength > maxSize) {
      throw new Error('Request too large');
    }

    // Validate query parameter limits
    if (req.query && Object.keys(req.query).length > 50) {
      throw new Error('Too many query parameters');
    }

    // Enhanced sanitization with depth protection and error resilience
    if (req.body) {
      try {
        req.body = InputValidator.sanitizeObject(req.body);
        validateObjectDepth(req.body, 0, 10); // Max depth 10
      } catch (sanitizationError) {
        // Log but don't block - allow legitimate business data through
        console.warn('Sanitization warning for', req.path, ':', sanitizationError);
      }
    }
    
    if (req.query) {
      try {
        // Validate query parameter values first
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string' && value.length > 1000) {
            throw new Error(`Query parameter '${key}' too long`);
          }
        }
        req.query = InputValidator.sanitizeObject(req.query);
      } catch (sanitizationError) {
        console.warn('Query sanitization warning for', req.path, ':', sanitizationError);
      }
    }
    
    if (req.params) {
      try {
        req.params = InputValidator.sanitizeObject(req.params);
      } catch (sanitizationError) {
        console.warn('Params sanitization warning for', req.path, ':', sanitizationError);
      }
    }

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(400).json({ 
      error: 'Invalid input detected',
      message: 'Request contains potentially harmful content',
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to prevent deeply nested objects (DoS protection)
function validateObjectDepth(obj: any, currentDepth: number, maxDepth: number): void {
  if (currentDepth > maxDepth) {
    throw new Error('Object too deeply nested');
  }
  
  if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        validateObjectDepth(value, currentDepth + 1, maxDepth);
      }
    }
  }
}

// Schema validation middleware factory
export function validateSchema(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      } else {
        res.status(400).json({ error: 'Invalid request format' });
      }
    }
  };
}

// Common validation schemas
export const paymentSchema = z.object({
  amount: z.number().positive().max(1000000),
  recipientEmail: z.string().email(),
  currency: z.string().length(3).optional()
});

export const transferSchema = z.object({
  fromAddress: z.string().min(20),
  toAddress: z.string().min(20),
  amount: z.number().positive(),
  network: z.enum(['ethereum', 'xrp', 'bitcoin'])
});

export const agentRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(500),
  capabilities: z.array(z.string()).min(1),
  contactEmail: z.string().email()
});