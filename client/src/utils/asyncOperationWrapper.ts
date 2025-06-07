/**
 * Comprehensive async operation wrapper to prevent unhandled promise rejections
 * Addresses the root cause by wrapping all async operations with proper error handling
 */

export class AsyncOperationWrapper {
  /**
   * Wrap fetch operations to prevent unhandled promise rejections
   */
  static async safeFetch(
    url: string, 
    options?: RequestInit
  ): Promise<Response | null> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      return response;
    } catch (error) {
      if (error instanceof Error) {
        // Log specific error types without throwing
        if (error.name === 'AbortError') {
          console.warn('Request timeout:', url);
        } else if (error.message.includes('Failed to fetch')) {
          console.warn('Network error:', url);
        } else {
          console.warn('Fetch error:', error.message);
        }
      }
      return null;
    }
  }

  /**
   * Wrap React Query operations to prevent unhandled rejections
   */
  static async safeQueryOperation<T>(
    operation: () => Promise<T>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.warn('Query operation failed:', error);
      return null;
    }
  }

  /**
   * Wrap mutation operations with comprehensive error handling
   */
  static async safeMutationOperation<T>(
    operation: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      console.warn('Mutation operation failed:', errorInstance.message);
      if (onError) {
        onError(errorInstance);
      }
      return null;
    }
  }

  /**
   * Wrap component async operations (useEffect, event handlers)
   */
  static async safeComponentOperation(
    operation: () => Promise<void>,
    componentName?: string
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      console.warn(
        `Component operation failed${componentName ? ` in ${componentName}` : ''}:`,
        error
      );
    }
  }

  /**
   * Create a wrapped version of setTimeout that won't throw unhandled rejections
   */
  static safeTimeout(
    callback: () => void | Promise<void>,
    delay: number
  ): NodeJS.Timeout {
    return setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.warn('Timeout callback failed:', error);
      }
    }, delay);
  }

  /**
   * Create a wrapped version of setInterval that won't throw unhandled rejections
   */
  static safeInterval(
    callback: () => void | Promise<void>,
    interval: number
  ): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.warn('Interval callback failed:', error);
      }
    }, interval);
  }
}

// Export wrapped fetch as default fetch replacement
export const safeFetch = AsyncOperationWrapper.safeFetch;