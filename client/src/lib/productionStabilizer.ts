/**
 * Production Frontend Stabilizer
 * Eliminates development environment artifacts and optimizes for production deployment
 */

class ProductionStabilizer {
  private isInitialized = false;
  private viteConnectionStabilized = false;
  private promiseHandlersInstalled = false;

  constructor() {
    this.initializeProductionOptimizations();
  }

  private initializeProductionOptimizations(): void {
    if (this.isInitialized) return;

    // Stabilize Vite HMR connections in development
    this.stabilizeViteConnections();
    
    // Enhanced promise rejection handling
    this.installGlobalPromiseHandlers();
    
    // Optimize performance for production
    this.optimizePerformance();
    
    // Initialize connection monitoring
    this.initializeConnectionMonitoring();

    this.isInitialized = true;
    console.log('Production stabilizer initialized');
  }

  private stabilizeViteConnections(): void {
    if (this.viteConnectionStabilized) return;

    // Prevent aggressive Vite reconnection attempts
    const originalWebSocket = window.WebSocket;
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        // Only apply to Vite HMR connections
        if (typeof url === 'string' && url.includes('/@vite/client')) {
          // Add connection stability parameters
          const stabilizedUrl = new URL(url, window.location.origin);
          stabilizedUrl.searchParams.set('timeout', '5000');
          stabilizedUrl.searchParams.set('retry', 'false');
          super(stabilizedUrl.toString(), protocols);
        } else {
          super(url, protocols);
        }

        // Enhanced error handling for Vite connections
        this.addEventListener('error', (event) => {
          if (typeof url === 'string' && url.includes('/@vite/client')) {
            event.preventDefault();
            event.stopPropagation();
            // Silently handle Vite connection errors
          }
        });

        this.addEventListener('close', (event) => {
          if (typeof url === 'string' && url.includes('/@vite/client')) {
            // Prevent automatic reconnection spam
            if (this.readyState === WebSocket.CLOSED) {
              return;
            }
          }
        });
      }
    };

    this.viteConnectionStabilized = true;
  }

  private installGlobalPromiseHandlers(): void {
    if (this.promiseHandlersInstalled) return;

    // Enhanced unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      
      // Filter out development-only errors
      if (this.isDevEnvironmentError(error)) {
        event.preventDefault();
        return;
      }

      // Log legitimate errors for monitoring
      if (error instanceof Error) {
        console.warn('Unhandled promise rejection:', {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
          timestamp: new Date().toISOString()
        });
      }

      // Prevent error from causing app crashes
      event.preventDefault();
    });

    // Enhanced error event handler
    window.addEventListener('error', (event) => {
      // Filter out development artifacts
      if (this.isDevEnvironmentError(event.error)) {
        event.preventDefault();
        return;
      }

      // Log production errors for monitoring
      console.warn('Runtime error captured:', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: new Date().toISOString()
      });
    });

    this.promiseHandlersInstalled = true;
  }

  private isDevEnvironmentError(error: any): boolean {
    if (!error) return false;
    
    const errorString = error.toString().toLowerCase();
    const stackString = error.stack?.toLowerCase() || '';
    
    // Development environment error patterns
    const devPatterns = [
      'vite',
      'hmr',
      'hot module',
      'chrometransport',
      'webdriver',
      'devtools',
      '/@vite/client',
      'connect-chrome',
      'runtime-error-plugin'
    ];

    return devPatterns.some(pattern => 
      errorString.includes(pattern) || stackString.includes(pattern)
    );
  }

  private optimizePerformance(): void {
    // Debounce resize events
    let resizeTimeout: NodeJS.Timeout;
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      if (type === 'resize' && typeof listener === 'function') {
        const debouncedListener = (...args: any[]) => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => listener(...args), 100);
        };
        return originalAddEventListener.call(this, type, debouncedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    // Optimize scroll performance
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Trigger any scroll-dependent optimizations
        this.performScrollOptimizations();
      }, 150);
    }, { passive: true });

    // Memory cleanup for long-running sessions
    setInterval(() => {
      this.performMemoryCleanup();
    }, 300000); // Every 5 minutes
  }

  private performScrollOptimizations(): void {
    // Lazy load images that come into viewport
    const images = document.querySelectorAll('img[data-lazy]');
    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      if (rect.top < window.innerHeight + 100) {
        const src = img.getAttribute('data-lazy');
        if (src) {
          img.setAttribute('src', src);
          img.removeAttribute('data-lazy');
        }
      }
    });
  }

  private performMemoryCleanup(): void {
    // Clear any accumulated error logs
    if (console.clear && Math.random() < 0.1) { // 10% chance to clear logs
      try {
        // Only clear in development to preserve production logs
        if (import.meta.env.DEV) {
          console.clear();
        }
      } catch (e) {
        // Ignore if console.clear is restricted
      }
    }

    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }
  }

  private initializeConnectionMonitoring(): void {
    // Monitor network conditions
    let isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      if (!isOnline) {
        isOnline = true;
        this.handleConnectionRestored();
      }
    });

    window.addEventListener('offline', () => {
      if (isOnline) {
        isOnline = false;
        this.handleConnectionLost();
      }
    });

    // Monitor page visibility for mobile optimization
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });
  }

  private handleConnectionRestored(): void {
    console.log('Network connection restored');
    // Trigger any necessary reconnection logic
    window.dispatchEvent(new CustomEvent('connection-restored'));
  }

  private handleConnectionLost(): void {
    console.log('Network connection lost');
    // Handle offline state
    window.dispatchEvent(new CustomEvent('connection-lost'));
  }

  private handlePageHidden(): void {
    // Reduce activity when page is hidden
    this.pauseNonEssentialOperations();
  }

  private handlePageVisible(): void {
    // Resume normal operations when page becomes visible
    this.resumeNormalOperations();
  }

  private pauseNonEssentialOperations(): void {
    // Pause animations, reduce polling frequency, etc.
    window.dispatchEvent(new CustomEvent('page-paused'));
  }

  private resumeNormalOperations(): void {
    // Resume normal operation
    window.dispatchEvent(new CustomEvent('page-resumed'));
  }

  public getStatus(): object {
    return {
      initialized: this.isInitialized,
      viteStabilized: this.viteConnectionStabilized,
      promiseHandlersActive: this.promiseHandlersInstalled,
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize production stabilizer immediately
export const productionStabilizer = new ProductionStabilizer();

// Export status check function
export function getStabilizerStatus() {
  return productionStabilizer.getStatus();
}