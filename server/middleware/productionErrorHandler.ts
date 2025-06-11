/**
 * Production-Grade Error Handling Middleware
 * Centralized error handling with logging and user-friendly responses
 */

import type { Request, Response, NextFunction } from "express";
import { env } from '../environment';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class ProductionErrorHandler {
  
  /**
   * Create standardized API error
   */
  static createError(
    message: string, 
    statusCode: number = 500, 
    code?: string, 
    details?: any
  ): APIError {
    const error: APIError = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.details = details;
    error.isOperational = true;
    return error;
  }

  /**
   * Async wrapper to catch promise rejections
   */
  static asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(error: any): APIError {
    if (error.name === 'ZodError') {
      const message = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
      return this.createError(`Validation failed: ${message}`, 400, 'VALIDATION_ERROR', error.errors);
    }
    return error;
  }

  /**
   * Handle database errors
   */
  static handleDatabaseError(error: any): APIError {
    if (error.code === '23505') { // Unique constraint violation
      return this.createError('Resource already exists', 409, 'DUPLICATE_ERROR');
    }
    if (error.code === '23503') { // Foreign key constraint violation
      return this.createError('Related resource not found', 400, 'FOREIGN_KEY_ERROR');
    }
    if (error.code === 'ECONNREFUSED') {
      return this.createError('Database connection failed', 503, 'DATABASE_UNAVAILABLE');
    }
    return this.createError('Database operation failed', 500, 'DATABASE_ERROR');
  }

  /**
   * Handle payment processor errors
   */
  static handlePaymentError(error: any): APIError {
    if (error.type === 'StripeCardError') {
      return this.createError(error.message, 400, 'PAYMENT_DECLINED', { 
        decline_code: error.decline_code,
        payment_method: 'stripe'
      });
    }
    if (error.message?.includes('PayPal')) {
      return this.createError('PayPal payment failed', 400, 'PAYMENT_FAILED', {
        payment_method: 'paypal'
      });
    }
    if (error.message?.includes('NOWPayments')) {
      return this.createError('Cryptocurrency payment failed', 400, 'CRYPTO_PAYMENT_FAILED', {
        payment_method: 'crypto'
      });
    }
    return this.createError('Payment processing failed', 500, 'PAYMENT_ERROR');
  }

  /**
   * Handle API rate limiting errors
   */
  static handleRateLimitError(error: any): APIError {
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return this.createError('Rate limit exceeded, please try again later', 429, 'RATE_LIMIT_EXCEEDED');
    }
    return error;
  }

  /**
   * Main error handling middleware
   */
  static errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      let processedError: APIError = error;

      // Handle specific error types
      if (error.name === 'ZodError') {
        processedError = this.handleValidationError(error);
      } else if (error.code && (error.code.startsWith('23') || error.code === 'ECONNREFUSED')) {
        processedError = this.handleDatabaseError(error);
      } else if (error.type?.includes('Stripe') || error.message?.includes('PayPal') || error.message?.includes('NOWPayments')) {
        processedError = this.handlePaymentError(error);
      } else if (error.status === 429) {
        processedError = this.handleRateLimitError(error);
      } else if (!error.isOperational) {
        // Unknown error - log and return generic message
        console.error('Unexpected error:', error);
        processedError = this.createError('Internal server error', 500, 'INTERNAL_ERROR');
      }

      // Log error in production
      if (env.NODE_ENV === 'production') {
        console.error('API Error:', {
          message: processedError.message,
          code: processedError.code,
          statusCode: processedError.statusCode,
          url: req.url,
          method: req.method,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }

      // Send response
      const statusCode = processedError.statusCode || 500;
      const response: any = {
        success: false,
        error: {
          message: processedError.message,
          code: processedError.code || 'UNKNOWN_ERROR'
        }
      };

      // Include details in development
      if (env.NODE_ENV === 'development' && processedError.details) {
        response.error.details = processedError.details;
      }

      res.status(statusCode).json(response);
    };
  }

  /**
   * 404 handler for undefined routes
   */
  static notFoundHandler() {
    return (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          message: `Route ${req.method} ${req.path} not found`,
          code: 'ROUTE_NOT_FOUND'
        }
      });
    };
  }

  /**
   * Graceful shutdown handler
   */
  static setupGracefulShutdown(server: any) {
    const shutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            message: 'Request timeout',
            code: 'REQUEST_TIMEOUT'
          }
        });
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
}

/**
 * Request logging middleware
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const log = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      if (env.NODE_ENV === 'production' && res.statusCode >= 400) {
        console.error('Request error:', log);
      } else if (env.NODE_ENV === 'development') {
        console.log('Request:', log);
      }
    });

    next();
  };
}