import { useEffect } from 'react';

interface PerformanceEntry {
  timestamp: number;
  type: 'pageLoad' | 'apiRequest' | 'userInteraction';
  duration?: number;
  details?: Record<string, any>;
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private apiEndpoint = '/api/analytics/performance';

  constructor() {
    this.initializePerformanceTracking();
  }

  private initializePerformanceTracking() {
    // Track page load performance
    if (typeof window !== 'undefined' && 'performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = performance.timing;
          const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
          
          this.recordEntry({
            timestamp: Date.now(),
            type: 'pageLoad',
            duration: pageLoadTime,
            details: {
              url: window.location.pathname,
              userAgent: navigator.userAgent,
              connectionType: (navigator as any).connection?.effectiveType || 'unknown'
            }
          });
        }, 100);
      });

      // Track route changes for SPA
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      const trackNavigation = () => {
        this.recordEntry({
          timestamp: Date.now(),
          type: 'pageLoad',
          details: {
            url: window.location.pathname,
            type: 'navigation'
          }
        });
      };

      history.pushState = function(...args: any[]) {
        originalPushState.apply(history, args);
        trackNavigation();
      };

      history.replaceState = function(...args: any[]) {
        originalReplaceState.apply(history, args);
        trackNavigation();
      };

      window.addEventListener('popstate', trackNavigation);
    }
  }

  public recordEntry(entry: PerformanceEntry) {
    this.entries.push(entry);
    
    // Send to backend if we have enough entries or periodically
    if (this.entries.length >= 10) {
      this.flushEntries();
    }
  }

  public recordAPIRequest(url: string, duration: number, success: boolean) {
    this.recordEntry({
      timestamp: Date.now(),
      type: 'apiRequest',
      duration,
      details: {
        url,
        success,
        method: 'GET' // Could be enhanced to track actual method
      }
    });
  }

  public recordUserInteraction(action: string, element?: string, duration?: number) {
    this.recordEntry({
      timestamp: Date.now(),
      type: 'userInteraction',
      duration,
      details: {
        action,
        element,
        url: window.location.pathname
      }
    });
  }

  private async flushEntries() {
    if (this.entries.length === 0) return;

    const entriesToSend = [...this.entries];
    this.entries = [];

    try {
      await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries: entriesToSend }),
      });
    } catch (error) {
      // Silently fail - don't break the app for analytics
      console.warn('Failed to send performance data:', error);
      // Re-add entries back if send failed
      this.entries.unshift(...entriesToSend);
    }
  }

  public startPeriodicFlush() {
    // Flush every 30 seconds
    setInterval(() => {
      this.flushEntries();
    }, 30000);
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for easy integration
export function usePerformanceTracking() {
  useEffect(() => {
    performanceMonitor.startPeriodicFlush();
    
    // Track component mount performance
    const startTime = performance.now();
    
    return () => {
      const mountDuration = performance.now() - startTime;
      performanceMonitor.recordEntry({
        timestamp: Date.now(),
        type: 'userInteraction',
        duration: mountDuration,
        details: {
          action: 'componentMount',
          component: 'App'
        }
      });
    };
  }, []);

  // Return helper functions for manual tracking
  return {
    recordAPIRequest: performanceMonitor.recordAPIRequest.bind(performanceMonitor),
    recordUserInteraction: performanceMonitor.recordUserInteraction.bind(performanceMonitor),
    recordEntry: performanceMonitor.recordEntry.bind(performanceMonitor)
  };
}

import React from 'react';

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<T extends object>(
  Component: React.ComponentType<T>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: T) {
    useEffect(() => {
      const startTime = performance.now();
      
      return () => {
        const duration = performance.now() - startTime;
        performanceMonitor.recordEntry({
          timestamp: Date.now(),
          type: 'userInteraction',
          duration,
          details: {
            action: 'componentLifetime',
            component: componentName
          }
        });
      };
    }, []);

    return <Component {...props} />;
  };
}

// API interceptor for automatic request tracking
export function createPerformanceAwareAPIClient() {
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const startTime = performance.now();
    const url = typeof input === 'string' ? input : input.toString();
    
    try {
      const response = await originalFetch(input, init);
      const duration = performance.now() - startTime;
      
      performanceMonitor.recordAPIRequest(url, duration, response.ok);
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordAPIRequest(url, duration, false);
      throw error;
    }
  };
}

// Initialize on import
if (typeof window !== 'undefined') {
  createPerformanceAwareAPIClient();
}