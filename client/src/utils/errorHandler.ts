/**
 * Global Error Handler for Unhandled Promise Rejections
 * Resolves production-blocking frontend errors
 */

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: Array<{ error: any; timestamp: number; context: string }> = [];
  private maxErrors = 100;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      this.logError(event.reason, 'unhandledrejection');
      
      // Prevent the default browser behavior (logging to console)
      event.preventDefault();
      
      // Handle specific error types
      this.handleSpecificError(event.reason);
    });

    // Handle general JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('Global Error:', event.error);
      
      this.logError(event.error, 'javascript_error');
      
      // Prevent error from breaking the application
      event.preventDefault();
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        console.error('Resource Error:', event);
        this.logError(event, 'resource_error');
      }
    }, true);
  }

  private logError(error: any, context: string) {
    const errorEntry = {
      error: this.serializeError(error),
      timestamp: Date.now(),
      context
    };

    this.errorQueue.push(errorEntry);

    // Keep only recent errors
    if (this.errorQueue.length > this.maxErrors) {
      this.errorQueue.shift();
    }

    // Send to monitoring service if available
    this.reportToMonitoring(errorEntry);
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.parse(JSON.stringify(error));
      } catch (e) {
        return { message: 'Unserializable error object' };
      }
    }
    
    return { message: String(error) };
  }

  private handleSpecificError(error: any) {
    // Handle API request failures
    if (error?.message?.includes('fetch')) {
      this.handleAPIError(error);
      return;
    }

    // Handle Vite connection errors
    if (error?.message?.includes('vite') || error?.message?.includes('ChromeTransport')) {
      this.handleViteError(error);
      return;
    }

    // Handle authentication errors
    if (error?.message?.includes('auth') || error?.status === 401) {
      this.handleAuthError(error);
      return;
    }

    // Handle network errors
    if (error?.message?.includes('network') || error?.name === 'NetworkError') {
      this.handleNetworkError(error);
      return;
    }
  }

  private handleAPIError(error: any) {
    console.warn('API Error handled:', error);
    
    // Show user-friendly message
    this.showErrorToast('Connection issue detected. Retrying...', 'warning');
    
    // Attempt retry if possible
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  private handleViteError(error: any) {
    console.warn('Vite connection error handled:', error);
    
    // These are development-only errors, suppress in production
    if (import.meta.env.PROD) {
      return;
    }
    
    // In development, attempt to reconnect
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    }, 5000);
  }

  private handleAuthError(error: any) {
    console.warn('Authentication error handled:', error);
    
    // Redirect to login if needed
    if (window.location.pathname !== '/' && !window.location.pathname.includes('/demo')) {
      window.location.href = '/api/login';
    }
  }

  private handleNetworkError(error: any) {
    console.warn('Network error handled:', error);
    
    this.showErrorToast('Network connection issue. Please check your connection.', 'destructive');
  }

  private showErrorToast(message: string, variant: 'default' | 'destructive' | 'warning' = 'default') {
    // Use toast if available
    const event = new CustomEvent('show-toast', {
      detail: { message, variant }
    });
    window.dispatchEvent(event);
  }

  private reportToMonitoring(errorEntry: any) {
    // Send to backend monitoring if available
    if (import.meta.env.PROD) {
      fetch('/api/monitoring/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorEntry)
      }).catch(() => {
        // Silently fail to prevent recursive errors
      });
    }
  }

  // Public methods for manual error handling
  public handlePromise<T>(promise: Promise<T>, context?: string): Promise<T> {
    return promise.catch((error) => {
      this.logError(error, context || 'manual_promise');
      throw error; // Re-throw to maintain promise chain
    });
  }

  public handleAsyncFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: string
  ): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        return this.handlePromise(result, context);
      } catch (error) {
        this.logError(error, context || 'async_function');
        throw error;
      }
    }) as T;
  }

  public getErrorReport() {
    return {
      errors: this.errorQueue,
      summary: {
        total: this.errorQueue.length,
        recent: this.errorQueue.filter(e => Date.now() - e.timestamp < 300000).length, // Last 5 minutes
        byContext: this.errorQueue.reduce((acc, e) => {
          acc[e.context] = (acc[e.context] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    };
  }
}

// Initialize global error handler
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// Export utility functions for components
export const handlePromise = <T>(promise: Promise<T>, context?: string) => 
  globalErrorHandler.handlePromise(promise, context);

export const handleAsyncFunction = <T extends (...args: any[]) => Promise<any>>(
  fn: T, 
  context?: string
) => globalErrorHandler.handleAsyncFunction(fn, context);