import { Router } from 'express';
import { storage } from '../storage';
import { sql } from 'drizzle-orm';
import { db } from '../db';

const router = Router();

// Email notification service (placeholder for now - would integrate with SendGrid)
class NotificationService {
  async sendOrderConfirmation(order: any, customer: any) {
    // In production, this would use SendGrid or similar service
    console.log(`📧 Order confirmation email sent to ${customer.email}`);
    console.log(`Order #${order.id} - ${order.serviceName} - $${order.totalAmount}`);
    
    // Log notification to database
    await this.logNotification({
      type: 'order_confirmation',
      recipient: customer.email,
      orderId: order.id,
      status: 'sent',
      content: `Order #${order.id} confirmed - ${order.serviceName}`
    });
  }

  async sendPaymentConfirmation(order: any, customer: any) {
    console.log(`📧 Payment confirmation email sent to ${customer.email}`);
    console.log(`Payment received for Order #${order.id} - $${order.totalAmount}`);
    
    await this.logNotification({
      type: 'payment_confirmation',
      recipient: customer.email,
      orderId: order.id,
      status: 'sent',
      content: `Payment confirmed for Order #${order.id}`
    });
  }

  async sendOrderStatusUpdate(order: any, customer: any, newStatus: string) {
    console.log(`📧 Order status update sent to ${customer.email}`);
    console.log(`Order #${order.id} status changed to: ${newStatus}`);
    
    await this.logNotification({
      type: 'status_update',
      recipient: customer.email,
      orderId: order.id,
      status: 'sent',
      content: `Order #${order.id} status: ${newStatus}`
    });
  }

  async sendAgentNotification(agent: any, order: any, type: string) {
    console.log(`📧 Agent notification sent to ${agent.email}`);
    console.log(`${type}: Order #${order.id} - $${order.totalAmount}`);
    
    await this.logNotification({
      type: `agent_${type}`,
      recipient: agent.email,
      orderId: order.id,
      status: 'sent',
      content: `${type}: Order #${order.id}`
    });
  }

  private async logNotification(notification: any) {
    try {
      await db.execute(sql`
        INSERT INTO notifications (
          type, recipient, order_id, status, content, created_at
        ) VALUES (
          ${notification.type}, ${notification.recipient}, 
          ${notification.orderId}, ${notification.status},
          ${notification.content}, CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }
}

const notificationService = new NotificationService();

// Webhook for order status changes
router.post('/notifications/order-status', async (req, res) => {
  try {
    const { orderId, newStatus, customerId, agentId } = req.body;

    // Get order details
    const orderResult = await db.execute(sql`
      SELECT o.*, s.name as service_name 
      FROM marketplace_orders o
      LEFT JOIN ai_marketplace_services s ON o.service_id = s.id
      WHERE o.id = ${orderId}
    `);

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get customer details
    const customerResult = await db.execute(sql`
      SELECT * FROM users WHERE id = ${customerId}
    `);

    // Get agent details if applicable
    let agent = null;
    if (agentId) {
      const agentResult = await db.execute(sql`
        SELECT * FROM global_ai_agents WHERE id = ${agentId}
      `);
      agent = agentResult.rows[0];
    }

    const customer = customerResult.rows[0];

    // Send appropriate notifications based on status
    switch (newStatus) {
      case 'confirmed':
        await notificationService.sendOrderConfirmation(order, customer);
        break;
      case 'paid':
        await notificationService.sendPaymentConfirmation(order, customer);
        if (agent) {
          await notificationService.sendAgentNotification(agent, order, 'new_order');
        }
        break;
      case 'in_progress':
        await notificationService.sendOrderStatusUpdate(order, customer, 'In Progress');
        break;
      case 'completed':
        await notificationService.sendOrderStatusUpdate(order, customer, 'Completed');
        if (agent) {
          await notificationService.sendAgentNotification(agent, order, 'order_completed');
        }
        break;
      case 'cancelled':
        await notificationService.sendOrderStatusUpdate(order, customer, 'Cancelled');
        break;
    }

    res.json({
      success: true,
      message: 'Notifications sent successfully'
    });

  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

// Get notification history
router.get('/notifications/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const notifications = await db.execute(sql`
      SELECT * FROM notifications 
      WHERE order_id = ${orderId}
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      notifications: notifications.rows
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications'
    });
  }
});

// Send manual notification
router.post('/notifications/send', async (req, res) => {
  try {
    const { type, recipient, orderId, content } = req.body;

    if (!type || !recipient || !content) {
      return res.status(400).json({
        error: 'Type, recipient, and content are required'
      });
    }

    // Send notification (in production, would use email service)
    console.log(`📧 Manual notification sent to ${recipient}: ${content}`);

    // Log notification
    await db.execute(sql`
      INSERT INTO notifications (
        type, recipient, order_id, status, content, created_at
      ) VALUES (
        ${type}, ${recipient}, ${orderId || null}, 'sent',
        ${content}, CURRENT_TIMESTAMP
      )
    `);

    res.json({
      success: true,
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

export { notificationService };
export default router;