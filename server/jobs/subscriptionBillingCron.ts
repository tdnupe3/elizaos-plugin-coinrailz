import { billingCycleService } from '../services/billingCycleService';

/**
 * Subscription Billing Cron Jobs
 * These functions should be called by a cron scheduler (like node-cron)
 * to automate subscription billing processes
 */

/**
 * Daily billing cycle job - runs every day at 6 AM UTC
 * Processes renewals, expired subscriptions, and payment retries
 */
export async function dailyBillingCycle(): Promise<void> {
  console.log('🕕 Starting daily billing cycle job...');
  
  try {
    // Process upcoming renewals (within 24 hours)
    await billingCycleService.processUpcomingRenewals();
    
    // Clean up expired subscriptions
    await billingCycleService.processExpiredSubscriptions();
    
    // Retry failed payments
    await billingCycleService.retryFailedPayments();
    
    console.log('✅ Daily billing cycle completed successfully');
  } catch (error) {
    console.error('❌ Daily billing cycle failed:', error);
    // TODO: Send alert to administrators
  }
}

/**
 * Hourly subscription check - runs every hour
 * Quick check for critical billing issues
 */
export async function hourlySubscriptionCheck(): Promise<void> {
  console.log('🕐 Starting hourly subscription check...');
  
  try {
    // Only process expired subscriptions (lighter operation)
    await billingCycleService.processExpiredSubscriptions();
    
    console.log('✅ Hourly subscription check completed');
  } catch (error) {
    console.error('❌ Hourly subscription check failed:', error);
  }
}

/**
 * Weekly billing report - runs every Monday at 9 AM UTC
 * Generates analytics and billing summaries
 */
export async function weeklyBillingReport(): Promise<void> {
  console.log('📊 Starting weekly billing report generation...');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    const billingSummary = await billingCycleService.generateBillingSummary(startDate, endDate);
    
    console.log('📊 Weekly Billing Summary:');
    console.log(`  - Total Subscriptions: ${billingSummary.totalSubscriptions}`);
    console.log(`  - Active: ${billingSummary.activeSubscriptions}`);
    console.log(`  - Cancelled: ${billingSummary.cancelledSubscriptions}`);
    console.log(`  - Expired: ${billingSummary.expiredSubscriptions}`);
    console.log(`  - Pending: ${billingSummary.pendingSubscriptions}`);
    console.log(`  - Stripe: ${billingSummary.byPaymentMethod.stripe}`);
    console.log(`  - USDC: ${billingSummary.byPaymentMethod.usdc}`);
    console.log(`  - PayPal: ${billingSummary.byPaymentMethod.paypal}`);
    console.log(`  - Monthly: ${billingSummary.byBillingPeriod.monthly}`);
    console.log(`  - Yearly: ${billingSummary.byBillingPeriod.yearly}`);
    
    // TODO: Save report to database or send to administrators
    
    console.log('✅ Weekly billing report completed');
  } catch (error) {
    console.error('❌ Weekly billing report failed:', error);
  }
}

/**
 * Initialize billing cron jobs
 * Call this function to set up automated billing processes
 */
export function initializeBillingCronJobs(): void {
  // Note: In production, you would use a proper cron scheduler like node-cron
  // For now, we'll set up basic intervals for demonstration
  
  console.log('⚙️ Initializing subscription billing automation...');
  
  // Daily billing cycle - every 24 hours
  setInterval(dailyBillingCycle, 24 * 60 * 60 * 1000);
  
  // Hourly subscription check - every hour
  setInterval(hourlySubscriptionCheck, 60 * 60 * 1000);
  
  // Weekly billing report - every 7 days
  setInterval(weeklyBillingReport, 7 * 24 * 60 * 60 * 1000);
  
  console.log('✅ Billing automation initialized');
  console.log('📅 Schedule:');
  console.log('  - Daily billing cycle: Every 24 hours');
  console.log('  - Hourly subscription check: Every hour');
  console.log('  - Weekly billing report: Every 7 days');
}

/**
 * Manual trigger functions for testing and admin use
 */
export const manualBillingTriggers = {
  triggerDailyBilling: dailyBillingCycle,
  triggerHourlyCheck: hourlySubscriptionCheck,
  triggerWeeklyReport: weeklyBillingReport,
  
  // Test specific functions
  triggerRenewalProcessing: () => billingCycleService.processUpcomingRenewals(),
  triggerExpiredCleanup: () => billingCycleService.processExpiredSubscriptions(),
  triggerPaymentRetry: () => billingCycleService.retryFailedPayments(),
};