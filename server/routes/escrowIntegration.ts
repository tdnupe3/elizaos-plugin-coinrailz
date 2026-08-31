/**
 * ESCROW INTEGRATION SYSTEM
 * Complete order-payment-escrow lifecycle management
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Global in-memory storage for escrow system
const escrowAccounts = new Map();
const payments = new Map();
const orders = new Map();
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Create escrow account for order
router.post('/create', async (req, res) => {
  try {
    const { orderId, amount, agentId, customerId } = req.body;
    
    if (!orderId || !amount || !agentId || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, amount, agentId, customerId'
      });
    }

    const escrowId = `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const escrow = {
      id: escrowId,
      orderId,
      amount,
      agentId,
      customerId,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      fees: {
        platformFee: amount * 0.15,
        agentPayout: amount * 0.85
      }
    };

    escrowAccounts.set(escrowId, escrow);

    res.json({
      success: true,
      data: {
        escrowId,
        orderId,
        amount,
        status: 'pending_payment',
        platformFee: escrow.fees.platformFee,
        agentPayout: escrow.fees.agentPayout,
        message: 'Escrow account created - awaiting payment'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Escrow creation failed',
      message: errorMessage(error)
    });
  }
});

// Process payment and hold in escrow
router.post('/process-payment', async (req, res) => {
  try {
    const { escrowId, paymentMethod, amount } = req.body;
    
    const escrow = escrowAccounts.get(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow account not found'
      });
    }

    if (escrow.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        error: 'Escrow not ready for payment'
      });
    }

    if (Math.abs(amount - escrow.amount) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount does not match escrow amount'
      });
    }

    // Create payment record
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const payment: {
      id: string; escrowId: string; orderId: unknown; amount: unknown; method: unknown;
      status: string; createdAt: string; confirmedAt?: string; transactionId?: string;
    } = {
      id: paymentId,
      escrowId,
      orderId: escrow.orderId,
      amount,
      method: paymentMethod,
      status: 'processing',
      createdAt: new Date().toISOString()
    };

    // Simulate payment processing
    payment.status = 'succeeded';
    payment.confirmedAt = new Date().toISOString();
    payment.transactionId = `txn_${Date.now()}`;

    payments.set(paymentId, payment);

    // Update escrow status
    escrow.status = 'held';
    escrow.paymentId = paymentId;
    escrow.heldAt = new Date().toISOString();
    escrowAccounts.set(escrowId, escrow);

    res.json({
      success: true,
      data: {
        paymentId,
        escrowId,
        orderId: escrow.orderId,
        status: 'held',
        amount,
        message: 'Payment successful - funds held in escrow until delivery confirmation'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      message: errorMessage(error)
    });
  }
});

// Release escrow to agent (after delivery confirmation)
router.post('/release', async (req, res) => {
  try {
    const { escrowId, orderId, customerApproval } = req.body;
    
    const escrow = escrowAccounts.get(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow account not found'
      });
    }

    if (escrow.status !== 'held') {
      return res.status(400).json({
        success: false,
        error: 'No funds held in escrow'
      });
    }

    if (escrow.orderId !== orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID mismatch'
      });
    }

    // Verify customer approval
    if (!customerApproval || !customerApproval.approved) {
      return res.status(400).json({
        success: false,
        error: 'Customer approval required for escrow release'
      });
    }

    // Release funds to agent
    escrow.status = 'released';
    escrow.releasedAt = new Date().toISOString();
    escrow.customerApproval = customerApproval;
    escrow.agentPaidAmount = escrow.fees.agentPayout;
    
    escrowAccounts.set(escrowId, escrow);

    res.json({
      success: true,
      data: {
        escrowId,
        orderId,
        status: 'released',
        agentPayout: escrow.fees.agentPayout,
        platformFee: escrow.fees.platformFee,
        releasedAt: escrow.releasedAt,
        message: `$${escrow.fees.agentPayout} released to agent`
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Escrow release failed',
      message: errorMessage(error)
    });
  }
});

// Refund escrow to customer (for disputes or cancellations)
router.post('/refund', async (req, res) => {
  try {
    const { escrowId, reason, amount: refundAmount } = req.body;
    
    const escrow = escrowAccounts.get(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow account not found'
      });
    }

    if (escrow.status !== 'held') {
      return res.status(400).json({
        success: false,
        error: 'No funds held in escrow to refund'
      });
    }

    const refund = refundAmount || escrow.amount;
    
    // Process refund
    escrow.status = 'refunded';
    escrow.refundedAt = new Date().toISOString();
    escrow.refundAmount = refund;
    escrow.refundReason = reason;
    
    escrowAccounts.set(escrowId, escrow);

    res.json({
      success: true,
      data: {
        escrowId,
        orderId: escrow.orderId,
        status: 'refunded',
        refundAmount: refund,
        reason,
        message: `$${refund} refunded to customer`
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Refund processing failed',
      message: errorMessage(error)
    });
  }
});

// Get escrow status
router.get('/:escrowId', (req, res) => {
  const { escrowId } = req.params;
  
  const escrow = escrowAccounts.get(escrowId);
  if (!escrow) {
    return res.status(404).json({
      success: false,
      error: 'Escrow account not found'
    });
  }

  res.json({
    success: true,
    data: escrow
  });
});

// List escrow accounts for order
router.get('/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const orderEscrows = Array.from(escrowAccounts.values())
    .filter(escrow => escrow.orderId === orderId);

  res.json({
    success: true,
    data: {
      orderId,
      escrows: orderEscrows,
      count: orderEscrows.length
    }
  });
});

export default router;