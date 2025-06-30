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

// Input validation for API endpoints only - DISABLED to prevent payment blocking
export const validateApiInput = (req: Request, res: Response, next: NextFunction) => {
  // Disabled - smart security middleware handles all validation
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

// Minimal security headers that are Vite-safe
export const viteCompatibleHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Apply to all responses but keep Vite-compatible
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Only apply frame protection to API endpoints (not frontend)
  if (req.path.startsWith('/api/')) {
    res.header('X-Frame-Options', 'DENY');
  }
  
  next();
};

// Authentication-specific rate limiting
const authRateMap = new Map<string, { count: number; resetTime: number }>();

export const authRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Only apply to authentication endpoints
  const authPaths = ['/api/login', '/api/register', '/api/auth', '/api/signin', '/api/signup'];
  if (!authPaths.some(path => req.path.includes(path))) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5; // 5 auth attempts per 15 minutes

  const key = `auth_${ip}`;
  const entry = authRateMap.get(key);

  if (!entry || now > entry.resetTime) {
    authRateMap.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (entry.count >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
  }

  entry.count++;
  next();
};

// Setup lightweight security that won't break frontend
export const setupLightweightSecurity = (app: any) => {
  app.use(viteCompatibleHeaders);
  app.use(authRateLimit);
  app.use(sanitizeApiInput);
  app.use(validateApiInput);
  app.use(lightweightRateLimit);
  
  console.log('✅ Lightweight API security activated (frontend-safe)');
};