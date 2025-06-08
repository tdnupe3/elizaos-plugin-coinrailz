/**
 * Production-Grade Monitoring and Analytics Service
 * Comprehensive platform health monitoring and business metrics tracking
 */

import { db } from '../db';
import { 
  users, 
  transactions, 
  agentServiceOrders, 
  globalAIAgents,
  type User,
  type Transaction
} from '@shared/schema';
import { eq, gte, count, sum, desc, and } from 'drizzle-orm';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  databaseStatus: 'connected' | 'disconnected' | 'error';
  apiResponseTimes: { [endpoint: string]: number };
  errorRate: number;
  activeConnections: number;
  timestamp: string;
}

interface BusinessMetrics {
  totalTransactions: number;
  totalRevenue: string;
  dailyActiveUsers: number;
  agentRegistrations: number;
  averageTransactionValue: string;
  topPerformingAgents: Array<{ id: string; volume: string; orders: number }>;
  revenueByStream: {
    aiAgents: string;
    p2pTransfers: string;
    cryptoSwaps: string;
    platformFees: string;
  };
  timestamp: string;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  errorCount: number;
}

interface AlertData {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  metadata?: any;
}

class ProductionMonitoringService {
  private startTime: number = Date.now();
  private apiResponseTimes: Map<string, number[]> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private alerts: AlertData[] = [];
  private serviceStatuses: Map<string, ServiceStatus> = new Map();

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    // Test database connectivity
    let databaseStatus: 'connected' | 'disconnected' | 'error' = 'connected';
    try {
      await db.select({ count: count() }).from(users).limit(1);
    } catch (error) {
      databaseStatus = 'error';
      this.recordAlert('error', 'Database connectivity test failed', { error: String(error) });
    }

    // Calculate error rate
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalRequests = Array.from(this.apiResponseTimes.values())
      .reduce((sum, times) => sum + times.length, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Get average API response times
    const apiResponseTimes: { [endpoint: string]: number } = {};
    this.apiResponseTimes.forEach((times, endpoint) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      apiResponseTimes[endpoint] = Math.round(avgTime);
    });

