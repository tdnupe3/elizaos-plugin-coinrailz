/**
 * Global Error Handler for Production Safety
 */

import { Request, Response, NextFunction } from 'express';

export interface SafeError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(err: SafeError, req: Request, res: Response, next: NextFunction) {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle operational errors (safe to expose)
  if (err.isOperational) {
    message = err.message;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data';
    code = 'VALIDATION_ERROR';
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Authentication required';
    code = 'AUTH_REQUIRED';
  }

  // Log error for monitoring (without exposing sensitive data)
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  });
}

/**
 * Async error wrapper to catch promise rejections
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process in production, just log
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit process in production, just log
});