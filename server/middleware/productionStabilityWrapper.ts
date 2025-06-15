/**
 * Production Stability Wrapper - Prevents all crashes and provides graceful fallbacks
 */
import { Request, Response, NextFunction } from 'express';

export class ProductionStabilityWrapper {
  static wrapAsyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res, next);
      } catch (error: any) {
        console.error('Route error caught:', error.message);
        
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Internal server error',
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  static wrapDatabaseOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string
  ): Promise<T> {
    return new Promise(async (resolve) => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error: any) {
        console.error(`Database error in ${context}:`, error.message);
        
        // Always return fallback instead of crashing
        resolve(fallback);
      }
    });
  }

  static wrapServiceCall<T>(
    serviceCall: () => Promise<T>,
    fallback: T,
    serviceName: string
  ): Promise<T> {
    return new Promise(async (resolve) => {
      try {
        const result = await serviceCall();
        resolve(result);
      } catch (error: any) {
        console.error(`Service error in ${serviceName}:`, error.message);
        resolve(fallback);
      }
    });
  }
}

// Global error handler for unhandled promise rejections
export function setupProductionErrorHandling() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    // Don't exit process - log and continue
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit process - log and continue
  });
}