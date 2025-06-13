/**
 * Exchange Rate Protection Service - Critical Security Fix
 * Prevents arbitrage exploitation during API outages and rate staleness
 */

export interface ExchangeRateData {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  timestamp: number;
  source: string;
  confidence: number;
}

export interface RateValidationResult {
  isValid: boolean;
  rate: number;
  source: string;
  staleness: number;
  warnings: string[];
  circuitBreakerActive: boolean;
}

export class ExchangeRateProtection {
  private static rateCache = new Map<string, ExchangeRateData>();
  private static rateSources = ['primary', 'backup1', 'backup2'];
  private static circuitBreakers = new Map<string, { isOpen: boolean; lastFailure: number; failureCount: number }>();
  private static readonly STALENESS_LIMIT = 60000; // 60 seconds
  private static readonly MAX_RATE_DEVIATION = 0.05; // 5% maximum deviation
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private static readonly CIRCUIT_BREAKER_RESET_TIME = 300000; // 5 minutes

  /**
   * Get validated exchange rate with staleness protection
   */
  static async getValidatedRate(
    baseCurrency: string,
    targetCurrency: string
  ): Promise<RateValidationResult> {
    const cacheKey = `${baseCurrency}_${targetCurrency}`;
    const warnings: string[] = [];
    
    // Check circuit breaker status
    const circuitBreaker = this.getCircuitBreakerStatus(cacheKey);
    if (circuitBreaker.isOpen) {
      return {
        isValid: false,
        rate: 0,
        source: 'circuit_breaker',
        staleness: 0,
        warnings: ['Exchange rate service circuit breaker is open'],
        circuitBreakerActive: true
      };
    }

    // Try to get fresh rate from multiple sources
    const freshRate = await this.fetchFreshRateWithFallback(baseCurrency, targetCurrency);
    
    if (freshRate) {
      // Validate rate against cached value for manipulation detection
      const cachedRate = this.rateCache.get(cacheKey);
      if (cachedRate && this.isRateDeviationSuspicious(cachedRate.rate, freshRate.rate)) {
        warnings.push('Suspicious rate deviation detected - using cached rate');
        
        if (this.isRateStale(cachedRate)) {
          return {
            isValid: false,
            rate: 0,
            source: 'stale_cached',
            staleness: Date.now() - cachedRate.timestamp,
            warnings: ['Cached rate is stale and fresh rate is suspicious'],
            circuitBreakerActive: false
          };
        }
        
        return {
          isValid: true,
          rate: cachedRate.rate,
          source: 'cached_safe',
          staleness: Date.now() - cachedRate.timestamp,
          warnings,
          circuitBreakerActive: false
        };
      }

      // Update cache with fresh rate
      this.rateCache.set(cacheKey, freshRate);
      this.resetCircuitBreaker(cacheKey);
      
      return {
        isValid: true,
        rate: freshRate.rate,
        source: freshRate.source,
        staleness: 0,
        warnings,
        circuitBreakerActive: false
      };
    }

    // No fresh rate available - check cached rate
    const cachedRate = this.rateCache.get(cacheKey);
    if (cachedRate) {
      const staleness = Date.now() - cachedRate.timestamp;
      
      if (staleness > this.STALENESS_LIMIT) {
        this.triggerCircuitBreaker(cacheKey);
        return {
          isValid: false,
          rate: 0,
          source: 'stale_cached',
          staleness,
          warnings: [`Rate is stale by ${Math.floor(staleness / 1000)} seconds`],
          circuitBreakerActive: false
        };
      }
      
      warnings.push('Using cached rate due to API unavailability');
      return {
        isValid: true,
        rate: cachedRate.rate,
        source: 'cached_fallback',
        staleness,
        warnings,
        circuitBreakerActive: false
      };
    }

    // No rate available at all
    this.triggerCircuitBreaker(cacheKey);
    return {
      isValid: false,
      rate: 0,
      source: 'unavailable',
      staleness: 0,
      warnings: ['No exchange rate available'],
      circuitBreakerActive: false
    };
  }

  /**
   * Fetch fresh rate with fallback to multiple sources
   */
  private static async fetchFreshRateWithFallback(
    baseCurrency: string,
    targetCurrency: string
  ): Promise<ExchangeRateData | null> {
    for (const source of this.rateSources) {
      try {
        const rate = await this.fetchRateFromSource(source, baseCurrency, targetCurrency);
        if (rate && this.isRateReasonable(rate.rate)) {
          return rate;
        }
      } catch (error) {
        console.warn(`Rate fetch failed for source ${source}:`, error);
        continue;
      }
    }
    return null;
  }

