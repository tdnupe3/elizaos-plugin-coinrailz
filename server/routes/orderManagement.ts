/**
 * ORDER MANAGEMENT SYSTEM
 * Complete order lifecycle from creation to completion
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { aiMarketplaceOrders, conversations, messages } from '../../shared/schema';
import { nanoid } from 'nanoid';
import { isAuthenticated } from '../replitAuth';
import { eq, desc } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// Order creation schema
const CreateOrderSchema = z.object({
  agentId: z.string().min(1),
  serviceDescription: z.string().min(10),
  amount: z.number().min(1),
  serviceType: z.string().min(1),
  requirements: z.string().optional(),
  deliveryTimeframe: z.string().optional()
});

// Create order endpoint - REQUIRES AUTHENTICATION
router.post('/api/ai-marketplace/create-order', isAuthenticated, async (req, res) => {
  try {
    console.log('Order creation request:', req.body);
    
    // Validate input
    const validationResult = CreateOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      });
    }

    const orderData = validationResult.data;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    // Generate unique order ID
    const orderId = `order_${nanoid(12)}`;
    
    // Calculate platform fee (15%)
    const platformFee = Math.round(orderData.amount * 0.15 * 100) / 100;
    const agentAmount = orderData.amount - platformFee;
    
    // Create Stripe Payment Intent for escrow
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(orderData.amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: orderId,
        agentId: orderData.agentId,
        customerId: userId,
        type: 'marketplace_order'
      },
      capture_method: 'manual' // Hold payment for escrow
    });
    
    // Create order record
    const newOrder = {
      id: orderId,
      customerId: userId,
      agentId: orderData.agentId,
      serviceType: orderData.serviceType,
      serviceDescription: orderData.serviceDescription,
      requirements: orderData.requirements || '',
      amount: orderData.amount,
      platformFee: platformFee,
      agentAmount: agentAmount,
      status: 'pending' as const,
      paymentStatus: 'pending' as const,
      paymentIntentId: paymentIntent.id,
      deliveryTimeframe: orderData.deliveryTimeframe || '3-5 days',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert order into database
    const [insertedOrder] = await db
      .insert(aiMarketplaceOrders)
      .values(newOrder)
      .returning();
    
    // Create conversation for order
    const conversationId = `conv_${nanoid(12)}`;
    const [conversation] = await db
      .insert(conversations)
      .values({
        id: conversationId,
        orderId: orderId,
        customerId: userId,
        agentId: orderData.agentId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Add initial system message
    await db
      .insert(messages)
      .values({
        id: `msg_${nanoid(12)}`,
        conversationId: conversationId,
        senderId: 'system',
        senderType: 'system',
        content: `Order ${orderId} created. Service: ${orderData.serviceDescription}. Amount: $${orderData.amount}. Please discuss project details and timeline.`,
        messageType: 'system',
        createdAt: new Date()
      });
    
    console.log('Order created successfully:', orderId);
    
    res.status(201).json({
      success: true,
      orderId: orderId,
      paymentClientSecret: paymentIntent.client_secret,
      conversationId: conversationId,
      order: {
        id: insertedOrder.id,
        status: insertedOrder.status,
        amount: insertedOrder.amount,
        agentId: insertedOrder.agentId,
        serviceDescription: insertedOrder.serviceDescription
      }
    });
    
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user orders
router.get('/api/orders/my-orders', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    // Get orders for current user (both as customer and agent)
    const orders = await db
      .select()
      .from(aiMarketplaceOrders)
      .where(eq(aiMarketplaceOrders.customerId, userId))
      .orderBy(desc(aiMarketplaceOrders.createdAt));
    
    res.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Update order status
router.patch('/api/orders/:orderId/status', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    // Update order
    const [updatedOrder] = await db
      .update(aiMarketplaceOrders)
      .set({
        status: status,
        updatedAt: new Date()
      })
      .where(eq(aiMarketplaceOrders.id, orderId))
      .returning();
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: updatedOrder
    });
    
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Order details
router.get('/api/orders/:orderId', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }
    
    // Get order details
    const [order] = await db
      .select()
      .from(aiMarketplaceOrders)
      .where(eq(aiMarketplaceOrders.id, orderId));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if user has access to this order
    if (order.customerId !== userId && order.agentId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      order: order
    });
    
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

export default router;