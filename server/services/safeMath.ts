/**
 * Safe Math Implementation - Critical Security Fix
 * Prevents overflow and precision errors in financial calculations
 */

export interface SafeNumber {
  value: string;
  decimals: number;
}

export interface MathResult {
  success: boolean;
  result?: SafeNumber;
  error?: string;
}

export class SafeMath {
  private static readonly MAX_SAFE_AMOUNT = "999999999999.99"; // $1 trillion limit
  private static readonly DEFAULT_DECIMALS = 2;

  /**
   * Create a safe number from various inputs
   */
  static createSafeNumber(value: number | string | SafeNumber, decimals: number = this.DEFAULT_DECIMALS): SafeNumber {
    if (typeof value === 'object' && 'value' in value) {
      return value;
    }

    let stringValue: string;
    
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) {
        throw new Error('Invalid number: must be finite');
      }
      stringValue = value.toFixed(decimals);
    } else {
      stringValue = value.toString();
    }

    // Remove any non-numeric characters except decimal point and minus sign
    stringValue = stringValue.replace(/[^0-9.-]/g, '');
    
    // Validate format
    if (!/^-?\d+(\.\d+)?$/.test(stringValue)) {
      throw new Error(`Invalid number format: ${stringValue}`);
    }

    // Check bounds
    const numValue = parseFloat(stringValue);
    if (Math.abs(numValue) > parseFloat(this.MAX_SAFE_AMOUNT)) {
      throw new Error(`Amount exceeds maximum safe value: ${this.MAX_SAFE_AMOUNT}`);
    }

    // Ensure proper decimal places
    const [whole, decimal] = stringValue.split('.');
    const paddedDecimal = (decimal || '').padEnd(decimals, '0').slice(0, decimals);
    
    return {
      value: `${whole}.${paddedDecimal}`,
      decimals
    };
  }

  /**
   * Add two safe numbers
   */
  static add(a: SafeNumber, b: SafeNumber): MathResult {
    try {
      const maxDecimals = Math.max(a.decimals, b.decimals);
      
      // Convert to integers to avoid floating point issues
      const multiplier = Math.pow(10, maxDecimals);
      const aInt = Math.round(parseFloat(a.value) * multiplier);
      const bInt = Math.round(parseFloat(b.value) * multiplier);
      
      const resultInt = aInt + bInt;
      const resultValue = (resultInt / multiplier).toFixed(maxDecimals);
      
      // Check bounds
      if (Math.abs(parseFloat(resultValue)) > parseFloat(this.MAX_SAFE_AMOUNT)) {
        return { success: false, error: 'Result exceeds maximum safe value' };
      }

      return {
        success: true,
        result: { value: resultValue, decimals: maxDecimals }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Subtract two safe numbers
   */
  static subtract(a: SafeNumber, b: SafeNumber): MathResult {
    try {
      const maxDecimals = Math.max(a.decimals, b.decimals);
      
      const multiplier = Math.pow(10, maxDecimals);
      const aInt = Math.round(parseFloat(a.value) * multiplier);
      const bInt = Math.round(parseFloat(b.value) * multiplier);
      
      const resultInt = aInt - bInt;
      const resultValue = (resultInt / multiplier).toFixed(maxDecimals);
      
      return {
        success: true,
        result: { value: resultValue, decimals: maxDecimals }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Multiply two safe numbers
   */
  static multiply(a: SafeNumber, b: SafeNumber): MathResult {
    try {
      const resultDecimals = a.decimals + b.decimals;
      
      // Convert to integers
      const aMultiplier = Math.pow(10, a.decimals);
      const bMultiplier = Math.pow(10, b.decimals);
      
      const aInt = Math.round(parseFloat(a.value) * aMultiplier);
      const bInt = Math.round(parseFloat(b.value) * bMultiplier);
      
      const resultInt = aInt * bInt;
      const finalMultiplier = Math.pow(10, resultDecimals);
      const resultValue = (resultInt / finalMultiplier).toFixed(Math.max(a.decimals, b.decimals));
      
      // Check bounds
      if (Math.abs(parseFloat(resultValue)) > parseFloat(this.MAX_SAFE_AMOUNT)) {
        return { success: false, error: 'Result exceeds maximum safe value' };
      }

      return {
        success: true,
        result: { value: resultValue, decimals: Math.max(a.decimals, b.decimals) }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Divide two safe numbers
   */
  static divide(a: SafeNumber, b: SafeNumber): MathResult {
    try {
      const bValue = parseFloat(b.value);
      if (bValue === 0) {
        return { success: false, error: 'Division by zero' };
      }

      const aValue = parseFloat(a.value);
      const resultValue = (aValue / bValue).toFixed(Math.max(a.decimals, b.decimals));
      
      // Check bounds
      if (Math.abs(parseFloat(resultValue)) > parseFloat(this.MAX_SAFE_AMOUNT)) {
        return { success: false, error: 'Result exceeds maximum safe value' };
      }

      return {
        success: true,
        result: { value: resultValue, decimals: Math.max(a.decimals, b.decimals) }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Calculate percentage of a number
   */
  static percentage(amount: SafeNumber, percent: number): MathResult {
    try {
      if (percent < 0 || percent > 100) {
        return { success: false, error: 'Percentage must be between 0 and 100' };
      }

      const percentSafe = this.createSafeNumber(percent / 100, 6); // 6 decimals for precision
      return this.multiply(amount, percentSafe);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Round to specified decimal places using banker's rounding
   */
  static round(number: SafeNumber, decimals: number): MathResult {
    try {
      const value = parseFloat(number.value);
      const multiplier = Math.pow(10, decimals);
      
      // Banker's rounding (round half to even)
      const shifted = value * multiplier;
      const integer = Math.floor(shifted);
      const fraction = shifted - integer;
      
      let rounded: number;
      if (fraction < 0.5) {
        rounded = integer;
      } else if (fraction > 0.5) {
        rounded = integer + 1;
      } else {
        // Exactly 0.5 - round to even
        rounded = integer % 2 === 0 ? integer : integer + 1;
      }
      
      const resultValue = (rounded / multiplier).toFixed(decimals);
      
      return {
        success: true,
        result: { value: resultValue, decimals }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Compare two safe numbers
   */
  static compare(a: SafeNumber, b: SafeNumber): number {
    const aValue = parseFloat(a.value);
    const bValue = parseFloat(b.value);
    
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
    return 0;
  }

  /**
   * Check if number is zero
   */
  static isZero(number: SafeNumber): boolean {
    return parseFloat(number.value) === 0;
  }

  /**
   * Check if number is positive
   */
  static isPositive(number: SafeNumber): boolean {
    return parseFloat(number.value) > 0;
  }

  /**
   * Check if number is negative
   */
  static isNegative(number: SafeNumber): boolean {
    return parseFloat(number.value) < 0;
  }

  /**
   * Get absolute value
   */
  static abs(number: SafeNumber): SafeNumber {
    const value = Math.abs(parseFloat(number.value)).toFixed(number.decimals);
    return { value, decimals: number.decimals };
  }

  /**
   * Convert SafeNumber to regular number (use with caution)
   */
  static toNumber(safeNumber: SafeNumber): number {
    return parseFloat(safeNumber.value);
  }

  /**
   * Convert SafeNumber to string for display
   */
  static toString(safeNumber: SafeNumber, includeSymbol: boolean = false): string {
    const symbol = includeSymbol ? '$' : '';
    return `${symbol}${safeNumber.value}`;
  }
}

/**
 * Commission Calculator using Safe Math
 */
export class SafeCommissionCalculator {
  /**
   * Calculate commission with safe math
   */
  static calculateCommission(
    transactionAmount: number | string,
    commissionRate: number,
    tierMultiplier: number = 1
  ): { success: boolean; commission?: SafeNumber; error?: string } {
    try {
      // Validate inputs
      if (commissionRate < 0 || commissionRate > 1) {
        return { success: false, error: 'Commission rate must be between 0 and 1' };
      }

      if (tierMultiplier < 0 || tierMultiplier > 10) {
        return { success: false, error: 'Tier multiplier must be between 0 and 10' };
      }

      // Create safe numbers
      const amount = SafeMath.createSafeNumber(transactionAmount);
      const rate = SafeMath.createSafeNumber(commissionRate, 6);
      const multiplier = SafeMath.createSafeNumber(tierMultiplier, 6);

      // Calculate base commission
      const baseCommissionResult = SafeMath.multiply(amount, rate);
      if (!baseCommissionResult.success) {
        return { success: false, error: baseCommissionResult.error };
      }

      // Apply tier multiplier
      const finalCommissionResult = SafeMath.multiply(baseCommissionResult.result!, multiplier);
      if (!finalCommissionResult.success) {
        return { success: false, error: finalCommissionResult.error };
      }

      // Round to 2 decimal places
      const roundedResult = SafeMath.round(finalCommissionResult.result!, 2);
      if (!roundedResult.success) {
        return { success: false, error: roundedResult.error };
      }

      return { success: true, commission: roundedResult.result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Calculate total commissions for multiple tiers
   */
  static calculateTotalCommissions(
    transactionAmount: number | string,
    tiers: { rate: number; multiplier: number }[]
  ): { success: boolean; total?: SafeNumber; breakdown?: SafeNumber[]; error?: string } {
    try {
      const breakdown: SafeNumber[] = [];
      let runningTotal = SafeMath.createSafeNumber(0);

      for (const tier of tiers) {
        const commissionResult = this.calculateCommission(
          transactionAmount,
          tier.rate,
          tier.multiplier
        );

        if (!commissionResult.success) {
          return { success: false, error: commissionResult.error };
        }

        breakdown.push(commissionResult.commission!);

        const addResult = SafeMath.add(runningTotal, commissionResult.commission!);
        if (!addResult.success) {
          return { success: false, error: addResult.error };
        }

        runningTotal = addResult.result!;
      }

      return {
        success: true,
        total: runningTotal,
        breakdown
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Calculate fee with safe math
   */
  static calculateFee(
    amount: number | string,
    feeRate: number,
    minimumFee: number = 0,
    maximumFee?: number
  ): { success: boolean; fee?: SafeNumber; error?: string } {
    try {
      // Calculate percentage fee
      const baseAmount = SafeMath.createSafeNumber(amount);
      const percentageResult = SafeMath.percentage(baseAmount, feeRate * 100);
      
      if (!percentageResult.success) {
        return { success: false, error: percentageResult.error };
      }

      let finalFee = percentageResult.result!;

      // Apply minimum fee
      if (minimumFee > 0) {
        const minFee = SafeMath.createSafeNumber(minimumFee);
        if (SafeMath.compare(finalFee, minFee) < 0) {
          finalFee = minFee;
        }
      }

      // Apply maximum fee
      if (maximumFee && maximumFee > 0) {
        const maxFee = SafeMath.createSafeNumber(maximumFee);
        if (SafeMath.compare(finalFee, maxFee) > 0) {
          finalFee = maxFee;
        }
      }

      // Round to 2 decimal places
      const roundedResult = SafeMath.round(finalFee, 2);
      if (!roundedResult.success) {
        return { success: false, error: roundedResult.error };
      }

      return { success: true, fee: roundedResult.result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}