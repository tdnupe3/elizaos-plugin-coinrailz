/**
 * Lightweight API Security - Protects APIs without blocking frontend
 * Focused on backend API protection while allowing frontend to load normally
 */
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Simple rate limiting for API endpoints only
const apiRateMap = new Map<string, { count: number; resetTime: number }>();

export const lightweightRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Only apply to API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requests per minute for APIs

  const key = `api_${ip}`;
  const entry = apiRateMap.get(key);

  if (!entry || now > entry.resetTime) {
    apiRateMap.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (entry.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'API rate limit exceeded. Please slow down.',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
  }

  entry.count++;
  next();
};

// Input validation for API endpoints only
export const validateApiInput = (req: Request, res: Response, next: NextFunction) => {
  // Only apply to API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Basic SQL injection patterns
  const dangerousPatterns = [
    /(\bDROP\s+TABLE\b)/gi,
    /(\bDELETE\s+FROM\b)/gi,
    /(\bUNION\s+SELECT\b)/gi,
    /(;\s*--)/g,
    /(\bEXEC\s*\()/gi
  ];

  const checkInput = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(obj));
    }
    if (Array.isArray(obj)) {
      return obj.some(checkInput);
    }
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkInput);
    }
    return false;
  };

  if (checkInput(req.body) || checkInput(req.query)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected',
      code: 'SECURITY_BLOCK'
    });
  }

  next();
};

// Sanitize inputs for API endpoints
export const sanitizeApiInput = (req: Request, res: Response, next: NextFunction) => {
  // Only apply to API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true 
      });
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
};

// Basic security headers that won't block frontend
export const basicSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Only for API responses, not frontend resources
  if (req.path.startsWith('/api/')) {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
  }
  
  next();
};

// Setup lightweight security that won't break frontend
export const setupLightweightSecurity = (app: any) => {
  app.use(basicSecurityHeaders);
  app.use(sanitizeApiInput);
  app.use(validateApiInput);
  app.use(lightweightRateLimit);
  
  console.log('✅ Lightweight API security activated (frontend-safe)');
};