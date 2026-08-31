import sgMail from '@sendgrid/mail';
import { sql } from 'drizzle-orm';
import { db } from '../db';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailTemplate {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private readonly fromEmail = 'support@coinrailz.com'; // Use verified sender from SendGrid

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendOrderConfirmation(order: any, customerEmail: string) {
    const template: EmailTemplate = {
      to: customerEmail,
      from: this.fromEmail,
      subject: `Order Confirmation #${order.id} - Coin Railz AI Marketplace`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Order Confirmed!</h2>
          <p>Thank you for your order with Coin Railz AI Marketplace.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details:</h3>
            <p><strong>Order ID:</strong> #${order.id}</p>
            <p><strong>Service:</strong> ${order.serviceName}</p>
            <p><strong>Amount:</strong> $${order.amount}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Created:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
          
          <p>You will receive updates as your order progresses. Our AI agents will begin working on your request shortly.</p>
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `Order Confirmation #${order.id} - Your order for ${order.serviceName} ($${order.amount}) has been confirmed and is being processed.`
    };

    return this.sendEmail(template, 'order_confirmation', order.id);
  }

  async sendPaymentConfirmation(order: any, customerEmail: string) {
    const template: EmailTemplate = {
      to: customerEmail,
      from: this.fromEmail,
      subject: `Payment Confirmed #${order.id} - Coin Railz`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Payment Confirmed!</h2>
          <p>Your payment has been successfully processed.</p>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Payment Details:</h3>
            <p><strong>Order ID:</strong> #${order.id}</p>
            <p><strong>Amount Paid:</strong> $${order.amount}</p>
            <p><strong>Service:</strong> ${order.serviceName}</p>
            <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p>Your order is now in progress. Our AI agents will begin working on your request immediately.</p>
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `Payment Confirmed #${order.id} - Your payment of $${order.amount} has been processed successfully.`
    };

    return this.sendEmail(template, 'payment_confirmation', order.id);
  }

  async sendOrderStatusUpdate(order: any, customerEmail: string, newStatus: string) {
    const statusMessages = {
      'in_progress': 'Your order is now in progress',
      'completed': 'Your order has been completed',
      'cancelled': 'Your order has been cancelled',
      'on_hold': 'Your order is temporarily on hold'
    };

    const template: EmailTemplate = {
      to: customerEmail,
      from: this.fromEmail,
      subject: `Order Update #${order.id} - ${statusMessages[newStatus as keyof typeof statusMessages]}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Order Status Update</h2>
          <p>${statusMessages[newStatus as keyof typeof statusMessages]}</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details:</h3>
            <p><strong>Order ID:</strong> #${order.id}</p>
            <p><strong>Service:</strong> ${order.serviceName}</p>
            <p><strong>New Status:</strong> ${newStatus}</p>
            <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          ${newStatus === 'completed' ? 
            '<p>Thank you for choosing Coin Railz! We hope you\'re satisfied with our service.</p>' : 
            '<p>We\'ll continue to keep you updated on your order progress.</p>'
          }
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `Order Update #${order.id} - ${statusMessages[newStatus as keyof typeof statusMessages]}`
    };

    return this.sendEmail(template, 'status_update', order.id);
  }

  async sendAgentNotification(agent: any, order: any, type: 'new_order' | 'order_completed' | 'payment_received') {
    const subjects = {
      'new_order': 'New Order Assignment',
      'order_completed': 'Order Completion Confirmation',
      'payment_received': 'Payment Received for Order'
    };

    const template: EmailTemplate = {
      to: agent.email,
      from: this.fromEmail,
      subject: `${subjects[type]} #${order.id} - Coin Railz Agent Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Agent Notification</h2>
          <p>Hello ${agent.agentName || agent.name},</p>
          
          <div style="background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${subjects[type]}:</h3>
            <p><strong>Order ID:</strong> #${order.id}</p>
            <p><strong>Service:</strong> ${order.serviceName}</p>
            <p><strong>Order Value:</strong> $${order.amount}</p>
            <p><strong>Your Commission (85%):</strong> $${(order.amount * 0.85).toFixed(2)}</p>
            ${type === 'new_order' ? `<p><strong>Customer:</strong> ${order.customerName}</p>` : ''}
          </div>
          
          ${type === 'new_order' ? 
            '<p>Please log into your agent dashboard to review the order details and begin work.</p>' :
            '<p>Thank you for your excellent service in the Coin Railz marketplace.</p>'
          }
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `${subjects[type]} #${order.id} - Order value: $${order.amount}, Your commission: $${(order.amount * 0.85).toFixed(2)}`
    };

    return this.sendEmail(template, `agent_${type}`, order.id);
  }

  async sendAgentWelcomeEmail(agent: any) {
    const template: EmailTemplate = {
      to: agent.email,
      from: this.fromEmail,
      subject: 'Welcome to Coin Railz AI Agent Marketplace!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Coin Railz!</h2>
          <p>Hello ${agent.name},</p>
          
          <p>Congratulations! Your agent profile has been successfully registered with the Coin Railz AI Marketplace.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Your Agent Profile:</h3>
            <p><strong>Agent ID:</strong> ${agent.id}</p>
            <p><strong>Specialties:</strong> ${Array.isArray(agent.specialties) ? agent.specialties.join(', ') : agent.specialties}</p>
            <p><strong>Commission Rate:</strong> 85%</p>
            <p><strong>Status:</strong> Pending Verification</p>
          </div>
          
          <p>Next steps:</p>
          <ul>
            <li>Your profile is currently under review</li>
            <li>You'll receive a verification email within 24-48 hours</li>
            <li>Once approved, you can start accepting orders</li>
          </ul>
          
          <p>Thank you for joining our marketplace!</p>
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `Welcome to Coin Railz! Your agent profile ${agent.id} has been registered and is pending verification.`
    };

    return this.sendEmail(template, 'agent_welcome', agent.id);
  }

  async sendUserWelcomeEmail(user: any) {
    const template: EmailTemplate = {
      to: user.email,
      from: this.fromEmail,
      subject: 'Welcome to Coin Railz - Your AI-Powered Fintech Platform!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Coin Railz!</h2>
          <p>Hello ${user.firstName || user.username || 'Friend'},</p>
          
          <p>Welcome to the future of fintech! Your account has been successfully created on Coin Railz - the world's first AI-powered multi-chain fintech platform.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🚀 What You Can Do Now:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Trade Crypto:</strong> Access our DEX with real-time pricing across multiple chains</li>
              <li><strong>AI Marketplace:</strong> Hire AI agents for any task or become an agent yourself</li>
              <li><strong>P2P Payments:</strong> Send money instantly with USDC and XRP</li>
              <li><strong>XRP Ecosystem:</strong> Full XRPL trading and liquidity services</li>
              <li><strong>Multi-Chain Support:</strong> Ethereum, Base, BNB Chain, XRP, and more</li>
            </ul>
          </div>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>💡 Getting Started:</h3>
            <p>1. <strong>Add Funds:</strong> Use our secure on-ramps to add USDC or crypto</p>
            <p>2. <strong>Explore DEX:</strong> Trade with competitive rates and low fees</p>
            <p>3. <strong>Try AI Services:</strong> Browse our marketplace for AI-powered solutions</p>
            <p>4. <strong>Invite Friends:</strong> Earn referral rewards through our viral system</p>
          </div>
          
          <p>Questions? Our support team is ready to help 24/7.</p>
          
          <p>Welcome to the future of finance!</p>
          
          <p>Best regards,<br>The Coin Railz Team</p>
        </div>
      `,
      text: `Welcome to Coin Railz! Your account has been created successfully. Start trading crypto, using AI services, and earning with our multi-chain fintech platform.`
    };

    return this.sendEmail(template, 'user_welcome', user.id);
  }

  private async sendEmail(template: EmailTemplate, type: string, orderId?: string) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.log(`📧 Email would be sent (${type}):`, {
          to: template.to,
          subject: template.subject,
          orderId
        });
        
        // Log to database even if not actually sent
        await this.logNotification(type, template.to, orderId, 'simulated');
        return { success: true, message: 'Email simulated (no API key)' };
      }

      await sgMail.send(template);
      console.log(`📧 Email sent successfully (${type}) to ${template.to}`);
      
      // Log successful email
      await this.logNotification(type, template.to, orderId, 'sent');
      
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error(`Failed to send email (${type}):`, error);
      
      // Log failed email
      await this.logNotification(type, template.to, orderId, 'failed');
      
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async logNotification(type: string, recipient: string, orderId?: string, status: string = 'sent') {
    try {
      await db.execute(sql`
        INSERT INTO notifications (
          type, recipient, order_id, status, content, created_at
        ) VALUES (
          ${type}, ${recipient}, ${orderId || null}, ${status},
          ${`${type} notification`}, CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }
}

export const emailService = EmailService.getInstance();