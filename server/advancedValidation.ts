/**
 * Advanced Input Validation and Security Service
 * Production-grade validation for financial transactions
 */

import { z } from 'zod';

/**
 * Financial transaction validation schemas
 */
export const transactionSchemas = {
  sendMoney: z.object({
    amount: z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 1000000;
    }, 'Amount must be between $0.01 and $1,000,000'),
    currency: z.enum(['USD', 'EUR', 'GBP']),
    recipientEmail: z.string().email('Invalid email address'),
    message: z.string().max(500, 'Message too long').optional()
  }),

  cryptoTransaction: z.object({
    amount: z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 1000000;
    }, 'Amount must be between $0.01 and $1,000,000'),
    fromCurrency: z.string().min(3).max(10),
    toCurrency: z.string().min(3).max(10),
    walletAddress: z.string().min(26).max(62).refine(
      addr => /^[a-zA-Z0-9]+$/.test(addr),
      'Invalid wallet address format'
    )
  }),

  agentTransaction: z.object({
    sourceAgentId: z.string().min(1).max(50),
    targetAgentId: z.string().min(1).max(50),
    amount: z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 100000;
    }, 'Amount must be between $0.01 and $100,000'),
    currency: z.enum(['USD', 'USDT', 'BTC', 'ETH']),
    purpose: z.string().min(1).max(200)
  })
};

/**
 * Security validation functions
 */
export class SecurityValidator {
  /**
   * Validate wallet address format by network
   */
  static validateWalletAddress(address: string, network: string): boolean {
    const patterns = {
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
      solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    };

    const pattern = patterns[network.toLowerCase() as keyof typeof patterns];
    return pattern ? pattern.test(address) : false;
  }

  /**
   * Validate transaction amount against suspicious patterns
   */
  static validateTransactionAmount(amount: number, currency: string): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let valid = true;

    // Check for suspicious round numbers
    if (amount % 1000 === 0 && amount >= 10000) {
      warnings.push('Large round number transaction - manual review recommended');
    }

    // Check for micro-transactions (potential spam)
    if (amount < 1) {
      warnings.push('Micro-transaction detected');
    }

    // Check for very large transactions
    if (amount > 100000) {
      warnings.push('Large transaction - enhanced verification required');
      valid = false;
    }

    return { valid, warnings };
  }

  /**
   * Rate limiting validation
   */
  static validateTransactionFrequency(
    userId: string,
    recentTransactions: number
  ): { valid: boolean; reason?: string } {
    // More than 20 transactions per hour is suspicious
    if (recentTransactions > 20) {
      return {
        valid: false,
        reason: 'Transaction frequency exceeds limits'
      };
    }

    return { valid: true };
  }

  /**
   * Comprehensive transaction validation
   */
  static async validateTransaction(data: {
    userId: string;
    amount: number;
    currency: string;
    type: string;
    recipientInfo?: any;
  }): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Amount validation
    const amountCheck = this.validateTransactionAmount(data.amount, data.currency);
    if (!amountCheck.valid) {
      errors.push('Transaction amount validation failed');
    }
    warnings.push(...amountCheck.warnings);

    // Currency validation
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT', 'USDC'];
    if (!supportedCurrencies.includes(data.currency)) {
      errors.push('Unsupported currency');
    }

    // Type validation
    const supportedTypes = ['send_money', 'buy_crypto', 'sell_crypto', 'swap_crypto', 'agent_transaction'];
    if (!supportedTypes.includes(data.type)) {
      errors.push('Invalid transaction type');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input: string): number | null {
    const cleaned = input.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}