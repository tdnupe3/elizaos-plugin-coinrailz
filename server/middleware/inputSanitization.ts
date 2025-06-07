/**
 * Input Sanitization Middleware
 * Prevents XSS, SQL injection, and other input-based attacks
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Use DOMPurify for XSS protection
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    // Additional encoding for special characters
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return sanitized.trim();
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input: string): number | null {
    if (!input) return null;
    
    // Remove any non-numeric characters except decimal point and minus
    const cleaned = String(input).replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed) || !isFinite(parsed)) return null;
    return parsed;
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    
    // Basic email sanitization
    return email
      .toLowerCase()
      .trim()
      .replace(/[^\w@.-]/g, '')
      .substring(0, 254); // RFC 5321 limit
  }

  /**
   * Sanitize wallet address
   */
  static sanitizeWalletAddress(address: string): string {
    if (!address || typeof address !== 'string') return '';
    
    // Remove any suspicious characters, keep only alphanumeric
    return address.replace(/[^a-zA-Z0-9]/g, '').substring(0, 128);
  }

  /**
   * Deep sanitize object properties
   */
  static sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = this.sanitizeString(key);
      
      if (typeof value === 'string') {
        sanitized[cleanKey] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitized[cleanKey] = value;
      } else if (typeof value === 'object') {
        sanitized[cleanKey] = this.sanitizeObject(value);
      } else {
        sanitized[cleanKey] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Middleware for request sanitization
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }
        
        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }
        
        next();
      } catch (error) {
        console.error('Input sanitization failed:', error);
        res.status(400).json({
          error: 'Invalid input data',
          message: 'Request contains invalid or malicious content'
        });
      }
    };
  }
}

export default InputSanitizer;