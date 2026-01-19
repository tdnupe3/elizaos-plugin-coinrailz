import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { unifiedCreditsService } from '../services/unifiedCreditsService';
import { db } from '../db';
import { iotAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

const ADMIN_API_KEY_HASH = process.env.ADMIN_API_KEY 
  ? crypto.createHash('sha256').update(process.env.ADMIN_API_KEY).digest('hex')
  : null;

function requireAdminOrInternal(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-admin-key'] as string;
  const internalSecret = req.headers['x-internal-secret'] as string;
  
  if (process.env.INTERNAL_SERVICE_SECRET && internalSecret === process.env.INTERNAL_SERVICE_SECRET) {
    return next();
  }
  
  if (apiKey && ADMIN_API_KEY_HASH) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (keyHash === ADMIN_API_KEY_HASH) {
      return next();
    }
  }
  
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    hint: 'Admin API key (X-Admin-Key header) or internal service secret (X-Internal-Secret header) required',
  });
}

async function requireOwnershipOrAdmin(req: Request, res: Response, next: NextFunction) {
  const { ownerType, ownerId } = req.params;
  const apiKey = req.headers['x-admin-key'] as string;
  const iotApiKey = req.headers['x-api-key'] as string;
  const userId = (req as any).user?.id || (req as any).session?.userId;
  
  if (apiKey && ADMIN_API_KEY_HASH) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (keyHash === ADMIN_API_KEY_HASH) {
      return next();
    }
  }
  
  if (ownerType === 'user') {
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        hint: 'Please authenticate via /api/auth/login first',
      });
    }
    if (userId === ownerId) {
      return next();
    }
  }
  
  if (ownerType === 'iot_account' && iotApiKey) {
    const keyHash = crypto.createHash('sha256').update(iotApiKey).digest('hex');
    const [account] = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, ownerId))
      .limit(1);
    
    if (account && account.apiKeyHash === keyHash) {
      return next();
    }
  }
  
  return res.status(403).json({
    success: false,
    error: 'Forbidden',
    hint: 'You do not have access to this account',
  });
}

const addCreditsSchema = z.object({
  ownerType: z.enum(['user', 'iot_account']),
  ownerId: z.string().min(1),
  amount: z.number().positive(),
  source: z.enum(['mcp', 'iot', 'stripe', 'paypal', 'x402', 'migration', 'admin']),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const deductCreditsSchema = z.object({
  ownerType: z.enum(['user', 'iot_account']),
  ownerId: z.string().min(1),
  amount: z.number().positive(),
  source: z.enum(['mcp', 'iot', 'stripe', 'paypal', 'x402', 'migration', 'admin']),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const migrateSchema = z.object({
  iotAccountId: z.string().min(1),
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'unified-credits',
    version: '1.0.0',
    features: [
      'Shared credits pool for MCP and IoT',
      'Opt-in migration from legacy systems',
      'Full audit trail with transaction ledger',
      'Balance guards for race condition safety',
    ],
  });
});

router.get('/balance/:ownerType/:ownerId', requireOwnershipOrAdmin, async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId } = req.params;
    
    if (!['user', 'iot_account'].includes(ownerType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ownerType. Must be "user" or "iot_account"',
      });
    }
    
    const balance = await unifiedCreditsService.getBalance(
      ownerType as 'user' | 'iot_account',
      ownerId
    );
    
    const hasAccount = await unifiedCreditsService.hasUnifiedCredits(
      ownerType as 'user' | 'iot_account',
      ownerId
    );
    
    res.json({
      success: true,
      ownerType,
      ownerId,
      balance,
      balanceFormatted: `$${balance.toFixed(2)}`,
      hasUnifiedAccount: hasAccount,
    });
  } catch (error: any) {
    console.error('❌ Get balance failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
      message: error.message,
    });
  }
});

router.post('/add', requireAdminOrInternal, async (req: Request, res: Response) => {
  try {
    const validation = addCreditsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { ownerType, ownerId, amount, source, ...options } = validation.data;
    
    const result = await unifiedCreditsService.addCredits(
      ownerType,
      ownerId,
      amount,
      source,
      options
    );
    
    res.json({
      success: true,
      ...result,
      message: `Added $${amount.toFixed(2)} to unified credits`,
    });
  } catch (error: any) {
    console.error('❌ Add credits failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add credits',
      message: error.message,
    });
  }
});

