/**
 * Complete Real-Time Notification Service
 * Handles platform notifications with database storage and WebSocket delivery
 */

import { db } from "../db";
import { notifications, notificationSettings, users } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { websocketService } from "../websocketService";

export enum NotificationType {
  TRANSACTION_COMPLETED = 'transaction_completed',
  PAYMENT_RECEIVED = 'payment_received',
  SECURITY_ALERT = 'security_alert',
  AI_AGENT_ACTIVITY = 'ai_agent_activity',
  REFERRAL_EARNED = 'referral_earned',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: any;
  actionUrl?: string;
}

export class NotificationService {
  /**
   * Create and store notification in database
   */
  static async createNotification(data: CreateNotificationData): Promise<any> {
    const notification = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: data.metadata,
      actionUrl: data.actionUrl,
      isRead: false,
      createdAt: new Date(),
    }).returning();

    // Send real-time notification via WebSocket
    await this.sendRealTimeNotification(data.userId, notification[0]);

    return notification[0];
  }

  /**
   * Send real-time notification via WebSocket
   */
  private static async sendRealTimeNotification(userId: string, notification: any): Promise<void> {
    try {
      websocketService.sendNotification(userId, notification);
    } catch (error) {
      console.error('Failed to send real-time notification:', error);
    }
  }

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    return result.length;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return result.length > 0;
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning();

    return result.length;
  }

  /**
   * Get user notification settings
   */
  static async getUserNotificationSettings(userId: string): Promise<any> {
    const settings = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    if (settings.length === 0) {
      return await this.createDefaultNotificationSettings(userId);
    }

    return settings[0];
  }

  /**
   * Update user notification settings
   */
  static async updateNotificationSettings(userId: string, settings: any): Promise<any> {
    const result = await db
      .update(notificationSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(notificationSettings.userId, userId))
      .returning();

    if (result.length === 0) {
      return await this.createDefaultNotificationSettings(userId, settings);
    }

    return result[0];
  }

  /**
   * Create default notification settings
   */
  private static async createDefaultNotificationSettings(userId: string, customSettings?: any): Promise<any> {
    const defaultSettings = {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      transactionAlerts: true,
      securityAlerts: true,
      marketingEmails: false,
      agentNotifications: true,
      referralNotifications: true,
      ...customSettings
    };

    const result = await db.insert(notificationSettings).values({
      userId,
      ...defaultSettings,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    return result[0];
  }
  /**
   * Send transaction completion notification
   */
  static async notifyTransactionCompleted(
    userId: string, 
    transactionId: string, 
    amount: string, 
    currency: string
  ): Promise<void> {
    websocketService.sendNotification(userId, {
      type: NotificationType.TRANSACTION_COMPLETED,
      title: 'Transaction Completed',
      message: `Your transaction of ${amount} ${currency} has been completed successfully.`,
      transactionId,
      amount,
      currency
    });
  }

  /**
   * Send payment received notification
   */
  static async notifyPaymentReceived(
    userId: string, 
    amount: string, 
    currency: string, 
    fromUser?: string
  ): Promise<void> {
    websocketService.sendNotification(userId, {
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment Received',
      message: `You received ${amount} ${currency}${fromUser ? ` from ${fromUser}` : ''}.`,
      amount,
      currency,
      fromUser
    });
  }

  /**
   * Send security alert notification
   */
  static async notifySecurityAlert(
    userId: string, 
    alertType: string, 
    details: string
  ): Promise<void> {
    websocketService.sendSecurityAlert(userId, {
      alertType,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * Send AI agent activity notification
   */
  static async notifyAIAgentActivity(
    userId: string, 
    agentName: string, 
    activity: string, 
    earnings?: string
  ): Promise<void> {
    websocketService.sendAgentUpdate(userId, {
      type: NotificationType.AI_AGENT_ACTIVITY,
      agentName,
      activity,
      earnings
    });
  }

  /**
   * Send referral earned notification
   */
  static async notifyReferralEarned(
    userId: string, 
    amount: string, 
    referralType: string
  ): Promise<void> {
    websocketService.sendReferralReward(userId, {
      type: NotificationType.REFERRAL_EARNED,
      amount,
      referralType
    });
  }

  /**
   * Send system announcement to all users
   */
  static async broadcastSystemAnnouncement(
    title: string, 
    message: string, 
    priority: string = 'medium'
  ): Promise<void> {
    websocketService.broadcastPriceUpdate({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority
    });
  }
}