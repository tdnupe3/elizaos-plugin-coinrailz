/**
 * Comprehensive Error Handling Middleware
 * Provides production-grade error handling with proper logging and response formatting
 */

import type { Request, Response, NextFunction } from 'express';

interface ErrorLog {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  code: string;
  userAgent?: string;
  ip: string;
  stack?: string;
}

class ErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private readonly maxLogs = 1000;
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  logError(error: any, req: Request, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode,
      code,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown'
    };

    // Only include stack trace in development
    if (this.isDevelopment && error?.stack) {
      errorLog.stack = error.stack;
    }

    this.errorLogs.push(errorLog);

    // Keep only recent logs to prevent memory issues
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (this.isDevelopment) {
      console.error('Error occurred:', errorLog);
    } else {
      console.error('Error occurred:', {
        timestamp: errorLog.timestamp,
        method: errorLog.method,
        url: errorLog.url,
        statusCode: errorLog.statusCode,
        code: errorLog.code,
        userAgent: errorLog.userAgent,
        ip: errorLog.ip
      });
    }
  }

  getRecentErrors(limit: number = 50): ErrorLog[] {
    return this.errorLogs.slice(-limit);
  }

  // Main error handling middleware
  middleware() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      // Determine status code
      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';
      let message = 'Internal server error';

      if (error.statusCode) {
        statusCode = error.statusCode;
      } else if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Invalid input data';
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        message = 'Authentication required';
      } else if (error.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorCode = 'SERVICE_UNAVAILABLE';
        message = 'Service temporarily unavailable';
      } else if (error.code === 'TIMEOUT') {
        statusCode = 408;
        errorCode = 'REQUEST_TIMEOUT';
        message = 'Request timeout';
      }

      // Log the error
      this.logError(error, req, statusCode, errorCode);

      // Return appropriate response
      const errorResponse: any = {
        success: false,
        error: errorCode,
        message,
        timestamp: new Date().toISOString()
      };

      // Include additional details in development
      if (this.isDevelopment && error.stack) {
        errorResponse.stack = error.stack;
        errorResponse.details = error.message;
      }

      // Add request ID for tracking
      errorResponse.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      res.status(statusCode).json(errorResponse);
    };
  }

  // Async error wrapper for route handlers
  asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Global uncaught exception handler
  setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // Don't exit in development for better debugging
      if (!this.isDevelopment) {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit in development for better debugging
      if (!this.isDevelopment) {
        process.exit(1);
      }
    });
  }
}

export const errorHandler = new ErrorHandler();

// Convenience export for async route handlers
export const asyncHandler = errorHandler.asyncHandler.bind(errorHandler);