/**
 * Safe Math Utilities - Eliminates Floating Point Precision Errors
 * Uses integer arithmetic (cents) for all financial calculations
 * Based on business logic audit requirements
 */

interface MoneyAmount {
  cents: number;
  dollars: number;
  formatted: string;
}

export class SafeMath {
  private static readonly CENTS_PER_DOLLAR = 100;

  /**
   * Convert dollars to cents for precision arithmetic
   */
  static dollarsToCents(dollars: number): number {
    return Math.round(dollars * this.CENTS_PER_DOLLAR);
  }

  /**
   * Convert cents back to dollars for display
   */
  static centsToDollars(cents: number): number {
    return cents / this.CENTS_PER_DOLLAR;
  }

  /**
   * Create MoneyAmount object from dollar value
   */
  static createMoney(dollars: number): MoneyAmount {
    const cents = this.dollarsToCents(dollars);
    return {
      cents,
      dollars: this.centsToDollars(cents),
      formatted: this.formatMoney(cents)
    };
  }

  /**
   * Add two money amounts safely
   */
  static addMoney(amount1: number, amount2: number): MoneyAmount {
    const cents1 = this.dollarsToCents(amount1);
    const cents2 = this.dollarsToCents(amount2);
    const totalCents = cents1 + cents2;
    
    return {
      cents: totalCents,
      dollars: this.centsToDollars(totalCents),
      formatted: this.formatMoney(totalCents)
    };
  }

  /**
   * Subtract two money amounts safely
   */
  static subtractMoney(amount1: number, amount2: number): MoneyAmount {
    const cents1 = this.dollarsToCents(amount1);
    const cents2 = this.dollarsToCents(amount2);
    const resultCents = cents1 - cents2;
    
    return {
      cents: resultCents,
      dollars: this.centsToDollars(resultCents),
      formatted: this.formatMoney(resultCents)
    };
  }

  /**
   * Multiply money amount by percentage safely
   */
  static multiplyByRate(amount: number, rate: number): MoneyAmount {
    const amountCents = this.dollarsToCents(amount);
    // Use integer arithmetic for rate calculation
    const resultCents = Math.round(amountCents * rate);
    
    return {
      cents: resultCents,
      dollars: this.centsToDollars(resultCents),
      formatted: this.formatMoney(resultCents)
    };
  }

  /**
   * Calculate percentage of amount safely
   */
  static calculatePercentage(amount: number, percentage: number): MoneyAmount {
    const amountCents = this.dollarsToCents(amount);
    const rate = percentage / 100;
    const resultCents = Math.round(amountCents * rate);
    
    return {
      cents: resultCents,
      dollars: this.centsToDollars(resultCents),
      formatted: this.formatMoney(resultCents)
    };
  }

  /**
   * Divide money amount safely
   */
  static divideMoney(amount: number, divisor: number): MoneyAmount {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    
    const amountCents = this.dollarsToCents(amount);
    const resultCents = Math.round(amountCents / divisor);
    
    return {
      cents: resultCents,
      dollars: this.centsToDollars(resultCents),
      formatted: this.formatMoney(resultCents)
    };
  }

  /**
   * Compare two money amounts
   */
  static compareMoney(amount1: number, amount2: number): number {
    const cents1 = this.dollarsToCents(amount1);
    const cents2 = this.dollarsToCents(amount2);
    
    if (cents1 > cents2) return 1;
    if (cents1 < cents2) return -1;
    return 0;
  }

  /**
   * Check if first amount is greater than second
   */
  static isGreaterThan(amount1: number, amount2: number): boolean {
    return this.compareMoney(amount1, amount2) > 0;
  }

  /**
   * Check if first amount is less than second
   */
  static isLessThan(amount1: number, amount2: number): boolean {
    return this.compareMoney(amount1, amount2) < 0;
  }

  /**
   * Check if amounts are equal
   */
  static isEqual(amount1: number, amount2: number): boolean {
    return this.compareMoney(amount1, amount2) === 0;
  }

  /**
   * Get minimum of two amounts
   */
  static min(amount1: number, amount2: number): MoneyAmount {
    const cents1 = this.dollarsToCents(amount1);
    const cents2 = this.dollarsToCents(amount2);
    const minCents = Math.min(cents1, cents2);
    
    return {
      cents: minCents,
      dollars: this.centsToDollars(minCents),
      formatted: this.formatMoney(minCents)
    };
  }

