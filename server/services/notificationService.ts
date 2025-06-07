
import { storage } from "../storage";
import { websocketService } from "./websocketService";

export interface Notification {
  id?: string;
  userId: string;
  type: 'transaction' | 'security' | 'agent' | 'system' | 'referral';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationSettings {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  transactionAlerts: boolean;
  securityAlerts: boolean;
  agentAlerts: boolean;
  marketingEmails: boolean;
}

class NotificationService {
  
  async createNotification(notification: Omit<Notification, 'id' | 'isRead' | 'createdAt'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRead: false,
      createdAt: new Date()
    };

    // Store in database (would need to add notifications table)
    await this.storeNotification(newNotification);

    // Send real-time notification via WebSocket
    websocketService.broadcastToUser(notification.userId, {
      type: 'notification',
      data: newNotification
    });

    return newNotification;
  }

  // Transaction notifications
  async notifyTransactionComplete(userId: string, transactionId: string, amount: string, currency: string = 'USD') {
    await this.createNotification({
      userId,
      type: 'transaction',
      title: 'Transaction Completed',
      message: `Your ${currency} ${amount} transaction has been completed successfully.`,
      data: { transactionId, amount, currency },
      priority: 'medium'
    });
  }

  async notifyTransactionFailed(userId: string, transactionId: string, reason: string) {
    await this.createNotification({
      userId,
      type: 'transaction',
      title: 'Transaction Failed',
      message: `Your transaction failed: ${reason}`,
      data: { transactionId, reason },
      priority: 'high'
    });
  }

  // Security notifications
  async notifySecurityAlert(userId: string, alertType: string, details: string) {
    await this.createNotification({
      userId,
      type: 'security',
      title: 'Security Alert',
      message: `${alertType}: ${details}`,
      data: { alertType, details },
      priority: 'critical'
    });
  }

  async notifyLoginAttempt(userId: string, location: string, success: boolean) {
    await this.createNotification({
      userId,
      type: 'security',
      title: success ? 'Successful Login' : 'Failed Login Attempt',
      message: `Login ${success ? 'successful' : 'attempt failed'} from ${location}`,
      data: { location, success, timestamp: new Date() },
      priority: success ? 'low' : 'high'
    });
  }

  // AI Agent notifications
  async notifyAgentTransaction(userId: string, agentId: string, amount: string, type: 'sent' | 'received') {
    await this.createNotification({
      userId,
      type: 'agent',
      title: `AI Agent ${type === 'sent' ? 'Payment Sent' : 'Payment Received'}`,
      message: `Agent ${agentId} ${type === 'sent' ? 'sent' : 'received'} $${amount}`,
      data: { agentId, amount, type },
      priority: 'medium'
    });
  }

  async notifyAgentRegistration(userId: string, agentId: string, agentName: string) {
    await this.createNotification({
      userId,
      type: 'agent',
      title: 'AI Agent Registered',
      message: `Your AI agent "${agentName}" has been successfully registered.`,
      data: { agentId, agentName },
      priority: 'medium'
    });
  }

  // Referral notifications
  async notifyReferralReward(userId: string, amount: string, currency: string, referredUserId: string) {
    await this.createNotification({
      userId,
      type: 'referral',
      title: 'Referral Reward Earned',
      message: `You earned ${currency} ${amount} from a successful referral!`,
      data: { amount, currency, referredUserId },
      priority: 'medium'
    });
  }

  async notifyNewReferral(userId: string, referralCode: string) {
    await this.createNotification({
      userId,
      type: 'referral',
      title: 'New Referral Signup',
      message: `Someone used your referral code ${referralCode} to sign up!`,
      data: { referralCode },
      priority: 'medium'
    });
  }

  // System notifications
  async notifySystemMaintenance(userId: string, maintenanceWindow: string) {
    await this.createNotification({
      userId,
      type: 'system',
      title: 'Scheduled Maintenance',
      message: `System maintenance scheduled for ${maintenanceWindow}`,
      data: { maintenanceWindow },
      priority: 'medium'
    });
  }

  // Get notifications for user
  async getUserNotifications(userId: string, limit: number = 20, unreadOnly: boolean = false): Promise<Notification[]> {
    // This would query the database for user notifications
    // For now, return mock data structure
    return [];
  }

  // Mark notifications as read
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    // Update database to mark notifications as read
    for (const notificationId of notificationIds) {
      await this.updateNotificationStatus(notificationId, true);
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<void> {
    // Update database to mark all user notifications as read
    await this.markAllUserNotificationsRead(userId);
  }

  // Get notification settings
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    // This would query user notification preferences
    return {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      transactionAlerts: true,
      securityAlerts: true,
      agentAlerts: true,
      marketingEmails: false
    };
  }

  // Update notification settings
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    // Update user notification preferences in database
    const currentSettings = await this.getNotificationSettings(userId);
    const updatedSettings = { ...currentSettings, ...settings };
    
    // Save to database
    await this.saveNotificationSettings(updatedSettings);
    
    return updatedSettings;
  }

  // Private helper methods (these would interact with your database)
  private async storeNotification(notification: Notification): Promise<void> {
    // Store notification in database
    // You'll need to add a notifications table to your schema
    console.log('Storing notification:', notification);
  }

  private async updateNotificationStatus(notificationId: string, isRead: boolean): Promise<void> {
    // Update notification read status in database
    console.log(`Marking notification ${notificationId} as ${isRead ? 'read' : 'unread'}`);
  }

  private async markAllUserNotificationsRead(userId: string): Promise<void> {
    // Mark all notifications for user as read
    console.log(`Marking all notifications for user ${userId} as read`);
  }

  private async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    // Save notification settings to database
    console.log('Saving notification settings:', settings);
  }

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    // Query database for unread notification count
    return 0; // Placeholder
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications(): Promise<void> {
    // Remove expired notifications from database
    console.log('Cleaning up expired notifications');
  }
}

export const notificationService = new NotificationService();