router.post('/deduct', requireAdminOrInternal, async (req: Request, res: Response) => {
  try {
    const validation = deductCreditsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { ownerType, ownerId, amount, source, ...options } = validation.data;
    
    const result = await unifiedCreditsService.deductCredits(
      ownerType,
      ownerId,
      amount,
      source,
      options
    );
    
    res.json({
      success: true,
      ...result,
      message: `Deducted $${amount.toFixed(2)} from unified credits`,
    });
  } catch (error: any) {
    if (error.message.includes('Insufficient balance')) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        message: error.message,
      });
    }
    console.error('❌ Deduct credits failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deduct credits',
      message: error.message,
    });
  }
});

router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        hint: 'You must be logged in to migrate credits. Please authenticate via /api/auth/login first.',
      });
    }
    
    const validation = migrateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { iotAccountId } = validation.data;
    
    const result = await unifiedCreditsService.migrateToUnified(userId, iotAccountId);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message,
    });
  }
});

router.get('/transactions/:ownerType/:ownerId', requireOwnershipOrAdmin, async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!['user', 'iot_account'].includes(ownerType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ownerType. Must be "user" or "iot_account"',
      });
    }
    
    const result = await unifiedCreditsService.getTransactionHistory(
      ownerType as 'user' | 'iot_account',
      ownerId,
      limit,
      offset
    );
    
    res.json({
      success: true,
      ownerType,
      ownerId,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Get transactions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      message: error.message,
    });
  }
});

router.get('/linked/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = (req as any).user?.id || (req as any).session?.userId;
    
    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        hint: 'Please authenticate via /api/auth/login first.',
      });
    }
    
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        hint: 'You can only view your own linked accounts',
      });
    }
    
    const result = await unifiedCreditsService.getLinkedAccounts(userId);
    
    res.json({
      success: true,
      userId,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Get linked accounts failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get linked accounts',
      message: error.message,
    });
  }
});

/**
 * Credits Proof View - Shows complete balance breakdown
 * READ-ONLY endpoint for transparency and trust
 * 
 * Returns:
 * - Starting balance (first transaction or 0)
 * - Total deposits
 * - Total deductions
 * - Current balance
 * - Recent transaction summary
 */
router.get('/proof/:ownerType/:ownerId', requireOwnershipOrAdmin, async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId } = req.params;
    
    if (!['user', 'iot_account'].includes(ownerType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ownerType. Must be "user" or "iot_account"',
      });
    }
    
    const balance = await unifiedCreditsService.getBalance(
      ownerType as 'user' | 'iot_account',
      ownerId
    );
    
    const hasAccount = await unifiedCreditsService.hasUnifiedCredits(
      ownerType as 'user' | 'iot_account',
      ownerId
    );
    
    if (!hasAccount) {
      return res.json({
        success: true,
        proof: {
          ownerType,
          ownerId,
          hasAccount: false,
          startingBalance: 0,
          totalDeposits: 0,
          totalDeductions: 0,
          currentBalance: 0,
          transactionCount: 0,
          message: 'No unified credits account found. Create one by adding credits.',
        },
        generatedAt: new Date().toISOString(),
      });
    }
    
    const txHistory = await unifiedCreditsService.getTransactionHistory(
      ownerType as 'user' | 'iot_account',
      ownerId,
      100,
      0
    );
    
    let totalDeposits = 0;
    let totalDeductions = 0;
    const depositTypes = ['deposit', 'transfer_in', 'migration', 'refund'];
    const deductTypes = ['spend', 'transfer_out'];
    
    for (const tx of txHistory.transactions || []) {
      const amount = parseFloat(tx.amount);
      if (depositTypes.includes(tx.type)) {
        totalDeposits += amount;
      } else if (deductTypes.includes(tx.type)) {
        totalDeductions += amount;
      }
    }
    
    const recentTransactions = (txHistory.transactions || []).slice(0, 10).map((tx: any) => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      source: tx.source,
      description: tx.description,
      createdAt: tx.createdAt,
    }));
    
    res.json({
      success: true,
      proof: {
        ownerType,
        ownerId,
        hasAccount: true,
        startingBalance: 0,
        totalDeposits: Number(totalDeposits.toFixed(4)),
        totalDeductions: Number(totalDeductions.toFixed(4)),
        currentBalance: balance,
        expectedBalance: Number((totalDeposits - totalDeductions).toFixed(4)),
        balanceMatches: Math.abs(balance - (totalDeposits - totalDeductions)) < 0.0001,
        transactionCount: txHistory.total || 0,
        recentTransactions,
      },
      generatedAt: new Date().toISOString(),
      note: 'This proof shows the complete history of your unified credits. All deposits and deductions are recorded in an immutable ledger.',
    });
  } catch (error: any) {
    console.error('❌ Get credits proof failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate credits proof',
      message: error.message,
    });
  }
});

