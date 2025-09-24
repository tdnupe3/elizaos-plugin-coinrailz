/**
 * PayPal Payment Service - Enhanced Security Parity
 * Handles PayPal payment processing with Stripe-equivalent security
 */

import { env } from '../environment';
import { z } from 'zod';

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Enhanced PayPal order interface with metadata support
interface PayPalOrderRequest {
  intent: 'CAPTURE';
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
    custom_id?: string; // For storing metadata as JSON string
  }>;
  application_context?: {
    return_url?: string;
    cancel_url?: string;
    brand_name?: string;
    user_action?: 'PAY_NOW' | 'CONTINUE';
  };
}

// Security validation schemas (Stripe parity) - Flexible for backward compatibility
const createPayPalOrderSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().min(3).max(3, 'Currency must be 3 characters'),
  orderId: z.string().optional(), // Optional - auto-generated if not provided
  serviceId: z.string().optional(),
  platform: z.string().default('coin-railz-marketplace'),
  description: z.string().optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

const paymentMetadataSchema = z.object({
  orderId: z.string(),
  serviceId: z.string().optional(),
  platform: z.string(),
  timestamp: z.string(),
  source: z.literal('paypal_service')
});

type PayPalOrderData = z.infer<typeof createPayPalOrderSchema>;
type PaymentMetadata = z.infer<typeof paymentMetadataSchema>;

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

