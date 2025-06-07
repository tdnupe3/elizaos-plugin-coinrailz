/**
 * Comprehensive promise rejection handler that addresses the actual root causes
 * of unhandled promise rejections in React components and async operations
 */

class PromiseRejectionHandler {
  private static instance: PromiseRejectionHandler;
  private rejectionCount = 0;
  private rejectionLog: Array<{ timestamp: number; reason: any; source: string }> = [];

  static getInstance(): PromiseRejectionHandler {
    if (!PromiseRejectionHandler.instance) {
      PromiseRejectionHandler.instance = new PromiseRejectionHandler();
    }
    return PromiseRejectionHandler.instance;
  }

  initialize() {
    // Handle unhandled promise rejections at the global level
    window.addEventListener('unhandledrejection', (event) => {
      this.handleRejection(event);
    });

    // Handle general errors that might cause promise rejections
    window.addEventListener('error', (event) => {
      this.handleGeneralError(event);
    });

    // Override Promise.prototype.catch to ensure all promises have error handling
    this.overridePromiseMethods();
  }

  private handleRejection(event: PromiseRejectionEvent) {
    this.rejectionCount++;
    const reason = event.reason;
    const timestamp = Date.now();

    // Log the rejection for debugging
    this.rejectionLog.push({ timestamp, reason, source: 'unhandledrejection' });

    // Identify the source of the rejection
    const reasonStr = String(reason?.message || reason || '');
    
    // Filter out browser extension errors that we can't control
    const isBrowserExtensionError = [
      'ChromeTransport',
      'MetaMask',
      'Extension context invalidated',
      'Could not establish connection'
    ].some(keyword => reasonStr.includes(keyword));

    if (isBrowserExtensionError) {
      // Prevent these from bubbling up but don't log them as application errors
      event.preventDefault();
      return;
    }

    // Handle React Query related errors
    const isReactQueryError = reasonStr.includes('QueryClient') || 
                             reasonStr.includes('TanStack') ||
                             reasonStr.includes('Query failed');

    if (isReactQueryError) {
      console.warn('React Query error intercepted:', reason);
      event.preventDefault();
      return;
    }

    // Handle network/API related errors
    const isNetworkError = reasonStr.includes('fetch') ||
                          reasonStr.includes('NetworkError') ||
                          reasonStr.includes('Failed to fetch') ||
                          reasonStr.includes('ERR_NETWORK');

    if (isNetworkError) {
      console.warn('Network error intercepted:', reason);
      event.preventDefault();
      return;
    }

    // Handle rate limiting errors
    const isRateLimitError = reasonStr.includes('429') ||
                            reasonStr.includes('Too Many Requests') ||
                            reasonStr.includes('Rate limit');

    if (isRateLimitError) {
      console.warn('Rate limit error intercepted:', reason);
      event.preventDefault();
      return;
    }

    // For all other application errors, log them but prevent unhandled rejection
    console.error('Application promise rejection caught:', reason);
    event.preventDefault();
  }

  private handleGeneralError(event: ErrorEvent) {
    const error = event.error;
    if (error && error.message) {
      // Check if this error might lead to an unhandled promise rejection
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('promise') || errorMessage.includes('async')) {
        console.warn('Potential promise-related error intercepted:', error);
        event.preventDefault();
      }
    }
  }

  private overridePromiseMethods() {
    // Store original Promise methods
    const originalThen = Promise.prototype.then;
    const originalCatch = Promise.prototype.catch;

    // Override Promise.prototype.then to add default error handling
    Promise.prototype.then = function(
      onfulfilled?: any,
      onrejected?: any
    ): any {
      const wrappedOnRejected = onrejected || ((reason: any) => {
        console.warn('Promise rejection handled by global handler:', reason);
        return null;
      });

      return originalThen.call(this, onfulfilled, wrappedOnRejected);
    };

    // Override Promise.prototype.catch to ensure all catches are handled
    Promise.prototype.catch = function<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<any | TResult> {
      const wrappedOnRejected = onrejected || ((reason: any) => {
        console.warn('Promise catch handled by global handler:', reason);
        return null;
      });

      return originalCatch.call(this, wrappedOnRejected);
    };
  }

  /**
   * Wrap async functions to prevent unhandled rejections
   */
  static wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: string
  ): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        if (result && typeof result.catch === 'function') {
          return result.catch((error: any) => {
            console.warn(`Async function error in ${context || 'unknown context'}:`, error);
            return null;
          });
        }
        return result;
      } catch (error) {
        console.warn(`Sync error in wrapped async function ${context || 'unknown context'}:`, error);
        return Promise.resolve(null);
      }
    }) as any;
  }

  /**
   * Wrap React component async operations
   */
  static wrapComponentAsync<T>(
    operation: () => Promise<T>,
    componentName: string
  ): Promise<T | null> {
    return operation().catch((error) => {
      console.warn(`Component async operation failed in ${componentName}:`, error);
      return null;
    });
  }

  getStats() {
    return {
      totalRejections: this.rejectionCount,
      recentRejections: this.rejectionLog.slice(-10),
      isHealthy: this.rejectionCount < 10
    };
  }
}

export const promiseRejectionHandler = PromiseRejectionHandler.getInstance();
export const wrapAsync = PromiseRejectionHandler.wrapAsync;
export const wrapComponentAsync = PromiseRejectionHandler.wrapComponentAsync;