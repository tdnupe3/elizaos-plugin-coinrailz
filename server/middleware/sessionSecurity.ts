/**
 * Session Security Middleware for AI Marketplace
 * Implements session timeout and authentication validation
 */

interface SessionData {
  userId: string;
  lastActivity: number;
  sessionStart: number;
  userRole: string;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function validateSession(req: any, res: any, next: any) {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  const now = Date.now();
  
  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: 'Session ID required',
      code: 'SESSION_MISSING'
    });
  }

  // In production, this would query the database for session data
  const mockSession: SessionData = {
    userId: 'user_123',
    lastActivity: now - (20 * 60 * 1000), // 20 minutes ago
    sessionStart: now - (2 * 60 * 60 * 1000), // 2 hours ago
    userRole: 'customer'
  };

  // Check session timeout
  if (now - mockSession.lastActivity > SESSION_TIMEOUT) {
    return res.status(401).json({
      success: false,
      error: 'Session expired due to inactivity',
      code: 'SESSION_TIMEOUT'
    });
  }

  // Check maximum session duration
  if (now - mockSession.sessionStart > MAX_SESSION_DURATION) {
    return res.status(401).json({
      success: false,
      error: 'Session expired - maximum duration exceeded',
      code: 'SESSION_MAX_DURATION'
    });
  }

  // Update last activity (in production, update database)
  mockSession.lastActivity = now;
  
  // Add session data to request
  req.session = mockSession;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.session || !allowedRoles.includes(req.session.userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.session?.userRole || 'none'
      });
    }
    next();
  };
}