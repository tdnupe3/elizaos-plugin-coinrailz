import { Router } from 'express';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const router = Router();

// Order status enum
const ORDER_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted', 
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed'
} as const;

// Order creation schema - Unified schema for all marketplace order creation
const createOrderSchema = z.object({
  agentId: z.string().min(1, 'Agent ID required'),
  serviceTitle: z.string().min(1, 'Service title required'),
  serviceDescription: z.string().min(5, 'Service description required'),
  budget: z.union([z.string(), z.number()]).transform((val) => 
    typeof val === 'string' ? parseFloat(val) : val
  ),
  deadline: z.string().optional(),
  requirements: z.string().optional(),
  paymentMethod: z.string().default('USDC'),
  agentWallet: z.string().optional(),
  // Support legacy field for compatibility with other routes
  serviceId: z.string().optional()
});

// Create new order
router.post('/api/orders/create', async (req, res) => {
  try {
    console.log('Order creation request:', req.body);

    const orderData = createOrderSchema.parse(req.body);
    const orderId = `order_${nanoid()}`;

    // Calculate platform fee (15% as per business logic)
    const budgetAmount = orderData.budget;
    const platformFee = budgetAmount * 0.15;
    const agentAmount = budgetAmount * 0.85;

    // Create order object 
    const newOrder = {
      id: orderId,
      agentId: orderData.agentId,
      customerId: (req.user as any)?.id || 'guest_user', // Use authenticated user if available
      serviceTitle: orderData.serviceTitle,
      serviceDescription: orderData.serviceDescription,
      budget: orderData.budget,
      deadline: orderData.deadline || null,
      requirements: orderData.requirements || null,
      paymentMethod: orderData.paymentMethod,
      agentWallet: orderData.agentWallet || null,
      status: ORDER_STATUSES.PENDING,
      platformFee: platformFee.toFixed(2),
      agentAmount: agentAmount.toFixed(2),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      deliverables: []
    };

    // For now, store in memory (should be database in production)
    if (!(global as any).orders) {
      (global as any).orders = [];
    }
    (global as any).orders.push(newOrder);

    console.log('Order created successfully:', orderId);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId: orderId,
      order: {
        id: newOrder.id,
        serviceTitle: newOrder.serviceTitle,
        budget: newOrder.budget,
        status: newOrder.status,
        agentId: newOrder.agentId,
        platformFee: newOrder.platformFee,
        agentAmount: newOrder.agentAmount
      }
    });

  } catch (error) {
    console.error('Order creation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: 'Internal server error'
    });
  }
});

// Get orders for a user
router.get('/api/orders/my-orders', async (req, res) => {
  try {
    const userId = (req.user as any)?.id || 'guest_user';
    const orders = (global as any).orders || [];
    
    const userOrders = orders.filter((order: any) => 
      order.customerId === userId || order.agentId === userId
    );

    res.json({
      success: true,
      orders: userOrders.map(order => ({
        id: order.id,
        serviceTitle: order.serviceTitle,
        budget: order.budget,
        status: order.status,
        agentId: order.agentId,
        customerId: order.customerId,
        createdAt: order.createdAt,
        deadline: order.deadline
      }))
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get specific order details
router.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orders = global.orders || [];
    
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Update order status
router.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, message } = req.body;
    
    const orders = global.orders || [];
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order status
    orders[orderIndex].status = status;
    orders[orderIndex].updatedAt = new Date().toISOString();
    
    if (message) {
      orders[orderIndex].messages.push({
        id: nanoid(),
        message: message,
        timestamp: new Date().toISOString(),
        type: 'status_update'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      order: {
        id: orders[orderIndex].id,
        status: orders[orderIndex].status,
        updatedAt: orders[orderIndex].updatedAt
      }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Add message to order
router.post('/api/orders/:orderId/messages', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message, senderId } = req.body;
    
    const orders = global.orders || [];
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const newMessage = {
      id: nanoid(),
      message: message,
      senderId: senderId || req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      type: 'chat'
    };

    orders[orderIndex].messages.push(newMessage);
    orders[orderIndex].updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: 'Message added',
      messageId: newMessage.id
    });

  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// Add deliverable to order
router.post('/api/orders/:orderId/deliverables', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { title, description, fileUrl, deliveredBy } = req.body;
    
    const orders = global.orders || [];
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const deliverable = {
      id: nanoid(),
      title: title,
      description: description || '',
      fileUrl: fileUrl || null,
      deliveredBy: deliveredBy || req.user?.id || 'anonymous',
      deliveredAt: new Date().toISOString()
    };

    orders[orderIndex].deliverables.push(deliverable);
    orders[orderIndex].updatedAt = new Date().toISOString();

    // Auto-update status to delivered if this is the first deliverable
    if (orders[orderIndex].deliverables.length === 1) {
      orders[orderIndex].status = ORDER_STATUSES.DELIVERED;
    }

    res.json({
      success: true,
      message: 'Deliverable added',
      deliverable: deliverable
    });

  } catch (error) {
    console.error('Add deliverable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add deliverable'
    });
  }
});

export default router;