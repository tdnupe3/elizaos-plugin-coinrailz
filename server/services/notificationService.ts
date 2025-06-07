/**
 * Streamlined Real-Time Notification Service
 * Handles platform notifications via WebSocket
 */

import { websocketService } from "../websocketService";

export enum NotificationType {
  TRANSACTION_COMPLETED = 'transaction_completed',
  PAYMENT_RECEIVED = 'payment_received',
  SECURITY_ALERT = 'security_alert',
  AI_AGENT_ACTIVITY = 'ai_agent_activity',
  REFERRAL_EARNED = 'referral_earned',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

export class NotificationService {
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