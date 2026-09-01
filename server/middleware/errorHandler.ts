/**
 * Global Error Handler Middleware
 * Handles unhandled promises and provides proper error responses
 */

import { Request, Response, NextFunction } from 'express';

export class GlobalErrorHandler {
  static init() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't crash the application, just log the error
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: any) => {
      const isTransient = error.code === 'ECONNRESET'
        || error.code === 'ECONNREFUSED'
        || error.code === 'ETIMEDOUT'
        || error.code === 'EPIPE'
        || error.message?.includes('socket hang up')
        || error.message?.includes('Connection terminated unexpectedly')
        || error.message?.includes('fetch failed')
        // Neon serverless WebSocket transient errors — safe to swallow, not app faults
        || error.message?.includes('Cannot set property message of #<ErrorEvent>')
        || error.message?.includes('Cannot read properties of null (reading \'setHeader\')')
        || (error.stack && error.stack.includes('@neondatabase/serverless'));
      if (isTransient) {
        console.warn('⚠️ Transient network error caught — server continues running:', error.message);
        return;
      }
      console.error('Uncaught Exception:', error);
      if (process.env.NODE_ENV === 'production') {
        console.error('💀 Fatal uncaught exception — exiting');
        process.exit(1);
      }
    });
  }

  static middleware() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Express Error Handler:', error);

      if (res.headersSent) {
        return next(error);
      }

      // Body parser errors must remain client errors after consolidating the
      // app onto this single terminal handler.
      if (error instanceof SyntaxError && (error as any).status === 400 && 'body' in error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON body — expected a JSON object'
        });
      }

      // Authentication errors
      if (error.name === 'UnauthorizedError' || error.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please log in to access this resource'
        });
      }

      // Validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.message
        });
      }

      // API errors
      if (error.response) {
        return res.status(error.response.status || 500).json({
          success: false,
          error: 'External API error',
          message: 'Service temporarily unavailable'
        });
      }

      // Database errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({
          success: false,
          error: 'Database connection failed',
          message: 'Service temporarily unavailable'
        });
      }

      // Default error response
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: isDevelopment ? error.message : 'Something went wrong',
        ...(isDevelopment && { stack: error.stack })
      });
    };
  }
}

export const initGlobalErrorHandling = GlobalErrorHandler.init;
export const errorHandlerMiddleware = GlobalErrorHandler.middleware;