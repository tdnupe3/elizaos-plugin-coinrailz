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
  budget: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (num < 10) throw new z.ZodError([{code: 'too_small', minimum: 10, type: 'number', inclusive: true, exact: false, message: 'Minimum order value is $10', path: ['budget']}]);
    return num;
  }),
  deadline: z.string().optional(),
  requirements: z.string().optional(),
  paymentMethod: z.string().default('USDC'),
  agentWallet: z.string().optional(),
  // MAKE serviceId OPTIONAL TO FIX VALIDATION
  serviceId: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional().transform((val) => 
    val ? (typeof val === 'string' ? parseFloat(val) : val) : undefined
  )
});

// Create new order - DATABASE FIRST APPROACH WITH COMPREHENSIVE ERROR HANDLING
router.post('/api/orders/create', async (req, res) => {
  // IMMEDIATE RESPONSE TO CONFIRM THIS ROUTE IS BEING HIT
  console.log(`🚨🚨🚨 ORDERMANAGEMENT ROUTE HIT!!! ${new Date().toISOString()} 🚨🚨🚨`);
  console.log(`Request method: ${req.method}, path: ${req.path}`);
  console.log(`Request body:`, req.body);
  
  // Immediate log to file system (should survive server restarts)
  require('fs').writeFileSync('/tmp/route_hit.txt', `ORDERMANAGEMENT ROUTE HIT: ${new Date().toISOString()}\n`);
  
  // IMMEDIATE LOG FILE TEST - BEFORE TRY BLOCK
  try {
    const fs = require('fs');
    const immediateLog = `${new Date().toISOString()} - ROUTE ENTRY: ${req.path}\n`;
    fs.appendFileSync('/tmp/route_trace.log', immediateLog);
    console.log(`📝 ROUTE ENTRY LOGGED`);
  } catch (e) {
    console.log(`❌ FAILED TO LOG ROUTE ENTRY:`, e);
  }
  
  try {
    console.log('🔥 ENTERING TRY BLOCK FOR ORDER CREATION:', req.body);

    const orderData = createOrderSchema.parse(req.body);
    const orderId = `order_${Date.now()}_${nanoid(8)}`;

    // Calculate platform fee (15% as per business logic)
    const budgetAmount = orderData.budget;
    const platformFee = budgetAmount * 0.15;
    const agentAmount = budgetAmount * 0.85;
    
    // Require authenticated user - no test user fallback for production
    if (!(req.user as any)?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to create orders'
      });
    }
    const customerId = (req.user as any).id;
    
    console.log(`💾 DIRECT DATABASE INSERT: ${orderId}`);
    console.log(`Customer: ${customerId}, Agent: ${orderData.agentId}, Amount: ${budgetAmount}`);
    
    // CRITICAL: DATABASE FIRST - COMPREHENSIVE ERROR CAPTURE  
    console.log(`🚨 ABOUT TO START DATABASE LOGIC FOR: ${orderId}`);
    
    let insertResult;
    try {
      // Write to persistent log file FIRST
      const fs = require('fs');
      console.log(`📝 CREATING LOG FILE FOR: ${orderId}`);
      const logEntry = `${new Date().toISOString()} - STARTING DB INSERT: ${orderId}\n`;
      fs.appendFileSync('/tmp/order_debug.log', logEntry);
      console.log(`✅ LOG FILE WRITTEN FOR: ${orderId}`);
      
      insertResult = await db.execute(sql`
        INSERT INTO ai_marketplace_orders (
          id, agent_id, customer_id, service_type, amount, agent_commission, 
          platform_fee, status, payment_method, service_description, 
          customer_requirements, estimated_delivery_hours
        ) VALUES (
          ${orderId}, ${orderData.agentId}, ${customerId}, ${orderData.serviceTitle}, 
          ${budgetAmount}, ${agentAmount}, ${platformFee}, 
          'pending', ${orderData.paymentMethod}, 
          ${orderData.serviceDescription || 'AI marketplace service'},
          ${JSON.stringify({
            requirements: orderData.requirements,
            deadline: orderData.deadline,
            budget: orderData.budget
          })},
          24
        )
        RETURNING id, created_at
      `);
      
      // Log success
      const successLog = `${new Date().toISOString()} - DB INSERT SUCCESS: ${orderId} - Rows: ${insertResult.rowCount}\n`;
      fs.appendFileSync('/tmp/order_debug.log', successLog);
      console.log(`✅ DATABASE INSERT SUCCESS: ${orderId}`);
      
      // CRITICAL VERIFICATION: Ensure the row actually exists
      const verifyResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM ai_marketplace_orders WHERE id = ${orderId}
      `);
      const actualCount = verifyResult.rows[0]?.count || 0;
      
      const verifyLog = `${new Date().toISOString()} - VERIFICATION: ${actualCount} rows found for ${orderId}\n`;
      fs.appendFileSync('/tmp/order_debug.log', verifyLog);
      
      if (actualCount === 0) {
        const failLog = `${new Date().toISOString()} - VERIFICATION FAILED: ${orderId} - Insert worked but verification shows 0 rows\n`;
        fs.appendFileSync('/tmp/order_debug.log', failLog);
        
        return res.status(500).json({
          success: false,
          error: 'Database verification failed - order was not persisted',
          orderId: orderId,
          insertResult: insertResult,
          verificationCount: actualCount
        });
      }
      
    } catch (dbError: any) {
      // Log error persistently
      const errorLog = `${new Date().toISOString()} - DB ERROR: ${orderId} - ${dbError.message}\n`;
      require('fs').appendFileSync('/tmp/order_debug.log', errorLog);
      
      console.error(`❌ DATABASE INSERTION FAILED: ${orderId}`, dbError);
      
      return res.status(500).json({
        success: false,
        error: 'Database storage failed',
        orderId: orderId,
        details: dbError.message,
        code: dbError.code
      });
    }

    // CRITICAL SUCCESS: Database insertion and verification completed
    console.log(`🎉 ORDER SUCCESSFULLY CREATED AND STORED: ${orderId}`);
    
    res.json({
      success: true,
      data: {
        orderId,
        status: 'pending_payment',
        amount: budgetAmount,
        platformFee: platformFee,
        agentPayout: agentAmount,
        paymentInstructions: 'Proceed to payment to secure this order',
        estimatedCompletion: '3-7 business days'
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
            budget: parseFloat(String(order.amount || '0')),
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
    const orders = globalOrders;
    
    const order = orders.find((o) => o.id === orderId);
    
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
    
    const orders = globalOrders;
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    
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
    
    const orders = (global as typeof globalThis & { orders?: Array<{ id: string; status: string; updatedAt: string; messages?: unknown[] }> }).orders || [];
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const newMessage = {
      id: nanoid(),
      message: message,
      senderId: senderId || (req.user as { id?: string } | undefined)?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      type: 'chat'
    };

    const order = orders[orderIndex];
    (order.messages ??= []).push(newMessage);
    order.updatedAt = new Date().toISOString();

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
    
    const orders = globalOrders;
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    
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
      deliveredBy: deliveredBy || (req.user as { id?: string } | undefined)?.id || 'anonymous',
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

// ISOLATED DATABASE TEST - NO MIDDLEWARE CONFLICTS
router.post('/api/test-db-insert', async (req, res) => {
  try {
    const testId = `test_${Date.now()}`;
    console.log(`🧪 ISOLATED TEST: Inserting ${testId}`);
    
    const result = await db.execute(sql`
      INSERT INTO ai_marketplace_orders (
        id, agent_id, customer_id, service_type, amount, agent_commission, 
        platform_fee, status, payment_method, service_description, 
        customer_requirements, estimated_delivery_hours
      ) VALUES (
        ${testId}, 'test_agent', 'test_customer', 'ISOLATED TEST', 
        100, 85, 15, 'pending', 'test', 'Isolated database test',
        '{"test": true}', 24
      ) RETURNING id
    `);
    
    console.log(`✅ ISOLATED TEST SUCCESS: ${testId}`);
    console.log(`Result:`, result);
    
    res.json({
      success: true,
      testId: testId,
      result: result,
      message: 'Isolated database test successful'
    });
    
  } catch (error: any) {
    console.error(`❌ ISOLATED TEST FAILED:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error
    });
  }
});

export default router;