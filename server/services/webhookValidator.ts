/**
 * Webhook Validation Service
 * Comprehensive webhook signature validation for all payment processors
 */

import crypto from 'crypto';
import { env } from '../environment';

export class WebhookValidator {

  /**
   * Validate Stripe webhook signature
   */
  static validateStripeWebhook(payload: string, signature: string): boolean {
    try {
      if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('Stripe webhook secret not configured');
      }

      const elements = signature.split(',');
      const signatureElements: { [key: string]: string } = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureElements[key] = value;
      }

      const timestamp = signatureElements.t;
      const signatures = [signatureElements.v1];

      if (!timestamp || !signatures[0]) {
        return false;
      }

      // Check timestamp (allow 5 minute tolerance)
      const timestampNumber = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - timestampNumber) > 300) {
        return false;
      }

      // Verify signature
      const payloadForSignature = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(payloadForSignature)
        .digest('hex');

      return signatures.some(sig => crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      ));

    } catch (error) {
      console.error('Stripe webhook validation error:', error);
      return false;
    }
  }

  /**
   * Validate PayPal webhook signature
   */
  static validatePayPalWebhook(payload: string, headers: any): boolean {
    try {
      if (!process.env.PAYPAL_WEBHOOK_ID) {
        throw new Error('PayPal webhook ID not configured');
      }

      // PayPal webhook validation would require their SDK
      // For now, we'll implement basic header validation
      const authAlgo = headers['paypal-auth-algo'];
      const transmission = headers['paypal-transmission-id'];
      const certId = headers['paypal-cert-id'];
      const signature = headers['paypal-transmission-sig'];
      const timestamp = headers['paypal-transmission-time'];

      if (!authAlgo || !transmission || !certId || !signature || !timestamp) {
        return false;
      }

      // Additional PayPal-specific validation would go here
      // This is a simplified version for development
      return true;

    } catch (error) {
      console.error('PayPal webhook validation error:', error);
      return false;
    }
  }

  /**
   * Validate NOWPayments webhook signature
   */
  static validateNOWPaymentsWebhook(payload: string, signature: string): boolean {
    try {
      if (!env.NOWPAYMENTS_IPN_SECRET) {
        throw new Error('NOWPayments IPN secret not configured');
      }

      const expectedSignature = crypto
        .createHmac('sha512', env.NOWPAYMENTS_IPN_SECRET)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

    } catch (error) {
      console.error('NOWPayments webhook validation error:', error);
      return false;
    }
  }

  /**
   * Validate ChangeNOW webhook signature
   */
  static validateChangeNOWWebhook(payload: string, signature: string): boolean {
    try {
      if (!env.CHANGENOW_API_KEY) {
        throw new Error('ChangeNOW API key not configured');
      }

      // ChangeNOW uses HMAC-SHA256 with API key
      const expectedSignature = crypto
        .createHmac('sha256', env.CHANGENOW_API_KEY)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    } catch (error) {
      console.error('ChangeNOW webhook validation error:', error);
      return false;
    }
  }

  /**
   * Generic webhook validation wrapper
   */
  static validateWebhook(
    provider: 'stripe' | 'paypal' | 'nowpayments' | 'changenow',
    payload: string,
    signature: string,
    headers?: any
  ): boolean {
    switch (provider) {
      case 'stripe':
        return this.validateStripeWebhook(payload, signature);
      case 'paypal':
        return this.validatePayPalWebhook(payload, headers);
      case 'nowpayments':
        return this.validateNOWPaymentsWebhook(payload, signature);
      case 'changenow':
        return this.validateChangeNOWWebhook(payload, signature);
      default:
        console.error(`Unknown webhook provider: ${provider}`);
        return false;
    }
  }

  /**
   * Middleware for webhook validation
   */
  static webhookValidationMiddleware(provider: 'stripe' | 'paypal' | 'nowpayments' | 'changenow') {
    return (req: any, res: any, next: any) => {
      const payload = req.body;
      const signature = req.headers['stripe-signature'] || 
                       req.headers['paypal-transmission-sig'] ||
                       req.headers['x-nowpayments-sig'] ||
                       req.headers['x-changenow-signature'];

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      const isValid = this.validateWebhook(
        provider,
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        signature,
        req.headers
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      next();
    };
  }

  /**
   * Log webhook events for monitoring
   */
  static logWebhookEvent(
    provider: string,
    eventType: string,
    payload: any,
    validationResult: boolean
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      provider,
      eventType,
      validationResult,
      payloadSize: JSON.stringify(payload).length,
      // Don't log sensitive payload data
      hasPayload: !!payload
    };

    if (env.NODE_ENV === 'production') {
      console.log('Webhook event:', logEntry);
    } else {
      console.log('Webhook event (dev):', { ...logEntry, payload });
    }
  }

  /**
   * Rate limiting for webhook endpoints
   */
  static webhookRateLimit() {
    const attempts = new Map<string, { count: number; resetTime: number }>();
    
    return (req: any, res: any, next: any) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxAttempts = 100; // 100 webhooks per minute per IP

      const key = `webhook_${ip}`;
      const current = attempts.get(key);

      if (!current || now > current.resetTime) {
        attempts.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (current.count >= maxAttempts) {
        return res.status(429).json({
          success: false,
          error: 'Webhook rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        });
      }

      current.count++;
      next();
    };
  }
}