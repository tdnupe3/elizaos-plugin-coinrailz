/**
 * Advanced Production Monitoring & Alerting
 * Optional enhancement that degrades gracefully
 */

interface MetricData {
  timestamp: number;
  value: number;
  type: 'request' | 'error' | 'memory' | 'response_time';
}

interface AlertThreshold {
  metric: string;
  threshold: number;
  window: number; // Time window in ms
  severity: 'warning' | 'critical';
}

export class AdvancedMonitoring {
  private metrics: MetricData[] = [];
  private alerts: AlertThreshold[] = [
    { metric: 'error_rate', threshold: 0.05, window: 300000, severity: 'warning' }, // 5% error rate over 5 minutes
    { metric: 'memory_usage', threshold: 400, window: 60000, severity: 'critical' }, // 400MB memory over 1 minute
    { metric: 'response_time', threshold: 1000, window: 300000, severity: 'warning' }, // 1s response time over 5 minutes
  ];
  private lastAlert: { [key: string]: number } = {};

  recordMetric(type: MetricData['type'], value: number) {
    try {
      this.metrics.push({
        timestamp: Date.now(),
        value,
        type
      });

      // Keep only last hour of metrics
      const oneHourAgo = Date.now() - 3600000;
      this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

      // Check alert thresholds
      this.checkAlerts();
    } catch (error) {
      // Graceful degradation - monitoring failures don't affect platform
      console.log('Monitoring error (non-critical):', error);
    }
  }

  private checkAlerts() {
    const now = Date.now();

    for (const alert of this.alerts) {
      const windowStart = now - alert.window;
      const windowMetrics = this.metrics.filter(m => m.timestamp > windowStart);

      let alertValue = 0;

      if (alert.metric === 'error_rate') {
        const totalRequests = windowMetrics.filter(m => m.type === 'request').length;
        const errorRequests = windowMetrics.filter(m => m.type === 'error').length;
        alertValue = totalRequests > 0 ? errorRequests / totalRequests : 0;
      } else if (alert.metric === 'memory_usage') {
        const memoryMetrics = windowMetrics.filter(m => m.type === 'memory');
        alertValue = memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1].value : 0;
      } else if (alert.metric === 'response_time') {
        const responseMetrics = windowMetrics.filter(m => m.type === 'response_time');
        alertValue = responseMetrics.length > 0 ? 
          responseMetrics.reduce((sum, m) => sum + m.value, 0) / responseMetrics.length : 0;
      }

      // Trigger alert if threshold exceeded and not recently alerted
      if (alertValue > alert.threshold) {
        const lastAlertTime = this.lastAlert[alert.metric] || 0;
        if (now - lastAlertTime > 600000) { // 10 minute cooldown between alerts
          this.triggerAlert(alert.metric, alertValue, alert.threshold, alert.severity);
          this.lastAlert[alert.metric] = now;
        }
      }
    }
  }

  private triggerAlert(metric: string, currentValue: number, threshold: number, severity: string) {
    const alertMessage = `[${severity.toUpperCase()}] ${metric}: ${currentValue.toFixed(2)} exceeds threshold ${threshold}`;
    
    if (severity === 'critical') {
      console.error('🚨 CRITICAL ALERT:', alertMessage);
    } else {
      console.warn('⚠️  WARNING ALERT:', alertMessage);
    }

    // Future: Could integrate with external alerting services (PagerDuty, Slack, etc.)
  }

  getHealthSummary() {
    const now = Date.now();
    const last15Min = now - 900000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > last15Min);

    const requests = recentMetrics.filter(m => m.type === 'request').length;
    const errors = recentMetrics.filter(m => m.type === 'error').length;
    const errorRate = requests > 0 ? (errors / requests * 100).toFixed(2) : '0.00';
    
    const responseTimes = recentMetrics.filter(m => m.type === 'response_time');
    const avgResponseTime = responseTimes.length > 0 ? 
      (responseTimes.reduce((sum, m) => sum + m.value, 0) / responseTimes.length).toFixed(2) : '0';

    const memoryMetrics = recentMetrics.filter(m => m.type === 'memory');
    const currentMemory = memoryMetrics.length > 0 ? 
      memoryMetrics[memoryMetrics.length - 1].value.toFixed(1) : '0';

    return {
      requests_15min: requests,
      error_rate_percent: errorRate,
      avg_response_ms: avgResponseTime,
      memory_mb: currentMemory,
      status: errors / requests < 0.05 && parseInt(avgResponseTime) < 500 ? 'healthy' : 'degraded'
    };
  }

  // Graceful cleanup
  cleanup() {
    this.metrics = [];
    this.lastAlert = {};
  }
}

export const monitoring = new AdvancedMonitoring();