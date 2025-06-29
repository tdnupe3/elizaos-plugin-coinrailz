/**
 * PayPal Payment Service
 * Handles PayPal payment processing for the Coin Railz platform
 */

import { env } from '../environment';

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrderRequest {
  intent: 'CAPTURE';
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
  }>;
  application_context?: {
    return_url?: string;
    cancel_url?: string;
    brand_name?: string;
    user_action?: 'PAY_NOW' | 'CONTINUE';
  };
}

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

  async createOrder(orderData: {
    amount: number;
    currency: string;
    description?: string;
    returnUrl?: string;
    cancelUrl?: string;
  }): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken();

    const orderRequest: PayPalOrderRequest = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: orderData.currency.toUpperCase(),
          value: orderData.amount.toFixed(2),
        },
        description: orderData.description || 'Coin Railz Payment',
      }],
      application_context: {
        return_url: orderData.returnUrl || `${env.FRONTEND_URL}/payment/success`,
        cancel_url: orderData.cancelUrl || `${env.FRONTEND_URL}/payment/cancel`,
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

    return await response.json();
  }

  async captureOrder(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

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

    return await response.json();
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