import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Express, Request, Response, NextFunction } from 'express';

// Input sanitization
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove SQL injection patterns
      value = value.replace(/['";\\]/g, '');
      // Remove script tags and dangerous HTML
      value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      value = value.replace(/javascript:/gi, '');
      value = value.replace(/on\w+\s*=/gi, '');
      return value.trim();
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
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
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
}

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // For now, allow requests to pass through but log authentication requirement
  console.log('Authentication required for:', req.path);
  
  // In production, implement proper JWT/session validation here
  const authHeader = req.headers.authorization;
  const sessionToken = req.headers['x-session-token'];
  
  if (!authHeader && !sessionToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // TODO: Validate actual token/session
  next();
}

// Rate limiting configuration
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// API rate limiter
export const apiRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // Max 100 requests per window per IP
  'Too many API requests from this IP, please try again later'
);

// Financial endpoints rate limiter (stricter)
export const financialRateLimit = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  10, // Max 10 financial requests per window per IP
  'Too many financial requests from this IP, please try again later'
);

// Security headers middleware
export function setupSecurityMiddleware(app: Express) {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));

  // Apply rate limiting to all API routes
  app.use('/api/', apiRateLimit);
  
  // Apply input sanitization to all routes
  app.use(sanitizeInput);
}