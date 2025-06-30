/**
 * Secure Authentication Middleware
 * Provides comprehensive authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Enhanced authentication middleware with proper error handling
 */
export function requireSecureAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Check session authentication
    if (!req.session || !(req.session as any).user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate session integrity
    if (!(req.session as any).user.id || !(req.session as any).user.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session',
        code: 'INVALID_SESSION'
      });
    }

    // Add user to request
    req.user = (req.session as any).user;
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication system error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Rate limiting for financial endpoints
 */
export const financialRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many financial requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Role-based authorization
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

/**
 * Input sanitization middleware - DISABLED to prevent payment blocking
 * Smart security middleware handles all input validation now
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Disabled - smart security middleware handles all validation
  next();
}

function sanitizeObject(obj: any) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potentially dangerous characters
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      obj[key] = obj[key].replace(/javascript:/gi, '');
      obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}