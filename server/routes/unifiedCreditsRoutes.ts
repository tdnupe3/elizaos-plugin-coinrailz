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

export default router;
