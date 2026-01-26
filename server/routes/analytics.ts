import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { microserviceRequests } from "@shared/schema";
import { gte, desc, sql } from "drizzle-orm";
import { getUsageStats, detectSDK } from "../middleware/usageAnalyticsMiddleware";
import { getHitStats } from "../middleware/hitTracker";

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
  // Endpoint Hit Stats - tracks x402 and IoT endpoint visits
  app.get("/api/analytics/hits", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const endpointType = req.query.type as string;
      
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const stats = await getHitStats({ 
        endpointType, 
        since,
        limit: 20 
      });
      
      res.json({
        success: true,
        period: `Last ${days} days`,
        ...stats
      });
    } catch (error) {
      console.error("Error getting hit stats:", error);
      res.status(500).json({ error: "Failed to retrieve hit stats" });
    }
  });

  // Recent hits for monitoring
  app.get("/api/analytics/hits/recent", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      
      const hits = await db.execute(sql`
        SELECT endpoint, endpoint_type, resource_id, user_agent, 
               wallet_address, method, status_code, response_time_ms, created_at
        FROM endpoint_hits
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      
      res.json({
        success: true,
        count: hits.rows.length,
        hits: hits.rows
      });
    } catch (error) {
      console.error("Error getting recent hits:", error);
      res.status(500).json({ error: "Failed to retrieve recent hits" });
    }
  });

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

  // x402 Usage Analytics - Payment method breakdown and SDK detection
  app.get("/api/analytics/x402/usage", async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'day';
      const stats = await getUsageStats(timeframe);
      
      res.json({
        success: true,
        timeframe,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('❌ Error fetching x402 usage stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch usage statistics',
        message: error.message,
      });
    }
  });

  // x402 Recent Requests - Last N requests with SDK detection
  app.get("/api/analytics/x402/recent-requests", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      
      const requests = await db.query.microserviceRequests.findMany({
        limit,
        orderBy: [desc(microserviceRequests.createdAt)],
      });
      
      const enrichedRequests = requests.map(r => ({
        ...r,
        sdk: detectSDK(r.userAgent || undefined),
        timestamp: r.createdAt,
      }));
      
      res.json({
        success: true,
        count: enrichedRequests.length,
        requests: enrichedRequests,
      });
    } catch (error: any) {
      console.error('❌ Error fetching recent requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent requests',
        message: error.message,
      });
    }
  });

  // x402 Payment Breakdown - EIP-712 vs raw transaction hash comparison
  app.get("/api/analytics/x402/payment-breakdown", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      const requests = await db.query.microserviceRequests.findMany({
        where: gte(microserviceRequests.createdAt, startTime),
      });
      
      const breakdown = {
        total: requests.length,
        eip712: {
          count: requests.filter(r => r.paymentMethod === 'eip712').length,
          sdks: {} as Record<string, number>,
        },
        tx_hash: {
          count: requests.filter(r => r.paymentMethod === 'tx_hash').length,
          sdks: {} as Record<string, number>,
        },
        no_payment: {
          count: requests.filter(r => !r.paymentMethod).length,
          sdks: {} as Record<string, number>,
        },
      };
      
      requests.forEach(r => {
        const sdk = detectSDK(r.userAgent || undefined);
        
        if (r.paymentMethod === 'eip712') {
          breakdown.eip712.sdks[sdk] = (breakdown.eip712.sdks[sdk] || 0) + 1;
        } else if (r.paymentMethod === 'tx_hash') {
          breakdown.tx_hash.sdks[sdk] = (breakdown.tx_hash.sdks[sdk] || 0) + 1;
        } else {
          breakdown.no_payment.sdks[sdk] = (breakdown.no_payment.sdks[sdk] || 0) + 1;
        }
      });
      
      res.json({
        success: true,
        hours,
        breakdown,
        insights: {
          eip712Percentage: breakdown.total > 0 
            ? Math.round((breakdown.eip712.count / breakdown.total) * 100) 
            : 0,
          txHashPercentage: breakdown.total > 0 
            ? Math.round((breakdown.tx_hash.count / breakdown.total) * 100) 
            : 0,
          conversionRate: breakdown.total > 0 
            ? Math.round(((breakdown.eip712.count + breakdown.tx_hash.count) / breakdown.total) * 100) 
            : 0,
        },
      });
    } catch (error: any) {
      console.error('❌ Error fetching payment breakdown:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment breakdown',
        message: error.message,
      });
    }
  });

  // x402 Funnel Report - 402 challenges vs paid requests by user agent
  // PUBLIC endpoint for monitoring conversion funnel
  app.get("/api/analytics/x402-funnel", async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Get requests with new structured logging fields
      const requests = await db.query.microserviceRequests.findMany({
        where: (table, { gte }) => gte(table.createdAt, startTime),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });

      // Build funnel analysis
      const byUserAgent: Record<string, { 
        total: number; 
        challenges402: number; 
        paid: number; 
        paymentAttempts: number;
        paths: Record<string, number>;
        methods: { GET: number; POST: number; other: number };
        uniqueIPs: Set<string>;
        firstSeen: Date | null;
        lastSeen: Date | null;
      }> = {};

      requests.forEach(req => {
        const ua = req.userAgent || 'unknown';
        if (!byUserAgent[ua]) {
          byUserAgent[ua] = { 
            total: 0, 
            challenges402: 0, 
            paid: 0, 
            paymentAttempts: 0,
            paths: {},
            methods: { GET: 0, POST: 0, other: 0 },
            uniqueIPs: new Set(),
            firstSeen: null,
            lastSeen: null,
          };
        }
        
        const stats = byUserAgent[ua];
        stats.total++;
        
        if (req.paymentStatus === 'pending') stats.challenges402++;
        if (req.paymentStatus === 'completed') stats.paid++;
        if (req.paymentMethod || (req as any).paymentAttempted) stats.paymentAttempts++;
        
        // Track paths
        const path = (req as any).requestPath || req.serviceId || 'unknown';
        stats.paths[path] = (stats.paths[path] || 0) + 1;
        
        // Track methods
        const method = ((req as any).requestMethod || 'GET').toUpperCase();
        if (method === 'GET') stats.methods.GET++;
        else if (method === 'POST') stats.methods.POST++;
        else stats.methods.other++;
        
        // Track unique IPs
        const ip = (req as any).clientIp;
        if (ip) stats.uniqueIPs.add(ip);
        
        // Track time range
        if (req.createdAt) {
          if (!stats.firstSeen || req.createdAt < stats.firstSeen) stats.firstSeen = req.createdAt;
          if (!stats.lastSeen || req.createdAt > stats.lastSeen) stats.lastSeen = req.createdAt;
        }
      });

      // Convert to array and serialize Sets
      const funnelData = Object.entries(byUserAgent)
        .map(([ua, stats]) => ({
          userAgent: ua,
          sdk: detectSDK(ua),
          total: stats.total,
          challenges402: stats.challenges402,
          paid: stats.paid,
          paymentAttempts: stats.paymentAttempts,
          conversionRate: stats.total > 0 ? ((stats.paid / stats.total) * 100).toFixed(2) + '%' : '0%',
          topPaths: Object.entries(stats.paths)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([path, count]) => ({ path, count })),
          methods: stats.methods,
          uniqueIPs: stats.uniqueIPs.size,
          firstSeen: stats.firstSeen,
          lastSeen: stats.lastSeen,
        }))
        .sort((a, b) => b.total - a.total);

      // Summary stats
      const totalRequests = requests.length;
      const total402 = requests.filter(r => r.paymentStatus === 'pending').length;
      const totalPaid = requests.filter(r => r.paymentStatus === 'completed').length;
      const totalPaymentAttempts = requests.filter(r => r.paymentMethod || (r as any).paymentAttempted).length;
      
      res.json({
        timeframe: `${hours} hours`,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRequests,
          total402Challenges: total402,
          totalPaidRequests: totalPaid,
          totalPaymentAttempts,
          overallConversionRate: totalRequests > 0 ? ((totalPaid / totalRequests) * 100).toFixed(2) + '%' : '0%',
          uniqueUserAgents: Object.keys(byUserAgent).length,
        },
        byUserAgent: funnelData,
      });
    } catch (error: any) {
      console.error('Error fetching x402 funnel data:', error);
      res.status(500).json({
        error: 'Failed to fetch x402 funnel data',
        message: error.message,
      });
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