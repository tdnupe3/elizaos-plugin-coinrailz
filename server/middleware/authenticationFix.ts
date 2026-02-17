import { Request, Response, NextFunction } from 'express';
import { getSessionSync } from '../services/sessionManager';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  isAuthenticated?: boolean;
}

export function enhancedAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.session && (req.session as any).user) {
      req.user = (req.session as any).user;
      req.isAuthenticated = true;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        const session = getSessionSync(token);
        if (session) {
          req.user = {
            id: session.userId,
            email: session.userEmail,
          };
          req.isAuthenticated = true;
          return next();
        }
      }
    }

    req.isAuthenticated = false;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    req.isAuthenticated = false;
    next();
  }
}

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

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    enhancedAuth(req, res, next);
  } catch (error) {
    console.error('Optional auth error:', error);
    req.isAuthenticated = false;
    next();
  }
}

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
