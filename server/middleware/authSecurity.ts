/**
 * Authentication Security Middleware
 * Implements password complexity, rate limiting, and enhanced error handling
 */

import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Password complexity validation schema
export const passwordComplexitySchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email validation schema
export const emailValidationSchema = z.string()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must be less than 254 characters')
  .refine((email) => {
    // Additional email validation rules
    const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return !blockedDomains.includes(domain);
  }, 'Temporary email addresses are not allowed');

// Rate limiting for authentication attempts
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please wait 15 minutes before trying again',
    retryAfter: 900 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Custom key generator for better tracking
  keyGenerator: (req: Request) => {
    return `auth:${req.ip}:${req.headers['user-agent'] || 'unknown'}`;
  }
});

// Rate limiting for registration attempts
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Please wait 1 hour before creating another account',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Enhanced error handling for authentication routes
export function handleAuthError(error: any, req: Request, res: Response, next: NextFunction) {
  console.error('Authentication error:', {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Determine error type and respond appropriately
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: error.message,
      details: error.issues || []
    });
  }

  if (error.message?.includes('duplicate') || error.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Account already exists',
      message: 'An account with this email already exists'
    });
  }

  if (error.message?.includes('authentication') || error.status === 401) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid credentials or session expired'
    });
  }

  if (error.message?.includes('rate limit') || error.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: error.message || 'Too many requests, please try again later',
      retryAfter: error.retryAfter || 900
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: 'An unexpected error occurred. Please try again later.'
  });
}

// Validate password complexity middleware
export function validatePasswordComplexity(req: Request, res: Response, next: NextFunction) {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password required',
      message: 'Password is required for account creation'
    });
  }

  try {
    passwordComplexitySchema.parse(password);
    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: 'Password validation failed',
      message: 'Password does not meet complexity requirements',
      requirements: [
        'At least 8 characters long',
        'Contains uppercase letter',
        'Contains lowercase letter', 
        'Contains number',
        'Contains special character'
      ],
      details: error.issues || []
    });
  }
}

// Validate email middleware
export function validateEmail(req: Request, res: Response, next: NextFunction) {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email required',
      message: 'Email address is required'
    });
  }

  try {
    emailValidationSchema.parse(email);
    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: 'Email validation failed',
      message: 'Please enter a valid email address',
      details: error.issues || []
    });
  }
}

// Sanitize authentication inputs
export function sanitizeAuthInputs(req: Request, res: Response, next: NextFunction) {
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  
  if (req.body.firstName) {
    req.body.firstName = req.body.firstName.trim();
  }
  
  if (req.body.lastName) {
    req.body.lastName = req.body.lastName.trim();
  }
  
  // Remove any potentially harmful characters
  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  });
  
  next();
}

// Check for suspicious registration patterns
export function detectSuspiciousRegistration(req: Request, res: Response, next: NextFunction) {
  const { email, firstName, lastName } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  
  // Flag suspicious patterns
  const suspiciousPatterns = [
    // Automated tools
    userAgent.includes('bot'),
    userAgent.includes('crawler'),
    userAgent.includes('spider'),
    // Suspicious email patterns
    email && email.includes('+'),
    email && /\d{5,}/.test(email), // 5+ consecutive numbers
    // Suspicious name patterns
    firstName && firstName.length < 2,
    lastName && lastName.length < 2,
    firstName && /\d/.test(firstName),
    lastName && /\d/.test(lastName)
  ];
  
  const suspiciousCount = suspiciousPatterns.filter(Boolean).length;
  
  if (suspiciousCount >= 3) {
    console.warn('Suspicious registration attempt detected:', {
      ip: req.ip,
      userAgent,
      email,
      suspiciousCount
    });
    
    return res.status(400).json({
      success: false,
      error: 'Registration validation failed',
      message: 'Please ensure all information is accurate and try again'
    });
  }
  
  next();
}