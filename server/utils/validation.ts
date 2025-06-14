import { z } from 'zod';

export class ValidationUtils {
  // Sanitize and validate decimal amounts
  static validateAmount(amount: string | number): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      throw new Error('Invalid amount: must be a valid number');
    }
    
    if (numAmount < 0) {
      throw new Error('Invalid amount: cannot be negative');
    }
    
    if (numAmount > 999999999.99) {
      throw new Error('Invalid amount: exceeds maximum limit');
    }
    
    // Round to 2 decimal places for fiat, 8 for crypto
    return Math.round(numAmount * 100) / 100;
  }

  static validateCryptoAmount(amount: string | number): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      throw new Error('Invalid crypto amount: must be a valid number');
    }
    
    if (numAmount < 0) {
      throw new Error('Invalid crypto amount: cannot be negative');
    }
    
    // Round to 8 decimal places for crypto
    return Math.round(numAmount * 100000000) / 100000000;
  }

  // Validate email addresses
  static validateEmail(email: string): string {
    const emailSchema = z.string().email();
    try {
      return emailSchema.parse(email.toLowerCase().trim());
    } catch {
      throw new Error('Invalid email address format');
    }
  }

  // CRITICAL SECURITY: Sanitize input to prevent SQL injection
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Remove or escape dangerous SQL characters and path traversal attempts
    return input
      .replace(/['";\\]/g, '') // Remove quotes and backslashes
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove start of block comments
      .replace(/\*\//g, '') // Remove end of block comments
      .replace(/\.\./g, '') // Remove path traversal attempts
      .replace(/[\/\\]/g, '') // Remove path separators
      .replace(/\$\{.*?\}/g, '') // Remove template injection attempts
      .replace(/<script.*?>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript protocols
      .replace(/data:/gi, '') // Remove data URIs
      .replace(/xp_/gi, '') // Remove stored procedure calls
      .replace(/sp_/gi, '') // Remove stored procedure calls
      .replace(/EXEC/gi, '') // Remove EXEC commands
      .replace(/EXECUTE/gi, '') // Remove EXECUTE commands
      .replace(/DROP/gi, '') // Remove DROP commands
      .replace(/DELETE/gi, '') // Remove DELETE commands
      .replace(/INSERT/gi, '') // Remove INSERT commands
      .replace(/UPDATE/gi, '') // Remove UPDATE commands
      .replace(/UNION/gi, '') // Remove UNION commands
      .replace(/SELECT/gi, '') // Remove SELECT commands
      .trim();
  }

  // Validate user balance operations
  static validateBalanceOperation(
    currentBalance: string | null, 
    operationAmount: number, 
    operationType: 'debit' | 'credit'
  ): { newBalance: number; isValid: boolean; error?: string } {
    try {
      const balance = parseFloat(currentBalance || '0');
      
      if (isNaN(balance)) {
        return { newBalance: 0, isValid: false, error: 'Invalid current balance' };
      }

      let newBalance: number;
      
      if (operationType === 'debit') {
        if (balance < operationAmount) {
          return { 
            newBalance: balance, 
            isValid: false, 
            error: 'Insufficient balance for operation' 
          };
        }
        newBalance = balance - operationAmount;
      } else {
        newBalance = balance + operationAmount;
      }

      return { 
        newBalance: Math.round(newBalance * 100) / 100, 
        isValid: true 
      };
    } catch (error) {
      return { 
        newBalance: 0, 
        isValid: false, 
        error: 'Balance validation failed' 
      };
    }
  }

  // Sanitize strings to prevent injection attacks
  static sanitizeString(input: string, maxLength: number = 255): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, ''); // Remove potential script tags
  }

  // Validate transaction references
  static validateTransactionReference(ref: string): string {
    const cleanRef = this.sanitizeString(ref, 50);
    
    if (cleanRef.length < 3) {
      throw new Error('Transaction reference must be at least 3 characters');
    }
    
    // Only allow alphanumeric and basic punctuation
    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(cleanRef)) {
      throw new Error('Transaction reference contains invalid characters');
    }
    
    return cleanRef;
  }
}