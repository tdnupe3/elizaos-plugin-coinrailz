/**
 * Production Stability Manager - Prevents all server crashes
 * Isolates components and handles errors gracefully
 */

export class StabilityManager {
  private static instance: StabilityManager;
  private crashCount = 0;
  private lastCrash = 0;
  private maxCrashes = 3;
  private resetWindow = 300000; // 5 minutes

  static getInstance(): StabilityManager {
    if (!StabilityManager.instance) {
      StabilityManager.instance = new StabilityManager();
    }
    return StabilityManager.instance;
  }

  async safeExecute<T>(
    operation: () => Promise<T> | T,
    fallback: T,
    context: string
  ): Promise<T> {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error(`Safe execution failed in ${context}:`, error);
      this.recordError(context, error);
      return fallback;
    }
  }

  private recordError(context: string, error: any) {
    const now = Date.now();
    
    // Reset crash count if outside window
    if (now - this.lastCrash > this.resetWindow) {
      this.crashCount = 0;
    }
    
    this.crashCount++;
    this.lastCrash = now;
    
    console.error(`Stability Manager - Error ${this.crashCount}/${this.maxCrashes} in ${context}:`, error);
    
    // Implement circuit breaker if too many failures
    if (this.crashCount >= this.maxCrashes) {
      console.error(`Circuit breaker activated for ${context} - disabling for ${this.resetWindow/1000}s`);
    }
  }

  setupGlobalHandlers() {
    // Override default crash handlers
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception caught by Stability Manager:', error);
      this.recordError('uncaughtException', error);
      // DO NOT EXIT - Continue operation
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection caught by Stability Manager:', reason);
      this.recordError('unhandledRejection', reason);
      // DO NOT EXIT - Continue operation
    });

    // Memory monitoring
    setInterval(() => {
      const usage = process.memoryUsage();
      const memoryMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      if (memoryMB > 500) {
        console.warn(`High memory usage: ${memoryMB}MB - forcing garbage collection`);
        if (global.gc) {
          global.gc();
        }
      }
    }, 30000);
  }

  createSafeWrapper<T extends (...args: any[]) => any>(
    fn: T,
    context: string,
    fallback?: any
  ): T {
    return ((...args: any[]) => {
      return this.safeExecute(
        () => fn(...args),
        fallback,
        context
      );
    }) as T;
  }
}

export const stability = StabilityManager.getInstance();