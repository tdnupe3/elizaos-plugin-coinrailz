/**
 * Production Systems Integration
 * Simplified monitoring and caching for deployment readiness
 */
import { Express, Request, Response, NextFunction } from 'express';

class ProductionSystems {
  private metrics = {
    requests: 0,
    errors: 0,
    responseTime: [] as number[],
    memoryUsage: 0,
    startTime: Date.now()
  };

  private cache = new Map<string, { data: any; expires: number }>();

  initialize() {
    console.log('✅ Production systems initialized');
  }

  // Request tracking middleware
  trackRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.requests++;

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responseTime.push(responseTime);

        // Keep only last 100 response times for memory efficiency
        if (this.metrics.responseTime.length > 100) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-50);
        }

        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
      });

      next();
    };
  }

  // Error handling middleware
  errorHandler() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      this.metrics.errors++;
      
      console.error('Production error:', {
        error: error.message,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  // Caching methods
  async cacheGet(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  async cacheSet(key: string, value: any, expirationSeconds: number = 300): Promise<void> {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + (expirationSeconds * 1000)
    });
  }

  // Health metrics
  getHealthMetrics() {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024);
    
    const avgResponseTime = this.metrics.responseTime.length > 0 
      ? Math.round(this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length)
      : 0;

    return {
      uptime: Math.round((Date.now() - this.metrics.startTime) / 1000),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? Math.round((this.metrics.errors / this.metrics.requests) * 100) : 0,
      averageResponseTime: avgResponseTime,
      memoryUsage: this.metrics.memoryUsage,
      cacheEntries: this.cache.size,
      status: this.getHealthStatus()
    };
  }

  private getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const errorRate = this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0;
    
    if (this.metrics.memoryUsage > 500 || errorRate > 10) {
      return 'critical';
    }
    
    if (this.metrics.memoryUsage > 200 || errorRate > 5) {
      return 'warning';
    }
    
    return 'healthy';
  }

  // Business metrics tracking
  trackTransaction(type: string, amount: number, success: boolean) {
    console.log('Transaction tracked:', {
      type,
      amount,
      success,
      timestamp: new Date().toISOString()
    });
  }

  trackSecurityEvent(type: string, details: any) {
    console.warn('Security event:', {
      type,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Cleanup
  shutdown() {
    this.cache.clear();
    console.log('Production systems shutdown complete');
  }
}

export const productionSystems = new ProductionSystems();