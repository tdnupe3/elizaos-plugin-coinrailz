/**
 * AI Agent Service Order & Delivery Routes
 * Handles orders for Smart Contract Auditor and Compliance Consultant
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { auditSmartContract, AuditRequest } from '../services/smartContractAuditor';
import { generateComplianceReport, ComplianceRequest } from '../services/complianceConsultant';
import { db } from '../db';
import { aiMarketplaceOrders, aiMarketplaceDeliveries } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Order schemas
const SmartContractAuditOrderSchema = z.object({
  agentId: z.literal('smart-contract-auditor'),
  contractCode: z.string().min(10),
  contractName: z.string().min(1),
  amount: z.number().min(1000) // $1,000 minimum
});

const ComplianceConsultationOrderSchema = z.object({
  agentId: z.literal('compliance-consultant'),
  projectName: z.string().min(1),
  projectType: z.enum(['defi', 'cex', 'wallet', 'token', 'nft', 'payment', 'other']),
  jurisdiction: z.string().min(2),
  description: z.string().min(20),
  specificQuestions: z.array(z.string()).optional(),
  targetLaunchDate: z.string().optional(),
  amount: z.number().min(500) // $500 minimum
});

/**
 * POST /api/agent-services/order/smart-contract-audit
 * Order a smart contract audit
 */
router.post('/order/smart-contract-audit', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const orderData = SmartContractAuditOrderSchema.parse(req.body);
    
    // Create order
    const [order] = await db.insert(aiMarketplaceOrders).values({
      agentId: orderData.agentId,
      customerId: userId,
      serviceType: 'smart_contract_audit',
      amount: orderData.amount.toString(),
      customerRequirements: JSON.stringify({
        contractCode: orderData.contractCode,
        contractName: orderData.contractName
      }),
      status: 'pending',
      platformFee: (orderData.amount * 0.15).toString(),
      agentCommission: (orderData.amount * 0.85).toString()
    }).returning();

    // Start audit asynchronously
    executeAudit(order.id, orderData.contractCode, orderData.contractName, userId).catch(err => {
      console.error(`Audit execution error for order ${order.id}:`, err);
    });

    return res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        status: 'processing',
        estimatedCompletion: '5-10 minutes',
        amount: orderData.amount,
        message: 'Audit started. You will receive results shortly.'
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request data',
        details: error.errors 
      });
    }
    console.error('Audit order error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create audit order' 
    });
  }
});

/**
 * POST /api/agent-services/order/compliance-consultation
 * Order a compliance consultation
 */
router.post('/order/compliance-consultation', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const orderData = ComplianceConsultationOrderSchema.parse(req.body);
    
    // Create order
    const [order] = await db.insert(aiMarketplaceOrders).values({
      agentId: orderData.agentId,
      customerId: userId,
      serviceType: 'compliance_consultation',
      amount: orderData.amount.toString(),
      customerRequirements: JSON.stringify({
        projectName: orderData.projectName,
        projectType: orderData.projectType,
        jurisdiction: orderData.jurisdiction,
        description: orderData.description,
        specificQuestions: orderData.specificQuestions,
        targetLaunchDate: orderData.targetLaunchDate
      }),
      status: 'pending',
      platformFee: (orderData.amount * 0.15).toString(),
      agentCommission: (orderData.amount * 0.85).toString()
    }).returning();

    // Generate compliance report asynchronously
    executeCompliance(order.id, orderData, userId).catch(err => {
      console.error(`Compliance execution error for order ${order.id}:`, err);
    });

    return res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        status: 'processing',
        estimatedCompletion: '2-5 minutes',
        amount: orderData.amount,
        message: 'Compliance analysis started. You will receive report shortly.'
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request data',
        details: error.errors 
      });
    }
    console.error('Compliance order error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create compliance order' 
    });
  }
});

/**
 * GET /api/agent-services/order/:orderId
 * Get order status and results
 */
router.get('/order/:orderId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { orderId } = req.params;

    const [order] = await db
      .select()
      .from(aiMarketplaceOrders)
      .where(eq(aiMarketplaceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.customerId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Get delivery if completed
    const deliveries = await db
      .select()
      .from(aiMarketplaceDeliveries)
      .where(eq(aiMarketplaceDeliveries.orderId, orderId));

    return res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          agentId: order.agentId,
          serviceType: order.serviceType,
          status: order.status,
          amount: order.amount,
          createdAt: order.createdAt
        },
        delivery: deliveries.length > 0 ? deliveries[0] : null
      }
    });

  } catch (error: any) {
    console.error('Get order error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve order' 
    });
  }
});

/**
 * Execute smart contract audit
 */
async function executeAudit(orderId: string, contractCode: string, contractName: string, userId: string) {
  try {
    // Update order status
    await db
      .update(aiMarketplaceOrders)
      .set({ status: 'in_progress' })
      .where(eq(aiMarketplaceOrders.id, orderId));

    // Run audit
    const auditResult = await auditSmartContract({
      orderId,
      contractCode,
      contractName,
      userId
    });

    // Create delivery
    await db.insert(aiMarketplaceDeliveries).values({
      orderId,
      agentId: 'smart-contract-auditor',
      deliveryMethod: 'api_response',
      deliveryContent: auditResult as object
    });

    // Update order status
    await db
      .update(aiMarketplaceOrders)
      .set({ 
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(aiMarketplaceOrders.id, orderId));

    console.log(`✅ Audit completed for order ${orderId}`);

  } catch (error: any) {
    console.error(`❌ Audit failed for order ${orderId}:`, error);
    
    await db
      .update(aiMarketplaceOrders)
      .set({ status: 'failed' })
      .where(eq(aiMarketplaceOrders.id, orderId));
  }
}

/**
 * Execute compliance consultation
 */
async function executeCompliance(orderId: string, orderData: any, userId: string) {
  try {
    // Update order status
    await db
      .update(aiMarketplaceOrders)
      .set({ status: 'in_progress' })
      .where(eq(aiMarketplaceOrders.id, orderId));

    // Generate compliance report
    const complianceReport = await generateComplianceReport({
      orderId,
      userId,
      projectName: orderData.projectName,
      projectType: orderData.projectType,
      jurisdiction: orderData.jurisdiction,
      description: orderData.description,
      specificQuestions: orderData.specificQuestions,
      targetLaunchDate: orderData.targetLaunchDate
    });

    // Create delivery
    await db.insert(aiMarketplaceDeliveries).values({
      orderId,
      agentId: 'compliance-consultant',
      deliveryMethod: 'api_response',
      deliveryContent: complianceReport as object
    });

    // Update order status
    await db
      .update(aiMarketplaceOrders)
      .set({ 
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(aiMarketplaceOrders.id, orderId));

    console.log(`✅ Compliance report completed for order ${orderId}`);

  } catch (error: any) {
    console.error(`❌ Compliance failed for order ${orderId}:`, error);
    
    await db
      .update(aiMarketplaceOrders)
      .set({ status: 'failed' })
      .where(eq(aiMarketplaceOrders.id, orderId));
  }
}

export default router;
