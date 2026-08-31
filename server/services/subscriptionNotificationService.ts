import { subscriptionStatusService } from "./subscriptionStatusService";

export interface NotificationTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface NotificationEvent {
  type: 'subscription_created' | 'subscription_renewed' | 'subscription_cancelled' | 
        'payment_failed' | 'trial_ending' | 'plan_upgraded' | 'plan_downgraded' |
        'billing_reminder' | 'feature_usage_alert';
  userId: string;
  email: string;
  data: Record<string, any>;
}

export class SubscriptionNotificationService {
  
  /**
   * Send notification for subscription events
   */
  async sendNotification(event: NotificationEvent): Promise<boolean> {
    try {
      const template = this.getNotificationTemplate(event.type, event.data);
      
      // Get user's subscription status for personalization
      const subscriptionStatus = await subscriptionStatusService.getUserSubscriptionStatus(event.userId);
      
      // Personalize the template
      const personalizedTemplate = this.personalizeTemplate(template, {
        ...event.data,
        userEmail: event.email,
        planName: subscriptionStatus.planName,
        tradingDiscount: subscriptionStatus.tradingFeeReduction
      });
      
      // Send email notification
      const emailSent = await this.sendEmail(
        event.email,
        personalizedTemplate.subject,
        personalizedTemplate.htmlContent,
        personalizedTemplate.textContent
      );
      
      // Log notification
      console.log(`📧 Notification sent: ${event.type} to ${event.email} - ${emailSent ? 'Success' : 'Failed'}`);
      
      // Track notification for analytics
      await this.trackNotification(event, emailSent);
      
      return emailSent;
      
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Send subscription renewal reminder
   */
  async sendRenewalReminder(userId: string, email: string, daysUntilRenewal: number): Promise<boolean> {
    return this.sendNotification({
      type: 'billing_reminder',
      userId,
      email,
      data: {
        daysUntilRenewal,
        reminderType: daysUntilRenewal <= 3 ? 'urgent' : 'standard'
      }
    });
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailure(userId: string, email: string, reason: string, retryDate: Date): Promise<boolean> {
    return this.sendNotification({
      type: 'payment_failed',
      userId,
      email,
      data: {
        failureReason: reason,
        retryDate: retryDate.toLocaleDateString(),
        supportEmail: 'support@coinrailz.com'
      }
    });
  }

  /**
   * Send plan upgrade confirmation
   */
  async sendPlanUpgrade(userId: string, email: string, oldPlan: string, newPlan: string, savings: number): Promise<boolean> {
    return this.sendNotification({
      type: 'plan_upgraded',
      userId,
      email,
      data: {
        oldPlan,
        newPlan,
        monthlySavings: savings,
        effectiveDate: new Date().toLocaleDateString()
      }
    });
  }

  /**
   * Send feature usage alert (e.g., approaching limits)
   */
  async sendFeatureUsageAlert(userId: string, email: string, feature: string, usage: number, limit: number): Promise<boolean> {
    return this.sendNotification({
      type: 'feature_usage_alert',
      userId,
      email,
      data: {
        feature,
        currentUsage: usage,
        limit,
        percentageUsed: Math.round((usage / limit) * 100),
        upgradeUrl: 'https://coinrailz.com/subscription'
      }
    });
  }

  /**
   * Get notification template for different event types
   */
  private getNotificationTemplate(type: string, data: Record<string, any>): NotificationTemplate {
    const templates: Record<string, NotificationTemplate> = {
      subscription_created: {
        subject: '🎉 Welcome to {{planName}} - Your Subscription is Active!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Welcome to Coin Railz {{planName}}!</h1>
            <p>Your subscription is now active and you're ready to start saving on trading fees.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your Benefits Include:</h3>
              <ul>
                <li>{{tradingDiscount}}% discount on all trading fees</li>
                <li>{{crossChainDiscount}}% discount on cross-chain transactions</li>
                <li>{{aiCredits}} AI marketplace credits</li>
                <li>Priority customer support</li>
              </ul>
            </div>
            <p><a href="https://coinrailz.com/dex" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Start Trading Now</a></p>
          </div>
        `,
        textContent: 'Welcome to Coin Railz {{planName}}! Your subscription is now active.'
      },

      subscription_renewed: {
        subject: '✅ Subscription Renewed - {{planName}} Active',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">Subscription Successfully Renewed</h1>
            <p>Your {{planName}} subscription has been renewed for another billing period.</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Next billing date:</strong> {{nextBillingDate}}</p>
                <p><strong>Amount charged:</strong> \${{amount}}</p>
            </div>
            <p>Continue enjoying your {{tradingDiscount}}% fee discounts and premium features!</p>
          </div>
        `,
        textContent: 'Your {{planName}} subscription has been renewed successfully.'
      },

      payment_failed: {
        subject: '⚠️ Payment Failed - Action Required',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">Payment Failed</h1>
            <p>We were unable to process your subscription payment.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Reason:</strong> {{failureReason}}</p>
              <p><strong>Next retry:</strong> {{retryDate}}</p>
            </div>
            <p>Please update your payment method to avoid service interruption.</p>
            <p><a href="https://coinrailz.com/subscription/billing" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a></p>
          </div>
        `,
        textContent: 'Payment failed for your subscription. Please update your payment method.'
      },

      plan_upgraded: {
        subject: '🚀 Plan Upgraded to {{newPlan}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">Congratulations on Your Upgrade!</h1>
            <p>You've successfully upgraded from {{oldPlan}} to {{newPlan}}.</p>
            <div style="background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your Enhanced Benefits:</h3>
                <p>💰 <strong>Monthly savings:</strong> \${{monthlySavings}}</p>
              <p>📅 <strong>Effective date:</strong> {{effectiveDate}}</p>
            </div>
            <p><a href="https://coinrailz.com/dex" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Start Trading with Lower Fees</a></p>
          </div>
        `,
        textContent: 'You have successfully upgraded to {{newPlan}}. Enjoy enhanced benefits!'
      },

      billing_reminder: {
        subject: '💳 Billing Reminder - {{daysUntilRenewal}} Days Until Renewal',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ea580c;">Billing Reminder</h1>
            <p>Your {{planName}} subscription will renew in {{daysUntilRenewal}} days.</p>
            <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p>Make sure your payment method is up to date to avoid any interruption in service.</p>
            </div>
            <p><a href="https://coinrailz.com/subscription/billing" style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Billing</a></p>
          </div>
        `,
        textContent: 'Your subscription will renew in {{daysUntilRenewal}} days.'
      },

      feature_usage_alert: {
        subject: '📊 {{feature}} Usage Alert - {{percentageUsed}}% Used',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">Usage Alert</h1>
            <p>You've used {{percentageUsed}}% of your {{feature}} allowance.</p>
            <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Current usage:</strong> {{currentUsage}} / {{limit}}</p>
            </div>
            <p>Consider upgrading to get higher limits and better value.</p>
            <p><a href="{{upgradeUrl}}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Upgrade Plan</a></p>
          </div>
        `,
        textContent: 'You have used {{percentageUsed}}% of your {{feature}} allowance.'
      }
    };

    return templates[type] || templates.subscription_created;
  }

  /**
   * Personalize template with user data
   */
  private personalizeTemplate(template: NotificationTemplate, data: Record<string, any>): NotificationTemplate {
    let personalizedSubject = template.subject;
    let personalizedHtml = template.htmlContent;
    let personalizedText = template.textContent;

    // Replace all template variables
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'g'), String(value));
      personalizedHtml = personalizedHtml.replace(new RegExp(placeholder, 'g'), String(value));
      personalizedText = personalizedText.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return {
      subject: personalizedSubject,
      htmlContent: personalizedHtml,
      textContent: personalizedText
    };
  }

  /**
   * Send email using configured email service
   */
  private async sendEmail(
    to: string, 
    subject: string, 
    htmlContent: string, 
    textContent: string
  ): Promise<boolean> {
    try {
      // This would integrate with actual email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the email
      console.log(`📧 EMAIL NOTIFICATION:
        To: ${to}
        Subject: ${subject}
        HTML Length: ${htmlContent.length} chars
        Text: ${textContent.substring(0, 100)}...`);
      
      // TODO: Implement actual email sending
      // Example with SendGrid:
      /*
      const msg = {
        to,
        from: 'support@coinrailz.com',
        subject,
        text: textContent,
        html: htmlContent,
      };
      await sgMail.send(msg);
      */
      
      return true; // Simulate successful send
      
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  /**
   * Track notification for analytics
   */
  private async trackNotification(event: NotificationEvent, success: boolean): Promise<void> {
    try {
      // This would store notification tracking data
      console.log(`📊 Notification tracked: ${event.type} - ${success ? 'Delivered' : 'Failed'}`);
      
      // TODO: Store in database for analytics
      /*
      await db.insert(notificationLogs).values({
        userId: event.userId,
        type: event.type,
        email: event.email,
        status: success ? 'delivered' : 'failed',
        sentAt: new Date()
      });
      */
      
    } catch (error) {
      console.error('Failed to track notification:', error);
    }
  }

  /**
   * Send bulk notifications (for announcements, updates, etc.)
   */
  async sendBulkNotification(
    userIds: string[], 
    subject: string, 
    content: string,
    htmlContent?: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming email service
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (userId) => {
        try {
          // Get user email
          const userStatus = await subscriptionStatusService.getUserSubscriptionStatus(userId);
          
          // Send notification
          const success = await this.sendEmail(
            `user-${userId}@example.com`, // Would get actual email from user record
            subject,
            htmlContent || content,
            content
          );
          
          return success ? 'sent' : 'failed';
        } catch (error) {
          return 'failed';
        }
      });

      const results = await Promise.all(promises);
      sent += results.filter(r => r === 'sent').length;
      failed += results.filter(r => r === 'failed').length;

      // Small delay between batches
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`📧 Bulk notification complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<{
    billingReminders: boolean;
    featureAlerts: boolean;
    marketingEmails: boolean;
    securityAlerts: boolean;
  }> {
    // This would fetch from user preferences
    // For now, return default preferences
    return {
      billingReminders: true,
      featureAlerts: true,
      marketingEmails: false,
      securityAlerts: true
    };
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string, 
    preferences: Partial<{
      billingReminders: boolean;
      featureAlerts: boolean;
      marketingEmails: boolean;
      securityAlerts: boolean;
    }>
  ): Promise<boolean> {
    try {
      // This would update preferences in database
      console.log(`📧 Updated notification preferences for user ${userId}:`, preferences);
      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }
}

export const subscriptionNotificationService = new SubscriptionNotificationService();