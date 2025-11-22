// Production-grade resilience wrapper for external API calls
// Provides: retry with exponential backoff, circuit breaker, timeout protection

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  fallback?: any;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  timeoutMs: 5000,
  fallback: null,
};

function getCircuitBreaker(key: string): CircuitBreakerState {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(key)!;
}

function updateCircuitBreaker(key: string, success: boolean) {
  const breaker = getCircuitBreaker(key);
  
  if (success) {
    breaker.failures = 0;
    breaker.state = 'closed';
  } else {
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    
    // Open circuit after 5 consecutive failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      console.warn(`🔴 Circuit breaker OPEN for ${key} (${breaker.failures} failures)`);
    }
  }
}

function canAttempt(key: string): boolean {
  const breaker = getCircuitBreaker(key);
  
  if (breaker.state === 'closed') {
    return true;
  }
  
  if (breaker.state === 'open') {
    // Try to recover after 30 seconds
    const timeSinceFailure = Date.now() - breaker.lastFailureTime;
    if (timeSinceFailure > 30000) {
      breaker.state = 'half-open';
      console.log(`🟡 Circuit breaker HALF-OPEN for ${key}, attempting recovery...`);
      return true;
    }
    return false;
  }
  
  // half-open state - allow one attempt
  return true;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withResilience<T>(
  fn: () => Promise<T>,
  key: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check circuit breaker
  if (!canAttempt(key)) {
    console.warn(`⚠️ Circuit breaker OPEN for ${key}, returning fallback`);
    if (opts.fallback !== null) {
      return opts.fallback;
    }
    throw new Error(`Circuit breaker open for ${key}`);
  }
  
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Add timeout protection
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), opts.timeoutMs)
        ),
      ]);
      
      updateCircuitBreaker(key, true);
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (attempt === opts.maxRetries) {
        updateCircuitBreaker(key, false);
        break;
      }
      
      console.log(`⚠️ Attempt ${attempt + 1}/${opts.maxRetries + 1} failed for ${key}: ${error.message}, retrying in ${delay}ms...`);
      await sleep(delay);
      
      // Exponential backoff
      delay = Math.min(delay * 2, opts.maxDelayMs);
    }
  }
  
  // All retries failed
  updateCircuitBreaker(key, false);
  
  if (opts.fallback !== null) {
    console.warn(`⚠️ All retries failed for ${key}, using fallback`);
    return opts.fallback;
  }
  
  throw lastError || new Error(`All retries failed for ${key}`);
}
