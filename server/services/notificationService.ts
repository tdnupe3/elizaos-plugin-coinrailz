/**
 * Comprehensive Real-Time Notification Service
 * Handles all platform notifications with WebSocket integration
 */

import { db } from "../db";
import { notifications, notificationSettings, users, type Notification } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { websocketService } from "./websocketService";

export enum NotificationType {
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_FAILED = 'transaction_failed',
  SECURITY_ALERT = 'security_alert',
  AI_AGENT_ACTIVITY = 'ai_agent_activity',
  REFERRAL_EARNED = 'referral_earned',
  ACCOUNT_UPDATE = 'account_update',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_SENT = 'payment_sent',
  KYC_STATUS = 'kyc_status',
  SUBSCRIPTION_UPDATE = 'subscription_update'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CreateNotificationData {
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
   * Create and send a notification
   */
  static async createNotification(data: CreateNotificationData): Promise<Notification> {
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
  private static async sendRealTimeNotification(userId: string, notification: Notification): Promise<void> {
    try {
      websocketService.sendToUser(userId, {
        type: 'notification',
        data: notification
      });
    } catch (error) {
      console.error('Failed to send real-time notification:', error);
    }
  }

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<Notification[]> {
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
      .select({ count: notifications.id })
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
      // Create default settings
      const defaultSettings = await this.createDefaultNotificationSettings(userId);
      return defaultSettings;
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
      // Create new settings if they don't exist
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
    await this.createNotification({
      userId,
      type: NotificationType.TRANSACTION_COMPLETED,
      title: 'Transaction Completed',
      message: `Your transaction of ${amount} ${currency} has been completed successfully.`,
      priority: NotificationPriority.MEDIUM,
      metadata: { transactionId, amount, currency },
      actionUrl: `/transaction-history?id=${transactionId}`
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
    await this.createNotification({
      userId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment Received',
      message: `You received ${amount} ${currency}${fromUser ? ` from ${fromUser}` : ''}.`,
      priority: NotificationPriority.HIGH,
      metadata: { amount, currency, fromUser },
      actionUrl: '/transaction-history'
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
    await this.createNotification({
      userId,
      type: NotificationType.SECURITY_ALERT,
      title: 'Security Alert',
      message: `${alertType}: ${details}`,
      priority: NotificationPriority.CRITICAL,
      metadata: { alertType, details },
      actionUrl: '/settings'
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
    await this.createNotification({
      userId,
      type: NotificationType.AI_AGENT_ACTIVITY,
      title: 'AI Agent Activity',
      message: `${agentName}: ${activity}${earnings ? ` (Earned: ${earnings})` : ''}`,
      priority: NotificationPriority.MEDIUM,
      metadata: { agentName, activity, earnings },
      actionUrl: '/ai-agents'
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
    await this.createNotification({
      userId,
      type: NotificationType.REFERRAL_EARNED,
      title: 'Referral Reward Earned',
      message: `You earned ${amount} from ${referralType} referral!`,
      priority: NotificationPriority.HIGH,
      metadata: { amount, referralType },
      actionUrl: '/referrals'
    });
  }

  /**
   * Send system announcement
   */
  static async broadcastSystemAnnouncement(
    title: string, 
    message: string, 
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): Promise<void> {
    // Get all active users
    const activeUsers = await db.select({ id: users.id }).from(users);

    // Send notification to all users
    const notifications = activeUsers.map(user => ({
      userId: user.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority,
      isRead: false,
      createdAt: new Date(),
    }));

    await db.insert(notifications).values(notifications);

    // Send real-time notifications
    await websocketService.broadcast({
      type: 'system_announcement',
      data: { title, message, priority }
    });
  }

  /**
   * Clean old notifications (older than 90 days)
   */
  static async cleanOldNotifications(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await db
      .delete(notifications)
      .where(eq(notifications.createdAt, ninetyDaysAgo))
      .returning();

    return result.length;
  }
}