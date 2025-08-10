import { Router } from 'express';
import { db } from '../db';
import { aiMarketplaceOrders } from '../../shared/schema';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';

// Global order storage with database-first approach
const globalOrders: any[] = [];

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
  serviceId: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional().transform((val) => 
    val ? (typeof val === 'string' ? parseFloat(val) : val) : undefined
  )
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
      customerId: (req.user as any)?.id || 'oauth-test-user-1749701423054', // Use authenticated user if available
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

    // Store order in memory for immediate response, then attempt database storage
    globalOrders.push(newOrder);
    console.log(`🚀 Order ${orderId} created - attempting database storage...`);
    
    // CRITICAL DATABASE STORAGE - Using PROVEN WORKING raw SQL approach
    try {
      console.log(`🗄️ DIRECT SQL INSERTION: ${orderId}`);
      const insertResult = await db.execute(sql`
        INSERT INTO ai_marketplace_orders (
          id, agent_id, customer_id, service_type, amount, agent_commission, 
          platform_fee, status, payment_method, service_description, 
          customer_requirements, estimated_delivery_hours
        ) VALUES (
          ${orderId}, ${orderData.agentId}, ${newOrder.customerId}, ${orderData.serviceTitle}, 
          ${orderData.budget}, ${agentAmount}, ${platformFee}, 
          'pending', ${orderData.paymentMethod}, 
          ${orderData.serviceDescription || 'AI marketplace service'},
          ${JSON.stringify({
            requirements: orderData.requirements,
            deadline: orderData.deadline,
            budget: orderData.budget
          })},
          24
        )
        RETURNING id
      `);
      
      console.log(`✅ DIRECT SQL SUCCESS: Order ${orderId} stored in database`);
      console.log(`Rows affected: ${insertResult.rowCount}`);
    } catch (dbError: any) {
      console.error(`❌ DATABASE INSERTION FAILED: ${orderId}`);
      console.error(`Error message: ${dbError.message}`);
      console.error(`Error code: ${dbError.code}`);
      console.error(`Error detail: ${dbError.detail}`);
      
      // CRITICAL: Don't return success if database fails
      return res.status(500).json({
        success: false,
        error: 'Database storage failed',
        orderId: orderId,
        details: dbError.message,
        code: dbError.code
      });
    }

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

// Get orders for a user - PRIORITY: MEMORY FIRST (immediate), then check database
router.get('/api/orders/my-orders', async (req, res) => {
  try {
    const userId = (req.user as any)?.id || 'oauth-test-user-1749701423054'; // Use same fallback as order creation
    
    console.log(`🔍 Looking for orders for user: ${userId}`);
    console.log(`📦 Memory storage contains ${globalOrders.length} total orders`);
    
    // PRIORITY 1: Check memory first (contains latest orders)
    const memoryOrders = globalOrders.filter(order => order.customerId === userId);
    console.log(`🎯 Found ${memoryOrders.length} orders in memory for this user`);
    
    if (memoryOrders.length > 0) {
      console.log(`✅ Returning ${memoryOrders.length} orders from memory`);
      return res.json({
        success: true,
        source: 'memory',
        orders: memoryOrders.map(order => ({
          id: order.id,
          serviceTitle: order.serviceTitle,
          budget: order.budget,
          status: order.status,
          agentId: order.agentId,
          customerId: order.customerId,
          createdAt: order.createdAt,
          serviceDescription: order.serviceDescription,
          platformFee: order.platformFee,
          agentAmount: order.agentAmount
        }))
      });
    }
    
    // PRIORITY 2: If no memory orders, check database using PROVEN WORKING SQL
    try {
      const dbOrdersResult = await db.execute(sql`
        SELECT id, service_type, amount, agent_commission, platform_fee, status, payment_method, 
               service_description, created_at 
        FROM ai_marketplace_orders 
        WHERE customer_id = ${userId}
        ORDER BY created_at DESC
      `);
      const dbOrders = dbOrdersResult.rows;
      
      if (dbOrders.length > 0) {
        console.log(`✅ Returning ${dbOrders.length} orders from database`);
        return res.json({
          success: true,
          source: 'database',
          orders: dbOrders.map(order => ({
            id: order.id,
            serviceTitle: order.serviceType,
            budget: parseFloat(order.amount || '0'),
            status: order.status,
            agentId: order.agentId,
            customerId: order.customerId,
            createdAt: order.createdAt,
            serviceDescription: order.serviceDescription,
            platformFee: order.platformFee,
            agentAmount: order.agentCommission
          }))
        });
      }
    } catch (dbError) {
      console.error('❌ Database query failed:', dbError);
    }
    
    // PRIORITY 3: No orders found anywhere
    console.log(`⚠️ No orders found for user ${userId}`);
    res.json({
      success: true,
      source: 'none',
      orders: [],
      message: `No orders found for user ${userId}`,
      memoryOrderCount: globalOrders.length
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

// DEBUG ENDPOINT: Show memory vs database state
router.get('/api/debug/order-state', async (req, res) => {
  try {
    console.log(`🔍 DEBUG: Checking order state...`);
    
    // Check memory
    const memoryCount = globalOrders.length;
    const memoryOrders = globalOrders.map(o => ({
      id: o.id,
      customerId: o.customerId,
      serviceTitle: o.serviceTitle,
      budget: o.budget,
      status: o.status
    }));
    
    // Check database
    let dbCount = 0;
    let dbOrders: any[] = [];
    try {
      const dbResults = await db.select().from(aiMarketplaceOrders);
      dbCount = dbResults.length;
      dbOrders = dbResults.map(o => ({
        id: o.id,
        customerId: o.customerId,
        serviceType: o.serviceType,
        amount: o.amount,
        status: o.status
      }));
    } catch (dbError: any) {
      console.error('Database query failed:', dbError.message);
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      memory: {
        count: memoryCount,
        orders: memoryOrders
      },
      database: {
        count: dbCount,
        orders: dbOrders
      },
      issue: memoryCount > dbCount ? 'DATABASE_INSERTION_FAILING' : 'SYNCHRONIZED'
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Debug check failed',
      details: error.message
    });
  }
});

export default router;