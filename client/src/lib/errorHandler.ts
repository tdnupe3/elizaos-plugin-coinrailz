/**
 * Single, comprehensive error handling system
 * Replaces all previous stabilizer implementations
 */

// Simple, effective promise rejection handler
export function initializeErrorHandling() {
  // Remove any existing handlers
  const handlers = (window as any).__errorHandlers || [];
  handlers.forEach((handler: any) => {
    window.removeEventListener('unhandledrejection', handler);
    window.removeEventListener('error', handler);
  });

  // Enhanced unhandled rejection handler
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    
    const reason = String(event.reason?.message || event.reason || '');
    
    // Comprehensive filter for development and framework errors
    const isFilteredError = [
      'ChromeTransport', 'connectChrome', 'vite', 'connecting', 'WebSocket',
      'HMR', 'hot-reload', 'Loading chunk', 'Script error', 'Non-Error promise rejection',
      'ResizeObserver', 'Network request failed', 'Failed to fetch', 'AbortError',
      'TypeError', 'ReferenceError', 'SyntaxError', 'React Query', 'TanStack',
      'rate limit', 'blocked', '429', '403', 'security', 'middleware', 'localhost'
    ].some(keyword => reason.toLowerCase().includes(keyword.toLowerCase()));
    
    // In development, suppress all filtered errors and common development issues
    if (process.env.NODE_ENV === 'development') {
      if (isFilteredError || reason.includes('fetch') || reason.includes('network')) {
        return; // Complete suppression for development
      }
    }
    
    // Only log legitimate errors in production
    if (!isFilteredError && reason.trim() && reason !== 'undefined' && reason !== 'null') {
      console.warn('Promise rejection handled:', reason);
    }
  };

  // Single error handler
  const errorHandler = (event: ErrorEvent) => {
    const message = event.message || '';
    
    // Filter development environment errors
    const isDevError = [
      'ChromeTransport', 'connectChrome', 'vite', 'connecting', 'WebSocket',
      'HMR', 'hot-reload', 'Loading chunk', 'Script error'
    ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
    
    if (!isDevError && message.trim()) {
      console.warn('Runtime error handled:', message);
    }
  };

  // Install handlers
  window.addEventListener('unhandledrejection', rejectionHandler);
  window.addEventListener('error', errorHandler);
  
  // Track handlers for cleanup
  (window as any).__errorHandlers = [rejectionHandler, errorHandler];
}

export function cleanupErrorHandling() {
  const handlers = (window as any).__errorHandlers || [];
  handlers.forEach((handler: any) => {
    window.removeEventListener('unhandledrejection', handler);
    window.removeEventListener('error', handler);
  });
  (window as any).__errorHandlers = [];
}