  /**
   * Get maximum of two amounts
   */
  static max(amount1: number, amount2: number): MoneyAmount {
    const cents1 = this.dollarsToCents(amount1);
    const cents2 = this.dollarsToCents(amount2);
    const maxCents = Math.max(cents1, cents2);
    
    return {
      cents: maxCents,
      dollars: this.centsToDollars(maxCents),
      formatted: this.formatMoney(maxCents)
    };
  }

  /**
   * Round money amount to nearest cent
   */
  static roundMoney(amount: number): MoneyAmount {
    const cents = this.dollarsToCents(amount);
    
    return {
      cents,
      dollars: this.centsToDollars(cents),
      formatted: this.formatMoney(cents)
    };
  }

  /**
   * Format money amount for display
   */
  static formatMoney(cents: number, currencySymbol: string = '$'): string {
    const dollars = this.centsToDollars(cents);
    return `${currencySymbol}${dollars.toFixed(2)}`;
  }

  /**
   * Calculate commission with safe math
   */
  static calculateCommission(transactionAmount: number, commissionRate: number): {
    transactionCents: number;
    commissionCents: number;
    commissionDollars: number;
    formatted: string;
  } {
    const transactionCents = this.dollarsToCents(transactionAmount);
    const commissionCents = Math.round(transactionCents * commissionRate);
    
    return {
      transactionCents,
      commissionCents,
      commissionDollars: this.centsToDollars(commissionCents),
      formatted: this.formatMoney(commissionCents)
    };
  }

  /**
   * Calculate fee with safe math
   */
  static calculateFee(amount: number, feeRate: number): {
    amountCents: number;
    feeCents: number;
    feeDollars: number;
    totalCents: number;
    totalDollars: number;
    formatted: {
      amount: string;
      fee: string;
      total: string;
    };
  } {
    const amountCents = this.dollarsToCents(amount);
    const feeCents = Math.round(amountCents * feeRate);
    const totalCents = amountCents + feeCents;
    
    return {
      amountCents,
      feeCents,
      feeDollars: this.centsToDollars(feeCents),
      totalCents,
      totalDollars: this.centsToDollars(totalCents),
      formatted: {
        amount: this.formatMoney(amountCents),
        fee: this.formatMoney(feeCents),
        total: this.formatMoney(totalCents)
      }
    };
  }

  /**
   * Validate money amount bounds
   */
  static validateAmount(amount: number, minAmount: number = 5.00, maxAmount: number = 999999.99): {
    valid: boolean;
    error?: string;
    amountCents: number;
  } {
    const amountCents = this.dollarsToCents(amount);
    const minCents = this.dollarsToCents(minAmount);
    const maxCents = this.dollarsToCents(maxAmount);
    
    if (amountCents < minCents) {
      return {
        valid: false,
        error: `Amount must be at least ${this.formatMoney(minCents)}`,
        amountCents
      };
    }
    
    if (amountCents > maxCents) {
      return {
        valid: false,
        error: `Amount cannot exceed ${this.formatMoney(maxCents)}`,
        amountCents
      };
    }
    
    if (!Number.isInteger(amountCents)) {
      return {
        valid: false,
        error: 'Invalid amount precision',
        amountCents
      };
    }
    
    return {
      valid: true,
      amountCents
    };
  }

  /**
   * Calculate exchange with safe math
   */
  static calculateExchange(
    fromAmount: number,
    exchangeRate: number,
    feeRate: number = 0
  ): {
    fromAmountCents: number;
    toAmountCents: number;
    feeCents: number;
    netAmountCents: number;
    formatted: {
      fromAmount: string;
      toAmount: string;
      fee: string;
      netAmount: string;
    };
  } {
    const fromAmountCents = this.dollarsToCents(fromAmount);
    const toAmountCents = Math.round(fromAmountCents * exchangeRate);
    const feeCents = Math.round(toAmountCents * feeRate);
    const netAmountCents = toAmountCents - feeCents;
    
    return {
      fromAmountCents,
      toAmountCents,
      feeCents,
      netAmountCents,
      formatted: {
        fromAmount: this.formatMoney(fromAmountCents),
        toAmount: this.formatMoney(toAmountCents),
        fee: this.formatMoney(feeCents),
        netAmount: this.formatMoney(netAmountCents)
      }
    };
  }
}