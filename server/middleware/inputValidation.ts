/**
 * Comprehensive Input Validation Middleware
 * Provides SQL injection protection and input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Regex patterns for validation
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  /(;|\||&|\$|`|'|"|\\|\*|\?|<|>|\[|\]|\{|\}|\(|\))/,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(UNION\s+SELECT)/i,
  /(DROP\s+TABLE)/i
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
    
    // Remove potential XSS content
    let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // Additional sanitization for SQL injection attempts
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw new Error('Invalid input detected');
      }
    }
    
    return sanitized.trim();
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

    // Enhanced sanitization with depth protection
    if (req.body) {
      req.body = InputValidator.sanitizeObject(req.body);
      validateObjectDepth(req.body, 0, 10); // Max depth 10
    }
    
    if (req.query) {
      req.query = InputValidator.sanitizeObject(req.query);
      // Validate query parameter values
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && value.length > 1000) {
          throw new Error(`Query parameter '${key}' too long`);
        }
      }
    }
    
    if (req.params) {
      req.params = InputValidator.sanitizeObject(req.params);
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