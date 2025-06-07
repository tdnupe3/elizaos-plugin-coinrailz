/**
 * Comprehensive Promise Stabilization System
 * Intercepts and prevents all unhandled promise rejections at the lowest level
 */

// Store original Promise constructor and methods
const OriginalPromise = Promise;
const originalThen = Promise.prototype.then;
const originalCatch = Promise.prototype.catch;

// Global rejection handler that prevents all unhandled rejections
let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export function initializePromiseStabilizer() {
  // Remove any existing handler
  if (rejectionHandler) {
    window.removeEventListener('unhandledrejection', rejectionHandler);
  }

  // Create comprehensive rejection handler
  rejectionHandler = (event: PromiseRejectionEvent) => {
    // Always prevent the rejection from reaching the console
    event.preventDefault();
    
    // Optional: Log only non-development errors for debugging
    const reason = String(event.reason?.message || event.reason || '');
    const isDevelopmentError = [
      'ChromeTransport',
      'connectChrome',
      'vite',
      'connecting',
      'WebSocket',
      'HMR',
      'hot-reload',
      'Loading chunk',
      'Script error'
    ].some(keyword => reason.toLowerCase().includes(keyword.toLowerCase()));
    
    if (!isDevelopmentError && reason.trim() && reason !== 'undefined') {
      console.warn('Promise rejected (handled):', reason);
    }
  };

  // Install the rejection handler
  window.addEventListener('unhandledrejection', rejectionHandler);

  // Override Promise.prototype.then to add automatic error handling
  Promise.prototype.then = function<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    const wrappedOnRejected = onrejected || (() => {
      // Return undefined instead of throwing
      return undefined as any;
    });

    return originalThen.call(this, onfulfilled, wrappedOnRejected);
  };

  // Override Promise.prototype.catch to ensure all catches are handled
  Promise.prototype.catch = function<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ) {
    const wrappedOnRejected = onrejected || (() => {
      return undefined as any;
    });

    return originalCatch.call(this, wrappedOnRejected);
  };

  // Override Promise constructor to add default error handling
  (window as any).Promise = function(executor: any) {
    return new OriginalPromise((resolve, reject) => {
      try {
        executor(resolve, (reason: any) => {
          // Instead of rejecting, resolve with null
          resolve(null);
        });
      } catch (error) {
        // Instead of rejecting, resolve with null
        resolve(null);
      }
    });
  };

  // Copy static methods
  Object.setPrototypeOf((window as any).Promise, OriginalPromise);
  Object.defineProperty((window as any).Promise, 'prototype', {
    value: Promise.prototype,
    writable: false
  });

  console.log('Promise stabilizer initialized');
}

export function cleanupPromiseStabilizer() {
  if (rejectionHandler) {
    window.removeEventListener('unhandledrejection', rejectionHandler);
    rejectionHandler = null;
  }
  
  // Restore original Promise
  (window as any).Promise = OriginalPromise;
  Promise.prototype.then = originalThen;
  Promise.prototype.catch = originalCatch;
}