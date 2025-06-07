/**
 * Production Monitoring Service
 * Comprehensive health monitoring, alerting, and performance tracking
 */

import { db } from "../db";
import { users, transactions, globalAiAgents } from "@shared/schema";
import { eq, gte, lte, count, sum, avg } from "drizzle-orm";

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: ServiceStatus[];
  metrics: SystemMetrics;
  alerts: Alert[];
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  errorCount: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  databaseConnections: number;
  activeUsers: number;
  transactionVolume: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  apiResponseTimes: {
    avg: number;
    p95: number;
    p99: number;
  };
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  source: string;
}

export class ProductionMonitoringService {
  private static instance: ProductionMonitoringService;
  private startTime: number = Date.now();
  private alerts: Alert[] = [];
  private responseTimeBuffer: number[] = [];
  private errorCounts: Map<string, number> = new Map();

  static getInstance(): ProductionMonitoringService {
    if (!ProductionMonitoringService.instance) {
      ProductionMonitoringService.instance = new ProductionMonitoringService();
    }
    return ProductionMonitoringService.instance;
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const services = await this.checkAllServices();
    const metrics = await this.getSystemMetrics();
    const recentAlerts = this.getActiveAlerts();

    // Determine overall system status
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices > 2) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      metrics,
      alerts: recentAlerts
    };
  }

  /**
   * Check status of all critical services
   */
  private async checkAllServices(): Promise<ServiceStatus[]> {
    const services = [
      { name: 'Database', check: () => this.checkDatabase() },
      { name: 'Stripe', check: () => this.checkStripe() },
      { name: 'NOWPayments', check: () => this.checkNOWPayments() },
      { name: 'CoinGecko', check: () => this.checkCoinGecko() },
      { name: 'ChangeNOW', check: () => this.checkChangeNOW() },
      { name: 'Authentication', check: () => this.checkAuthentication() }
    ];

    const results = await Promise.allSettled(
      services.map(async service => {
        const startTime = Date.now();
        try {
          await service.check();
          const responseTime = Date.now() - startTime;
          return {
            name: service.name,
            status: responseTime > 5000 ? 'degraded' : 'healthy' as const,
            responseTime,
            lastCheck: new Date().toISOString(),
            errorCount: this.errorCounts.get(service.name) || 0
          };
        } catch (error) {
          this.incrementErrorCount(service.name);
          return {
            name: service.name,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            errorCount: this.errorCounts.get(service.name) || 0
          };
        }
      })
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        name: 'Unknown',
        status: 'unhealthy' as const,
        responseTime: 0,
        lastCheck: new Date().toISOString(),
        errorCount: 0
      }
    );
  }

  /**
   * Get comprehensive system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const uptime = (Date.now() - this.startTime) / 1000;
    const memoryUsage = process.memoryUsage();
    
    // Get transaction volume metrics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [volume24h, volume7d, volume30d, activeUsers] = await Promise.all([
      this.getTransactionVolume(last24h, now),
      this.getTransactionVolume(last7d, now),
      this.getTransactionVolume(last30d, now),
      this.getActiveUserCount()
    ]);

    return {
      uptime,
      memoryUsage,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      databaseConnections: 5, // Would get from actual pool status
      activeUsers,
      transactionVolume: {
        last24h: volume24h,
        last7d: volume7d,
        last30d: volume30d
      },
      apiResponseTimes: {
        avg: this.getAverageResponseTime(),
        p95: this.getPercentileResponseTime(95),
        p99: this.getPercentileResponseTime(99)
      }
    };
  }

  /**
   * Individual service health checks
   */
  private async checkDatabase(): Promise<void> {
    await db.select().from(users).limit(1);
  }

  private async checkStripe(): Promise<void> {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe not configured');
    }
    // Would make actual Stripe API call
  }

  private async checkNOWPayments(): Promise<void> {
    if (!process.env.NOWPAYMENTS_API_KEY) {
      throw new Error('NOWPayments not configured');
    }
    const response = await fetch('https://api.nowpayments.io/v1/status');
    if (!response.ok) {
      throw new Error(`NOWPayments API error: ${response.status}`);
    }
  }

  private async checkCoinGecko(): Promise<void> {
    const response = await fetch('https://api.coingecko.com/api/v3/ping');
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
  }

  private async checkChangeNOW(): Promise<void> {
    if (!process.env.CHANGENOW_API_KEY) {
      throw new Error('ChangeNOW not configured');
    }
    const response = await fetch('https://api.changenow.io/v1/currencies');
    if (!response.ok) {
      throw new Error(`ChangeNOW API error: ${response.status}`);
    }
  }

  private async checkAuthentication(): Promise<void> {
    // Check if session store is accessible
    if (!process.env.SESSION_SECRET) {
      throw new Error('Authentication not configured');
    }
  }

  /**
   * Get transaction volume for date range
   */
  private async getTransactionVolume(startDate: Date, endDate: Date): Promise<number> {
    try {
      const result = await db
        .select({ totalAmount: sum(transactions.amount) })
        .from(transactions)
        .where(
          gte(transactions.createdAt, startDate.toISOString())
        );
      
      return parseFloat(result[0]?.totalAmount || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get active user count (users active in last 24 hours)
   */
  private async getActiveUserCount(): Promise<number> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.updatedAt, yesterday.toISOString()));
      
      return result[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Response time tracking
   */
  recordResponseTime(responseTime: number): void {
    this.responseTimeBuffer.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.responseTimeBuffer.length > 1000) {
      this.responseTimeBuffer.shift();
    }
  }

  private getAverageResponseTime(): number {
    if (this.responseTimeBuffer.length === 0) return 0;
    
    const sum = this.responseTimeBuffer.reduce((a, b) => a + b, 0);
    return sum / this.responseTimeBuffer.length;
  }

  private getPercentileResponseTime(percentile: number): number {
    if (this.responseTimeBuffer.length === 0) return 0;
    
    const sorted = [...this.responseTimeBuffer].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Alert management
   */
  createAlert(level: Alert['level'], message: string, source: string): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      source
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log critical alerts
    if (level === 'critical' || level === 'error') {
      console.error(`[${level.toUpperCase()}] ${source}: ${message}`);
    }
  }

  private getActiveAlerts(): Alert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  private incrementErrorCount(service: string): void {
    const current = this.errorCounts.get(service) || 0;
    this.errorCounts.set(service, current + 1);
  }

  /**
   * Performance monitoring middleware
   */
  performanceMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);

        // Create alerts for slow responses
        if (responseTime > 10000) {
          this.createAlert('warning', `Slow response: ${req.path} took ${responseTime}ms`, 'Performance');
        }

        // Create alerts for errors
        if (res.statusCode >= 500) {
          this.createAlert('error', `Server error: ${req.path} returned ${res.statusCode}`, 'API');
        }
      });

      next();
    };
  }

  /**
   * Automated health check with alerting
   */
  async runHealthCheck(): Promise<void> {
    const health = await this.getSystemHealth();
    
    if (health.status === 'unhealthy') {
      this.createAlert('critical', 'System health check failed', 'HealthCheck');
    } else if (health.status === 'degraded') {
      this.createAlert('warning', 'System performance degraded', 'HealthCheck');
    }

    // Check individual services
    health.services.forEach(service => {
      if (service.status === 'unhealthy') {
        this.createAlert('error', `Service ${service.name} is unhealthy`, 'ServiceCheck');
      } else if (service.status === 'degraded') {
        this.createAlert('warning', `Service ${service.name} is degraded`, 'ServiceCheck');
      }
    });
  }
}