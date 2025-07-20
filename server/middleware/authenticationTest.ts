/**
 * Test authentication system to resolve promise rejection issues
 */

import { Request, Response } from 'express';

/**
 * Test endpoint to verify authentication system is working
 */
export function createAuthTest() {
  return async (req: Request, res: Response) => {
    try {
      // Test various authentication states
      const authHeader = req.headers.authorization;
      const session = (req.session as any)?.user;
      
      const authState = {
        hasAuthHeader: !!authHeader,
        hasSession: !!session,
        headerType: authHeader?.substring(0, 20) || null,
        sessionValid: !!session?.id,
        isAuthenticated: !!(authHeader && authHeader.length > 10) || !!session?.id
      };

      res.json({
        success: true,
        message: 'Authentication test endpoint',
        authState,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Auth test error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication test failed',
        message: error.message
      });
    }
  };
}