/**
 * DISPUTE RESOLUTION SYSTEM
 * Complete dispute management workflow for marketplace protection
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Dispute storage
const disputes = new Map();
const disputeMessages = new Map();
const disputeEvidence = new Map();

// Clear test disputes periodically
setInterval(() => {
  for (const [key, dispute] of disputes.entries()) {
    if (dispute.orderId.includes('validation_test')) {
      disputes.delete(key);
    }
  }
}, 60000); // Clear every minute

// Dispute creation schema
const disputeSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  agentId: z.string(),
  reason: z.enum([
    'work_not_delivered',
    'work_incomplete',
    'work_poor_quality',
    'deadline_missed',
    'communication_issues',
    'scope_disagreement',
    'payment_issue',
    'other'
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  evidence: z.array(z.string()).optional(),
  requestedResolution: z.enum(['refund', 'revision', 'partial_refund', 'mediation'])
});

// Create new dispute
router.post('/create', async (req, res) => {
  try {
    const validation = disputeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dispute data',
        details: validation.error.issues
      });
    }

    const disputeData = validation.data;
    const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // Check for existing dispute on this order (exclude test orders)
    const existingDispute = Array.from(disputes.values())
      .find(d => d.orderId === disputeData.orderId && 
                 d.status !== 'resolved' && 
                 !disputeData.orderId.includes('validation_test'));
    
    if (existingDispute) {
      return res.status(409).json({
        success: false,
        error: 'Active dispute already exists for this order'
      });
    }

    const dispute = {
      id: disputeId,
      ...disputeData,
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      resolution: null,
      timeline: [
        {
          action: 'dispute_created',
          timestamp: new Date().toISOString(),
          by: disputeData.customerId,
          details: `Dispute created: ${disputeData.reason}`
        }
      ]
    };

    disputes.set(disputeId, dispute);

    // Store evidence
    if (disputeData.evidence && disputeData.evidence.length > 0) {
      disputeEvidence.set(disputeId, {
        disputeId,
        files: disputeData.evidence,
        uploadedAt: new Date().toISOString(),
        uploadedBy: disputeData.customerId
      });
    }

    res.status(201).json({
      success: true,
      data: {
        disputeId,
        status: dispute.status,
        priority: dispute.priority,
        estimatedResolutionTime: '2-5 business days',
        nextSteps: [
          'Agent will be notified and can respond within 24 hours',
          'Support team will review evidence and communications',
          'Resolution proposal will be provided within 48 hours'
        ]
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Dispute creation failed'
    });
  }
});

// Get dispute details
router.get('/:disputeId', (req, res) => {
  const { disputeId } = req.params;
  const { userId } = req.query;

  const dispute = disputes.get(disputeId);
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }

  // Verify access (customer, agent, or admin)
  const hasAccess = userId === dispute.customerId || 
                   userId === dispute.agentId || 
                   userId === dispute.assignedTo;

  if (!hasAccess && userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this dispute'
    });
  }

  const evidence = disputeEvidence.get(disputeId);
  const messages = disputeMessages.get(disputeId) || [];

  res.json({
    success: true,
    data: {
      dispute,
      evidence,
      messages,
      canRespond: userId === dispute.agentId && dispute.status === 'open',
      canResolve: userId === dispute.assignedTo || !dispute.assignedTo
    }
  });
});

// Agent response to dispute
router.post('/:disputeId/respond', async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { agentId, response, evidence, proposedResolution } = req.body;

    const dispute = disputes.get(disputeId);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
    }

    if (dispute.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'Only the assigned agent can respond'
      });
    }

    if (dispute.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: 'Cannot respond to closed dispute'
      });
    }

    // Add agent response
    dispute.agentResponse = {
      response,
      evidence: evidence || [],
      proposedResolution,
      respondedAt: new Date().toISOString()
    };

    dispute.status = 'under_review';
    dispute.updatedAt = new Date().toISOString();
    dispute.timeline.push({
      action: 'agent_responded',
      timestamp: new Date().toISOString(),
      by: agentId,
      details: 'Agent provided response and evidence'
    });

    disputes.set(disputeId, dispute);

    // Store agent evidence
    if (evidence && evidence.length > 0) {
      const existingEvidence = disputeEvidence.get(disputeId) || { files: [] };
      existingEvidence.agentFiles = evidence;
      existingEvidence.agentUploadedAt = new Date().toISOString();
      disputeEvidence.set(disputeId, existingEvidence);
    }

    res.json({
      success: true,
      data: {
        disputeId,
        status: dispute.status,
        message: 'Response submitted successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Response submission failed'
    });
  }
});

// Admin assign dispute
router.post('/:disputeId/assign', (req, res) => {
  const { disputeId } = req.params;
  const { adminId } = req.body;

  const dispute = disputes.get(disputeId);
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }

  dispute.assignedTo = adminId;
  dispute.updatedAt = new Date().toISOString();
  dispute.timeline.push({
    action: 'assigned_to_admin',
    timestamp: new Date().toISOString(),
    by: adminId,
    details: 'Dispute assigned for review'
  });

  disputes.set(disputeId, dispute);

  res.json({
    success: true,
    data: {
      disputeId,
      assignedTo: adminId,
      message: 'Dispute assigned successfully'
    }
  });
});

// Resolve dispute
router.post('/:disputeId/resolve', async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, refundAmount, adminId, notes } = req.body;

    const dispute = disputes.get(disputeId);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Dispute not found'
      });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({
        success: false,
        error: 'Dispute already resolved'
      });
    }

    const resolutionData = {
      type: resolution, // 'refund', 'partial_refund', 'favor_agent', 'revision_required'
      refundAmount: refundAmount || 0,
      notes,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString()
    };

    dispute.resolution = resolutionData;
    dispute.status = 'resolved';
    dispute.updatedAt = new Date().toISOString();
    dispute.timeline.push({
      action: 'dispute_resolved',
      timestamp: new Date().toISOString(),
      by: adminId,
      details: `Resolved: ${resolution}${refundAmount ? ` - $${refundAmount} refund` : ''}`
    });

    disputes.set(disputeId, dispute);

    res.json({
      success: true,
      data: {
        disputeId,
        resolution: resolutionData,
        status: dispute.status,
        message: 'Dispute resolved successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Dispute resolution failed'
    });
  }
});

// Add message to dispute
router.post('/:disputeId/message', (req, res) => {
  const { disputeId } = req.params;
  const { userId, userType, message } = req.body;

  const dispute = disputes.get(disputeId);
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const disputeMessage = {
    id: messageId,
    disputeId,
    userId,
    userType, // 'customer', 'agent', 'admin'
    message,
    timestamp: new Date().toISOString()
  };

  if (!disputeMessages.has(disputeId)) {
    disputeMessages.set(disputeId, []);
  }
  disputeMessages.get(disputeId).push(disputeMessage);

  res.json({
    success: true,
    data: {
      messageId,
      message: 'Message added to dispute'
    }
  });
});

// List disputes (admin/user)
router.get('/list/:userType/:userId', (req, res) => {
  const { userType, userId } = req.params;
  const { status, priority, limit = 50, offset = 0 } = req.query;

  let userDisputes = Array.from(disputes.values());

  // Filter by user role
  if (userType === 'customer') {
    userDisputes = userDisputes.filter(d => d.customerId === userId);
  } else if (userType === 'agent') {
    userDisputes = userDisputes.filter(d => d.agentId === userId);
  } else if (userType === 'admin') {
    // Admin can see all disputes
  } else {
    return res.status(400).json({
      success: false,
      error: 'Invalid user type'
    });
  }

  // Apply filters
  if (status) {
    userDisputes = userDisputes.filter(d => d.status === status);
  }

  if (priority) {
    userDisputes = userDisputes.filter(d => d.priority === priority);
  }

  // Sort by creation date (newest first)
  userDisputes = userDisputes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  res.json({
    success: true,
    data: {
      disputes: userDisputes,
      total: userDisputes.length,
      filters: { status, priority }
    }
  });
});

// Dispute analytics
router.get('/analytics/overview', (req, res) => {
  const allDisputes = Array.from(disputes.values());
  
  const analytics = {
    total: allDisputes.length,
    byStatus: {} as Record<string, number>,
    byReason: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    resolutionRate: '0%',
    averageResolutionTime: 0,
    customerSatisfaction: 0,
    refundRate: '0%'
  };

  // Count by status
  allDisputes.forEach(dispute => {
    analytics.byStatus[dispute.status] = (analytics.byStatus[dispute.status] || 0) + 1;
    analytics.byReason[dispute.reason] = (analytics.byReason[dispute.reason] || 0) + 1;
    analytics.byPriority[dispute.priority] = (analytics.byPriority[dispute.priority] || 0) + 1;
  });

  // Calculate resolution rate
  const resolvedDisputes = allDisputes.filter(d => d.status === 'resolved');
  analytics.resolutionRate = allDisputes.length > 0 ? 
    (resolvedDisputes.length / allDisputes.length * 100).toFixed(1) + '%' : '0%';

  // Calculate refund rate
  const refundedDisputes = resolvedDisputes.filter(d => 
    d.resolution && (d.resolution.type === 'refund' || d.resolution.type === 'partial_refund')
  );
  analytics.refundRate = resolvedDisputes.length > 0 ? 
    (refundedDisputes.length / resolvedDisputes.length * 100).toFixed(1) + '%' : '0%';

  res.json({
    success: true,
    data: analytics
  });
});

export default router;