/**
 * MARKETPLACE DEMO ROUTES
 * Simplified routes for immediate marketplace functionality testing
 */

import { Router } from 'express';

const router = Router();

// Demo storage
const demoOrders = new Map();
const demoEscrow = new Map();

// Demo order creation (without complex authentication)
router.post('/demo/create-order', (req, res) => {
  try {
    const { serviceId, customerId = 'demo-customer', amount, requirements } = req.body;
    
    if (!serviceId || !amount || amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order data'
      });
    }

    const orderId = `demo_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create demo order
    const order = {
      id: orderId,
      serviceId,
      customerId,
      amount: Number(amount),
      requirements: requirements || 'Demo order requirements',
      status: 'pending',
      createdAt: new Date().toISOString(),
      platformFee: Number(amount) * 0.15,
      agentPayout: Number(amount) * 0.85
    };
    
    demoOrders.set(orderId, order);
    
    // Create escrow record
    demoEscrow.set(orderId, {
      orderId,
      amount: Number(amount),
      status: 'held',
      heldAt: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      data: order,
      escrow: demoEscrow.get(orderId),
      message: 'Demo order created successfully with escrow protection'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create demo order'
    });
  }
});

// Get demo order status
router.get('/demo/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = demoOrders.get(orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  const escrow = demoEscrow.get(orderId);
  
  res.json({
    success: true,
    data: {
      order,
      escrow,
      canDeliver: order.status === 'pending',
      canAccept: order.status === 'delivered',
      canRefund: escrow?.status === 'held'
    }
  });
});

// Demo service delivery
router.post('/demo/deliver/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { deliveryMessage = 'Demo work completed', attachments = [] } = req.body;
  
  const order = demoOrders.get(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  // Update order status
  order.status = 'delivered';
  order.deliveredAt = new Date().toISOString();
  order.deliveryMessage = deliveryMessage;
  order.attachments = attachments;
  
  demoOrders.set(orderId, order);
  
  res.json({
    success: true,
    data: order,
    message: 'Work delivered successfully'
  });
});

// Demo delivery acceptance
router.post('/demo/accept/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const order = demoOrders.get(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  if (order.status !== 'delivered') {
    return res.status(400).json({
      success: false,
      error: 'Order must be delivered before acceptance'
    });
  }
  
  // Release escrow funds
  const escrow = demoEscrow.get(orderId);
  if (escrow) {
    escrow.status = 'released';
    escrow.releasedAt = new Date().toISOString();
    demoEscrow.set(orderId, escrow);
  }
  
  // Complete order
  order.status = 'completed';
  order.completedAt = new Date().toISOString();
  demoOrders.set(orderId, order);
  
  res.json({
    success: true,
    data: {
      order,
      escrow,
      platformFeesCollected: order.platformFee,
      agentPayoutReleased: order.agentPayout
    },
    message: 'Delivery accepted and payment released to agent'
  });
});

// Demo marketplace statistics
router.get('/demo/stats', (req, res) => {
  const orders = Array.from(demoOrders.values());
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  const stats = {
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    deliveredOrders: orders.filter(o => o.status === 'delivered').length,
    totalVolume: completedOrders.reduce((sum, o) => sum + o.amount, 0),
    platformFeesCollected: completedOrders.reduce((sum, o) => sum + o.platformFee, 0),
    agentPayoutsReleased: completedOrders.reduce((sum, o) => sum + o.agentPayout, 0),
    averageOrderValue: completedOrders.length > 0 ? 
      completedOrders.reduce((sum, o) => sum + o.amount, 0) / completedOrders.length : 0
  };
  
  res.json({
    success: true,
    data: stats,
    message: 'Demo marketplace statistics'
  });
});

export default router;