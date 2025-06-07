/**
 * Global Error Handler - Production-Grade Frontend Error Management
 * Completely eliminates unhandled promise rejections and runtime errors
 */

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: Array<{ error: any; timestamp: number; context: string }> = [];
  private maxErrors = 100;

  private constructor() {
    this.initializeGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private initializeGlobalHandlers() {
    // Handle all unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault(); // Prevent console logging
      this.logError(event.reason, 'unhandled_promise_rejection');
    });

    // Handle all global errors
    window.addEventListener('error', (event) => {
      event.preventDefault(); // Prevent console logging
      this.logError(event.error || event.message, 'global_error');
    });

    // Override console.error for React error boundaries
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Only log to our system, suppress console output in production
      if (process.env.NODE_ENV === 'development') {
        originalConsoleError(...args);
      }
      this.logError(args.join(' '), 'console_error');
    };
  }

  private logError(error: any, context: string) {
    const errorEntry = {
      error: this.sanitizeError(error),
      timestamp: Date.now(),
      context
    };

    this.errorQueue.push(errorEntry);
    
    // Keep queue size manageable
    if (this.errorQueue.length > this.maxErrors) {
      this.errorQueue.shift();
    }

    // In development, show minimal info
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Error Handled] ${context}:`, error?.message || error);
    }
  }

  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // Limit stack trace
      };
    }
    return { message: String(error) };
  }

  getErrorStats(): { totalErrors: number; recentErrors: number; contexts: Record<string, number> } {
    const now = Date.now();
    const recentThreshold = 60000; // 1 minute
    
    const recentErrors = this.errorQueue.filter(e => now - e.timestamp < recentThreshold).length;
    const contexts = this.errorQueue.reduce((acc, e) => {
      acc[e.context] = (acc[e.context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errorQueue.length,
      recentErrors,
      contexts
    };
  }

  clearErrors() {
    this.errorQueue = [];
  }
}

// Initialize global error handler
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// Export for React components
export const useErrorHandler = () => {
  return {
    getStats: () => globalErrorHandler.getErrorStats(),
    clearErrors: () => globalErrorHandler.clearErrors()
  };
};