    // Determine overall system status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (databaseStatus === 'error' || errorRate > 10) {
      status = 'unhealthy';
    } else if (errorRate > 5 || Object.values(apiResponseTimes).some(time => time > 2000)) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      memoryUsage,
      databaseStatus,
      apiResponseTimes,
      errorRate: Math.round(errorRate * 100) / 100,
      activeConnections: 0, // Would be populated from WebSocket service
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get comprehensive business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Get transaction metrics
      const [transactionMetrics] = await db
        .select({
          totalCount: count(),
          totalAmount: sum(transactions.amount),
        })
        .from(transactions);

      // Get daily active users (users with transactions today)
      const [dailyActiveUsers] = await db
        .select({ count: count() })
        .from(transactions)
        .where(gte(transactions.createdAt, today));

      // Get agent registrations this month
      const [agentRegistrations] = await db
        .select({ count: count() })
        .from(globalAIAgents)
        .where(gte(globalAIAgents.registeredAt, thisMonth));

      // Get top performing agents by order volume
      const topAgents = await db
        .select({
          agentId: agentServiceOrders.sellerAgentId,
          totalOrders: count(),
          totalVolume: sum(agentServiceOrders.totalAmount)
        })
        .from(agentServiceOrders)
        .where(gte(agentServiceOrders.createdAt, thisMonth))
        .groupBy(agentServiceOrders.sellerAgentId)
        .orderBy(desc(count()))
        .limit(5);

      // Calculate revenue streams
      const totalRevenue = Number(transactionMetrics.totalAmount || 0);
      const averageTransactionValue = transactionMetrics.totalCount > 0 
        ? totalRevenue / transactionMetrics.totalCount 
        : 0;

      // Estimate revenue distribution (would be more precise with actual categorization)
      const aiAgentsRevenue = totalRevenue * 0.4; // Estimated 40% from AI services
      const p2pRevenue = totalRevenue * 0.35;     // Estimated 35% from P2P transfers
      const cryptoRevenue = totalRevenue * 0.15;  // Estimated 15% from crypto swaps
      const platformRevenue = totalRevenue * 0.1; // Estimated 10% platform fees

      return {
        totalTransactions: transactionMetrics.totalCount || 0,
        totalRevenue: totalRevenue.toFixed(2),
        dailyActiveUsers: dailyActiveUsers.count || 0,
        agentRegistrations: agentRegistrations.count || 0,
        averageTransactionValue: averageTransactionValue.toFixed(2),
        topPerformingAgents: topAgents.map(agent => ({
          id: agent.agentId,
          volume: (Number(agent.totalVolume) || 0).toFixed(2),
          orders: agent.totalOrders || 0
        })),
        revenueByStream: {
          aiAgents: aiAgentsRevenue.toFixed(2),
          p2pTransfers: p2pRevenue.toFixed(2),
          cryptoSwaps: cryptoRevenue.toFixed(2),
          platformFees: platformRevenue.toFixed(2)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.recordAlert('error', 'Failed to gather business metrics', { error: String(error) });
      
      // Return safe defaults
      return {
        totalTransactions: 0,
        totalRevenue: '0.00',
        dailyActiveUsers: 0,
        agentRegistrations: 0,
        averageTransactionValue: '0.00',
        topPerformingAgents: [],
        revenueByStream: {
          aiAgents: '0.00',
          p2pTransfers: '0.00',
          cryptoSwaps: '0.00',
          platformFees: '0.00'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Record API response time for monitoring
   */
  recordApiResponseTime(endpoint: string, responseTime: number): void {
    if (!this.apiResponseTimes.has(endpoint)) {
      this.apiResponseTimes.set(endpoint, []);
    }
    
    const times = this.apiResponseTimes.get(endpoint)!;
    times.push(responseTime);
    
    // Keep only last 100 response times
    if (times.length > 100) {
      times.shift();
    }

    // Alert on slow responses
    if (responseTime > 5000) {
      this.recordAlert('warning', `Slow API response: ${endpoint}`, { 
        responseTime, 
        endpoint 
      });
    }
  }

  /**
   * Record error occurrence
   */
  recordError(endpoint: string, error: string): void {
    const current = this.errorCounts.get(endpoint) || 0;
    this.errorCounts.set(endpoint, current + 1);
    
    this.recordAlert('error', `API error in ${endpoint}`, { 
      error, 
      count: current + 1 
    });
  }

  /**
   * Record system alert
   */
  recordAlert(level: AlertData['level'], message: string, metadata?: any): void {
    this.alerts.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata
    });

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    // Log critical alerts
    if (level === 'critical' || level === 'error') {
      console.error(`[MONITOR] ${level.toUpperCase()}: ${message}`, metadata || '');
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): AlertData[] {
    return this.alerts
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get service status overview
   */
  getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  /**
   * Update service status
   */
  updateServiceStatus(name: string, status: ServiceStatus['status'], responseTime: number): void {
    const existing = this.serviceStatuses.get(name);
    const errorCount = status === 'healthy' ? 0 : (existing?.errorCount || 0) + 1;

    this.serviceStatuses.set(name, {
      name,
      status,
      responseTime,
      lastCheck: new Date().toISOString(),
      errorCount
    });
  }

  /**
   * Express middleware for automatic monitoring
   */
  createMonitoringMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const endpoint = `${req.method} ${req.path}`;

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const responseTime = Date.now() - startTime;
        
        // Record metrics
        productionMonitoringService.recordApiResponseTime(endpoint, responseTime);
        
        // Record errors for 4xx/5xx responses
        if (res.statusCode >= 400) {
          productionMonitoringService.recordError(endpoint, `HTTP ${res.statusCode}`);
        }
        
        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData() {
    const [systemHealth, businessMetrics] = await Promise.all([
      this.getSystemHealth(),
      this.getBusinessMetrics()
    ]);

    return {
      systemHealth,
      businessMetrics,
      recentAlerts: this.getRecentAlerts(20),
      serviceStatuses: this.getServiceStatuses(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<{ status: string; checks: any }> {
    const checks = {
      database: 'unknown',
      memory: 'unknown',
      responseTime: 'unknown'
    };

    try {
      // Database check
      await db.select({ count: count() }).from(users).limit(1);
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = memoryUsagePercent < 80 ? 'healthy' : 'degraded';

    // Response time check
    const avgResponseTime = Array.from(this.apiResponseTimes.values())
      .flat()
      .reduce((sum, time, _, arr) => sum + time / arr.length, 0);
    checks.responseTime = avgResponseTime < 1000 ? 'healthy' : 'degraded';

    const overallStatus = Object.values(checks).includes('unhealthy') 
      ? 'unhealthy' 
      : Object.values(checks).includes('degraded') 
        ? 'degraded' 
        : 'healthy';

    return {
      status: overallStatus,
      checks
    };
  }
}

// Export singleton instance
export const productionMonitoringService = new ProductionMonitoringService();

// Export types for use in routes
export type { SystemHealth, BusinessMetrics, ServiceStatus, AlertData };