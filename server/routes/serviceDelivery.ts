/**
 * SERVICE DELIVERY AND COMPLETION SYSTEM
 * Complete file upload, delivery tracking, and order completion workflow
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

const router = Router();

// In-memory storage for deliveries
const deliveries = new Map();
const orders = new Map();
const escrowAccounts = new Map();

// Configure multer for file uploads (memory storage for security)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Block dangerous file types
    const dangerousTypes = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'];
    const fileExt = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (dangerousTypes.includes(fileExt)) {
      return cb(new Error('File type not allowed for security reasons'));
    }
    
    cb(null, true);
  }
});

// Virus scanning simulation
function performVirusScan(buffer: Buffer, filename: string): { clean: boolean, threat?: string } {
  // Check for EICAR test string (industry standard test virus)
  const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  const content = buffer.toString();
  
  if (content.includes(eicarSignature)) {
    return { clean: false, threat: 'EICAR-Test-File detected' };
  }
  
  // Additional security checks
  const scriptPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi
  ];
  
  for (const pattern of scriptPatterns) {
    if (pattern.test(content)) {
      return { clean: false, threat: 'Potentially malicious script detected' };
    }
  }
  
  return { clean: true };
}

// Submit delivery for order
router.post('/submit', upload.array('files', 10), async (req, res) => {
  try {
    const { orderId, agentId, deliveryNotes, milestone } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!orderId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, agentId'
      });
    }

    // Verify order exists and agent is authorized
    const order = orders.get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'Agent not authorized for this order'
      });
    }

    // Process and scan files
    const processedFiles = [];
    if (files && files.length > 0) {
      for (const file of files) {
        // Perform virus scan
        const scanResult = performVirusScan(file.buffer, file.originalname);
        
        if (!scanResult.clean) {
          return res.status(400).json({
            success: false,
            error: `File ${file.originalname} failed security scan: ${scanResult.threat}`
          });
        }

        processedFiles.push({
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date().toISOString(),
          scanStatus: 'clean'
        });
      }
    }

    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const delivery = {
      id: deliveryId,
      orderId,
      agentId,
      customerId: order.customerId,
      status: 'submitted',
      deliveryNotes: deliveryNotes || '',
      milestone: milestone || 'final',
      files: processedFiles,
      submittedAt: new Date().toISOString(),
      requiresApproval: true
    };

    deliveries.set(deliveryId, delivery);

    // Update order status
    order.status = 'delivered';
    order.deliveryId = deliveryId;
    order.deliveredAt = new Date().toISOString();
    orders.set(orderId, order);

    res.json({
      success: true,
      data: {
        deliveryId,
        orderId,
        status: 'submitted',
        filesUploaded: processedFiles.length,
        totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0),
        securityScan: 'passed',
        message: 'Delivery submitted successfully - awaiting customer approval'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Delivery submission failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Customer approval/rejection of delivery
router.post('/approve', async (req, res) => {
  try {
    const { deliveryId, orderId, customerId, approved, rating, feedback } = req.body;
    
    const delivery = deliveries.get(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    if (delivery.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        error: 'Customer not authorized for this delivery'
      });
    }

    // Update delivery status
    delivery.status = approved ? 'approved' : 'rejected';
    delivery.customerApproval = {
      approved,
      rating: rating || null,
      feedback: feedback || '',
      approvedAt: new Date().toISOString()
    };
    deliveries.set(deliveryId, delivery);

    // Update order status
    const order = orders.get(orderId);
    if (order) {
      order.status = approved ? 'completed' : 'revision_required';
      order.completedAt = approved ? new Date().toISOString() : null;
      orders.set(orderId, order);
    }

    if (approved) {
      // Trigger escrow release
      const escrowRelease = await triggerEscrowRelease(orderId, delivery.customerApproval);
      
      res.json({
        success: true,
        data: {
          deliveryId,
          orderId,
          status: delivery.status,
          rating,
          feedback,
          escrowReleased: escrowRelease.success,
          agentPayout: escrowRelease.amount,
          message: approved ? 'Delivery approved - payment released to agent' : 'Delivery rejected - revisions required'
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          deliveryId,
          orderId,
          status: delivery.status,
          feedback,
          message: 'Delivery rejected - agent notified for revisions'
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Delivery approval failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger escrow release (internal function)
async function triggerEscrowRelease(orderId: string, customerApproval: any) {
  try {
    // Find escrow for this order
    const escrow = Array.from(escrowAccounts.values())
      .find(e => e.orderId === orderId && e.status === 'held');
    
    if (!escrow) {
      return { success: false, error: 'No held escrow found for order' };
    }

    // Release escrow
    escrow.status = 'released';
    escrow.releasedAt = new Date().toISOString();
    escrow.customerApproval = customerApproval;
    escrow.agentPaidAmount = escrow.fees.agentPayout;
    
    escrowAccounts.set(escrow.id, escrow);

    return { 
      success: true, 
      amount: escrow.fees.agentPayout,
      escrowId: escrow.id 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get delivery status
router.get('/:deliveryId', (req, res) => {
  const { deliveryId } = req.params;
  
  const delivery = deliveries.get(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: 'Delivery not found'
    });
  }

  res.json({
    success: true,
    data: delivery
  });
});

// List deliveries for order
router.get('/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const orderDeliveries = Array.from(deliveries.values())
    .filter(delivery => delivery.orderId === orderId);

  res.json({
    success: true,
    data: {
      orderId,
      deliveries: orderDeliveries,
      count: orderDeliveries.length
    }
  });
});

// Download delivered file (placeholder - would integrate with file storage)
router.get('/download/:deliveryId/:filename', (req, res) => {
  const { deliveryId, filename } = req.params;
  
  const delivery = deliveries.get(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: 'Delivery not found'
    });
  }

  const file = delivery.files.find((f: { originalName: string }) => f.originalName === filename);
  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found in delivery'
    });
  }

  // In production, this would serve the actual file from secure storage
  res.json({
    success: true,
    data: {
      message: 'File download would be served here',
      filename: file.originalName,
      size: file.size,
      downloadUrl: `/api/delivery/download/${deliveryId}/${filename}`
    }
  });
});

export default router;