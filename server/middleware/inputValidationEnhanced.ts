/**
 * Enhanced Input Validation Middleware
 * Comprehensive validation for all API endpoints
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Enhanced schemas for different endpoint types
export const userRegistrationSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(254, 'Email too long')
    .refine(email => {
      const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
      const domain = email.split('@')[1]?.toLowerCase();
      return !blockedDomains.includes(domain);
    }, 'Temporary email addresses not allowed'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  
  firstName: z.string()
    .min(1, 'First name required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s\-']+$/, 'First name contains invalid characters'),
  
  lastName: z.string()
    .min(1, 'Last name required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name contains invalid characters'),
  
  acceptTerms: z.boolean().refine(val => val === true, 'Must accept terms')
});

export const transactionSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(5, 'Minimum transaction amount is $5')
    .max(50000, 'Maximum transaction amount is $50,000')
    .refine(amount => Number.isFinite(amount), 'Invalid amount'),
  
  currency: z.string()
    .min(3, 'Currency code too short')
    .max(5, 'Currency code too long')
    .regex(/^[A-Z]{3,5}$/, 'Invalid currency format'),
  
  recipientEmail: z.string()
    .email('Invalid recipient email')
    .optional(),
  
  toUserId: z.string()
    .min(1, 'Recipient user ID required')
    .optional(),
  
  message: z.string()
    .max(500, 'Message too long')
    .optional()
});

export const cryptoTransferSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .refine(amount => Number.isFinite(amount), 'Invalid amount'),
  
  cryptoSymbol: z.string()
    .min(2, 'Crypto symbol too short')
    .max(10, 'Crypto symbol too long')
    .regex(/^[A-Z]{2,10}$/, 'Invalid crypto symbol format'),
  
  toWalletAddress: z.string()
    .min(20, 'Wallet address too short')
    .max(100, 'Wallet address too long'),
  
  blockchainNetwork: z.string()
    .min(3, 'Network name too short')
    .max(50, 'Network name too long'),
  
  message: z.string()
    .max(200, 'Message too long')
    .optional()
});

export const kycVerificationSchema = z.object({
  verificationType: z.enum(['identity', 'address', 'income']),
  documentType: z.enum(['passport', 'license', 'utility_bill', 'bank_statement']),
  verificationData: z.object({}).passthrough() // Allow any structure but sanitize
});

export const agentRegistrationSchema = z.object({
  name: z.string()
    .min(3, 'Agent name too short')
    .max(100, 'Agent name too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Agent name contains invalid characters'),
  
  description: z.string()
    .min(10, 'Description too short')
    .max(1000, 'Description too long'),
  
  capabilities: z.array(z.string())
    .min(1, 'At least one capability required')
    .max(10, 'Too many capabilities'),
  
  pricing: z.object({
    basePrice: z.number().positive('Base price must be positive'),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Invalid currency')
  }),
  
  contactEmail: z.string().email('Invalid contact email'),
  
  serviceDeliveryMethods: z.array(z.string())
    .min(1, 'At least one delivery method required')
});

// XSS Protection and sanitization
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove script tags and other dangerous content
    let sanitized = DOMPurify.sanitize(input);
    
    // Additional sanitization for common injection patterns
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace/on\w+\s*=/gi, '');
    
    return sanitized;
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// SQL Injection protection for raw queries
export function sanitizeSQLInput(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  // Remove common SQL injection patterns
  return input
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '')
    .replace(/[;'"\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// Enhanced validation middleware factory
export function validateWithSchema<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input first
      const sanitizedBody = sanitizeInput(req.body);
      
      // Validate with schema
      const validatedData = schema.parse(sanitizedBody);
      
      // Replace request body with validated and sanitized data
      req.body = validatedData;
      
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Input validation failed',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: issue.received
          }))
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Request contains invalid data'
      });
    }
  };
}

// Middleware for comprehensive input sanitization
export function comprehensiveInputSanitization(req: Request, res: Response, next: NextFunction) {
  // Sanitize all input sources
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  
  // Validate content length
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request payload exceeds maximum size limit'
    });
  }
  
  // Validate content type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
        message: 'Content-Type must be application/json'
      });
    }
  }
  
  next();
}

// Validate numeric IDs
export function validateNumericId(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID',
        message: `${paramName} must be a valid numeric ID`
      });
    }
    
    next();
  };
}

// Validate UUID format
export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid UUID',
        message: `${paramName} must be a valid UUID`
      });
    }
    
    next();
  };
}