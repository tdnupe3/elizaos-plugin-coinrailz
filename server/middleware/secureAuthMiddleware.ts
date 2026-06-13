/**
 * 🔒 SECURE AUTHENTICATION MIDDLEWARE
 * FIXES CRITICAL SECURITY GAP - Removes prefix token bypass vulnerability
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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

/**
 * 🔒 SECURE Fast Revenue Authentication - NO BYPASS VULNERABILITIES
 * Enforces strict JWT verification without any prefix token fallbacks
 */
export const secureRevenueAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in Authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is missing or invalid'
      });
    }

    // STRICT JWT verification - NO fallback mechanisms for security
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Verify user still exists in database
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({
          error: 'User not found',
          message: 'User account no longer exists or has been deactivated'
        });
      }
      
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.userTier = decoded.tier || 'basic';
      req.user = user;
      
      console.log(`✅ Secure auth success: User ${decoded.userId} (${decoded.tier || 'basic'} tier)`);
      return next();
      
    } catch (jwtError: any) {
      console.error('🔒 JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your authentication token has expired. Please log in again.'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Authentication token is malformed or invalid.'
        });
      }
      
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Token verification failed. Please provide a valid JWT token.'
      });
    }
  } catch (error: any) {
    console.error('🔒 Secure revenue auth error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An internal authentication error occurred'
    });
  }
};

/**
 * 🔑 Generate JWT Token for User Login
 */
export const generateSecureJWTToken = (userId: string, email: string, tier: string = 'basic'): string => {
  const payload: JWTPayload = {
    userId,
    email,
    tier
  };
  
  // Token expires in 24 hours
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export default secureRevenueAuth;