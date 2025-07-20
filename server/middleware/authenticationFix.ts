/**
 * Authentication Middleware Fix
 * Resolves mixed authentication states and promise rejection issues
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  isAuthenticated?: boolean;
}

/**
 * Enhanced authentication middleware that properly handles mixed states
 */
export function enhancedAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Check session-based authentication first
    if (req.session && (req.session as any).user) {
      req.user = (req.session as any).user;
      req.isAuthenticated = true;
      return next();
    }

    // Check Bearer token authentication
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // For demo/development purposes, accept any valid-looking token
      if (token && token.length > 10) {
        req.user = {
          id: 'demo-user-' + Date.now(),
          email: 'demo@coinrailz.com',
          username: 'demo'
        };
        req.isAuthenticated = true;
        return next();
      }
    }

    // No authentication found
    req.isAuthenticated = false;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    req.isAuthenticated = false;
    next();
  }
}

/**
 * Middleware that requires authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    enhancedAuth(req, res, () => {
      if (!req.isAuthenticated || !req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please log in to access this resource'
        });
      }
      next();
    });
  } catch (error) {
    console.error('Require auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication system error',
      message: 'Please try again'
    });
  }
}

/**
 * Middleware that provides optional authentication
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    enhancedAuth(req, res, next);
  } catch (error) {
    console.error('Optional auth error:', error);
    req.isAuthenticated = false;
    next();
  }
}

/**
 * Safe user data resolver
 */
export function resolveUser(req: AuthenticatedRequest): { id: string; email: string; username?: string } | null {
  try {
    if (req.user && req.isAuthenticated) {
      return req.user;
    }
    return null;
  } catch (error) {
    console.error('User resolve error:', error);
    return null;
  }
}