/**
 * Chargeback/Dispute Handling - Admin endpoint
 * 
 * Creates a compensating transaction (refund) when a dispute is filed.
 * Does NOT modify historical transactions - creates new refund entry.
 * 
 * ADMIN-ONLY: Requires X-Admin-Key or X-Internal-Secret
 */
const disputeSchema = z.object({
  ownerType: z.enum(['user', 'iot_account']),
  ownerId: z.string().min(1),
  originalTransactionId: z.string().min(1),
  disputeReason: z.enum(['chargeback', 'fraud', 'duplicate', 'service_not_delivered', 'other']),
  refundAmount: z.number().positive(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
});

router.post('/dispute', requireAdminOrInternal, async (req: Request, res: Response) => {
  try {
    const validation = disputeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { ownerType, ownerId, originalTransactionId, disputeReason, refundAmount, notes, idempotencyKey } = validation.data;
    
    const result = await unifiedCreditsService.addCredits(
      ownerType,
      ownerId,
      refundAmount,
      'admin',
      {
        referenceType: 'dispute_refund',
        referenceId: originalTransactionId,
        description: `Dispute refund (${disputeReason}): ${notes || 'No additional notes'}`,
        idempotencyKey: idempotencyKey || `dispute_${originalTransactionId}_${Date.now()}`,
      }
    );
    
    console.log(`⚠️ DISPUTE PROCESSED: ${disputeReason} for ${ownerType}/${ownerId}, refunded $${refundAmount}`);
    
    res.json({
      success: true,
      dispute: {
        originalTransactionId,
        disputeReason,
        refundAmount,
        refundTransactionId: result.transactionId,
        newBalance: result.newBalance,
        notes,
      },
      message: `Dispute processed. $${refundAmount.toFixed(2)} refunded to account.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Process dispute failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process dispute',
      message: error.message,
    });
  }
});

/**
 * Dispute Policy Information - Public endpoint
 * Returns the platform's chargeback/dispute policy
 */
router.get('/dispute-policy', (req: Request, res: Response) => {
  res.json({
    success: true,
    policy: {
      version: '1.0.0',
      effectiveDate: '2026-01-19',
      summary: 'Coin Railz Unified Credits Dispute Policy',
      rules: [
        {
          id: 'CR-001',
          title: 'Chargeback Eligibility',
          description: 'Chargebacks may be filed within 30 days of a credit purchase if the service was not delivered as described.',
        },
        {
          id: 'CR-002',
          title: 'Fraud Protection',
          description: 'Suspicious activity including duplicate payments, unauthorized access, or account compromise will be investigated within 48 hours.',
        },
        {
          id: 'CR-003',
          title: 'Consumed Credits',
          description: 'Credits that have been consumed (used for metering, transfers, or purchases) are generally non-refundable unless service was not delivered.',
        },
        {
          id: 'CR-004',
          title: 'Dispute Resolution',
          description: 'All disputes are reviewed by our team. Approved disputes result in a compensating credit to your account.',
        },
        {
          id: 'CR-005',
          title: 'Contact',
          description: 'To file a dispute, email support@coinrailz.com with your account ID and transaction details.',
        },
      ],
    },
  });
});

export default router;
