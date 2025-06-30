/**
 * Enhanced Security Middleware for AI Marketplace
 * Comprehensive protection without excessive restrictions
 */

import crypto from 'crypto';

interface SecurityContext {
  userId?: string;
  sessionId?: string;
  requestCount: number;
  lastActivity: number;
  riskScore: number;
}

// Simple in-memory store for demo - in production, use Redis
const securityStore = new Map<string, SecurityContext>();

export function enhancedAuthValidation(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const sessionId = req.headers['x-session-id'] || crypto.randomUUID();
  
  // Allow public endpoints without authentication
  const publicEndpoints = [
    '/api/ai-agents/search',
    '/api/ai-agents/categories', 
    '/api/ai-agents/payment-methods',
    '/api/platform/health'
  ];
  
  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  // Require authentication for sensitive operations
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Extract and validate token (simplified for demo)
  const token = authHeader.replace('Bearer ', '');
  if (token.length < 10) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }

  // Track security context
  const context = securityStore.get(sessionId) || {
    userId: token.substring(0, 8),
    sessionId,
    requestCount: 0,
    lastActivity: Date.now(),
    riskScore: 0
  };

  context.requestCount++;
  context.lastActivity = Date.now();
  securityStore.set(sessionId, context);

  req.securityContext = context;
  next();
}

export function businessLogicValidation(req: any, res: any, next: any) {
  // Validate critical business operations
  if (req.method === 'POST') {
    const { body } = req;
    
    // Order validation
    if (req.path.includes('/order')) {
      if (!body.agentId || !body.serviceType || !body.amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required order fields',
          required: ['agentId', 'serviceType', 'amount']
        });
      }
      
      if (body.amount < 5) {
        return res.status(400).json({
          success: false,
          error: 'Minimum order amount is $5.00',
          minimum: 5
        });
      }
    }
    
    // Payment validation
    if (req.path.includes('/payment') || req.path.includes('/release')) {
      if (!body.orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID required for payment operations'
        });
      }
    }
  }
  
  next();
}

export function riskAssessment(req: any, res: any, next: any) {
  const context = req.securityContext;
  if (!context) return next();

  // Calculate risk score based on behavior
  let riskScore = 0;
  
  // High request frequency
  if (context.requestCount > 50) {
    riskScore += 20;
  }
  
  // Financial operations add risk
  if (req.path.includes('/order') || req.path.includes('/payment')) {
    riskScore += 10;
  }
  
  // Multiple failed attempts
  if (req.headers['x-retry-count'] && parseInt(req.headers['x-retry-count']) > 3) {
    riskScore += 30;
  }

  context.riskScore = riskScore;

  // Block high-risk requests
  if (riskScore > 80) {
    return res.status(429).json({
      success: false,
      error: 'Request blocked due to high risk score',
      riskScore,
      cooldown: 300000 // 5 minutes
    });
  }

  // Add security headers for medium risk
  if (riskScore > 40) {
    res.set('X-Risk-Level', 'elevated');
    res.set('X-Security-Check', 'required');
  }

  next();
}

export function dataProtection(req: any, res: any, next: any) {
  // Prevent unauthorized data access
  if (req.method === 'GET' && req.path.includes('/performance/')) {
    const agentId = req.params.agentId || req.path.split('/').pop();
    const userId = req.securityContext?.userId;
    
    // Only allow agents to see their own performance data
    if (agentId !== 'all' && agentId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot access other agents performance data',
        code: 'DATA_PROTECTION'
      });
    }
  }
  
  next();
}

export function errorSecurityWrapper(fn: Function) {
  return async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // Don't expose internal errors
      console.error('Security middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Security validation failed',
        code: 'SECURITY_ERROR'
      });
    }
  };
}