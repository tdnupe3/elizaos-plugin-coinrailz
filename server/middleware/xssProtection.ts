/**
 * COMPREHENSIVE XSS PROTECTION MIDDLEWARE
 * Blocks malicious content at the request level with proper error responses
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Comprehensive XSS and injection attack patterns
const SECURITY_PATTERNS = [
  // Script tags (any variation)
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script.*?>/gi,
  /javascript:/gi,
  
  // Event handlers
  /on\w+\s*=/gi,
  /onload/gi,
  /onerror/gi,
  /onclick/gi,
  /onmouseover/gi,
  
  // Dangerous functions
  /alert\s*\(/gi,
  /confirm\s*\(/gi,
  /prompt\s*\(/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /document\./gi,
  /window\./gi,
  
  // Dangerous tags
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<meta/gi,
  /<style/gi,
  /<svg.*onload/gi,
  
  // Data URIs and protocols
  /data:text\/html/gi,
  /vbscript:/gi,
  /livescript:/gi,
  /mocha:/gi,
  
  // HTML entities that could be malicious
  /&#x?[0-9a-fA-F]+;/g,
  
  // Path traversal attacks
  /\.\.\//gi,
  /\.\.\\\\/gi,
  /\.\.%2f/gi,
  /\.\.%5c/gi,
  /%2e%2e%2f/gi,
  /%2e%2e%5c/gi,
  /\/etc\/passwd/gi,
  /\/proc\/self\/environ/gi,
  /\/windows\/system32/gi,
  
  // SQL injection patterns
  /union\s+select/gi,
  /or\s+1\s*=\s*1/gi,
  /drop\s+table/gi,
  /delete\s+from/gi,
  /insert\s+into/gi,
  /update\s+.*set/gi,
  
  // Command injection
  /\|\s*ls/gi,
  /\|\s*cat/gi,
  /\|\s*rm/gi,
  /\|\s*chmod/gi,
  /;\s*ls/gi,
  /;\s*cat/gi,
  /;\s*rm/gi,
  /&&\s*ls/gi,
  /&&\s*cat/gi
];

// Function to detect XSS in any input
function containsXSS(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  // Check if DOMPurify removes content (indicates potential XSS)
  const sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  });
  
  return sanitized !== input;
}

// Recursive function to scan all object properties
function scanObjectForXSS(obj: any, path: string = ''): string | null {
  if (typeof obj === 'string') {
    if (containsXSS(obj)) {
      return `${path}: "${obj.substring(0, 50)}..."`;
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const threat = scanObjectForXSS(obj[i], `${path}[${i}]`);
      if (threat) return threat;
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      // Check key for XSS
      if (containsXSS(key)) {
        return `key "${key}": potential XSS in property name`;
      }
      
      // Check value for XSS
      const threat = scanObjectForXSS(value, path ? `${path}.${key}` : key);
      if (threat) return threat;
    }
  }
  
  return null;
}

// Main XSS protection middleware
export function xssProtection(req: Request, res: Response, next: NextFunction) {
  try {
    // Scan request body for XSS
    if (req.body) {
      const bodyThreat = scanObjectForXSS(req.body, 'body');
      if (bodyThreat) {
        console.error(`XSS threat blocked in ${req.path}:`, bodyThreat);
        return res.status(400).json({
          success: false,
          error: 'Malicious content detected and blocked',
          message: 'XSS protection activated',
          details: 'Request contains potentially harmful scripts or HTML'
        });
      }
    }
    
    // Scan query parameters for XSS
    if (req.query) {
      const queryThreat = scanObjectForXSS(req.query, 'query');
      if (queryThreat) {
        console.error(`XSS threat blocked in ${req.path} query:`, queryThreat);
        return res.status(400).json({
          success: false,
          error: 'Malicious content detected in query parameters',
          message: 'XSS protection activated'
        });
      }
    }
    
    // Scan URL parameters for XSS
    if (req.params) {
      const paramsThreat = scanObjectForXSS(req.params, 'params');
      if (paramsThreat) {
        console.error(`XSS threat blocked in ${req.path} params:`, paramsThreat);
        return res.status(400).json({
          success: false,
          error: 'Malicious content detected in URL parameters',
          message: 'XSS protection activated'
        });
      }
    }
    
    // Request is clean, proceed
    next();
    
  } catch (error) {
    console.error('XSS protection middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Security validation failed',
      message: 'Internal security error'
    });
  }
}

// Enhanced XSS protection for specific routes
export function strictXSSProtection(req: Request, res: Response, next: NextFunction) {
  try {
    // More aggressive scanning for critical endpoints
    const allInputs = {
      ...req.body,
      ...req.query,
      ...req.params
    };
    
    const threat = scanObjectForXSS(allInputs, 'request');
    if (threat) {
      console.error(`STRICT XSS protection triggered for ${req.path}:`, threat);
      return res.status(403).json({
        success: false,
        error: 'Security violation detected',
        message: 'Strict XSS protection activated',
        details: 'This endpoint has enhanced security requirements'
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Strict XSS protection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Security validation failed',
      message: 'Internal security error'
    });
  }
}