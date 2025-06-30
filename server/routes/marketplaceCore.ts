/**
 * MARKETPLACE CORE INFRASTRUCTURE
 * Essential missing components for functional AI marketplace
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';

const router = Router();

// In-memory storage for demo (replace with database in production)
const services = new Map();
const orders = new Map();
const escrow = new Map();
const agentEarnings = new Map();

// Populate with sample services for immediate functionality
const sampleServices = [
  {
    id: 'svc_data_analysis_001',
    name: 'Advanced Data Analysis',
    description: 'Comprehensive data analysis with visualization and insights using Python and R',
    category: 'data-analysis',
    pricing: 150,
    deliveryTime: '3-5 days',
    tags: ['python', 'pandas', 'visualization', 'statistics'],
    agentId: 'agent_data_specialist',
    isActive: true,
    createdAt: new Date().toISOString(),
    rating: 4.8,
    completedOrders: 23
  },
  {
    id: 'svc_content_creation_002',
    name: 'AI-Powered Content Writing',
    description: 'High-quality blog posts, articles, and marketing content optimized for SEO',
    category: 'content-creation',
    pricing: 75,
    deliveryTime: '1-2 days',
    tags: ['copywriting', 'seo', 'marketing', 'blog'],
    agentId: 'agent_content_writer',
    isActive: true,
    createdAt: new Date().toISOString(),
    rating: 4.9,
    completedOrders: 45
  },
  {
    id: 'svc_automation_003',
    name: 'Process Automation Setup',
    description: 'Custom automation workflows for business processes using Zapier and Python',
    category: 'automation',
    pricing: 200,
    deliveryTime: '5-7 days',
    tags: ['zapier', 'automation', 'workflow', 'python'],
    agentId: 'agent_automation_expert',
    isActive: true,
    createdAt: new Date().toISOString(),
    rating: 4.7,
    completedOrders: 18
  },
  {
    id: 'svc_consultation_004',
    name: 'Technical Architecture Consultation',
    description: 'Expert consultation on system architecture, scalability, and technology stack decisions',
    category: 'consultation',
    pricing: 300,
    deliveryTime: '2-3 days',
    tags: ['architecture', 'scalability', 'consulting', 'technology'],
    agentId: 'agent_tech_consultant',
    isActive: true,
    createdAt: new Date().toISOString(),
    rating: 5.0,
    completedOrders: 12
  },
  {
    id: 'svc_financial_planning_005',
    name: 'Personal Financial Planning',
    description: 'Comprehensive financial planning with investment strategies and budget optimization',
    category: 'financial-planning',
    pricing: 250,
    deliveryTime: '3-4 days',
    tags: ['finance', 'investment', 'planning', 'budget'],
    agentId: 'agent_financial_advisor',
    isActive: true,
    createdAt: new Date().toISOString(),
    rating: 4.6,
    completedOrders: 31
  }
];

// Initialize services
sampleServices.forEach(service => {
  services.set(service.id, service);
});

// Service listing schema
const ServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  category: z.string(),
  pricing: z.number().min(1),
  deliveryTime: z.string(),
  tags: z.array(z.string()),
  agentId: z.string()
});

// Order schema
const OrderSchema = z.object({
  serviceId: z.string(),
  customerId: z.string(),
  agentId: z.string(),
  amount: z.number().min(1),
  requirements: z.string()
});

/**
 * 1. SERVICE CATALOG MANAGEMENT
 */

// List all available services
router.get('/services', (req, res) => {
  const { category, search } = req.query;
  let availableServices = Array.from(services.values()).filter(s => s.isActive);
  
  if (category && category !== 'all') {
    availableServices = availableServices.filter(s => s.category === category);
  }
  
  if (search) {
    const searchTerm = search.toString().toLowerCase();
    availableServices = availableServices.filter(s => 
      s.name.toLowerCase().includes(searchTerm) ||
      s.description.toLowerCase().includes(searchTerm) ||
      s.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
    );
  }
  
  res.json({
    success: true,
    data: availableServices,
    total: availableServices.length
  });
});

// Agent creates a new service listing
router.post('/services', isAuthenticated, (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const serviceData = ServiceSchema.parse(req.body);
    const serviceId = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const service = {
      id: serviceId,
      ...serviceData,
      agentId: userId,
      isActive: true,
      createdAt: new Date().toISOString(),
      rating: 0,
      completedOrders: 0
    };
    
    services.set(serviceId, service);
    
    res.status(201).json({
      success: true,
      data: service,
      message: 'Service listed successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create service'
    });
  }
});

// Get agent's services
router.get('/agent/:agentId/services', (req, res) => {
  const { agentId } = req.params;
  const agentServices = Array.from(services.values()).filter(s => s.agentId === agentId);
  
  res.json({
    success: true,
    data: agentServices
  });
});

/**
 * 2. ORDER MANAGEMENT SYSTEM
 */

// Create order with escrow
router.post('/orders', isAuthenticated, (req, res) => {
  try {
    const customerId = (req.user as any)?.claims?.sub;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const orderData = OrderSchema.parse(req.body);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Verify service exists
    const service = services.get(orderData.serviceId);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    // Create order
    const order = {
      id: orderId,
      ...orderData,
      customerId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      platformFee: orderData.amount * 0.25,
      agentPayout: orderData.amount * 0.75
    };
    
    orders.set(orderId, order);
    
    // Hold funds in escrow
    escrow.set(orderId, {
      orderId,
      amount: orderData.amount,
      status: 'held',
      heldAt: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created and funds held in escrow'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create order'
    });
  }
});

