/**
 * Production Transaction Validator
 * Implements comprehensive validation for all transaction types
 */

import { z } from 'zod';

// Transaction validation schemas
export const transactionValidationSchemas = {
  p2pTransfer: z.object({
    recipientEmail: z.string().email('Invalid email format'),
    amount: z.number().min(5, 'Minimum transaction amount is $5.00').max(9999, 'Maximum transaction without KYC is $9,999'),
    currency: z.enum(['USD', 'EUR', 'GBP']),
    paymentMethod: z.enum(['stripe', 'paypal', 'bank_transfer']),
    memo: z.string().max(140, 'Memo cannot exceed 140 characters').optional()
  }),
  
  cryptoP2P: z.object({
    recipientAddress: z.string().min(25, 'Invalid wallet address'),
    amount: z.number().min(0.000001, 'Minimum crypto amount is 0.000001'),
    currency: z.enum(['XRP', 'BTC', 'ETH', 'USDT', 'USDC']),
    memo: z.string().max(140, 'Memo cannot exceed 140 characters').optional()
  }),
  
  fiatDeposit: z.object({
    amount: z.number().min(10, 'Minimum deposit is $10.00').max(9999, 'Maximum deposit without KYC is $9,999'),
    currency: z.enum(['USD', 'EUR', 'GBP']),
    paymentMethod: z.enum(['stripe', 'paypal', 'bank_transfer'])
  })
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  requiresKYC: boolean;
  transactionType: string;
}

export class TransactionValidator {
  /**
   * Validate P2P fiat transfer
   */
  static validateP2PTransfer(data: any): ValidationResult {
    const result = transactionValidationSchemas.p2pTransfer.safeParse(data);
    
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message),
        requiresKYC: false,
        transactionType: 'p2p_fiat'
      };
    }
    
    const { amount } = result.data;
    const requiresKYC = amount >= 3000; // BSA reporting threshold
    
    // Additional business logic validation
    const errors: string[] = [];
    
    // Check for suspicious patterns
    if (amount === 2999.99 || amount === 9999.99) {
      errors.push('Transaction amount appears to be structuring - compliance review required');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      requiresKYC,
      transactionType: 'p2p_fiat'
    };
  }
  
  /**
   * Validate crypto P2P transfer (no limits)
   */
  static validateCryptoP2P(data: any): ValidationResult {
    const result = transactionValidationSchemas.cryptoP2P.safeParse(data);
    
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message),
        requiresKYC: false,
        transactionType: 'p2p_crypto'
      };
    }
    
    // Validate wallet address format by currency
    const { recipientAddress, currency } = result.data;
    const addressValidation = this.validateWalletAddress(recipientAddress, currency);
    
    if (!addressValidation.isValid) {
      return {
        isValid: false,
        errors: [addressValidation.error || 'Invalid wallet address'],
        requiresKYC: false,
        transactionType: 'p2p_crypto'
      };
    }
    
    return {
      isValid: true,
      errors: [],
      requiresKYC: false, // Crypto P2P never requires KYC per your requirements
      transactionType: 'p2p_crypto'
    };
  }
  
  /**
   * Validate fiat deposit
   */
  static validateFiatDeposit(data: any): ValidationResult {
    const result = transactionValidationSchemas.fiatDeposit.safeParse(data);
    
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message),
        requiresKYC: false,
        transactionType: 'fiat_deposit'
      };
    }
    
    const { amount } = result.data;
    const requiresKYC = amount >= 3000;
    
    return {
      isValid: true,
      errors: [],
      requiresKYC,
      transactionType: 'fiat_deposit'
    };
  }
  
  /**
   * Validate wallet address by currency
   */
  private static validateWalletAddress(address: string, currency: string): { isValid: boolean; error?: string } {
    switch (currency) {
      case 'XRP':
        // XRP classic address validation
        if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
          return { isValid: false, error: 'Invalid XRP address format' };
        }
        break;
      case 'BTC':
        // Bitcoin address validation (basic)
        if (!/^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address)) {
          return { isValid: false, error: 'Invalid Bitcoin address format' };
        }
        break;
      case 'ETH':
      case 'USDT':
      case 'USDC':
        // Ethereum address validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          return { isValid: false, error: 'Invalid Ethereum address format' };
        }
        break;
      default:
        return { isValid: false, error: 'Unsupported currency' };
    }
    
    return { isValid: true };
  }
}