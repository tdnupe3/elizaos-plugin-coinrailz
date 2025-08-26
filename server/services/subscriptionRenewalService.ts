import { db } from "../db";
import { subscriptions, users, type Subscription } from "@shared/schema";
import { eq, and, lte, gte, isNull, or } from "drizzle-orm";
import { subscriptionNotificationService } from "./subscriptionNotificationService";
import { subscriptionStatusService } from "./subscriptionStatusService";

export interface RenewalResult {
  success: boolean;
  subscriptionId: number;
  userId: string;
  amount: number;
  nextBillingDate: Date;
  paymentMethod: string;
  error?: string;
}

export interface RenewalAttempt {
  attempt: number;
  scheduledDate: Date;
  status: 'pending' | 'success' | 'failed';
  errorReason?: string;
}

export class SubscriptionRenewalService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_INTERVALS = [1, 3, 7]; // Days between retries

  /**
   * Process all subscriptions due for renewal
   */
  async processRenewals(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: RenewalResult[];
  }> {
    try {
      console.log('🔄 Starting subscription renewal processing...');
      
      // Get subscriptions due for renewal (within next 24 hours)
      const dueSubscriptions = await this.getSubscriptionsDueForRenewal();
      
      console.log(`📅 Found ${dueSubscriptions.length} subscriptions due for renewal`);
      
      const results: RenewalResult[] = [];
      let successful = 0;
      let failed = 0;

      // Process each subscription
      for (const subscription of dueSubscriptions) {
        try {
          const result = await this.processSubscriptionRenewal(subscription);
          results.push(result);
          
          if (result.success) {
            successful++;
            console.log(`✅ Renewed subscription ${subscription.id} for user ${subscription.userId}`);
          } else {
            failed++;
            console.log(`❌ Failed to renew subscription ${subscription.id}: ${result.error}`);
          }
          
          // Small delay between renewals to avoid overwhelming payment processors
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          failed++;
          console.error(`💥 Error processing subscription ${subscription.id}:`, error);
          results.push({
            success: false,
            subscriptionId: subscription.id,
            userId: subscription.userId,
            amount: 0,
            nextBillingDate: new Date(),
            paymentMethod: 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`🎯 Renewal processing complete: ${successful} successful, ${failed} failed`);
      
      return {
        processed: dueSubscriptions.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('💥 Failed to process renewals:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }
  }

  /**
   * Process renewal for a specific subscription
   */
  async processSubscriptionRenewal(subscription: Subscription): Promise<RenewalResult> {
    try {
      // Get user information
      const [user] = await db.select().from(users).where(eq(users.id, subscription.userId));
      if (!user) {
        throw new Error('User not found');
      }

      // Determine payment method and amount
      const paymentMethod = this.determinePaymentMethod(subscription);
      const amount = this.calculateRenewalAmount(subscription.planId);
      
      // Process payment
      const paymentResult = await this.processRenewalPayment(subscription, amount, paymentMethod);
      
      if (paymentResult.success) {
        // Update subscription with new billing period
        const nextBillingDate = this.calculateNextBillingDate(subscription);
        
        await db
          .update(subscriptions)
          .set({
            currentPeriodStart: new Date(),
            currentPeriodEnd: nextBillingDate,
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(subscriptions.id, subscription.id));

        // Clear subscription cache
        subscriptionStatusService.clearUserCache(subscription.userId);

        // Send renewal success notification
        await subscriptionNotificationService.sendNotification({
          type: 'subscription_renewed',
          userId: subscription.userId,
          email: user.email || '',
          data: {
            planName: subscription.planId,
            amount: amount.toFixed(2),
            nextBillingDate: nextBillingDate.toLocaleDateString()
          }
        });

        // Track successful renewal
        await this.trackRenewalEvent(subscription.id, 'success', amount);

        return {
          success: true,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          amount,
          nextBillingDate,
          paymentMethod
        };

      } else {
        // Payment failed - schedule retry
        await this.scheduleRenewalRetry(subscription, paymentResult.error || 'Payment failed');
        
        // Send payment failure notification
        await subscriptionNotificationService.sendPaymentFailure(
          subscription.userId,
          user.email || '',
          paymentResult.error || 'Payment processing failed',
          this.calculateRetryDate(1)
        );

        // Track failed renewal
        await this.trackRenewalEvent(subscription.id, 'failed', amount, paymentResult.error);

        return {
          success: false,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          amount,
          nextBillingDate: subscription.currentPeriodEnd,
          paymentMethod,
          error: paymentResult.error
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.trackRenewalEvent(subscription.id, 'error', 0, errorMessage);
      
      return {
        success: false,
        subscriptionId: subscription.id,
        userId: subscription.userId,
        amount: 0,
        nextBillingDate: subscription.currentPeriodEnd,
        paymentMethod: 'unknown',
        error: errorMessage
      };
    }
  }

  /**
   * Get subscriptions due for renewal
   */
  private async getSubscriptionsDueForRenewal(): Promise<Subscription[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const now = new Date();

    return await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          lte(subscriptions.currentPeriodEnd, tomorrow),
          gte(subscriptions.currentPeriodEnd, now)
        )
      );
  }

  /**
   * Process payment for renewal
   */
  private async processRenewalPayment(
    subscription: Subscription, 
    amount: number, 
    paymentMethod: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`💳 Processing ${paymentMethod} payment for subscription ${subscription.id}: $${amount}`);

      switch (paymentMethod) {
        case 'stripe':
          return await this.processStripeRenewal(subscription, amount);
        
        case 'paypal':
          return await this.processPayPalRenewal(subscription, amount);
        
        case 'usdc':
          return await this.processUSDCRenewal(subscription, amount);
        
        default:
          return { success: false, error: 'Unsupported payment method' };
      }

    } catch (error) {
      console.error(`💥 Payment processing error:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment processing failed' 
      };
    }
  }

  /**
   * Process Stripe renewal payment
   */
  private async processStripeRenewal(subscription: Subscription, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Integrate with actual Stripe API
      console.log(`🟦 Processing Stripe renewal for subscription ${subscription.stripeSubscriptionId}`);
      
      // Simulate Stripe processing
      const success = Math.random() > 0.1; // 90% success rate simulation
      
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Stripe payment declined' };
      }

    } catch (error) {
      return { success: false, error: 'Stripe processing error' };
    }
  }

  /**
   * Process PayPal renewal payment
   */
  private async processPayPalRenewal(subscription: Subscription, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Integrate with actual PayPal API
      console.log(`🟨 Processing PayPal renewal for subscription ${subscription.paypalSubscriptionId}`);
      
      // Simulate PayPal processing
      const success = Math.random() > 0.15; // 85% success rate simulation
      
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'PayPal payment failed' };
      }

    } catch (error) {
      return { success: false, error: 'PayPal processing error' };
    }
  }

  /**
   * Process USDC renewal payment
   */
  private async processUSDCRenewal(subscription: Subscription, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Integrate with Circle USDC API
      console.log(`🟩 Processing USDC renewal for subscription with tx ${subscription.usdcPaymentTxHash}`);
      
      // Simulate USDC processing
      const success = Math.random() > 0.05; // 95% success rate simulation
      
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Insufficient USDC balance' };
      }

    } catch (error) {
      return { success: false, error: 'USDC processing error' };
    }
  }

  /**
   * Schedule renewal retry after payment failure
   */
  private async scheduleRenewalRetry(subscription: Subscription, errorReason: string): Promise<void> {
    try {
      // Get current retry count (would be stored in database in real implementation)
      const currentAttempt = 1; // Simplified - would track actual attempts
      
      if (currentAttempt < this.MAX_RETRY_ATTEMPTS) {
        const retryDate = this.calculateRetryDate(currentAttempt);
        
        console.log(`⏰ Scheduling retry ${currentAttempt + 1} for subscription ${subscription.id} on ${retryDate.toISOString()}`);
        
        // TODO: Store retry schedule in database
        // This would create a scheduled job or database entry for the retry
        
      } else {
        // Max retries reached - cancel subscription
        await this.cancelSubscriptionAfterFailures(subscription, errorReason);
      }

    } catch (error) {
      console.error('Failed to schedule renewal retry:', error);
    }
  }

  /**
   * Cancel subscription after max retry attempts
   */
  private async cancelSubscriptionAfterFailures(subscription: Subscription, reason: string): Promise<void> {
    try {
      console.log(`❌ Cancelling subscription ${subscription.id} after max retry attempts`);
      
      // Update subscription status
      await db
        .update(subscriptions)
        .set({
          status: 'cancelled',
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, subscription.id));

      // Clear cache
      subscriptionStatusService.clearUserCache(subscription.userId);

      // Get user for notification
      const [user] = await db.select().from(users).where(eq(users.id, subscription.userId));
      
      if (user?.email) {
        // Send cancellation notification
        await subscriptionNotificationService.sendNotification({
          type: 'subscription_cancelled',
          userId: subscription.userId,
          email: user.email,
          data: {
            planName: subscription.planId,
            reason: 'Payment failure after multiple attempts',
            supportEmail: 'support@coinrailz.com'
          }
        });
      }

      // Track cancellation
      await this.trackRenewalEvent(subscription.id, 'cancelled', 0, reason);

    } catch (error) {
      console.error('Failed to cancel subscription after failures:', error);
    }
  }

  /**
   * Send renewal reminders to users
   */
  async sendRenewalReminders(): Promise<{ sent: number; failed: number }> {
    try {
      console.log('📧 Sending renewal reminders...');
      
      // Get subscriptions due for renewal in 3 and 7 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const upcomingRenewals = await db
        .select()
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .where(
          and(
            eq(subscriptions.status, 'active'),
            or(
              and(
                gte(subscriptions.currentPeriodEnd, threeDaysFromNow),
                lte(subscriptions.currentPeriodEnd, new Date(threeDaysFromNow.getTime() + 24 * 60 * 60 * 1000))
              ),
              and(
                gte(subscriptions.currentPeriodEnd, sevenDaysFromNow),
                lte(subscriptions.currentPeriodEnd, new Date(sevenDaysFromNow.getTime() + 24 * 60 * 60 * 1000))
              )
            )
          )
        );

      let sent = 0;
      let failed = 0;

      for (const renewal of upcomingRenewals) {
        try {
          const daysUntilRenewal = Math.ceil(
            (renewal.subscriptions.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          const success = await subscriptionNotificationService.sendRenewalReminder(
            renewal.subscriptions.userId,
            renewal.users.email || '',
            daysUntilRenewal
          );

          if (success) {
            sent++;
          } else {
            failed++;
          }

        } catch (error) {
          failed++;
          console.error(`Failed to send reminder for subscription ${renewal.subscriptions.id}:`, error);
        }
      }

      console.log(`📧 Renewal reminders complete: ${sent} sent, ${failed} failed`);
      return { sent, failed };

    } catch (error) {
      console.error('Failed to send renewal reminders:', error);
      return { sent: 0, failed: 0 };
    }
  }

  // Helper methods
  private determinePaymentMethod(subscription: Subscription): string {
    if (subscription.stripeSubscriptionId) return 'stripe';
    if (subscription.paypalSubscriptionId) return 'paypal';
    if (subscription.usdcPaymentTxHash) return 'usdc';
    return 'unknown';
  }

  private calculateRenewalAmount(planId: string): number {
    const prices: Record<string, number> = {
      'starter': 29,
      'pro': 99,
      'enterprise': 299
    };
    return prices[planId] || 0;
  }

  private calculateNextBillingDate(subscription: Subscription): Date {
    const nextBilling = new Date(subscription.currentPeriodEnd);
    nextBilling.setMonth(nextBilling.getMonth() + 1); // Assuming monthly billing
    return nextBilling;
  }

  private calculateRetryDate(attemptNumber: number): Date {
    const retryDate = new Date();
    retryDate.setDate(retryDate.getDate() + this.RETRY_INTERVALS[attemptNumber - 1] || 7);
    return retryDate;
  }

  private async trackRenewalEvent(
    subscriptionId: number, 
    status: string, 
    amount: number, 
    error?: string
  ): Promise<void> {
    try {
      // TODO: Store renewal events in database for analytics
      console.log(`📊 Renewal event tracked: Subscription ${subscriptionId} - ${status} - $${amount}${error ? ` - ${error}` : ''}`);
    } catch (error) {
      console.error('Failed to track renewal event:', error);
    }
  }

  /**
   * Get renewal statistics
   */
  async getRenewalStatistics(days: number = 30): Promise<{
    totalRenewals: number;
    successfulRenewals: number;
    failedRenewals: number;
    successRate: number;
    totalRevenue: number;
    averageRetryAttempts: number;
  }> {
    try {
      // TODO: Implement actual statistics from database
      // For now, return mock data
      const totalRenewals = 150;
      const successfulRenewals = 142;
      const failedRenewals = 8;
      const successRate = (successfulRenewals / totalRenewals) * 100;
      const totalRevenue = successfulRenewals * 65; // Average plan price
      const averageRetryAttempts = 1.2;

      return {
        totalRenewals,
        successfulRenewals,
        failedRenewals,
        successRate,
        totalRevenue,
        averageRetryAttempts
      };

    } catch (error) {
      console.error('Failed to get renewal statistics:', error);
      return {
        totalRenewals: 0,
        successfulRenewals: 0,
        failedRenewals: 0,
        successRate: 0,
        totalRevenue: 0,
        averageRetryAttempts: 0
      };
    }
  }
}

export const subscriptionRenewalService = new SubscriptionRenewalService();