// Get agent's orders
router.get('/agent/:agentId/orders', isAuthenticated, (req, res) => {
  const { agentId } = req.params;
  const agentOrders = Array.from(orders.values()).filter(o => o.agentId === agentId);
  
  res.json({
    success: true,
    data: agentOrders
  });
});

// Get customer's orders
router.get('/customer/orders', isAuthenticated, (req, res) => {
  const customerId = (req.user as any)?.claims?.sub;
  const customerOrders = Array.from(orders.values()).filter(o => o.customerId === customerId);
  
  res.json({
    success: true,
    data: customerOrders
  });
});

/**
 * 3. SERVICE DELIVERY SYSTEM
 */

// Agent delivers work
router.post('/orders/:orderId/deliver', isAuthenticated, (req, res) => {
  const { orderId } = req.params;
  const { deliveryMessage, attachments } = req.body;
  const agentId = (req.user as any)?.claims?.sub;
  
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  
  if (order.agentId !== agentId) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  
  // Update order with delivery
  order.status = 'delivered';
  order.deliveredAt = new Date().toISOString();
  order.deliveryMessage = deliveryMessage;
  order.attachments = attachments || [];
  
  orders.set(orderId, order);
  
  res.json({
    success: true,
    data: order,
    message: 'Work delivered successfully'
  });
});

// Customer accepts delivery
router.post('/orders/:orderId/accept', isAuthenticated, (req, res) => {
  const { orderId } = req.params;
  const customerId = (req.user as any)?.claims?.sub;
  
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  
  if (order.customerId !== customerId) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  
  // Release escrow funds
  const escrowRecord = escrow.get(orderId);
  if (escrowRecord) {
    escrowRecord.status = 'released';
    escrowRecord.releasedAt = new Date().toISOString();
    
    // Add to agent earnings
    const currentEarnings = agentEarnings.get(order.agentId) || 0;
    agentEarnings.set(order.agentId, currentEarnings + order.agentPayout);
  }
  
  // Complete order
  order.status = 'completed';
  order.completedAt = new Date().toISOString();
  
  orders.set(orderId, order);
  
  res.json({
    success: true,
    data: order,
    message: 'Delivery accepted and payment released'
  });
});

/**
 * 4. ESCROW MANAGEMENT
 */

// Get escrow status
router.get('/escrow/:orderId', isAuthenticated, (req, res) => {
  const { orderId } = req.params;
  const escrowRecord = escrow.get(orderId);
  
  if (!escrowRecord) {
    return res.status(404).json({ success: false, error: 'Escrow record not found' });
  }
  
  res.json({
    success: true,
    data: escrowRecord
  });
});

// Release escrow (admin function)
router.post('/escrow/release', isAuthenticated, (req, res) => {
  const { orderId, agentId } = req.body;
  
  const escrowRecord = escrow.get(orderId);
  if (!escrowRecord) {
    return res.status(404).json({ success: false, error: 'Escrow record not found' });
  }
  
  if (escrowRecord.status !== 'held') {
    return res.status(400).json({ success: false, error: 'Funds already released' });
  }
  
  // Release funds
  escrowRecord.status = 'released';
  escrowRecord.releasedAt = new Date().toISOString();
  
  const order = orders.get(orderId);
  if (order) {
    const currentEarnings = agentEarnings.get(agentId) || 0;
    agentEarnings.set(agentId, currentEarnings + order.agentPayout);
  }
  
  res.json({
    success: true,
    message: 'Funds released to agent'
  });
});

/**
 * 5. EARNINGS & ANALYTICS
 */

// Get agent earnings
router.get('/agent/:agentId/earnings', isAuthenticated, (req, res) => {
  const { agentId } = req.params;
  const earnings = agentEarnings.get(agentId) || 0;
  const agentOrders = Array.from(orders.values()).filter(o => o.agentId === agentId);
  
  res.json({
    success: true,
    data: {
      totalEarnings: earnings,
      totalOrders: agentOrders.length,
      completedOrders: agentOrders.filter(o => o.status === 'completed').length,
      pendingOrders: agentOrders.filter(o => o.status === 'pending').length,
      deliveredOrders: agentOrders.filter(o => o.status === 'delivered').length
    }
  });
});

// Platform fee collection summary
router.get('/platform/fees', isAuthenticated, (req, res) => {
  const completedOrders = Array.from(orders.values()).filter(o => o.status === 'completed');
  const totalFees = completedOrders.reduce((sum, order) => sum + order.platformFee, 0);
  const totalVolume = completedOrders.reduce((sum, order) => sum + order.amount, 0);
  
  res.json({
    success: true,
    data: {
      totalFeesCollected: totalFees,
      totalTransactionVolume: totalVolume,
      completedTransactions: completedOrders.length,
      averageTransactionValue: totalVolume / completedOrders.length || 0
    }
  });
});

/**
 * 6. REFUND SYSTEM
 */

// Request refund
router.post('/refund', isAuthenticated, (req, res) => {
  const { orderId, reason } = req.body;
  const customerId = (req.user as any)?.claims?.sub;
  
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  
  if (order.customerId !== customerId) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  
  // Process refund
  const escrowRecord = escrow.get(orderId);
  if (escrowRecord && escrowRecord.status === 'held') {
    escrowRecord.status = 'refunded';
    escrowRecord.refundedAt = new Date().toISOString();
    escrowRecord.refundReason = reason;
    
    order.status = 'refunded';
    order.refundedAt = new Date().toISOString();
    
    orders.set(orderId, order);
    
    res.json({
      success: true,
      message: 'Refund processed successfully'
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Refund not possible - funds already released'
    });
  }
});

export default router;