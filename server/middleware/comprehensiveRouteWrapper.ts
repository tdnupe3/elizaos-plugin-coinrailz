/**
 * Comprehensive Route Wrapper - Adds missing error handling to all routes
 * Fixes the 40+ missing try-catch blocks identified in production audit
 */
import { Request, Response, NextFunction, Router } from 'express';
import { ProductionStabilityWrapper } from './productionStabilityWrapper';

export class ComprehensiveRouteWrapper {
  static wrapRouter(router: Router): Router {
    const wrappedRouter = Router();
    
    // Copy all routes from original router and wrap them
    router.stack.forEach((layer: any) => {
      if (layer.route) {
        // Wrap individual route handlers
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods);
        
        methods.forEach(method => {
          const handlers = layer.route.stack.map((handler: any) => {
            return ProductionStabilityWrapper.wrapAsyncRoute(handler.handle);
          });
          
          (wrappedRouter as any)[method](path, ...handlers);
        });
      } else if (layer.name === 'router') {
        // Recursively wrap nested routers
        const nestedRouter = layer.handle;
        wrappedRouter.use(layer.regexp, this.wrapRouter(nestedRouter));
      }
    });
    
    return wrappedRouter;
  }

  static createSafeRoute(method: string, path: string, handler: Function) {
    return {
      method,
      path,
      handler: ProductionStabilityWrapper.wrapAsyncRoute(async (req: Request, res: Response, next: NextFunction) => {
        try {
          await handler(req, res, next);
        } catch (error: any) {
          console.error(`Route error ${method} ${path}:`, error.message);
          if (!res.headersSent) {
            res.status(500).json({ 
              error: 'Internal server error',
              path: path,
              method: method,
              timestamp: new Date().toISOString()
            });
          }
        }
      })
    };
  }

  static addGlobalErrorHandling(app: any) {
    // Catch all unhandled route errors
    app.use('*', (req: Request, res: Response, next: NextFunction) => {
      if (!res.headersSent) {
        res.status(404).json({
          error: 'Route not found',
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Global error handler
    app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', error.message);
      
      if (!res.headersSent) {
        res.status(error.status || 500).json({
          error: error.message || 'Internal server error',
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
}