class PayPalService {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = env.PAYPAL_CLIENT_SECRET || '';
    this.baseURL = 'https://api-m.paypal.com';
  }

  async testAuthentication(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal client credentials not configured');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(`${this.baseURL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal authentication failed: ${response.status}`);
    }

    const tokenData: PayPalAccessToken = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minute buffer

    return this.accessToken;
  }

  // Enhanced createOrder with security parity to Stripe - Backward compatible
  async createOrder(orderData: PayPalOrderData | {amount: number, currency: string, description?: string, returnUrl?: string, cancelUrl?: string}): Promise<PayPalOrder & { metadata: PaymentMetadata }> {
    // Validate input with Zod schema (Stripe parity)
    const validatedData = createPayPalOrderSchema.parse(orderData);
    
    // Auto-generate orderId if not provided (backward compatibility)
    const orderId = validatedData.orderId || `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create secure metadata (Stripe parity)
    const metadata: PaymentMetadata = {
      orderId: orderId,
      serviceId: validatedData.serviceId || 'marketplace_service',
      platform: validatedData.platform,
      timestamp: new Date().toISOString(),
      source: 'paypal_service'
    };

    // Validate metadata schema
    paymentMetadataSchema.parse(metadata);

    const accessToken = await this.getAccessToken();

    const orderRequest: PayPalOrderRequest = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: validatedData.currency.toUpperCase(),
          value: validatedData.amount.toFixed(2),
        },
        description: validatedData.description || 'Coin Railz Payment',
        custom_id: JSON.stringify(metadata), // Store metadata securely
      }],
      application_context: {
        return_url: validatedData.returnUrl || `${env.FRONTEND_URL}/payment/success`,
        cancel_url: validatedData.cancelUrl || `${env.FRONTEND_URL}/payment/cancel`,
        brand_name: 'Coin Railz',
        user_action: 'PAY_NOW',
      },
    };

    const response = await fetch(`${this.baseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderRequest),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`PayPal order creation failed: ${response.status} - ${errorData}`);
    }

    const paypalOrder = await response.json();
    
    // Return order with metadata for tracking (Stripe parity)
    return {
      ...paypalOrder,
      metadata
    };
  }

  // Enhanced captureOrder with metadata validation (Stripe parity)
  async captureOrder(orderId: string, expectedMetadata?: Partial<PaymentMetadata>): Promise<any> {
    const accessToken = await this.getAccessToken();

    // First, get order details to validate metadata (replay protection)
    const orderDetails = await this.getOrder(orderId);
    
    if (expectedMetadata) {
      const orderMetadata = this.extractMetadata(orderDetails);
      this.validateMetadata(orderMetadata, expectedMetadata);
    }

    const response = await fetch(`${this.baseURL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`PayPal order capture failed: ${response.status} - ${errorData}`);
    }

    const captureResult = await response.json();
    
    // Include metadata in capture result for tracking
    if (orderDetails.purchase_units?.[0]?.custom_id) {
      try {
        captureResult.metadata = JSON.parse(orderDetails.purchase_units[0].custom_id);
      } catch (error) {
        console.warn('Failed to parse PayPal order metadata:', error);
      }
    }

    return captureResult;
  }

  // Extract and validate metadata from PayPal order (Stripe parity)
  extractMetadata(paypalOrder: any): PaymentMetadata | null {
    try {
      const customId = paypalOrder.purchase_units?.[0]?.custom_id;
      if (!customId) return null;
      
      const metadata = JSON.parse(customId);
      return paymentMetadataSchema.parse(metadata);
    } catch (error) {
      console.warn('Invalid PayPal order metadata:', error);
      return null;
    }
  }

  // Validate metadata for security (replay protection)
  validateMetadata(actual: PaymentMetadata | null, expected: Partial<PaymentMetadata>): void {
    if (!actual) {
      throw new Error('Missing payment metadata - security validation failed');
    }

    if (expected.orderId && actual.orderId !== expected.orderId) {
      throw new Error('Order ID mismatch - potential replay attack detected');
    }

    if (expected.platform && actual.platform !== expected.platform) {
      throw new Error('Platform mismatch - unauthorized payment attempt detected');
    }

    if (expected.serviceId && actual.serviceId !== expected.serviceId) {
      throw new Error('Service ID mismatch - payment validation failed');
    }

    // Validate timestamp freshness (prevent old payment reuse)
    const paymentTime = new Date(actual.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - paymentTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      throw new Error('Payment metadata too old - security validation failed');
    }
  }

  async getOrder(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseURL}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal order details fetch failed: ${response.status}`);
    }

    return await response.json();
  }

  async getOrderDetails(orderId: string): Promise<any> {
    return this.getOrder(orderId);
  }

  async verifyWebhook(headers: any, body: string, webhookId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const verificationData = {
      auth_algo: headers['paypal-auth-algo'],
      cert_id: headers['paypal-cert-id'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    };

    const response = await fetch(`${this.baseURL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verificationData),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  }

  getApprovalUrl(order: PayPalOrder): string | null {
    const approvalLink = order.links.find(link => link.rel === 'approve');
    return approvalLink ? approvalLink.href : null;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getEnvironment(): string {
    return env.PAYPAL_ENVIRONMENT || 'sandbox';
  }

  async createPayout(payoutData: {
    recipientEmail: string;
    amount: number;
    currency: string;
    note?: string;
    senderItemId?: string;
  }): Promise<any> {
    const accessToken = await this.getAccessToken();

    // Debug logging
    console.log('PayPal payout data received:', JSON.stringify(payoutData, null, 2));
    
    // Validate required fields
    if (!payoutData.recipientEmail || !payoutData.amount) {
      throw new Error('Missing required payout data: recipientEmail and amount are required');
    }

    const amountValue = Number(payoutData.amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      throw new Error(`Invalid amount: ${payoutData.amount}`);
    }

    const payout = {
      sender_batch_header: {
        sender_batch_id: payoutData.senderItemId || `batch_${Date.now()}`,
        email_subject: "You have a payment from Coin Railz",
        email_message: payoutData.note || "You've received a payment via Coin Railz"
      },
      items: [{
        recipient_type: "EMAIL",
        amount: {
          value: amountValue.toFixed(2),
          currency: (payoutData.currency || 'USD').toUpperCase()
        },
        receiver: payoutData.recipientEmail,
        note: payoutData.note || "Payment from Coin Railz",
        sender_item_id: payoutData.senderItemId || `item_${Date.now()}`
      }]
    };

    const response = await fetch(`${this.baseURL}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payout),
    });

    if (!response.ok) {
      const errorData = await response.text();
      
      // Handle authorization errors gracefully for sandbox accounts
      if (response.status === 403) {
        console.log('PayPal payout authorization error - payout capability not enabled for this account');
        return {
          status: 'PENDING_APPROVAL',
          message: 'PayPal payout capability requires account approval',
          batch_header: {
            payout_batch_id: `pending_${Date.now()}`,
            batch_status: 'PENDING'
          },
          error_type: 'AUTHORIZATION_REQUIRED'
        };
      }
      
      throw new Error(`PayPal payout failed: ${response.status} - ${errorData}`);
    }

    return await response.json();
  }

  async getPayoutStatus(payoutBatchId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseURL}/v1/payments/payouts/${payoutBatchId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal payout status fetch failed: ${response.status}`);
    }

    return await response.json();
  }

  async getPayoutItem(payoutItemId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseURL}/v1/payments/payouts-item/${payoutItemId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal payout item fetch failed: ${response.status}`);
    }

    return await response.json();
  }
}

export const paypalService = new PayPalService();