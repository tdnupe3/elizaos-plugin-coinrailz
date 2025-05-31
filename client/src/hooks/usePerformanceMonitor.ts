import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTracking() {
    // Track navigation timing
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now(),
          });
        });
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
      this.observers.push(observer);
    }

    // Track Core Web Vitals
    this.trackWebVitals();
  }

  private trackWebVitals() {
    // Track Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric({
          name: 'LCP',
          duration: lastEntry.startTime,
          timestamp: Date.now(),
        });
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        // Fallback for older browsers
        console.warn('LCP monitoring not supported');
      }
    }

    // Track First Input Delay (FID)
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: 'FID',
            duration: entry.processingStart - entry.startTime,
            timestamp: Date.now(),
          });
        });
      });

      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID monitoring not supported');
      }
    }
  }

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log performance issues
    if (metric.name === 'LCP' && metric.duration > 2500) {
      console.warn(`Poor LCP performance: ${metric.duration}ms`);
    }
    if (metric.name === 'FID' && metric.duration > 100) {
      console.warn(`Poor FID performance: ${metric.duration}ms`);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  measureComponentRender(componentName: string, renderFn: () => void) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    this.recordMetric({
      name: `Component:${componentName}`,
      duration: end - start,
      timestamp: Date.now(),
    });
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

export function usePerformanceMonitor(componentName?: string) {
  const renderCountRef = useRef(0);
  const monitor = PerformanceMonitor.getInstance();

  useEffect(() => {
    monitor.startTracking();
    return () => {
      // Don't cleanup on unmount as this is a singleton
    };
  }, []);

  useEffect(() => {
    if (componentName) {
      renderCountRef.current++;
      if (renderCountRef.current > 1) {
        console.log(`Component ${componentName} re-rendered ${renderCountRef.current} times`);
      }
    }
  });

  return {
    recordMetric: (name: string, duration: number) => 
      monitor.recordMetric({ name, duration, timestamp: Date.now() }),
    getMetrics: () => monitor.getMetrics(),
    measureRender: (fn: () => void) => 
      componentName ? monitor.measureComponentRender(componentName, fn) : fn(),
  };
}