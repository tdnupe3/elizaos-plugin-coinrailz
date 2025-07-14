import { Request, Response, NextFunction } from 'express';
import { getSession, isSessionValid } from '../services/sessionManager';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token required'
      });
    }

    // Extract and validate session token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Please login again'
      });
    }

    // Check if session exists and is valid
    if (!isSessionValid(token)) {
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        message: 'Please login again'
      });
    }

    const session = getSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        message: 'Please login again'
      });
    }

    // Add user info to request
    req.user = {
      id: session.userId,
      email: session.userEmail,
      firstName: 'Demo',
      lastName: 'User'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication system error',
      message: 'Please try again later'
    });
  }
}

export default requireAuth;