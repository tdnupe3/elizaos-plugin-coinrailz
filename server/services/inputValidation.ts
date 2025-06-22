/**
 * Comprehensive Input Validation - Prevents Invalid Transactions
 * Implements $5.00 minimum with bounds checking for all financial operations
 * Based on business logic audit requirements
 */

import { SafeMath } from '../utils/safeMath';

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
}

interface TransactionValidation extends ValidationResult {
  amountCents?: number;
  formattedAmount?: string;
}

export class InputValidation {
  private static readonly MIN_TRANSACTION_AMOUNT = 5.00;
  private static readonly MAX_TRANSACTION_AMOUNT = 999999.99;
  private static readonly MIN_COMMISSION_RATE = 0.0001; // 0.01%
  private static readonly MAX_COMMISSION_RATE = 0.02; // 2% maximum total commissions

  /**
   * Validate transaction amount with $5.00 minimum
   */
  static validateTransactionAmount(amount: any): TransactionValidation {
    // Type validation
    if (typeof amount !== 'number' && typeof amount !== 'string') {
      return {
        valid: false,
        error: 'Amount must be a number'
      };
    }

    // Convert to number if string
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Check for invalid numbers
    if (isNaN(numericAmount) || !isFinite(numericAmount)) {
      return {
        valid: false,
        error: 'Invalid amount format'
      };
    }

    // Check for negative or zero amounts
    if (numericAmount <= 0) {
      return {
        valid: false,
        error: 'Amount must be greater than zero'
      };
    }

    // Validate using SafeMath bounds checking
    const validation = SafeMath.validateAmount(
      numericAmount,
      this.MIN_TRANSACTION_AMOUNT,
      this.MAX_TRANSACTION_AMOUNT
    );

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error
      };
    }

    return {
      valid: true,
      amountCents: validation.amountCents,
      formattedAmount: SafeMath.formatMoney(validation.amountCents)
    };
  }

  /**
   * Validate commission rate to prevent overflow
   */
  static validateCommissionRate(rate: any): ValidationResult {
    if (typeof rate !== 'number') {
      return {
        valid: false,
        error: 'Commission rate must be a number'
      };
    }

    if (isNaN(rate) || !isFinite(rate)) {
      return {
        valid: false,
        error: 'Invalid commission rate format'
      };
    }

    if (rate < this.MIN_COMMISSION_RATE) {
      return {
        valid: false,
        error: `Commission rate must be at least ${(this.MIN_COMMISSION_RATE * 100).toFixed(2)}%`
      };
    }

    if (rate > this.MAX_COMMISSION_RATE) {
      return {
        valid: false,
        error: `Commission rate cannot exceed ${(this.MAX_COMMISSION_RATE * 100).toFixed(2)}%`
      };
    }

    return {
      valid: true,
      sanitized: rate
    };
  }

  /**
   * Validate user ID format
   */
  static validateUserId(userId: any): ValidationResult {
    if (typeof userId !== 'string') {
      return {
        valid: false,
        error: 'User ID must be a string'
      };
    }

    // Remove whitespace
    const sanitized = userId.trim();

    if (sanitized.length === 0) {
      return {
        valid: false,
        error: 'User ID cannot be empty'
      };
    }

    if (sanitized.length < 3) {
      return {
        valid: false,
        error: 'User ID must be at least 3 characters'
      };
    }

    if (sanitized.length > 50) {
      return {
        valid: false,
        error: 'User ID cannot exceed 50 characters'
      };
    }

    // Check for valid characters (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      return {
        valid: false,
        error: 'User ID can only contain letters, numbers, underscores, and hyphens'
      };
    }

    return {
      valid: true,
      sanitized
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(email: any): ValidationResult {
    if (typeof email !== 'string') {
      return {
        valid: false,
        error: 'Email must be a string'
      };
    }

    const sanitized = email.trim().toLowerCase();

    if (sanitized.length === 0) {
      return {
        valid: false,
        error: 'Email cannot be empty'
      };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      return {
        valid: false,
        error: 'Invalid email format'
      };
    }

    // Check length limits
    if (sanitized.length > 254) {
      return {
        valid: false,
        error: 'Email address too long'
      };
    }

    return {
      valid: true,
      sanitized
    };
  }

  /**
   * Validate currency code
   */
  static validateCurrencyCode(currency: any): ValidationResult {
    if (typeof currency !== 'string') {
      return {
        valid: false,
        error: 'Currency code must be a string'
      };
    }

    const sanitized = currency.trim().toUpperCase();

    // Must be 3 characters (ISO 4217 standard)
    if (sanitized.length !== 3) {
      return {
        valid: false,
        error: 'Currency code must be exactly 3 characters'
      };
    }

    // Must be alphabetic
    if (!/^[A-Z]{3}$/.test(sanitized)) {
      return {
        valid: false,
        error: 'Currency code must contain only letters'
      };
    }

    // Check against supported currencies
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'XRP'];
    if (!supportedCurrencies.includes(sanitized)) {
      return {
        valid: false,
        error: `Unsupported currency. Supported: ${supportedCurrencies.join(', ')}`
      };
    }

    return {
      valid: true,
      sanitized
    };
  }

  /**
   * Validate P2P transfer request
   */
  static validateP2PTransfer(request: {
    fromUserId?: any;
    toUserId?: any;
    amount?: any;
    currency?: any;
  }): ValidationResult {
    const errors: string[] = [];

    // Validate from user ID
    const fromUserValidation = this.validateUserId(request.fromUserId);
    if (!fromUserValidation.valid) {
      errors.push(`From user: ${fromUserValidation.error}`);
    }

    // Validate to user ID
    const toUserValidation = this.validateUserId(request.toUserId);
    if (!toUserValidation.valid) {
      errors.push(`To user: ${toUserValidation.error}`);
    }

    // Check for same user transfer
    if (fromUserValidation.valid && toUserValidation.valid && 
        fromUserValidation.sanitized === toUserValidation.sanitized) {
      errors.push('Cannot transfer to the same user');
    }

    // Validate amount
    const amountValidation = this.validateTransactionAmount(request.amount);
    if (!amountValidation.valid) {
      errors.push(`Amount: ${amountValidation.error}`);
    }

    // Validate currency if provided
    if (request.currency !== undefined) {
      const currencyValidation = this.validateCurrencyCode(request.currency);
      if (!currencyValidation.valid) {
        errors.push(`Currency: ${currencyValidation.error}`);
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; ')
      };
    }

    return {
      valid: true,
      sanitized: {
        fromUserId: fromUserValidation.sanitized,
        toUserId: toUserValidation.sanitized,
        amount: amountValidation.amountCents! / 100,
        amountCents: amountValidation.amountCents,
        currency: request.currency ? this.validateCurrencyCode(request.currency).sanitized : 'USD'
      }
    };
  }

  /**
   * Validate commission payout request
   */
  static validateCommissionPayout(request: {
    agentId?: any;
    amount?: any;
    transactionId?: any;
  }): ValidationResult {
    const errors: string[] = [];

    // Validate agent ID
    const agentValidation = this.validateUserId(request.agentId);
    if (!agentValidation.valid) {
      errors.push(`Agent ID: ${agentValidation.error}`);
    }

    // Validate amount (lower minimum for commissions)
    if (typeof request.amount !== 'number' || request.amount <= 0) {
      errors.push('Amount: Must be a positive number');
    } else if (request.amount > 10000) { // Max $10k commission payout
      errors.push('Amount: Commission payout cannot exceed $10,000');
    }

    // Validate transaction ID
    if (typeof request.transactionId !== 'string' || request.transactionId.trim().length === 0) {
      errors.push('Transaction ID: Must be a non-empty string');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; ')
      };
    }

    return {
      valid: true,
      sanitized: {
        agentId: agentValidation.sanitized,
        amount: request.amount,
        transactionId: request.transactionId.trim()
      }
    };
  }

  /**
   * Validate agent registration request
   */
  static validateAgentRegistration(request: {
    name?: any;
    email?: any;
    capabilities?: any;
  }): ValidationResult {
    const errors: string[] = [];

    // Validate name
    if (typeof request.name !== 'string' || request.name.trim().length === 0) {
      errors.push('Name: Must be a non-empty string');
    } else if (request.name.trim().length > 100) {
      errors.push('Name: Cannot exceed 100 characters');
    }

    // Validate email
    const emailValidation = this.validateEmail(request.email);
    if (!emailValidation.valid) {
      errors.push(`Email: ${emailValidation.error}`);
    }

    // Validate capabilities
    if (!Array.isArray(request.capabilities)) {
      errors.push('Capabilities: Must be an array');
    } else if (request.capabilities.length === 0) {
      errors.push('Capabilities: Must specify at least one capability');
    } else {
      const validCapabilities = ['trading', 'analysis', 'portfolio', 'signals', 'consulting'];
      const invalidCapabilities = request.capabilities.filter(
        (cap: any) => typeof cap !== 'string' || !validCapabilities.includes(cap)
      );
      if (invalidCapabilities.length > 0) {
        errors.push(`Capabilities: Invalid capabilities: ${invalidCapabilities.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; ')
      };
    }

    return {
      valid: true,
      sanitized: {
        name: request.name.trim(),
        email: emailValidation.sanitized,
        capabilities: request.capabilities
      }
    };
  }

  /**
   * Sanitize string input to prevent injection attacks
   */
  static sanitizeString(input: any, maxLength: number = 255): ValidationResult {
    if (typeof input !== 'string') {
      return {
        valid: false,
        error: 'Input must be a string'
      };
    }

    let sanitized = input.trim();

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"&]/g, '');

    // Check length
    if (sanitized.length > maxLength) {
      return {
        valid: false,
        error: `Input too long (max ${maxLength} characters)`
      };
    }

    return {
      valid: true,
      sanitized
    };
  }
}