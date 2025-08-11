import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";

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

// In-memory storage for analytics data (in production, use a proper database)
const performanceMetrics: PerformanceMetric[] = [];
const errorReports: ErrorReport[] = [];
const maxMetrics = 10000;
const maxErrors = 5000;

export function setupAnalyticsRoutes(app: Express) {
  // Store performance metrics
  app.post("/api/analytics/metrics", async (req, res) => {
    try {
      const metric: PerformanceMetric = req.body;
      
      // Validate metric data
      if (!metric.name || typeof metric.value !== 'number') {
        return res.status(400).json({ error: "Invalid metric data" });
      }

      // Add timestamp if not provided
      if (!metric.timestamp) {
        metric.timestamp = Date.now();
      }

      performanceMetrics.push(metric);
      
      // Trim old metrics
      if (performanceMetrics.length > maxMetrics) {
        performanceMetrics.splice(0, performanceMetrics.length - maxMetrics);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error storing performance metric:", error);
      res.status(500).json({ error: "Failed to store metric" });
    }
  });

  // Store error reports
  app.post("/api/analytics/errors", async (req, res) => {
    try {
      const error: ErrorReport = req.body;
      
      // Validate error data
      if (!error.message || !error.component) {
        return res.status(400).json({ error: "Invalid error data" });
      }

      // Add timestamp if not provided
      if (!error.timestamp) {
        error.timestamp = Date.now();
      }

      errorReports.push(error);
      
      // Trim old errors
      if (errorReports.length > maxErrors) {
        errorReports.splice(0, errorReports.length - maxErrors);
      }

      // Log critical errors
      if (error.component === 'payment' || error.component === 'wallet') {
        console.error("CRITICAL ERROR:", error);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error storing error report:", error);
      res.status(500).json({ error: "Failed to store error" });
    }
  });

  // Get analytics dashboard data (protected route)
  app.get("/api/analytics/dashboard", isAuthenticated, async (req, res) => {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      // Filter recent data
      const recentMetrics = performanceMetrics.filter(m => m.timestamp > oneDayAgo);
      const recentErrors = errorReports.filter(e => e.timestamp > oneDayAgo);
      
      // Calculate analytics
      const pageLoadMetrics = recentMetrics.filter(m => m.name === 'page_load');
      const apiCallMetrics = recentMetrics.filter(m => m.name === 'api_call');
      const walletMetrics = recentMetrics.filter(m => m.name === 'wallet_operation');
      const revenueMetrics = recentMetrics.filter(m => m.name === 'revenue_event');
      
      const analytics = {
        performance: {
          avgPageLoad: calculateAverage(pageLoadMetrics.map(m => m.value)),
          avgAPIResponse: calculateAverage(apiCallMetrics.map(m => m.value)),
          totalPageViews: pageLoadMetrics.length,
          totalAPIRequests: apiCallMetrics.length
        },
        errors: {
          totalErrors: recentErrors.length,
          criticalErrors: recentErrors.filter(e => 
            e.component === 'payment' || e.component === 'wallet'
          ).length,
          errorsByComponent: getErrorsByComponent(recentErrors),
          recentErrors: recentErrors.slice(-10)
        },
        business: {
          walletOperations: walletMetrics.length,
          successfulWalletOps: walletMetrics.filter(m => 
            m.metadata?.success === true
          ).length,
          revenueEvents: revenueMetrics.length,
          totalRevenue: revenueMetrics.reduce((sum, m) => sum + (m.value || 0), 0)
        },
        realTime: {
          activeUsers: getActiveUsers(recentMetrics, oneHourAgo),
          currentLoad: getCurrentLoad(recentMetrics, oneHourAgo)
        }
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error generating analytics dashboard:", error);
      res.status(500).json({ error: "Failed to generate analytics" });
    }
  });

  // Get performance trends
  app.get("/api/analytics/trends", isAuthenticated, async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || '24h';
      const now = Date.now();
      
      let cutoff: number;
      switch (timeframe) {
        case '1h':
          cutoff = now - (60 * 60 * 1000);
          break;
        case '24h':
          cutoff = now - (24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoff = now - (7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = now - (24 * 60 * 60 * 1000);
      }
      
      const relevantMetrics = performanceMetrics.filter(m => m.timestamp > cutoff);
      
      // Group metrics by hour for trending
      const hourlyData = groupMetricsByHour(relevantMetrics, cutoff, now);
      
      res.json({
        timeframe,
        trends: hourlyData
      });
    } catch (error) {
      console.error("Error generating trends:", error);
      res.status(500).json({ error: "Failed to generate trends" });
    }
  });

  // Health check endpoint
  app.get("/api/analytics/health", async (req, res) => {
    try {
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      const recentErrors = errorReports.filter(e => e.timestamp > fiveMinutesAgo);
      const criticalErrors = recentErrors.filter(e => 
        e.component === 'payment' || e.component === 'wallet'
      );
      
      const health = {
        status: criticalErrors.length === 0 ? 'healthy' : 'degraded',
        timestamp: now,
        metrics: {
          totalMetrics: performanceMetrics.length,
          totalErrors: errorReports.length,
          recentErrors: recentErrors.length,
          criticalErrors: criticalErrors.length
        }
      };
      
      res.json(health);
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ error: "Health check failed" });
    }
  });
}

// Helper functions
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function getErrorsByComponent(errors: ErrorReport[]): Record<string, number> {
  const byComponent: Record<string, number> = {};
  errors.forEach(error => {
    byComponent[error.component] = (byComponent[error.component] || 0) + 1;
  });
  return byComponent;
}

function getActiveUsers(metrics: PerformanceMetric[], since: number): number {
  const uniqueUsers = new Set();
  metrics
    .filter(m => m.timestamp > since && m.metadata?.userId)
    .forEach(m => uniqueUsers.add(m.metadata?.userId));
  return uniqueUsers.size;
}

function getCurrentLoad(metrics: PerformanceMetric[], since: number): number {
  const recentMetrics = metrics.filter(m => m.timestamp > since);
  return recentMetrics.length;
}

function groupMetricsByHour(metrics: PerformanceMetric[], start: number, end: number): any[] {
  const hourlyData: any[] = [];
  const oneHour = 60 * 60 * 1000;
  
  for (let time = start; time < end; time += oneHour) {
    const hourEnd = time + oneHour;
    const hourMetrics = metrics.filter(m => m.timestamp >= time && m.timestamp < hourEnd);
    
    const pageLoads = hourMetrics.filter(m => m.name === 'page_load');
    const apiCalls = hourMetrics.filter(m => m.name === 'api_call');
    
    hourlyData.push({
      timestamp: time,
      pageViews: pageLoads.length,
      apiRequests: apiCalls.length,
      avgPageLoad: calculateAverage(pageLoads.map(m => m.value)),
      avgAPIResponse: calculateAverage(apiCalls.map(m => m.value))
    });
  }
  
  return hourlyData;
}