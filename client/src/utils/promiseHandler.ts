/**
 * Comprehensive Promise Handler - Prevents unhandled promise rejections
 * Wraps all async operations with proper error handling
 */

export interface PromiseHandlerOptions {
  fallbackValue?: any;
  logErrors?: boolean;
  suppressToast?: boolean;
}

class PromiseHandler {
  /**
   * Safely execute an async operation with comprehensive error handling
   */
  static async safeExecute<T>(
    promise: Promise<T>,
    options: PromiseHandlerOptions = {}
  ): Promise<T | null> {
    const {
      fallbackValue = null,
      logErrors = true,
      suppressToast = false
    } = options;

    try {
      return await promise;
    } catch (error) {
      if (logErrors) {
        console.error('Promise Handler - Caught Error:', error);
      }

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          if (!suppressToast) {
            console.warn('Rate limit exceeded - backing off');
          }
        } else if (error.message.includes('403')) {
          if (!suppressToast) {
            console.warn('Access forbidden - check permissions');
          }
        } else if (error.message.includes('502')) {
          if (!suppressToast) {
            console.warn('Server unavailable - retrying later');
          }
        }
      }

      return fallbackValue;
    }
  }

  /**
   * Wrap API requests with error handling
   */
  static async safeApiRequest<T>(
    requestFn: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T | null> {
    return this.safeExecute(requestFn(), {
      fallbackValue,
      logErrors: true,
      suppressToast: true
    });
  }

  /**
   * Wrap mutation operations with error handling
   */
  static async safeMutation<T>(
    mutationFn: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T | null> {
    try {
      return await mutationFn();
    } catch (error) {
      console.error('Mutation Error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return null;
    }
  }

  /**
   * Batch promise execution with individual error handling
   */
  static async safeBatch<T>(
    promises: Promise<T>[],
    options: PromiseHandlerOptions = {}
  ): Promise<(T | null)[]> {
    return Promise.all(
      promises.map(promise => this.safeExecute(promise, options))
    );
  }
}

/**
 * Global promise rejection handler
 */
export function initializeGlobalPromiseHandler() {
  // Handle unhandled promise rejections
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      // Prevent the error from bubbling up
      event.preventDefault();
      
      // Log for debugging
      if (event.reason instanceof Error) {
        console.error('Error details:', {
          message: event.reason.message,
          stack: event.reason.stack,
          name: event.reason.name
        });
      }
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Uncaught Error:', event.error);
      event.preventDefault();
    });
  }
}

export default PromiseHandler;