
import { EventEmitter } from 'events';

interface MonitoringMetrics {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  databaseConnections: number;
  queueLength: number;
}

interface AlertThreshold {
  metric: keyof MonitoringMetrics;
  threshold: number;
  severity: 'warning' | 'critical';
}

class ProductionMonitoringService extends EventEmitter {
  private static instance: ProductionMonitoringService;
  private metrics: MonitoringMetrics[] = [];
  private alerts: Map<string, AlertThreshold> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.setupDefaultThresholds();
  }

  static getInstance(): ProductionMonitoringService {
    if (!ProductionMonitoringService.instance) {
      ProductionMonitoringService.instance = new ProductionMonitoringService();
    }
    return ProductionMonitoringService.instance;
  }

  private setupDefaultThresholds(): void {
    this.alerts.set('cpu-warning', { metric: 'cpuUsage', threshold: 70, severity: 'warning' });
    this.alerts.set('cpu-critical', { metric: 'cpuUsage', threshold: 90, severity: 'critical' });
    this.alerts.set('memory-warning', { metric: 'memoryUsage', threshold: 80, severity: 'warning' });
    this.alerts.set('memory-critical', { metric: 'memoryUsage', threshold: 95, severity: 'critical' });
    this.alerts.set('response-time-warning', { metric: 'responseTime', threshold: 2000, severity: 'warning' });
    this.alerts.set('response-time-critical', { metric: 'responseTime', threshold: 5000, severity: 'critical' });
    this.alerts.set('error-rate-warning', { metric: 'errorRate', threshold: 5, severity: 'warning' });
    this.alerts.set('error-rate-critical', { metric: 'errorRate', threshold: 10, severity: 'critical' });
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collect metrics every 30 seconds

    console.log('✅ Enhanced production monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoring = false;
      console.log('🛑 Production monitoring stopped');
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: MonitoringMetrics = {
        timestamp: Date.now(),
        cpuUsage: await this.getCpuUsage(),
        memoryUsage: this.getMemoryUsage(),
        responseTime: await this.getAverageResponseTime(),
        errorRate: this.getErrorRate(),
        activeConnections: this.getActiveConnections(),
        databaseConnections: await this.getDatabaseConnections(),
        queueLength: this.getQueueLength()
      };

      this.metrics.push(metrics);
      this.checkAlerts(metrics);
      this.cleanupOldMetrics();

      // Emit metrics for real-time dashboards
      this.emit('metrics', metrics);

    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation
    const usage = process.cpuUsage();
    return Math.random() * 100; // Placeholder - replace with actual CPU monitoring
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return (memUsage.heapUsed / memUsage.heapTotal) * 100;
  }

  private async getAverageResponseTime(): Promise<number> {
    // Return average response time from recent requests
    return Math.random() * 1000; // Placeholder
  }

  private getErrorRate(): number {
    // Calculate error rate percentage from recent requests
    return Math.random() * 10; // Placeholder
  }

  private getActiveConnections(): number {
    // Count active WebSocket and HTTP connections
    return Math.floor(Math.random() * 100); // Placeholder
  }

  private async getDatabaseConnections(): Promise<number> {
    // Monitor database connection pool
    return Math.floor(Math.random() * 20); // Placeholder
  }

  private getQueueLength(): number {
    // Monitor job queue length
    return Math.floor(Math.random() * 50); // Placeholder
  }

  private checkAlerts(metrics: MonitoringMetrics): void {
    this.alerts.forEach((alert, alertId) => {
      const value = metrics[alert.metric];
      if (typeof value === 'number' && value > alert.threshold) {
        this.emit('alert', {
          id: alertId,
          metric: alert.metric,
          value,
          threshold: alert.threshold,
          severity: alert.severity,
          timestamp: metrics.timestamp
        });
      }
    });
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  getRecentMetrics(minutes: number = 60): MonitoringMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical', details: any } {
    if (this.metrics.length === 0) {
      return { status: 'warning', details: { message: 'No metrics available' } };
    }

    const latest = this.metrics[this.metrics.length - 1];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    // Check critical thresholds
    if (latest.cpuUsage > 90 || latest.memoryUsage > 95 || latest.errorRate > 10) {
      status = 'critical';
    } else if (latest.cpuUsage > 70 || latest.memoryUsage > 80 || latest.responseTime > 2000) {
      status = 'warning';
    }

    return {
      status,
      details: {
        lastUpdate: latest.timestamp,
        cpuUsage: latest.cpuUsage,
        memoryUsage: latest.memoryUsage,
        responseTime: latest.responseTime,
        errorRate: latest.errorRate,
        activeConnections: latest.activeConnections
      }
    };
  }
}

export default ProductionMonitoringService;
