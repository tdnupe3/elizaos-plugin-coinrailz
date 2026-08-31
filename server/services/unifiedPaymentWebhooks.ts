/**
 * 🔄 UNIFIED PAYMENT WEBHOOK HANDLER
 * Triggers product delivery for ALL payment methods (Stripe, PayPal, Circle, Crypto, XRP)
 * CRITICAL: Ensures every paying customer gets their products delivered!
 */

import { productDelivery } from './productDeliveryService.js';
import crypto from 'crypto';
import { db } from '../db';
import { aiAgentSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export class UnifiedPaymentWebhooks {
  /**
   * 🎯 HANDLE STRIPE WEBHOOK
   */
  async handleStripeWebhook(event: any): Promise<void> {
    try {
      console.log(`💳 Stripe webhook received: ${event.type}`);
      
      if (event.type === 'payment_intent.succeeded' || 
          event.type === 'checkout.session.completed' ||
          event.type === 'invoice.payment_succeeded') {
        
        const paymentData = this.extractStripePaymentData(event);
        await this.processSuccessfulPayment(paymentData);
      }
      
    } catch (error) {
      console.error('❌ Stripe webhook error:', error);
      throw error;
    }
  }

  /**
   * 💙 HANDLE PAYPAL WEBHOOK
   */
  async handlePayPalWebhook(event: any): Promise<void> {
    try {
      console.log(`💙 PayPal webhook received: ${event.event_type}`);
      
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || 
          event.event_type === 'CHECKOUT.ORDER.APPROVED' ||
          event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        
        const paymentData = this.extractPayPalPaymentData(event);
        await this.processSuccessfulPayment(paymentData);
      }
      
    } catch (error) {
      console.error('❌ PayPal webhook error:', error);
      throw error;
    }
  }

  /**
   * 🔵 HANDLE CIRCLE/USDC WEBHOOK
   */
  async handleCircleWebhook(event: any): Promise<void> {
    try {
      console.log(`🔵 Circle webhook received: ${event.Type}`);
      
      if (event.Type === 'transfers' && event.Status === 'complete') {
        const paymentData = this.extractCirclePayhmentData(event);
        await this.processSuccessfulPayment(paymentData);
      }
      
    } catch (error) {
      console.error('❌ Circle webhook error:', error);
      throw error;
    }
  }

  /**
   * ⛓️ HANDLE CRYPTO PAYMENT CONFIRMATION
   */
  async handleCryptoPayment(paymentData: any): Promise<void> {
    try {
      console.log(`⛓️ Crypto payment confirmed: ${paymentData.chain}`);
      
      const processedData = this.extractCryptoPaymentData(paymentData);
      await this.processSuccessfulPayment(processedData);
      
    } catch (error) {
      console.error('❌ Crypto payment error:', error);
      throw error;
    }
  }

  /**
   * 🌊 HANDLE XRP PAYMENT CONFIRMATION
   */
  async handleXRPPayment(paymentData: any): Promise<void> {
    try {
      console.log(`🌊 XRP payment confirmed: ${paymentData.transaction_hash}`);
      
      const processedData = this.extractXRPPaymentData(paymentData);
      await this.processSuccessfulPayment(processedData);
      
    } catch (error) {
      console.error('❌ XRP payment error:', error);
      throw error;
    }
  }

  /**
   * 🎯 UNIFIED PAYMENT PROCESSING
   * Core function that triggers product delivery regardless of payment method
   */
  private async processSuccessfulPayment(paymentData: any): Promise<void> {
    try {
      console.log(`🎯 Processing successful payment:`, {
        method: paymentData.paymentMethod,
        amount: paymentData.amount,
        agentId: paymentData.agentId,
        productId: paymentData.productId
      });
      
      // Generate API key for the subscription
      const apiKey = this.generateAPIKey(paymentData.agentId, paymentData.productId);
      
      // Create or update subscription record
      const subscription = await this.createSubscription(paymentData, apiKey);
      
      // Trigger product delivery based on product type
      await this.deliverProduct(subscription, paymentData);
      
      console.log(`✅ Product delivery completed for ${paymentData.agentId} via ${paymentData.paymentMethod}`);
      
    } catch (error) {
      console.error('❌ Failed to process successful payment:', error);
      throw error;
    }
  }

  /**
   * 📦 DELIVER PRODUCT BASED ON TYPE
   */
  private async deliverProduct(subscription: any, paymentData: any): Promise<void> {
    try {
      const productType = this.getProductType(paymentData.productId);
      
      switch (productType) {
        case 'api_access':
          await productDelivery.deliverAPIAccess(subscription, subscription.apiKey);
          break;
          
        case 'sdk_license':
          const licenseKey = this.generateLicenseKey(subscription.agentId);
          await productDelivery.deliverSDKAccess(subscription, licenseKey);
          break;
          
        case 'enterprise_report':
          const reportType = this.getReportType(paymentData.productId);
          await productDelivery.deliverEnterpriseReport(subscription, reportType);
          break;
          
        case 'competition_access':
          await productDelivery.deliverCompetitionAccess(subscription.agentId);
          break;
          
        default:
          await productDelivery.deliverAPIAccess(subscription, subscription.apiKey);
      }
      
    } catch (error) {
      console.error('❌ Product delivery failed:', error);
      throw error;
    }
  }

  /**
   * 🔑 GENERATE API KEY
   */
  private generateAPIKey(agentId: string, productId: number): string {
    const tier = this.getTierName(productId);
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `cr_${tier.toLowerCase()}_${timestamp}_${random}`;
  }

  /**
   * 🛡️ GENERATE LICENSE KEY
   */
  private generateLicenseKey(agentId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(20).toString('hex');
    return `CRL_${timestamp}_${random}`;
  }

  /**
   * 📝 CREATE SUBSCRIPTION RECORD
   */
  private async createSubscription(paymentData: any, apiKey: string): Promise<any> {
    try {
      // Create subscription in database (using simplified storage for now)
      const subscription = {
        id: `sub_${Date.now()}`,
        agentId: paymentData.agentId,
        productId: paymentData.productId,
        apiKey: apiKey,
        status: 'active',
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        currency: paymentData.currency,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        usageStats: {
          requests_today: 0,
          requests_month: 0,
          last_reset: new Date().toISOString()
        },
        monthlyRevenue: parseFloat(paymentData.amount) || 0
      };
      
      console.log(`📝 Subscription created: ${subscription.id} for agent ${paymentData.agentId}`);
      return subscription;
      
    } catch (error) {
      console.error('❌ Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * 🔧 PAYMENT DATA EXTRACTORS
   */
  private extractStripePaymentData(event: any): any {
    const payment = event.data.object;
    return {
      paymentMethod: 'stripe',
      paymentId: payment.id,
      amount: (payment.amount / 100).toString(), // Convert from cents
      currency: payment.currency.toUpperCase(),
      agentId: payment.metadata?.agent_id || 'unknown',
      productId: parseInt(payment.metadata?.product_id) || 1,
      customerEmail: payment.receipt_email || payment.customer?.email
    };
  }

  private extractPayPalPaymentData(event: any): any {
    const resource = event.resource;
    return {
      paymentMethod: 'paypal',
      paymentId: resource.id,
      amount: resource.amount?.total || resource.purchase_units?.[0]?.amount?.value,
      currency: resource.amount?.currency || resource.purchase_units?.[0]?.amount?.currency_code,
      agentId: resource.custom_id || 'unknown',
      productId: parseInt(resource.invoice_id) || 1,
      customerEmail: resource.payer?.email_address
    };
  }

  private extractCirclePayhmentData(event: any): any {
    return {
      paymentMethod: 'circle_usdc',
      paymentId: event.transferId,
      amount: event.amount?.amount,
      currency: 'USDC',
      agentId: event.userToken || 'unknown',
      productId: parseInt(event.businessToken) || 1,
      walletAddress: event.destination?.address
    };
  }

  private extractCryptoPaymentData(paymentData: any): any {
    return {
      paymentMethod: `crypto_${paymentData.chain.toLowerCase()}`,
      paymentId: paymentData.transaction_hash,
      amount: paymentData.amount,
      currency: paymentData.token || 'ETH',
      agentId: paymentData.metadata?.agent_id || 'unknown',
      productId: parseInt(paymentData.metadata?.product_id) || 1,
      walletAddress: paymentData.from_address
    };
  }

  private extractXRPPaymentData(paymentData: any): any {
    return {
      paymentMethod: 'xrp',
      paymentId: paymentData.transaction_hash,
      amount: paymentData.delivered_amount?.value,
      currency: 'XRP',
      agentId: paymentData.destination_tag || 'unknown',
      productId: parseInt(paymentData.memo) || 1,
      walletAddress: paymentData.destination
    };
  }

  /**
   * 🏷️ HELPER METHODS
   */
  private getProductType(productId: number): string {
    const productTypes: Record<number, string> = {
      1: 'api_access',
      2: 'api_access', 
      3: 'api_access',
      4: 'sdk_license',
      5: 'enterprise_report',
      6: 'competition_access'
    };
    return productTypes[productId] || 'api_access';
  }

  private getReportType(productId: number): string {
    const reportTypes: Record<number, string> = {
      5: 'crypto_flow_intelligence',
      6: 'ai_marketplace_analytics'
    };
    return reportTypes[productId] || 'crypto_flow_intelligence';
  }

  private getTierName(productId: number): string {
    const tiers: Record<number, string> = { 1: 'Starter', 2: 'Pro', 3: 'Enterprise' };
    return tiers[productId] || 'Starter';
  }
}

// Export singleton instance
export const unifiedWebhooks = new UnifiedPaymentWebhooks();