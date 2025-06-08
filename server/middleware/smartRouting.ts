/**
 * Smart Routing Middleware
 * Implements intelligent request routing and load balancing
 */

import type { Request, Response, NextFunction } from 'express';

interface RouteMetrics {
  responseTime: number[];
  errorRate: number;
  activeConnections: number;
  lastUpdate: number;
}

interface LoadBalancerConfig {
  maxConnections: number;
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
}

class SmartRouter {
  private metrics: Map<string, RouteMetrics> = new Map();
  private circuitBreakers: Map<string, boolean> = new Map();
  private readonly config: LoadBalancerConfig;
  private readonly isDevelopment: boolean;

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.config = {
      maxConnections: config.maxConnections || (this.isDevelopment ? 1000 : 100),
      healthCheckInterval: config.healthCheckInterval || 30000,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.5,
    };

    // Start health monitoring
    setInterval(() => this.performHealthChecks(), this.config.healthCheckInterval);
  }

  /**
   * Middleware for intelligent request routing
   */
  routingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const route = this.getRouteKey(req);
      const startTime = Date.now();

      // Skip complex routing in development
      if (this.isDevelopment) {
        return next();
      }

      // Check circuit breaker
      if (this.circuitBreakers.get(route)) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Route is experiencing issues, please try again later',
          retryAfter: 60
        });
      }

      // Initialize metrics if not exists
      if (!this.metrics.has(route)) {
        this.metrics.set(route, {
          responseTime: [],
          errorRate: 0,
          activeConnections: 0,
          lastUpdate: Date.now()
        });
      }

      const metrics = this.metrics.get(route)!;

      // Check connection limits
      if (metrics.activeConnections >= this.config.maxConnections) {
        return res.status(503).json({
          error: 'Service overloaded',
          message: 'Too many active connections, please try again later',
          retryAfter: 30
        });
      }

      // Increment active connections
      metrics.activeConnections++;

      // Override response end to capture metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        metrics.responseTime.push(responseTime);
        metrics.activeConnections--;

        // Keep only last 100 response times
        if (metrics.responseTime.length > 100) {
          metrics.responseTime = metrics.responseTime.slice(-100);
        }

        // Update error rate
        if (res.statusCode >= 400) {
          const errorCount = metrics.responseTime.length * metrics.errorRate + 1;
          metrics.errorRate = errorCount / (metrics.responseTime.length + 1);
        } else {
          const errorCount = metrics.responseTime.length * metrics.errorRate;
          metrics.errorRate = errorCount / (metrics.responseTime.length + 1);
        }

        metrics.lastUpdate = Date.now();

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Request distribution middleware for load balancing
   */
  loadBalancingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip in development
      if (this.isDevelopment) {
        return next();
      }

      const route = this.getRouteKey(req);
      const metrics = this.metrics.get(route);

      if (!metrics) {
        return next();
      }

      // Calculate average response time
      const avgResponseTime = metrics.responseTime.length > 0
        ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
        : 0;

      // Add performance headers
      res.set({
        'X-Route-Performance': avgResponseTime.toString(),
        'X-Active-Connections': metrics.activeConnections.toString(),
        'X-Error-Rate': (metrics.errorRate * 100).toFixed(2),
        'X-Load-Balancer': 'smart-router'
      });

      // Adaptive timeout based on performance
      const timeout = Math.max(5000, avgResponseTime * 3);
      req.setTimeout(timeout);

      next();
    };
  }

  /**
   * Get route key for metrics tracking
   */
  private getRouteKey(req: Request): string {
    const method = req.method;
    const path = req.route?.path || req.path;
    return `${method}:${path}`;
  }

  /**
   * Perform health checks and update circuit breakers
   */
  private performHealthChecks(): void {
    for (const [route, metrics] of this.metrics.entries()) {
      const avgResponseTime = metrics.responseTime.length > 0
        ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
        : 0;

      // Circuit breaker logic
      const isUnhealthy = metrics.errorRate > this.config.circuitBreakerThreshold ||
                         avgResponseTime > 10000 || // 10 second response time
                         metrics.activeConnections > this.config.maxConnections * 0.9;

      if (isUnhealthy && !this.circuitBreakers.get(route)) {
        console.warn(`Circuit breaker activated for route: ${route}`);
        this.circuitBreakers.set(route, true);

        // Auto-recovery after 2 minutes
        setTimeout(() => {
          this.circuitBreakers.set(route, false);
          console.log(`Circuit breaker reset for route: ${route}`);
        }, 120000);
      }
    }
  }

  /**
   * Get current routing metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [route, metrics] of this.metrics.entries()) {
      const avgResponseTime = metrics.responseTime.length > 0
        ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
        : 0;

      result[route] = {
        averageResponseTime: Math.round(avgResponseTime),
        errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
        activeConnections: metrics.activeConnections,
        isCircuitBreakerOpen: this.circuitBreakers.get(route) || false,
        totalRequests: metrics.responseTime.length,
        lastUpdate: new Date(metrics.lastUpdate).toISOString()
      };
    }

    return result;
  }

  /**
   * Reset metrics for a specific route
   */
  resetMetrics(route?: string): void {
    if (route) {
      this.metrics.delete(route);
      this.circuitBreakers.delete(route);
    } else {
      this.metrics.clear();
      this.circuitBreakers.clear();
    }
  }
}

// Export singleton instance
export const smartRouter = new SmartRouter();

// Export middleware functions
export const routingMiddleware = smartRouter.routingMiddleware();
export const loadBalancingMiddleware = smartRouter.loadBalancingMiddleware();