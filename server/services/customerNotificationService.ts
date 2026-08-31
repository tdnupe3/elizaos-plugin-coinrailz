/**
 * Customer Notification Service
 * Handles real-time notifications, email, and SMS delivery
 */

import { db } from "../db";
import { 
  customerNotifications,
  users,
  type CustomerNotification,
  type InsertCustomerNotification 
} from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'in_app';
  enabled: boolean;
  address?: string; // email address or phone number
}

export class CustomerNotificationService {
  static isEmailAvailable(): boolean {
    return Boolean(process.env.SENDGRID_API_KEY);
  }

  static isSMSAvailable(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
  }

  static async sendEmail(data: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    return this.sendEmailNotification(data.to, data.subject, data.html, 'direct_message', 0);
  }

  static async sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    return this.sendSMSNotification(phoneNumber, 'Coin Railz', message, 0);
  }
  
  /**
   * Send notification to customer through all preferred channels
   */
  static async sendNotification(data: {
    customerId: string;
    type: string;
    title: string;
    message: string;
    relatedOrderId?: string;
    relatedDisputeId?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    channels?: NotificationChannel[];
  }): Promise<{ success: boolean; notificationId?: number; deliveryResults?: any[] }> {
    
    try {
      // Create notification record
      const [notification] = await db.insert(customerNotifications).values({
        customerId: data.customerId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedOrderId: data.relatedOrderId,
        relatedDisputeId: data.relatedDisputeId,
        priority: data.priority || 'normal',
        read: false,
        emailSent: false,
        smsSent: false
      }).returning();
      
      // Get customer contact info
      const [customer] = await db.select()
        .from(users)
        .where(eq(users.id, data.customerId));
      
      if (!customer) {
        throw new Error('Customer not found');
      }
      
      const deliveryResults = [];
      
      // Determine delivery channels
      const channels = data.channels || await this.getDefaultChannels(data.priority || 'normal');
      
      // Send through each enabled channel
      for (const channel of channels) {
        if (!channel.enabled) continue;
        
        try {
          switch (channel.type) {
            case 'email':
              if (customer.email) {
                const emailResult = await this.sendEmailNotification(
                  customer.email,
                  data.title,
                  data.message,
                  data.type,
                  notification.id
                );
                deliveryResults.push({ channel: 'email', success: emailResult.success });
                
                if (emailResult.success) {
                  await db.update(customerNotifications)
                    .set({ emailSent: true })
                    .where(eq(customerNotifications.id, notification.id));
                }
              }
              break;
              
            case 'sms':
              if (customer.phoneNumber) {
                const smsResult = await this.sendSMSNotification(
                  customer.phoneNumber,
                  data.title,
                  data.message,
                  notification.id
                );
                deliveryResults.push({ channel: 'sms', success: smsResult.success });
                
                if (smsResult.success) {
                  await db.update(customerNotifications)
                    .set({ smsSent: true })
                    .where(eq(customerNotifications.id, notification.id));
                }
              }
              break;
              
            case 'push':
              // Push notification implementation would go here
              deliveryResults.push({ channel: 'push', success: false, note: 'Push notifications not implemented' });
              break;
              
            case 'in_app':
              // In-app notification is already created in database
              deliveryResults.push({ channel: 'in_app', success: true });
              break;
          }
        } catch (channelError) {
          deliveryResults.push({ 
            channel: channel.type, 
            success: false, 
            error: channelError instanceof Error ? channelError.message : 'Unknown error' 
          });
        }
      }
      
      console.log('Notification sent:', {
        notificationId: notification.id,
        customerId: data.customerId,
        type: data.type,
        priority: data.priority,
        deliveryResults
      });
      
      return {
        success: true,
        notificationId: notification.id,
        deliveryResults
      };
      
    } catch (error: any) {
      console.error('Notification sending failed:', error);
      return { success: false };
    }
  }
  
  /**
   * Send email notification via SendGrid
   */
  private static async sendEmailNotification(
    email: string,
    title: string,
    message: string,
    type: string,
    notificationId: number
  ): Promise<{ success: boolean; messageId?: string }> {
    
    try {
      // Check if SendGrid API key is available
      if (!process.env.SENDGRID_API_KEY) {
        console.log('Email notification skipped - SendGrid API key not configured');
        return { success: false };
      }

      // Import SendGrid client
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const emailContent = {
        to: email,
        from: 'support@coinrailz.com', // Your verified sender email
        subject: `Coin Railz: ${title}`,
        html: this.generateEmailTemplate(title, message, type, notificationId),
        text: message
      };
      
      // Send email via SendGrid
      const [response] = await sgMail.send(emailContent);
      
      console.log('Email notification sent successfully:', {
        to: email,
        subject: emailContent.subject,
        messageId: response.headers['x-message-id'],
        statusCode: response.statusCode,
        notificationId
      });
      
      return {
        success: true,
        messageId: response.headers['x-message-id'] || `email_${notificationId}_${Date.now()}`
      };
      
    } catch (error: any) {
      console.error('Email sending failed:', error);
      return { 
        success: false,
        messageId: undefined 
      };
    }
  }
  
  /**
   * Send SMS notification via Twilio
   */
  private static async sendSMSNotification(
    phoneNumber: string,
    title: string,
    message: string,
    notificationId: number
  ): Promise<{ success: boolean; messageId?: string }> {
    
    try {
      // Check if Twilio credentials are available
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('SMS notification skipped - Twilio credentials not configured');
        return { success: false };
      }

      // Import Twilio client
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Format phone number (ensure it has country code)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
      
      const smsContent = {
        body: `${title}: ${message}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      };
      
      // Send SMS via Twilio
      const twilioMessage = await client.messages.create(smsContent);
      
      console.log('SMS notification sent successfully:', {
        to: formattedPhone,
        messageId: twilioMessage.sid,
        status: twilioMessage.status,
        notificationId
      });
      
      return {
        success: true,
        messageId: twilioMessage.sid
      };
      
    } catch (error: any) {
      console.error('SMS sending failed:', error);
      return { 
        success: false,
        messageId: undefined 
      };
    }
  }
  
  /**
   * Get customer notifications with pagination
   */
  static async getCustomerNotifications(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
      since?: Date;
    } = {}
  ): Promise<{ notifications: CustomerNotification[]; totalCount: number; unreadCount: number }> {
    
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      let whereConditions = [eq(customerNotifications.customerId, customerId)];
      
      if (options.unreadOnly) {
        whereConditions.push(eq(customerNotifications.read, false));
      }
      
      if (options.type) {
        whereConditions.push(eq(customerNotifications.type, options.type));
      }
      
      if (options.since) {
        whereConditions.push(gte(customerNotifications.createdAt, options.since));
      }
      
      // Get notifications
      const notifications = await db.select()
        .from(customerNotifications)
        .where(and(...whereConditions))
        .orderBy(desc(customerNotifications.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Get total count
      const totalResults = await db.select()
        .from(customerNotifications)
        .where(and(...whereConditions));
      
      // Get unread count
      const unreadResults = await db.select()
        .from(customerNotifications)
        .where(and(
          eq(customerNotifications.customerId, customerId),
          eq(customerNotifications.read, false)
        ));
      
      return {
        notifications,
        totalCount: totalResults.length,
        unreadCount: unreadResults.length
      };
      
    } catch (error: any) {
      console.error('Error getting notifications:', error);
      return {
        notifications: [],
        totalCount: 0,
        unreadCount: 0
      };
    }
  }
  
  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: number,
    customerId: string
  ): Promise<{ success: boolean }> {
    
    try {
      const result = await db.update(customerNotifications)
        .set({
          read: true,
          readAt: new Date()
        })
        .where(and(
          eq(customerNotifications.id, notificationId),
          eq(customerNotifications.customerId, customerId)
        ))
        .returning();
      
      return { success: result.length > 0 };
      
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return { success: false };
    }
  }
  
  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(customerId: string): Promise<{ success: boolean; updatedCount?: number }> {
    
    try {
      const result = await db.update(customerNotifications)
        .set({
          read: true,
          readAt: new Date()
        })
        .where(and(
          eq(customerNotifications.customerId, customerId),
          eq(customerNotifications.read, false)
        ))
        .returning();
      
      return {
        success: true,
        updatedCount: result.length
      };
      
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return { success: false };
    }
  }
  
  /**
   * Delete notification
   */
  static async deleteNotification(
    notificationId: number,
    customerId: string
  ): Promise<{ success: boolean }> {
    
    try {
      const result = await db.delete(customerNotifications)
        .where(and(
          eq(customerNotifications.id, notificationId),
          eq(customerNotifications.customerId, customerId)
        ))
        .returning();
      
      return { success: result.length > 0 };
      
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      return { success: false };
    }
  }
  
  /**
   * Get notification preferences for customer
   */
  static async getNotificationPreferences(customerId: string): Promise<NotificationPreferences> {
    try {
      // In a real implementation, this would be stored in a preferences table
      // For now, return default preferences
      return {
        email: true,
        sms: true,
        push: true,
        inApp: true
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return {
        email: false,
        sms: false,
        push: false,
        inApp: true
      };
    }
  }
  
  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    customerId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean }> {
    
    try {
      // In a real implementation, this would update a preferences table
      console.log('Notification preferences updated:', {
        customerId,
        preferences
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      return { success: false };
    }
  }
  
  /**
   * Get default notification channels based on priority
   */
  private static async getDefaultChannels(priority: string): Promise<NotificationChannel[]> {
    const channels: NotificationChannel[] = [
      { type: 'in_app', enabled: true }
    ];
    
    switch (priority) {
      case 'urgent':
        channels.push(
          { type: 'email', enabled: true },
          { type: 'sms', enabled: true },
          { type: 'push', enabled: true }
        );
        break;
        
      case 'high':
        channels.push(
          { type: 'email', enabled: true },
          { type: 'push', enabled: true }
        );
        break;
        
      case 'normal':
        channels.push(
          { type: 'email', enabled: true }
        );
        break;
        
      case 'low':
        // Only in-app notification
        break;
    }
    
    return channels;
  }
  
  /**
   * Generate email template
   */
  private static generateEmailTemplate(
    title: string,
    message: string,
    type: string,
    notificationId: number
  ): string {
    
    const logoUrl = 'https://coinrailz.com/logo.png';
    const unsubscribeUrl = `https://coinrailz.com/unsubscribe/${notificationId}`;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
            .content { padding: 20px 0; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${logoUrl}" alt="Coin Railz" style="max-height: 50px;">
                <h2>${title}</h2>
            </div>
            <div class="content">
                <p>${message}</p>
                ${type === 'dispute_deadline' ? 
                  '<p><a href="https://coinrailz.com/orders" class="btn">View Order</a></p>' : 
                  ''
                }
            </div>
            <div class="footer">
                <p>Coin Railz - AI-Powered Fintech Platform</p>
                <p><a href="${unsubscribeUrl}">Unsubscribe</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
  
  /**
   * Send bulk notifications (for system-wide announcements)
   */
  static async sendBulkNotification(
    customerIds: string[],
    notificationData: {
      type: string;
      title: string;
      message: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    }
  ): Promise<{ success: boolean; sent: number; failed: number; results: any[] }> {
    
    const results = [];
    let sent = 0;
    let failed = 0;
    
    for (const customerId of customerIds) {
      try {
        const result = await this.sendNotification({
          customerId,
          ...notificationData
        });
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
        
        results.push({
          customerId,
          success: result.success,
          notificationId: result.notificationId
        });
        
      } catch (error) {
        failed++;
        results.push({
          customerId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log('Bulk notification completed:', {
      total: customerIds.length,
      sent,
      failed
    });
    
    return {
      success: sent > 0,
      sent,
      failed,
      results
    };
  }
}

// Create instance for import compatibility
export const customerNotificationService = CustomerNotificationService;