  /**
   * Fetch rate from specific source (mock implementation)
   */
  private static async fetchRateFromSource(
    source: string,
    baseCurrency: string,
    targetCurrency: string
  ): Promise<ExchangeRateData | null> {
    // Mock implementation - replace with actual API calls
    const mockRates: Record<string, number> = {
      'USD_EUR': 0.85,
      'USD_GBP': 0.73,
      'USD_XRP': 0.5,
      'EUR_USD': 1.18,
      'GBP_USD': 1.37,
      'XRP_USD': 2.0
    };

    const rateKey = `${baseCurrency}_${targetCurrency}`;
    const baseRate = mockRates[rateKey];
    
    if (!baseRate) return null;

    // Add small random variation to simulate real rates
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    const rate = baseRate * (1 + variation);

    return {
      baseCurrency,
      targetCurrency,
      rate,
      timestamp: Date.now(),
      source,
      confidence: 0.95
    };
  }

  /**
   * Check if rate deviation is suspicious
   */
  private static isRateDeviationSuspicious(cachedRate: number, newRate: number): boolean {
    const deviation = Math.abs(newRate - cachedRate) / cachedRate;
    return deviation > this.MAX_RATE_DEVIATION;
  }

  /**
   * Check if cached rate is stale
   */
  private static isRateStale(rateData: ExchangeRateData): boolean {
    return Date.now() - rateData.timestamp > this.STALENESS_LIMIT;
  }

  /**
   * Basic sanity check for rate values
   */
  private static isRateReasonable(rate: number): boolean {
    return rate > 0 && rate < 1000000 && !isNaN(rate) && isFinite(rate);
  }

  /**
   * Circuit breaker management
   */
  private static getCircuitBreakerStatus(key: string): { isOpen: boolean; canReset: boolean } {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      return { isOpen: false, canReset: false };
    }

    const canReset = Date.now() - breaker.lastFailure > this.CIRCUIT_BREAKER_RESET_TIME;
    if (canReset && breaker.isOpen) {
      this.resetCircuitBreaker(key);
      return { isOpen: false, canReset: true };
    }

    return { isOpen: breaker.isOpen, canReset };
  }

  private static triggerCircuitBreaker(key: string): void {
    const breaker = this.circuitBreakers.get(key) || { isOpen: false, lastFailure: 0, failureCount: 0 };
    
    breaker.failureCount++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      console.warn(`Circuit breaker activated for exchange rate: ${key}`);
    }
    
    this.circuitBreakers.set(key, breaker);
  }

  private static resetCircuitBreaker(key: string): void {
    this.circuitBreakers.set(key, { isOpen: false, lastFailure: 0, failureCount: 0 });
  }

  /**
   * Validate rate for transaction processing
   */
  static async validateRateForTransaction(
    baseCurrency: string,
    targetCurrency: string,
    amount: number
  ): Promise<{ canProceed: boolean; rate?: number; error?: string; warnings?: string[] }> {
    if (baseCurrency === targetCurrency) {
      return { canProceed: true, rate: 1.0 };
    }

    const validation = await this.getValidatedRate(baseCurrency, targetCurrency);
    
    if (!validation.isValid) {
      return {
        canProceed: false,
        error: `Exchange rate unavailable: ${validation.warnings.join(', ')}`,
        warnings: validation.warnings
      };
    }

    // Additional checks for large transactions
    if (amount > 10000 && validation.staleness > 30000) {
      return {
        canProceed: false,
        error: 'Rate too stale for large transaction',
        warnings: validation.warnings
      };
    }

    return {
      canProceed: true,
      rate: validation.rate,
      warnings: validation.warnings
    };
  }

  /**
   * Get rate cache statistics
   */
  static getRateStatistics(): {
    cachedRates: number;
    staleRates: number;
    circuitBreakersOpen: number;
    oldestRate: number;
  } {
    const now = Date.now();
    let staleCount = 0;
    let oldestAge = 0;

    for (const rate of this.rateCache.values()) {
      const age = now - rate.timestamp;
      if (age > this.STALENESS_LIMIT) staleCount++;
      if (age > oldestAge) oldestAge = age;
    }

    const openBreakers = Array.from(this.circuitBreakers.values()).filter(b => b.isOpen).length;

    return {
      cachedRates: this.rateCache.size,
      staleRates: staleCount,
      circuitBreakersOpen: openBreakers,
      oldestRate: oldestAge
    };
  }
}