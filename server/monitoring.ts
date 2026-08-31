/**
 * Production Monitoring and Error Tracking System
 * Provides comprehensive monitoring for production deployment
 */
import * as Sentry from '@sentry/node';
import winston from 'winston';

class ProductionMonitor {
  private logger: winston.Logger;
  private metrics = {
    requests: 0,
    errors: 0,
    responseTime: [] as number[],
    activeConnections: 0,
    memoryUsage: 0,
    lastHealthCheck: Date.now()
  };

  constructor() {
    // Initialize Sentry for error tracking
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [
          Sentry.httpIntegration(),
          Sentry.expressIntegration(),
        ],
      });
      console.log('✅ Sentry error tracking initialized');
    }

    // Initialize Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'coin-railz' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });

    // Add console logging for development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }

    console.log('✅ Production monitoring system initialized');
  }

  // Request tracking middleware
  trackRequest() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      this.metrics.requests++;
      this.metrics.activeConnections++;

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responseTime.push(responseTime);
        this.metrics.activeConnections--;

        // Keep only last 1000 response times for memory efficiency
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-500);
        }

        // Log slow requests
        if (responseTime > 1000) {
          this.logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            responseTime,
            statusCode: res.statusCode
          });
        }

        // Log errors
        if (res.statusCode >= 400) {
          this.metrics.errors++;
          this.logger.error('HTTP error response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime
          });
        }
      });

      next();
    };
  }

  // Error handling middleware
  errorHandler() {
    return (error: Error, req: any, res: any, next: any) => {
      this.metrics.errors++;
      
      // Log error details
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Send to Sentry if configured
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error);
      }

      // Return appropriate error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown'
        });
      }

      next();
    };
  }

  // Business metrics tracking
  trackTransaction(type: string, amount: number, success: boolean) {
    this.logger.info('Transaction processed', {
      type,
      amount,
      success,
      timestamp: new Date().toISOString()
    });

    if (process.env.SENTRY_DSN) {
      Sentry.addBreadcrumb({
        message: 'Transaction processed',
        category: 'business',
        data: { type, amount, success }
      });
    }
  }

  trackUserAction(userId: string, action: string, metadata?: any) {
    this.logger.info('User action', {
      userId,
      action,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  trackSecurityEvent(type: 'rate_limit' | 'auth_failure' | 'suspicious_activity', details: any) {
    this.logger.warn('Security event', {
      type,
      details,
      timestamp: new Date().toISOString()
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(`Security event: ${type}`, 'warning');
    }
  }

  // Health metrics
  updateMemoryUsage() {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = usage.heapUsed / 1024 / 1024; // MB
    this.metrics.lastHealthCheck = Date.now();
  }

  getHealthMetrics() {
    this.updateMemoryUsage();
    
    const avgResponseTime = this.metrics.responseTime.length > 0 
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
      : 0;

    return {
      uptime: process.uptime(),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      activeConnections: this.metrics.activeConnections,
      memoryUsage: Math.round(this.metrics.memoryUsage),
      lastHealthCheck: new Date(this.metrics.lastHealthCheck).toISOString(),
      status: this.getOverallHealth()
    };
  }

  private getOverallHealth(): 'healthy' | 'warning' | 'critical' {
    const metrics = this.getHealthMetrics();
    
    if (metrics.memoryUsage > 500 || metrics.errorRate > 10) {
      return 'critical';
    }
    
    if (metrics.memoryUsage > 200 || metrics.errorRate > 5 || metrics.averageResponseTime > 1000) {
      return 'warning';
    }
    
    return 'healthy';
  }

  // Alert system for critical issues
  checkAlerts() {
    const health = this.getOverallHealth();
    
    if (health === 'critical') {
      this.logger.error('CRITICAL: System health degraded', this.getHealthMetrics());
      
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage('Critical system health alert', 'fatal');
      }
    }
  }

  // Graceful shutdown
  async shutdown() {
    this.logger.info('Production monitor shutting down');
    await Sentry.close(2000);
  }
}

export const productionMonitor = new ProductionMonitor();