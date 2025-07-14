import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check for Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // In a real implementation, you would verify the JWT token here
  // For now, we'll do a simple check
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication token is invalid'
    });
  }

  // Mock user object - in production, extract from JWT
  req.user = {
    id: 'demo-user-123',
    walletId: 'demo-wallet-456',
    email: 'demo@example.com'
  };

  next();
};

export default requireAuth;