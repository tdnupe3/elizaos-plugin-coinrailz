// Performance monitoring and error tracking for production platform
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  component: string;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private errorReports: ErrorReport[] = [];
  private maxMetrics = 1000;
  private maxErrors = 500;

  // Track page load performance
  trackPageLoad(pageName: string) {
    if (typeof window !== 'undefined' && window.performance) {
      const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
      this.addMetric('page_load', loadTime, { page: pageName });
    }
  }

  // Track API response times
  trackAPICall(endpoint: string, duration: number, status: number) {
    this.addMetric('api_call', duration, { 
      endpoint, 
      status,
      success: status >= 200 && status < 300 
    });
  }

  // Track user interactions
  trackUserAction(action: string, component: string, metadata?: Record<string, any>) {
    this.addMetric('user_action', Date.now(), { 
      action, 
      component, 
      ...metadata 
    });
  }

  // Track wallet operations
  trackWalletOperation(operation: string, success: boolean, duration?: number) {
    this.addMetric('wallet_operation', duration || 0, { 
      operation, 
      success,
      timestamp: Date.now()
    });
  }

  // Track revenue operations
  trackRevenueEvent(event: string, amount?: number, currency?: string) {
    this.addMetric('revenue_event', amount || 0, { 
      event, 
      currency: currency || 'USD',
      timestamp: Date.now()
    });
  }

  // Error tracking
  trackError(error: Error, component: string, userId?: string) {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      component,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId
    };

    this.errorReports.push(errorReport);
    if (this.errorReports.length > this.maxErrors) {
      this.errorReports.shift();
    }

    // Send to server for logging
    this.sendErrorToServer(errorReport);
  }

  private addMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Send critical metrics to server
    if (this.isCriticalMetric(name)) {
      this.sendMetricToServer(metric);
    }
  }

  private isCriticalMetric(name: string): boolean {
    return ['api_call', 'wallet_operation', 'revenue_event'].includes(name);
  }

  private async sendMetricToServer(metric: PerformanceMetric) {
    try {
      await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      console.warn('Failed to send metric to server:', error);
    }
  }

  private async sendErrorToServer(error: ErrorReport) {
    try {
      await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (err) {
      console.warn('Failed to send error to server:', err);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    
    return {
      totalMetrics: recentMetrics.length,
      avgPageLoad: this.getAverageMetric(recentMetrics, 'page_load'),
      avgAPICall: this.getAverageMetric(recentMetrics, 'api_call'),
      errorCount: this.errorReports.filter(e => e.timestamp > oneHourAgo).length,
      userActions: recentMetrics.filter(m => m.name === 'user_action').length
    };
  }

  private getAverageMetric(metrics: PerformanceMetric[], name: string): number {
    const filtered = metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for performance tracking
export function usePerformanceTracking() {
  return {
    trackPageLoad: performanceMonitor.trackPageLoad.bind(performanceMonitor),
    trackUserAction: performanceMonitor.trackUserAction.bind(performanceMonitor),
    trackWalletOperation: performanceMonitor.trackWalletOperation.bind(performanceMonitor),
    trackRevenueEvent: performanceMonitor.trackRevenueEvent.bind(performanceMonitor),
    trackError: performanceMonitor.trackError.bind(performanceMonitor)
  };
}