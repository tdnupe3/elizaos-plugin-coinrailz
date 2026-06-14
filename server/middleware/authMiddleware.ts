import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storage } from '../storage.js';

// JWT Secret - REQUIRED from environment variables for enterprise security
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }
  console.error('🔒 WARNING: JWT_SECRET not set - using development fallback. REQUIRED for production deployment!');
  return 'development_jwt_secret_not_for_production';
})();

interface JWTPayload {
  userId: string;
  email: string;
  tier?: string;
  iat?: number;
  exp?: number;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in Authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Authentication token is missing or invalid'
      });
    }

    // Verify JWT token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (jwtError: any) {
      console.error('JWT verification failed:', jwtError.message);
      
      // Provide specific error messages for JWT issues
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          message: 'Your authentication token has expired. Please log in again.'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          message: 'Authentication token is malformed or invalid.'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Token verification failed'
      });
    }

    // Verify user still exists in database
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'The user associated with this token no longer exists.'
      });
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      tier: decoded.tier || 'basic'
    };
    
    // Store for fast revenue routes compatibility
    (req as any).userId = user.id;
    (req as any).userTier = decoded.tier || 'basic';

    next();
    
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Generate JWT token for user login
 */
export const generateJWTToken = (userId: string, email: string, tier: string = 'basic'): string => {
  const payload: JWTPayload = {
    userId,
    email,
    tier
  };
  
  // Token expires in 24 hours
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export default requireAuth;

/**
 * Lightweight auth for fast revenue routes (simplified for compatibility)
 */
export const fastRevenueAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || token.length < 10) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide valid Bearer token in Authorization header'
      });
    }
    
    // Try JWT verification first
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.userId = decoded.userId;
      req.userTier = decoded.tier || 'basic';
      return next();
    } catch (jwtError) {
      // Fallback: validate against DB-backed api_keys table (SHA-256 hash lookup)
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const apiKey = await storage.getApiKeyByHash(hashedToken);

      if (!apiKey || apiKey.status !== 'active' || apiKey.revokedAt) {
        return res.status(401).json({
          error: 'Invalid or revoked token',
          message: 'Provide a valid JWT or an active API key'
        });
      }

      req.userId = apiKey.userId;
      req.userTier = apiKey.keyPrefix?.startsWith('ent_') ? 'enterprise' :
                     apiKey.keyPrefix?.startsWith('api_') ? 'premium' : 'basic';
      return next();
    }
  } catch (error: any) {
    console.error('Fast revenue auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};
