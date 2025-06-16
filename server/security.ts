/**
 * Institutional-Grade Security Middleware
 * Implements comprehensive security measures for production deployment
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Express, Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Rate limiting configuration
const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/platform/health';
    }
  });
};

// Security rate limits
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // requests per window
  'Too many requests from this IP, please try again later'
);

const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // login attempts per window
  'Too many authentication attempts, please try again later'
);

const apiRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  30, // API calls per minute
  'API rate limit exceeded, please slow down'
);

const strictRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // strict endpoints
  'Rate limit exceeded for sensitive operations'
);

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true 
      });
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// SQL injection prevention
export const validateSQLInput = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(;|\-\-|\||\*|%|<|>|=)/g,
    /('|(\\')|(\\")|(\\\\))/g
  ];

  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkForSQLInjection);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkForSQLInjection);
    }
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected',
      code: 'SECURITY_VIOLATION'
    });
  }

  next();
};

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Required for Vite in development
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Environment-specific CORS
export const corsConfig = (req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://coinrailz.com', 'https://www.coinrailz.com']
    : ['http://localhost:5000', 'http://127.0.0.1:5000'];

  const origin = req.headers.origin;
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }
  }

  // Validate request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      success: false,
      message: 'Request payload too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  next();
};

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const sessionToken = req.headers['x-session-token'];

  if (!token && !sessionToken) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Add user context to request (implement your auth logic here)
  next();
};

// Security audit logging
const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const securityEvents = [
    'login', 'register', 'payment', 'withdrawal', 'agent-register'
  ];

  const isSecurityEvent = securityEvents.some(event => 
    req.path.includes(event) || req.path.includes('auth')
  );

  if (isSecurityEvent) {
    console.log(`[SECURITY] ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent']?.substring(0, 100)}`);
  }

  next();
};

// Setup comprehensive security middleware
export const setupSecurity = (app: Express) => {
  // Apply security headers
  app.use(securityHeaders);
  
  // Apply CORS configuration
  app.use(corsConfig);
  
  // Apply general rate limiting
  app.use(generalRateLimit);
  
  // Apply request validation
  app.use(validateRequest);
  
  // Apply input sanitization
  app.use(sanitizeInput);
  
  // Apply SQL injection prevention
  app.use(validateSQLInput);
  
  // Apply security logging
  app.use(securityLogger);

  console.log('✅ Institutional-grade security middleware activated');
};

// Export security middleware for route-specific usage
export {
  authRateLimit,
  apiRateLimit,
  strictRateLimit,
  requireAuth
};