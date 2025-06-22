/**
 * Exchange Rate Staleness Protection - Prevents Arbitrage Exploitation
 * Implements 30-second rate expiration with automatic refresh
 * Based on business logic audit requirements
 */

interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: number;
  source: string;
}

interface RateValidationResult {
  valid: boolean;
  rate?: number;
  reason?: string;
  staleness?: number;
}

export class ExchangeRateProtection {
  private static rateCache = new Map<string, ExchangeRate>();
  private static readonly RATE_EXPIRY_MS = 30 * 1000; // 30 seconds
  private static readonly MAX_RATE_DEVIATION = 0.05; // 5% maximum sudden change
  private static circuitBreakerTripped = false;
  private static circuitBreakerResetTime = 0;
  private static readonly CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Get validated exchange rate with staleness protection
   */
  static async getValidatedRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<RateValidationResult> {
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const now = Date.now();

    // Check circuit breaker
    if (this.circuitBreakerTripped) {
      if (now < this.circuitBreakerResetTime) {
        return {
          valid: false,
          reason: 'Exchange rate service temporarily unavailable'
        };
      } else {
        this.circuitBreakerTripped = false;
        console.log('Exchange rate circuit breaker reset');
      }
    }

    // Check cache for existing rate
    const cachedRate = this.rateCache.get(cacheKey);
    
    if (cachedRate) {
      const age = now - cachedRate.timestamp;
      
      // Check if rate is stale
      if (age > this.RATE_EXPIRY_MS) {
        console.log(`Rate for ${cacheKey} is stale (${age}ms old), refreshing...`);
        return await this.refreshRate(fromCurrency, toCurrency);
      }
      
      return {
        valid: true,
        rate: cachedRate.rate,
        staleness: age
      };
    }

    // No cached rate, fetch new one
    return await this.refreshRate(fromCurrency, toCurrency);
  }

  /**
   * Refresh exchange rate from external sources
   */
  private static async refreshRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<RateValidationResult> {
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    
    try {
      // Fetch rate from multiple sources for validation
      const rates = await Promise.allSettled([
        this.fetchRateFromSource1(fromCurrency, toCurrency),
        this.fetchRateFromSource2(fromCurrency, toCurrency)
      ]);

      const validRates = rates
        .filter((result): result is PromiseFulfilledResult<number> => 
          result.status === 'fulfilled' && typeof result.value === 'number'
        )
        .map(result => result.value);

      if (validRates.length === 0) {
        this.tripCircuitBreaker();
        return {
          valid: false,
          reason: 'No exchange rate sources available'
        };
      }

      // Use median rate if multiple sources available
      const newRate = validRates.length === 1 
        ? validRates[0] 
        : this.calculateMedianRate(validRates);

      // Validate rate deviation
      const previousRate = this.rateCache.get(cacheKey);
      if (previousRate && this.isRateDeviationSuspicious(previousRate.rate, newRate)) {
        return {
          valid: false,
          reason: `Rate deviation too large: ${((newRate - previousRate.rate) / previousRate.rate * 100).toFixed(2)}%`
        };
      }

      // Cache the new rate
      this.rateCache.set(cacheKey, {
        fromCurrency,
        toCurrency,
        rate: newRate,
        timestamp: Date.now(),
        source: `${validRates.length} sources`
      });

      return {
        valid: true,
        rate: newRate,
        staleness: 0
      };

    } catch (error) {
      console.error('Error refreshing exchange rate:', error);
      this.tripCircuitBreaker();
      return {
        valid: false,
        reason: 'Exchange rate service error'
      };
    }
  }

  /**
   * Fetch rate from source 1 (mock implementation - replace with real API)
   */
  private static async fetchRateFromSource1(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // Mock implementation - replace with actual exchange rate API
    // For development, return reasonable mock rates
    const mockRates: Record<string, number> = {
      'USD_EUR': 0.85,
      'EUR_USD': 1.18,
      'USD_GBP': 0.73,
      'GBP_USD': 1.37,
      'BTC_USD': 43250.00,
      'USD_BTC': 0.000023,
      'ETH_USD': 2650.00,
      'USD_ETH': 0.000377
    };

    const key = `${fromCurrency}_${toCurrency}`;
    const rate = mockRates[key];
    
    if (!rate) {
      throw new Error(`No rate available for ${fromCurrency}/${toCurrency}`);
    }

    // Add small random variation to simulate real market data
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return rate * (1 + variation);
  }

  /**
   * Fetch rate from source 2 (mock implementation - replace with real API)
   */
  private static async fetchRateFromSource2(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // Mock implementation for second source
    // In production, use different exchange rate provider
    const rate = await this.fetchRateFromSource1(fromCurrency, toCurrency);
    
    // Add slight different variation for source diversity
    const variation = (Math.random() - 0.5) * 0.015; // ±0.75% variation
    return rate * (1 + variation);
  }

  /**
   * Calculate median rate from multiple sources
   */
  private static calculateMedianRate(rates: number[]): number {
    const sorted = rates.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Check if rate deviation is suspicious
   */
  private static isRateDeviationSuspicious(oldRate: number, newRate: number): boolean {
    const deviation = Math.abs(newRate - oldRate) / oldRate;
    return deviation > this.MAX_RATE_DEVIATION;
  }

  /**
   * Trip circuit breaker to prevent using unreliable rates
   */
  private static tripCircuitBreaker(): void {
    this.circuitBreakerTripped = true;
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
    console.log('Exchange rate circuit breaker tripped - service disabled for 5 minutes');
  }

  /**
   * Validate rate before executing financial transaction
   */
  static async validateRateForTransaction(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<{ valid: boolean; rate?: number; error?: string }> {
    // Check minimum transaction amount first
    if (amount < 5.00) {
      return {
        valid: false,
        error: 'Transaction amount below $5.00 minimum'
      };
    }

    const rateResult = await this.getValidatedRate(fromCurrency, toCurrency);
    
    if (!rateResult.valid) {
      return {
        valid: false,
        error: rateResult.reason || 'Invalid exchange rate'
      };
    }

    return {
      valid: true,
      rate: rateResult.rate
    };
  }

  /**
   * Get rate cache status for monitoring
   */
  static getCacheStatus(): {
    cacheSize: number;
    circuitBreakerStatus: boolean;
    rates: Array<{
      pair: string;
      rate: number;
      age: number;
      fresh: boolean;
    }>;
  } {
    const now = Date.now();
    const rates = Array.from(this.rateCache.entries()).map(([key, data]) => ({
      pair: key,
      rate: data.rate,
      age: now - data.timestamp,
      fresh: (now - data.timestamp) < this.RATE_EXPIRY_MS
    }));

    return {
      cacheSize: this.rateCache.size,
      circuitBreakerStatus: this.circuitBreakerTripped,
      rates
    };
  }

  /**
   * Clear stale rates from cache
   */
  static cleanupStaleRates(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, rate] of this.rateCache.entries()) {
      if (now - rate.timestamp > this.RATE_EXPIRY_MS * 2) { // Remove rates older than 1 minute
        this.rateCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Cleaned up ${removed} stale exchange rates`);
    }

    return removed;
  }
}

// Cleanup stale rates every 2 minutes
setInterval(() => {
  ExchangeRateProtection.cleanupStaleRates();
}, 2 * 60 * 1000);