import { Request, Response, NextFunction } from 'express';
import { getSession, isSessionValid, isSessionValidSync, getSessionSync } from '../services/sessionManager';

type AuthenticatedRequest = Omit<Request, 'user'> & {
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token required'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Please login again'
      });
    }

    const valid = await isSessionValid(token);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        message: 'Please login again'
      });
    }

    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        message: 'Please login again'
      });
    }

    (req as AuthenticatedRequest).user = {
      id: session.userId,
      email: session.userEmail,
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
