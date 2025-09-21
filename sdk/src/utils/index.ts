/**
 * COINRAILZ SDK UTILITIES
 * Helper functions for enterprise AI payment infrastructure
 */

import { v4 as uuidv4 } from 'uuid';
import type { LicenseInfo } from '../types';
import { NetworkError, LicenseError } from '../errors';

/**
 * Validate license key with CoinRailz platform
 */
export async function validateLicense(
  licenseKey: string,
  platformUrl: string
): Promise<{ success: boolean; license?: LicenseInfo; error?: string }> {
  try {
    console.log(`🔑 Validating license: ${licenseKey.substring(0, 8)}...`);
    
    const response = await fetch(`${platformUrl}/api/sdk/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${licenseKey}`,
        'User-Agent': 'CoinRailz-SDK/1.0.0'
      },
      body: JSON.stringify({ licenseKey })
    });

    if (!response.ok) {
      throw new NetworkError(
        `License validation failed: ${response.status}`,
        'LICENSE_VALIDATION_FAILED',
        { statusCode: response.status, endpoint: '/api/sdk/validate' }
      );
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'License validation failed'
      };
    }

    // Parse license data
    const license: LicenseInfo = {
      isValid: data.license.isValid,
      tier: data.license.tier,
      companyName: data.license.companyName,
      contactEmail: data.license.contactEmail,
      expiresAt: new Date(data.license.expiresAt),
      monthlyVolumeLimit: data.license.monthlyVolumeLimit,
      featuresEnabled: data.license.featuresEnabled || [],
      daysUntilRenewal: data.license.daysUntilRenewal,
      billingCycle: data.license.billingCycle
    };

    console.log(`✅ License validated for ${license.companyName} (${license.tier})`);
    
    return { success: true, license };
    
  } catch (error) {
    console.error('❌ License validation error:', error);
    return {
      success: false,
      error: error.message || 'License validation failed'
    };
  }
}

/**
 * Format currency amounts with proper precision
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: currency.toLowerCase() === 'usdc' ? 6 : 2
    }).format(amount);
  } catch (error) {
    // Fallback for unsupported currencies
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Get currency symbol for common currencies
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    USDC: '$',
    ETH: 'Ξ',
    BTC: '₿'
  };
  
  return symbols[currency.toUpperCase()] || currency.toUpperCase() + ' ';
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(prefix: string = 'cr'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate license key
 */
export function generateLicenseKey(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `cr_${uuid.substring(0, 8)}_${uuid.substring(8, 16)}`;
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate payment amount
 */
export function validateAmount(amount: number, currency: string = 'USD'): {
  valid: boolean;
  error?: string;
} {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }
  
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  
  // Currency-specific validation
  const maxDecimals = currency.toLowerCase() === 'usdc' ? 6 : 2;
  const decimals = (amount.toString().split('.')[1] || '').length;
  
  if (decimals > maxDecimals) {
    return { 
      valid: false, 
      error: `Amount cannot have more than ${maxDecimals} decimal places for ${currency}` 
    };
  }
  
  // Minimum amounts
  const minimums: Record<string, number> = {
    USD: 0.50,
    EUR: 0.50,
    GBP: 0.30,
    USDC: 0.01,
    ETH: 0.001
  };
  
  const minimum = minimums[currency.toUpperCase()] || 0.01;
  if (amount < minimum) {
    return { 
      valid: false, 
      error: `Amount must be at least ${formatCurrency(minimum, currency)}` 
    };
  }
  
  return { valid: true };
}

/**
 * Calculate payment fees
 */
export function calculateFees(
  amount: number,
  method: string,
  tier: string = 'Startup'
): {
  platformFee: number;
  processingFee: number;
  totalFees: number;
  netAmount: number;
} {
  let platformFeeRate = 0.035; // 3.5% default
  let processingFeeRate = 0.029; // 2.9% default
  let fixedFee = 0.30;
  
  // Tier-based fee discounts
  switch (tier) {
    case 'Growth':
      platformFeeRate = 0.025; // 2.5%
      break;
    case 'Enterprise':
      platformFeeRate = 0.015; // 1.5%
      break;
    case 'Custom':
      platformFeeRate = 0.01; // 1.0%
      break;
  }
  
  // Method-specific processing fees
  switch (method.toLowerCase()) {
    case 'usdc':
      processingFeeRate = 0.005; // 0.5%
      fixedFee = 0.01;
      break;
    case 'stripe':
      processingFeeRate = 0.029; // 2.9%
      fixedFee = 0.30;
      break;
    case 'paypal':
      processingFeeRate = 0.0349; // 3.49%
      fixedFee = 0.49;
      break;
    case 'crypto':
      processingFeeRate = 0.015; // 1.5%
      fixedFee = 0.02;
      break;
  }
  
  const platformFee = amount * platformFeeRate;
  const processingFee = amount * processingFeeRate + fixedFee;
  const totalFees = platformFee + processingFee;
  const netAmount = amount - totalFees;
  
  return {
    platformFee: Math.round(platformFee * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await sleep(backoffDelay);
    }
  }
  
  throw lastError!;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize string for logging (remove sensitive data)
 */
export function sanitizeForLogging(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sanitized = { ...obj };
  const sensitiveFields = [
    'password', 'apiKey', 'secret', 'token', 'privateKey',
    'licenseKey', 'cardNumber', 'cvv', 'ssn', 'taxId'
  ];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }
  
  return result;
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Check if running in Node.js environment
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Parse error message from various error types
 */
export function parseErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  return 'Unknown error occurred';
}