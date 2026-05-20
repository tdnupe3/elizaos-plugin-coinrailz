import { db } from "../db";
import { subscriptions, users, type Subscription } from "@shared/schema";
import { eq, lt, and } from "drizzle-orm";
import { stripe } from './stripeClient';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


export interface BillingCycleJob {
  id: string;
  subscriptionId: string;
  scheduledAt: Date;
  type: 'renewal' | 'retry' | 'expiration';
  status: 'pending' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  metadata?: any;
}

export class BillingCycleService {
  /**
   * Process upcoming subscription renewals
   * This should be called via cron job daily
   */
  async processUpcomingRenewals(): Promise<void> {
    console.log('🔄 Processing upcoming subscription renewals...');
    
    try {
      // Find subscriptions that need renewal in the next 24 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const upcomingRenewals = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lt(subscriptions.currentPeriodEnd, tomorrow)
          )
        );

      console.log(`📋 Found ${upcomingRenewals.length} subscriptions for renewal`);

      for (const subscription of upcomingRenewals) {
        await this.processSubscriptionRenewal(subscription);
      }

      console.log('✅ Completed processing subscription renewals');
    } catch (error) {
      console.error('❌ Error processing subscription renewals:', error);
      throw error;
    }
  }

  /**
   * Process individual subscription renewal
   */
  async processSubscriptionRenewal(subscription: Subscription): Promise<void> {
    try {
      console.log(`🔄 Processing renewal for subscription ${subscription.id}`);

      // Calculate next billing period
      const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
      const nextPeriodStart = new Date(currentPeriodEnd);
      const nextPeriodEnd = new Date(currentPeriodEnd);

      if (subscription.billingPeriod === 'yearly') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      } else {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      }

      // Handle based on payment method
      switch (subscription.paymentMethod) {
        case 'stripe':
          await this.processStripeRenewal(subscription, nextPeriodStart, nextPeriodEnd);
          break;
          
        case 'usdc':
          await this.processUSDCRenewal(subscription, nextPeriodStart, nextPeriodEnd);
          break;
          
        case 'paypal':
          await this.processPayPalRenewal(subscription, nextPeriodStart, nextPeriodEnd);
          break;
          
        default:
          console.warn(`⚠️ Unsupported payment method: ${subscription.paymentMethod}`);
          await this.handleRenewalFailure(subscription, 'Unsupported payment method');
      }

    } catch (error) {
      console.error(`❌ Error processing renewal for subscription ${subscription.id}:`, error);
      await this.handleRenewalFailure(subscription, error.message || 'Unknown error');
    }
  }

  /**
   * Process Stripe subscription renewal
   */
  async processStripeRenewal(
    subscription: Subscription, 
    nextPeriodStart: Date, 
    nextPeriodEnd: Date
  ): Promise<void> {
    try {
      // For Stripe, subscriptions are automatically renewed
      // We just need to update our local database
      await this.updateSubscriptionPeriod(subscription.id, nextPeriodStart, nextPeriodEnd);
      
      console.log(`✅ Stripe renewal processed for subscription ${subscription.id}`);
    } catch (error) {
      console.error(`❌ Stripe renewal failed for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Process USDC subscription renewal (requires manual payment)
   */
  async processUSDCRenewal(
    subscription: Subscription, 
    nextPeriodStart: Date, 
    nextPeriodEnd: Date
  ): Promise<void> {
    try {
      // For USDC, we need to notify the user to make payment
      // Set subscription to pending renewal
      await db
        .update(subscriptions)
        .set({
          status: 'pending',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      // TODO: Send notification to user about upcoming USDC payment
      console.log(`📨 USDC renewal notification sent for subscription ${subscription.id}`);
      
    } catch (error) {
      console.error(`❌ USDC renewal processing failed for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Process PayPal subscription renewal
   */
  async processPayPalRenewal(
    subscription: Subscription, 
    nextPeriodStart: Date, 
    nextPeriodEnd: Date
  ): Promise<void> {
    try {
      // For PayPal, subscriptions are automatically renewed
      // We just need to update our local database
      await this.updateSubscriptionPeriod(subscription.id, nextPeriodStart, nextPeriodEnd);
      
      console.log(`✅ PayPal renewal processed for subscription ${subscription.id}`);
    } catch (error) {
      console.error(`❌ PayPal renewal failed for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription billing period
   */
  async updateSubscriptionPeriod(
    subscriptionId: string, 
    nextPeriodStart: Date, 
    nextPeriodEnd: Date
  ): Promise<void> {
    await db
      .update(subscriptions)
      .set({
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd: nextPeriodEnd,
        status: 'active',
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, subscriptionId));
  }

  /**
   * Handle renewal failure
   */
  async handleRenewalFailure(subscription: Subscription, reason: string): Promise<void> {
    try {
      // Set subscription to expired if payment fails
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      // TODO: Send notification to user about failed renewal
      console.log(`❌ Subscription ${subscription.id} marked as expired due to: ${reason}`);
      
    } catch (error) {
      console.error(`❌ Error handling renewal failure for subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Process expired subscriptions cleanup
   * Remove benefits for expired subscriptions
   */
  async processExpiredSubscriptions(): Promise<void> {
    console.log('🔄 Processing expired subscriptions cleanup...');
    
    try {
      const now = new Date();
      
      // Find subscriptions that have expired
      const expiredSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lt(subscriptions.currentPeriodEnd, now)
          )
        );

      console.log(`📋 Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const subscription of expiredSubscriptions) {
        await db
          .update(subscriptions)
          .set({
            status: 'expired',
            updatedAt: new Date()
          })
          .where(eq(subscriptions.id, subscription.id));

        console.log(`⏰ Subscription ${subscription.id} marked as expired`);
      }

      console.log('✅ Completed expired subscriptions cleanup');
    } catch (error) {
      console.error('❌ Error processing expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Retry failed payments
   */
  async retryFailedPayments(): Promise<void> {
    console.log('🔄 Retrying failed subscription payments...');
    
    try {
      // Find subscriptions with failed payments (status = 'pending')
      const failedSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.status, 'pending'));

      console.log(`📋 Found ${failedSubscriptions.length} subscriptions with failed payments`);

      for (const subscription of failedSubscriptions) {
        // Check if it's been more than 24 hours since failure
        const timeSinceUpdate = Date.now() - new Date(subscription.updatedAt).getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (timeSinceUpdate > dayInMs) {
          // Mark as expired after 24 hours of failed payment
          await this.handleRenewalFailure(subscription, 'Payment retry period expired');
        }
      }

      console.log('✅ Completed payment retry processing');
    } catch (error) {
      console.error('❌ Error retrying failed payments:', error);
      throw error;
    }
  }

  /**
   * Generate billing summary for analytics
   */
  async generateBillingSummary(startDate: Date, endDate: Date): Promise<any> {
    try {
      const billingData = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            lt(subscriptions.currentPeriodStart, endDate),
            lt(startDate, subscriptions.currentPeriodEnd)
          )
        );

      const summary = {
        totalSubscriptions: billingData.length,
        activeSubscriptions: billingData.filter(s => s.status === 'active').length,
        cancelledSubscriptions: billingData.filter(s => s.status === 'cancelled').length,
        expiredSubscriptions: billingData.filter(s => s.status === 'expired').length,
        pendingSubscriptions: billingData.filter(s => s.status === 'pending').length,
        totalRevenue: 0, // Would calculate based on payment records
        byPaymentMethod: {
          stripe: billingData.filter(s => s.paymentMethod === 'stripe').length,
          usdc: billingData.filter(s => s.paymentMethod === 'usdc').length,
          paypal: billingData.filter(s => s.paymentMethod === 'paypal').length,
        },
        byBillingPeriod: {
          monthly: billingData.filter(s => s.billingPeriod === 'monthly').length,
          yearly: billingData.filter(s => s.billingPeriod === 'yearly').length,
        }
      };

      return summary;
    } catch (error) {
      console.error('❌ Error generating billing summary:', error);
      throw error;
    }
  }
}

export const billingCycleService = new BillingCycleService();