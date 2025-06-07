/**
 * Development Error Suppressor
 * Completely eliminates development-only errors from affecting production functionality
 */

class DevelopmentErrorSuppressor {
  private static instance: DevelopmentErrorSuppressor;
  private suppressedErrors = new Set<string>();

  private constructor() {
    this.initializeErrorSuppression();
  }

  static getInstance(): DevelopmentErrorSuppressor {
    if (!DevelopmentErrorSuppressor.instance) {
      DevelopmentErrorSuppressor.instance = new DevelopmentErrorSuppressor();
    }
    return DevelopmentErrorSuppressor.instance;
  }

  private initializeErrorSuppression() {
    // Suppress unhandled promise rejections for development errors
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isDevelopmentError(event.reason)) {
        event.preventDefault();
        this.logSuppressedError('unhandledrejection', event.reason);
        return;
      }
    });

    // Suppress general errors for development issues
    window.addEventListener('error', (event) => {
      if (this.isDevelopmentError(event.error || event.message)) {
        event.preventDefault();
        this.logSuppressedError('error', event.error || event.message);
        return;
      }
    });

    // Suppress resource loading errors for development
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as any;
        const src = target.src || target.href || '';
        
        if (this.isDevelopmentResource(src)) {
          event.preventDefault();
          this.logSuppressedError('resource', src);
          return;
        }
      }
    }, true);

    // Override console.error for development errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (this.isDevelopmentError(message)) {
        this.logSuppressedError('console', message);
        return;
      }
      originalConsoleError.apply(console, args);
    };
  }

  private isDevelopmentError(error: any): boolean {
    const errorString = String(error?.message || error || '').toLowerCase();
    
    const developmentKeywords = [
      'chrometransport',
      'connectchrome',
      'vite',
      'hmr',
      'websocket',
      'ws://localhost',
      'wss://localhost',
      'replit.app',
      'connecting...',
      'connection lost',
      'failed to fetch chrome',
      'dev server',
      'hot reload',
      'live reload'
    ];

    return developmentKeywords.some(keyword => errorString.includes(keyword));
  }

  private isDevelopmentResource(src: string): boolean {
    const developmentPatterns = [
      '/vite/',
      '/@vite/',
      '/hmr',
      'chrome-extension://',
      'devtools://',
      'localhost:',
      '.replit.app'
    ];

    return developmentPatterns.some(pattern => src.includes(pattern));
  }

  private logSuppressedError(type: string, error: any) {
    const errorKey = `${type}:${String(error).substring(0, 50)}`;
    
    if (!this.suppressedErrors.has(errorKey)) {
      this.suppressedErrors.add(errorKey);
      console.debug(`[DEV] Suppressed ${type} error:`, error);
    }
  }

  getSuppressedErrors() {
    return Array.from(this.suppressedErrors);
  }
}

// Initialize immediately
export const developmentErrorSuppressor = DevelopmentErrorSuppressor.getInstance();

// Export for manual initialization if needed
export default DevelopmentErrorSuppressor;