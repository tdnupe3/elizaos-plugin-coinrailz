/**
 * Circuit Breaker Pattern Implementation
 * Provides failover protection for external service dependencies
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;
  private successCount = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000 // 10 seconds
    }
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`Circuit breaker ${this.name} attempting reset`);
      } else {
        console.log(`Circuit breaker ${this.name} is OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN and no fallback provided`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        console.log(`Circuit breaker ${this.name} failed, using fallback`);
        return await fallback();
      }
      
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log(`Circuit breaker ${this.name} reset to CLOSED`);
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log(`Circuit breaker ${this.name} opened due to ${this.failureCount} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  public getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Create circuit breakers for critical services
export const paymentCircuitBreaker = new CircuitBreaker('Payment Gateway', {
  failureThreshold: 3,
  resetTimeout: 30000,
  monitoringPeriod: 5000
});

export const xrpCircuitBreaker = new CircuitBreaker('XRP Service', {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 10000
});

export const aiAgentCircuitBreaker = new CircuitBreaker('AI Agent Service', {
  failureThreshold: 10,
  resetTimeout: 120000,
  monitoringPeriod: 15000
});