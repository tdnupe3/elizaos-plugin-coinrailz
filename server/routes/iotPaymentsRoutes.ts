/**
 * IoT Payments Routes - Production-Grade Device Payment Infrastructure
 * 
 * VERSION: 1.1.0 (January 2026)
 * 
 * WHAT'S NEW IN v1.1:
 * - 50% price reduction: Base price now $0.005/event (was $0.01)
 * - Volume pricing: 100k-1M @ $0.0025, 1M+ @ $0.001
 * - PayPal topups: Alternative to Stripe for credit purchases
 * - 2x more credits per pack at same price
 * 
 * REVENUE MODEL:
 * - Credits Packs: $25/5,000, $100/25,000, $500/200,000 credits
 * - D2D Transfer Fee: 2% + $0.02 per transfer
 * - Billable Events: $0.005 per event (volume discounts available)
 * 
 * ENDPOINTS:
 * - POST /api/iot/account - Create IoT account
 * - GET /api/iot/account/:accountId - Get account details
 * - POST /api/iot/register - Register device to account
 * - GET /api/iot/balance/:deviceId - Check device/account balance
 * - POST /api/iot/meter - Record billable event and deduct credits
 * - POST /api/iot/transfer - D2D payment with fee extraction
 * - POST /api/iot/topup - Add credits via Stripe or PayPal
 * - GET /api/iot/transactions/:deviceId - Transaction history
 * - GET /api/iot/health - Service health check
 * 
 * ROLLBACK: Delete this file, remove registration from server/index.ts
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql, eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import {
  iotAccounts,
  iotDeviceRegistry,
  iotTransfers,
  iotBillableEvents,
  iotTopups,
} from '@shared/schema';
import {
  IOT_CREDITS_PACKS,
  IOT_TRANSFER_FEE,
  IOT_EVENT_TYPES,
  IOT_VOLUME_TIERS,
  calculateTransferFee,
  isValidPackId,
  getPackById,
  getVolumeTier,
  type IotCreditsPackId,
  type IotEventType,
} from '@shared/iotPricing';
import { paypalService } from '../services/paypalService';

const router = Router();

const iotRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { 
    success: false, 
    error: 'Too many requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(iotRateLimiter);

interface IoTAuthResult {
  valid: boolean;
  accountId?: string;
  deviceId?: string;
  ownedAccountIds?: string[];
}

async function verifyApiKey(apiKey: string): Promise<IoTAuthResult> {
  if (!apiKey) return { valid: false };
  
  const { createHash } = await import('crypto');
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const deviceResult = await db.execute(
    sql`SELECT dr.device_id, dr.account_id, dr.status 
        FROM iot_device_registry dr
        JOIN m2m_devices m ON m.device_id = dr.device_id
        WHERE m.api_key_hash = ${keyHash} AND m.status = 'active' AND dr.status = 'active'`
  );
  
  if (deviceResult.rows.length > 0) {
    const d = deviceResult.rows[0] as any;
    return { 
      valid: true, 
      accountId: d.account_id, 
      deviceId: d.device_id,
      ownedAccountIds: [d.account_id]
    };
  }
  
  const accountKeyResult = await db.execute(
    sql`SELECT ia.id, ia.status 
        FROM iot_accounts ia
        WHERE ia.api_key_hash = ${keyHash} AND ia.status = 'active'`
  );
  
  if (accountKeyResult.rows.length > 0) {
    const accountIds = accountKeyResult.rows.map((r: any) => r.id);
    return { 
      valid: true, 
      accountId: accountIds[0],
      ownedAccountIds: accountIds
    };
  }
  
  return { valid: false };
}

function canAccessAccount(auth: IoTAuthResult, accountId: string): boolean {
  if (!auth.ownedAccountIds) return false;
  return auth.ownedAccountIds.includes(accountId);
}

async function canAccessDevice(auth: IoTAuthResult, deviceId: string): Promise<boolean> {
  if (auth.deviceId === deviceId) return true;
  
  const device = await db.select()
    .from(iotDeviceRegistry)
    .where(eq(iotDeviceRegistry.deviceId, deviceId))
    .limit(1);
  
  if (!device.length) return false;
  return canAccessAccount(auth, device[0].accountId);
}

function requireAuth(allowPublic: boolean = false) {
  return async (req: any, res: any, next: any) => {
    if (allowPublic) return next();
    
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        header: 'X-API-Key',
      });
    }
    
    const auth = await verifyApiKey(apiKey);
    if (!auth.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }
    
    req.iotAuth = auth;
    next();
  };
}

const MIN_TRANSFER_AMOUNT = 0.05;

let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia" as any
    });
  }
  return stripeClient;
}

const createAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  ownerId: z.string().optional(),
  ownerWallet: z.string().optional(),
  tier: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  metadata: z.record(z.any()).optional(),
});

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1).max(255),
  accountId: z.string().min(1),
  deviceName: z.string().max(100).optional(),
  deviceType: z.enum(['iot_device', 'sensor', 'gateway', 'actuator', 'ai_agent']).default('iot_device'),
  walletAddress: z.string().optional(),
  chain: z.enum(['base-mainnet', 'ethereum-mainnet', 'polygon-mainnet', 'arbitrum-mainnet', 'solana-mainnet']).default('base-mainnet'),
  spendingLimit: z.number().positive().optional(),
  canReceivePayments: z.boolean().default(true),
  canSendPayments: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

const meterEventSchema = z.object({
  deviceId: z.string().min(1),
  eventType: z.enum(['message', 'data_access', 'unlock', 'stream_minute', 'sensor_reading', 'api_call', 'compute_second', 'storage_mb']),
  units: z.number().int().positive().default(1),
  unitPrice: z.number().positive().optional(), // Override default price
  topic: z.string().optional(),
  payload: z.record(z.any()).optional(),
  serviceId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const transferSchema = z.object({
  fromDeviceId: z.string().min(1),
  toDeviceId: z.string().optional(),
  toWallet: z.string().optional(),
  amount: z.number().positive().min(MIN_TRANSFER_AMOUNT, `Minimum transfer amount is $${MIN_TRANSFER_AMOUNT}`),
  paymentMethod: z.enum(['credits', 'usdc_onchain']),
  chain: z.string().optional(),
  purpose: z.string().optional(),
  reference: z.string().optional(),
  idempotencyKey: z.string().optional(),
}).refine(data => data.toDeviceId || data.toWallet, {
  message: 'Either toDeviceId or toWallet must be provided',
});

const topupSchema = z.object({
  accountId: z.string().min(1),
  packId: z.enum(['starter_25', 'growth_100', 'enterprise_500']),
  paymentMethod: z.enum(['stripe', 'paypal']),
  stripePaymentMethodId: z.string().optional(),
  paypalOrderId: z.string().optional(), // For capturing an approved PayPal order
});

router.get('/health', async (req: Request, res: Response) => {
  const stripe = getStripeClient();
  let paypalConfigured = false;
  try {
    paypalConfigured = await paypalService.testAuthentication();
  } catch (e) {}
  
  res.json({
    success: true,
    status: 'operational',
    version: '1.1.0',
    stripeConfigured: !!stripe,
    paypalConfigured,
    volumePricing: IOT_VOLUME_TIERS,
    feeStructure: {
      transferPercentage: `${IOT_TRANSFER_FEE.percentageFee * 100}%`,
      transferFlat: `$${IOT_TRANSFER_FEE.flatFee}`,
      minFee: `$${IOT_TRANSFER_FEE.minFee}`,
    },
    creditsPacks: Object.keys(IOT_CREDITS_PACKS),
    eventTypes: Object.keys(IOT_EVENT_TYPES),
    endpoints: {
      createAccount: 'POST /api/iot/account',
      getAccount: 'GET /api/iot/account/:accountId',
      registerDevice: 'POST /api/iot/register',
      getBalance: 'GET /api/iot/balance/:deviceId',
      meterEvent: 'POST /api/iot/meter',
      transfer: 'POST /api/iot/transfer',
      topup: 'POST /api/iot/topup',
      transactions: 'GET /api/iot/transactions/:deviceId',
    },
    timestamp: new Date().toISOString(),
  });
});

const optionalAuth = requireAuth(true);
const requiredAuth = requireAuth(false);

router.post('/account', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = createAccountSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { accountName, ownerId, ownerWallet, tier, metadata } = validation.data;
    const accountId = `iot_acc_${nanoid(12)}`;
    
    const { createHash, randomBytes } = await import('crypto');
    const apiKey = `iot_${randomBytes(24).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    await db.insert(iotAccounts).values({
      id: accountId,
      ownerId,
      ownerWallet,
      apiKeyHash,
      accountName,
      tier,
      metadata: metadata || {},
    });

    console.log(`✅ IoT Account created: ${accountId} (${accountName})`);

    res.status(201).json({
      success: true,
      account: {
        id: accountId,
        accountName,
        tier,
        creditsBalance: 0,
        status: 'active',
      },
      apiKey,
      apiKeyWarning: 'Store this API key securely. It cannot be retrieved again.',
      endpoints: {
        registerDevice: '/api/iot/register',
        topup: '/api/iot/topup',
        balance: `/api/iot/account/${accountId}`,
      },
      creditsPacks: IOT_CREDITS_PACKS,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ IoT Account creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Account creation failed',
      message: error.message,
    });
  }
});

router.get('/account/:accountId', requiredAuth, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const auth = (req as any).iotAuth as IoTAuthResult;
    
    if (!canAccessAccount(auth, accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }
    
    const account = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, accountId))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    if (account[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended',
        status: account[0].status,
      });
    }

    const devices = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.accountId, accountId));

    res.json({
      success: true,
      account: {
        ...account[0],
        creditsBalance: parseFloat(account[0].creditsBalance || '0'),
        totalDeposited: parseFloat(account[0].totalDeposited || '0'),
        totalSpent: parseFloat(account[0].totalSpent || '0'),
        totalFeesEarned: parseFloat(account[0].totalFeesEarned || '0'),
      },
      devices: devices.map(d => ({
        id: d.id,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        status: d.status,
      })),
      deviceCount: devices.length,
    });
  } catch (error: any) {
    console.error('❌ Get account failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account',
    });
  }
});

router.post('/account/:accountId/rotate-key', requiredAuth, async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const auth = (req as any).iotAuth as IoTAuthResult;
    
    if (!canAccessAccount(auth, accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }
    
    const account = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, accountId))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    const { createHash, randomBytes } = await import('crypto');
    const newApiKey = `iot_${randomBytes(24).toString('hex')}`;
    const newApiKeyHash = createHash('sha256').update(newApiKey).digest('hex');
    
    await db.update(iotAccounts)
      .set({ 
        apiKeyHash: newApiKeyHash,
        updatedAt: new Date(),
      })
      .where(eq(iotAccounts.id, accountId));
    
    console.log(`🔑 IoT Account API key rotated: ${accountId}`);
    
    res.json({
      success: true,
      apiKey: newApiKey,
      apiKeyWarning: 'Store this API key securely. The old key is now invalidated.',
      accountId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ API key rotation failed:', error);
    res.status(500).json({
      success: false,
      error: 'API key rotation failed',
    });
  }
});

router.post('/register', requiredAuth, async (req: Request, res: Response) => {
  try {
    const validation = registerDeviceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const data = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    
    if (!canAccessAccount(auth, data.accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }
    
    const account = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, data.accountId))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }
    
    if (account[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended',
      });
    }

    const existing = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.deviceId, data.deviceId))
      .limit(1);

    if (existing.length) {
      return res.status(200).json({
        success: true,
        isExisting: true,
        device: existing[0],
        message: 'Device already registered',
      });
    }

    const deviceRegistryId = `iot_dev_${nanoid(12)}`;
    
    await db.insert(iotDeviceRegistry).values({
      id: deviceRegistryId,
      deviceId: data.deviceId,
      accountId: data.accountId,
      deviceName: data.deviceName,
      deviceType: data.deviceType,
      walletAddress: data.walletAddress,
      chain: data.chain,
      spendingLimit: data.spendingLimit?.toString(),
      canReceivePayments: data.canReceivePayments,
      canSendPayments: data.canSendPayments,
      metadata: data.metadata || {},
    });

    console.log(`✅ IoT Device registered: ${data.deviceId} → account ${data.accountId}`);

    res.status(201).json({
      success: true,
      device: {
        id: deviceRegistryId,
        deviceId: data.deviceId,
        accountId: data.accountId,
        deviceType: data.deviceType,
        status: 'active',
      },
      endpoints: {
        meter: '/api/iot/meter',
        balance: `/api/iot/balance/${data.deviceId}`,
        transfer: '/api/iot/transfer',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Device registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Device registration failed',
      message: error.message,
    });
  }
});

router.get('/balance/:deviceId', requiredAuth, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const auth = (req as any).iotAuth as IoTAuthResult;

    const device = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.deviceId, deviceId))
      .limit(1);

    if (!device.length) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        registerEndpoint: '/api/iot/register',
      });
    }
    
    if (!canAccessAccount(auth, device[0].accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this device',
      });
    }
    
    if (device[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Device is suspended',
        status: device[0].status,
      });
    }

    const account = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, device[0].accountId))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    const balance = parseFloat(account[0].creditsBalance || '0');
    
    await db.update(iotDeviceRegistry)
      .set({ lastActiveAt: new Date() })
      .where(eq(iotDeviceRegistry.deviceId, deviceId));

    res.json({
      success: true,
      deviceId,
      accountId: device[0].accountId,
      balance,
      balanceFormatted: `$${balance.toFixed(4)}`,
      spendingLimit: device[0].spendingLimit ? parseFloat(device[0].spendingLimit) : null,
      todaySpent: parseFloat(device[0].todaySpent || '0'),
      canSendPayments: device[0].canSendPayments,
      canReceivePayments: device[0].canReceivePayments,
      status: device[0].status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Get balance failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
    });
  }
});

router.post('/meter', requiredAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validation = meterEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { deviceId, eventType, units, unitPrice, topic, payload, serviceId, idempotencyKey } = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    const eventId = idempotencyKey ? `iot_evt_${idempotencyKey}` : `iot_evt_${nanoid(16)}`;

    if (idempotencyKey) {
      const existing = await db.select()
        .from(iotBillableEvents)
        .where(eq(iotBillableEvents.id, eventId))
        .limit(1);
      
      if (existing.length) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          event: existing[0],
          message: 'Event already processed',
        });
      }
    }

    const device = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.deviceId, deviceId))
      .limit(1);

    if (!device.length) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }
    
    if (!canAccessAccount(auth, device[0].accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this device',
      });
    }
    
    if (device[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Device is suspended',
      });
    }

    const effectiveUnitPrice = unitPrice ?? IOT_EVENT_TYPES[eventType as IotEventType]?.defaultUnitPrice ?? 0.01;
    const totalCost = units * effectiveUnitPrice;
    
    const spendingLimit = device[0].spendingLimit ? parseFloat(device[0].spendingLimit) : null;
    const todaySpent = parseFloat(device[0].todaySpent || '0');
    
    if (spendingLimit !== null && (todaySpent + totalCost) > spendingLimit) {
      return res.status(402).json({
        success: false,
        error: 'Spending limit exceeded',
        spendingLimit,
        todaySpent,
        requestedAmount: totalCost,
        remaining: Math.max(0, spendingLimit - todaySpent),
      });
    }

    const result = await db.transaction(async (tx) => {
      const accountResult = await tx.execute(
        sql`UPDATE iot_accounts 
            SET credits_balance = credits_balance - ${totalCost.toFixed(4)}::numeric,
                total_spent = total_spent + ${totalCost.toFixed(4)}::numeric,
                updated_at = NOW()
            WHERE id = ${device[0].accountId}
            AND credits_balance >= ${totalCost.toFixed(4)}::numeric
            RETURNING credits_balance`
      );

      if (!accountResult.rows || accountResult.rows.length === 0) {
        throw { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient credits balance' };
      }

      const newBalance = parseFloat((accountResult.rows[0] as any).credits_balance || '0');

      await tx.insert(iotBillableEvents).values({
        id: eventId,
        deviceId,
        accountId: device[0].accountId,
        eventType,
        eventName: IOT_EVENT_TYPES[eventType as IotEventType]?.name || eventType,
        units,
        unitPrice: effectiveUnitPrice.toString(),
        totalCost: totalCost.toString(),
        balanceAfter: newBalance.toString(),
        topic,
        payload: payload || {},
        serviceId,
        status: 'completed',
      });

      await tx.execute(
        sql`UPDATE iot_device_registry 
            SET today_spent = today_spent + ${totalCost.toFixed(4)}::numeric,
                last_active_at = NOW()
            WHERE device_id = ${deviceId}`
      );

      return { newBalance };
    });

    const durationMs = Date.now() - startTime;
    console.log(`💳 IoT Meter: ${deviceId} charged $${totalCost.toFixed(4)} for ${units}x ${eventType}`);

    res.status(201).json({
      success: true,
      event: {
        id: eventId,
        deviceId,
        eventType,
        units,
        unitPrice: effectiveUnitPrice,
        totalCost,
        balanceAfter: result.newBalance,
      },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ IoT Meter failed:', error);
    
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        topupEndpoint: '/api/iot/topup',
        creditsPacks: IOT_CREDITS_PACKS,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Metering failed',
      message: error.message,
    });
  }
});

router.post('/transfer', requiredAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validation = transferSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { fromDeviceId, toDeviceId, toWallet, amount, paymentMethod, chain, purpose, reference, idempotencyKey } = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    const transferId = `iot_txn_${nanoid(16)}`;

    if (amount < MIN_TRANSFER_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Minimum transfer amount is $${MIN_TRANSFER_AMOUNT}`,
        minAmount: MIN_TRANSFER_AMOUNT,
      });
    }

    if (paymentMethod === 'credits' && !toDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'Credits transfers require toDeviceId',
        hint: 'For external wallet transfers, use paymentMethod: usdc_onchain',
      });
    }

    if (paymentMethod === 'usdc_onchain' && !toWallet && !toDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'USDC on-chain transfers require toWallet or toDeviceId',
      });
    }
    
    if (fromDeviceId === toDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot transfer to the same device',
      });
    }

    if (idempotencyKey) {
      const existing = await db.select()
        .from(iotTransfers)
        .where(eq(iotTransfers.idempotencyKey, idempotencyKey))
        .limit(1);
      
      if (existing.length) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          transfer: existing[0],
          message: 'Transfer already processed',
        });
      }
    }

    const fromDevice = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.deviceId, fromDeviceId))
      .limit(1);

    if (!fromDevice.length) {
      return res.status(404).json({
        success: false,
        error: 'Sender device not found',
      });
    }
    
    if (!canAccessAccount(auth, fromDevice[0].accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to sender device',
      });
    }
    
    if (fromDevice[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Sender device is suspended',
      });
    }

    if (!fromDevice[0].canSendPayments) {
      return res.status(403).json({
        success: false,
        error: 'Device is not authorized to send payments',
      });
    }

    let toDevice: any = null;
    let toAccountId: string | null = null;

    if (toDeviceId) {
      const toDeviceResult = await db.select()
        .from(iotDeviceRegistry)
        .where(eq(iotDeviceRegistry.deviceId, toDeviceId))
        .limit(1);

      if (!toDeviceResult.length) {
        return res.status(404).json({
          success: false,
          error: 'Recipient device not found',
        });
      }
      
      toDevice = toDeviceResult[0];
      toAccountId = toDevice.accountId;
      
      if (toDevice.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Recipient device is suspended',
        });
      }
      
      if (!toDevice.canReceivePayments) {
        return res.status(403).json({
          success: false,
          error: 'Recipient device cannot receive payments',
        });
      }
      
      if (fromDevice[0].accountId === toDevice.accountId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot transfer between devices on the same account',
          hint: 'Use internal account balance management instead',
        });
      }
    }

    const { fee, netAmount } = calculateTransferFee(amount);

    if (paymentMethod === 'credits') {
      const result = await db.transaction(async (tx) => {
        const fromAccountResult = await tx.execute(
          sql`UPDATE iot_accounts 
              SET credits_balance = credits_balance - ${amount.toFixed(4)}::numeric,
                  total_spent = total_spent + ${amount.toFixed(4)}::numeric,
                  updated_at = NOW()
              WHERE id = ${fromDevice[0].accountId}
              AND credits_balance >= ${amount.toFixed(4)}::numeric
              RETURNING credits_balance`
        );

        if (!fromAccountResult.rows || fromAccountResult.rows.length === 0) {
          throw { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient credits balance' };
        }

        if (toAccountId) {
          await tx.execute(
            sql`UPDATE iot_accounts 
                SET credits_balance = credits_balance + ${netAmount.toFixed(4)}::numeric,
                    total_fees_earned = total_fees_earned + ${fee.toFixed(4)}::numeric,
                    updated_at = NOW()
                WHERE id = ${toAccountId}`
          );
        }

        await tx.insert(iotTransfers).values({
          id: transferId,
          fromDeviceId,
          fromAccountId: fromDevice[0].accountId,
          toDeviceId: toDeviceId || null,
          toAccountId,
          toWallet: toWallet || null,
          amount: amount.toString(),
          fee: fee.toString(),
          netAmount: netAmount.toString(),
          currency: 'USD',
          paymentMethod,
          chain: chain || null,
          purpose: purpose || null,
          reference: reference || null,
          status: 'completed',
          idempotencyKey: idempotencyKey || null,
        });

        return { senderBalance: parseFloat((fromAccountResult.rows[0] as any).credits_balance) };
      });

      const durationMs = Date.now() - startTime;
      console.log(`💸 IoT Transfer: ${fromDeviceId} → ${toDeviceId || toWallet} | $${amount} (fee: $${fee}, net: $${netAmount})`);

      res.status(201).json({
        success: true,
        transfer: {
          id: transferId,
          fromDeviceId,
          toDeviceId: toDeviceId || null,
          toWallet: toWallet || null,
          amount,
          fee,
          netAmount,
          currency: 'USD',
          paymentMethod,
          status: 'completed',
        },
        senderBalanceAfter: result.senderBalance,
        feeBreakdown: {
          percentage: `${IOT_TRANSFER_FEE.percentageFee * 100}%`,
          flat: `$${IOT_TRANSFER_FEE.flatFee}`,
          total: `$${fee.toFixed(4)}`,
        },
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } else if (paymentMethod === 'usdc_onchain') {
      await db.insert(iotTransfers).values({
        id: transferId,
        fromDeviceId,
        fromAccountId: fromDevice[0].accountId,
        toDeviceId: toDeviceId || null,
        toAccountId,
        toWallet: toWallet || null,
        amount: amount.toString(),
        fee: fee.toString(),
        netAmount: netAmount.toString(),
        currency: 'USDC',
        paymentMethod,
        chain: chain || 'base-mainnet',
        purpose: purpose || null,
        reference: reference || null,
        status: 'pending',
        idempotencyKey: idempotencyKey || null,
      });

      res.status(201).json({
        success: true,
        transfer: {
          id: transferId,
          status: 'pending',
          amount,
          fee,
          netAmount,
          currency: 'USDC',
          chain: chain || 'base-mainnet',
        },
        action: 'on_chain_required',
        message: 'On-chain USDC transfer required. Use wallet to complete.',
        recipientWallet: toWallet || toDevice?.walletAddress,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('❌ IoT Transfer failed:', error);
    
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        topupEndpoint: '/api/iot/topup',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Transfer failed',
      message: error.message,
    });
  }
});

router.post('/topup', requiredAuth, async (req: Request, res: Response) => {
  try {
    const validation = topupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { accountId, packId, paymentMethod, stripePaymentMethodId } = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    const topupId = `iot_topup_${nanoid(16)}`;
    
    if (!canAccessAccount(auth, accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }

    const account = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, accountId))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    const pack = getPackById(packId as IotCreditsPackId);
    if (!pack) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pack ID',
        availablePacks: Object.keys(IOT_CREDITS_PACKS),
      });
    }

    if (paymentMethod === 'stripe') {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({
          success: false,
          error: 'Stripe not configured',
        });
      }

      if (!stripePaymentMethodId) {
        return res.status(400).json({
          success: false,
          error: 'stripePaymentMethodId required for Stripe payments',
        });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(pack.priceUSD * 100),
          currency: 'usd',
          payment_method: stripePaymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: {
            accountId,
            packId,
            credits: pack.credits.toString(),
            source: 'iot_payments',
          },
        });

        if (paymentIntent.status === 'succeeded') {
          const creditsValueUSD = pack.credits * pack.perCreditPrice;
          
          const result = await db.transaction(async (tx) => {
            const accountResult = await tx.execute(
              sql`UPDATE iot_accounts 
                  SET credits_balance = credits_balance + ${creditsValueUSD.toFixed(4)}::numeric,
                      total_deposited = total_deposited + ${pack.priceUSD.toFixed(4)}::numeric,
                      updated_at = NOW()
                  WHERE id = ${accountId}
                  RETURNING credits_balance`
            );

            const newBalance = parseFloat((accountResult.rows[0] as any).credits_balance);

            await tx.insert(iotTopups).values({
              id: topupId,
              accountId,
              amount: creditsValueUSD.toString(),
              amountPaid: pack.priceUSD.toString(),
              packType: packId,
              paymentMethod: 'stripe',
              stripePaymentIntentId: paymentIntent.id,
              status: 'completed',
              balanceAfter: newBalance.toString(),
            });

            return { newBalance };
          });

          console.log(`💰 IoT Topup: ${accountId} added $${creditsValueUSD.toFixed(2)} credits (${pack.credits} units at $${pack.perCreditPrice}/ea) via ${packId}`);

          res.status(201).json({
            success: true,
            topup: {
              id: topupId,
              accountId,
              packId,
              creditsAdded: creditsValueUSD,
              creditUnits: pack.credits,
              perCreditPrice: pack.perCreditPrice,
              amountPaid: pack.priceUSD,
              balanceAfter: result.newBalance,
              status: 'completed',
            },
            stripePaymentIntentId: paymentIntent.id,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(402).json({
            success: false,
            error: 'Payment not completed',
            paymentStatus: paymentIntent.status,
            stripePaymentIntentId: paymentIntent.id,
          });
        }
      } catch (stripeError: any) {
        console.error('❌ Stripe payment failed:', stripeError);
        res.status(402).json({
          success: false,
          error: 'Payment failed',
          message: stripeError.message,
        });
      }
    } else if (paymentMethod === 'paypal') {
      const { paypalOrderId } = validation.data;
      
      if (!paypalOrderId) {
        // Step 1: Create PayPal order for user to approve
        try {
          const order = await paypalService.createOrder({
            amount: pack.priceUSD,
            currency: 'USD',
            description: `IoT Credits: ${pack.name} (${pack.credits} credits)`,
            orderId: topupId,
            platform: 'iot_payments',
          });

          console.log(`📦 PayPal order created for IoT topup: ${order.id}`);

          const approvalLink = order.links?.find((l: any) => l.rel === 'approve')?.href;

          res.status(200).json({
            success: true,
            status: 'approval_required',
            paypalOrderId: order.id,
            approvalUrl: approvalLink,
            pack: {
              id: packId,
              name: pack.name,
              priceUSD: pack.priceUSD,
              credits: pack.credits,
            },
            message: 'Approve payment in PayPal, then call this endpoint again with paypalOrderId',
          });
        } catch (paypalError: any) {
          console.error('❌ PayPal order creation failed:', paypalError);
          res.status(500).json({
            success: false,
            error: 'PayPal order creation failed',
            message: paypalError.message,
          });
        }
      } else {
        // Step 2: Capture approved PayPal order with validation
        try {
          // First fetch order details to validate amount before capture
          const orderDetails = await paypalService.getOrderDetails(paypalOrderId);
          
          // Validate order amount matches expected pack price
          const purchaseUnit = orderDetails?.purchase_units?.[0];
          const orderAmount = parseFloat(purchaseUnit?.amount?.value || '0');
          const orderCurrency = purchaseUnit?.amount?.currency_code;
          
          if (orderCurrency !== 'USD') {
            return res.status(400).json({
              success: false,
              error: 'Invalid currency',
              expected: 'USD',
              received: orderCurrency,
            });
          }
          
          // Validate amount matches pack price (allow small floating point tolerance)
          if (Math.abs(orderAmount - pack.priceUSD) > 0.01) {
            console.error(`❌ PayPal order amount mismatch: expected $${pack.priceUSD}, got $${orderAmount}`);
            return res.status(400).json({
              success: false,
              error: 'Order amount mismatch',
              expected: pack.priceUSD,
              received: orderAmount,
              hint: 'PayPal order amount does not match selected pack price',
            });
          }
          
          // Validate order is approved and ready to capture
          if (orderDetails.status !== 'APPROVED') {
            return res.status(400).json({
              success: false,
              error: 'Order not approved',
              status: orderDetails.status,
              hint: 'User must approve the PayPal order before capture',
            });
          }
          
          const capture = await paypalService.captureOrder(paypalOrderId);

          if (capture.status === 'COMPLETED') {
            const creditsValueUSD = pack.credits * pack.perCreditPrice;
            
            const result = await db.transaction(async (tx) => {
              const accountResult = await tx.execute(
                sql`UPDATE iot_accounts 
                    SET credits_balance = credits_balance + ${creditsValueUSD.toFixed(4)}::numeric,
                        total_deposited = total_deposited + ${pack.priceUSD.toFixed(4)}::numeric,
                        updated_at = NOW()
                    WHERE id = ${accountId}
                    RETURNING credits_balance`
              );

              const newBalance = parseFloat((accountResult.rows[0] as any).credits_balance);

              await tx.insert(iotTopups).values({
                id: topupId,
                accountId,
                amount: creditsValueUSD.toString(),
                amountPaid: pack.priceUSD.toString(),
                packType: packId,
                paymentMethod: 'paypal',
                paypalOrderId: paypalOrderId,
                status: 'completed',
                balanceAfter: newBalance.toString(),
              });

              return { newBalance };
            });

            console.log(`💰 IoT Topup via PayPal: ${accountId} added $${creditsValueUSD.toFixed(2)} credits`);

            res.status(201).json({
              success: true,
              topup: {
                id: topupId,
                accountId,
                packId,
                creditsAdded: creditsValueUSD,
                creditUnits: pack.credits,
                perCreditPrice: pack.perCreditPrice,
                amountPaid: pack.priceUSD,
                balanceAfter: result.newBalance,
                status: 'completed',
              },
              paypalOrderId: paypalOrderId,
              timestamp: new Date().toISOString(),
            });
          } else {
            res.status(402).json({
              success: false,
              error: 'Payment not completed',
              paymentStatus: capture.status,
              paypalOrderId: paypalOrderId,
            });
          }
        } catch (paypalError: any) {
          console.error('❌ PayPal capture failed:', paypalError);
          res.status(402).json({
            success: false,
            error: 'PayPal payment capture failed',
            message: paypalError.message,
          });
        }
      }
    }
  } catch (error: any) {
    console.error('❌ IoT Topup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Topup failed',
      message: error.message,
    });
  }
});

router.get('/transactions/:deviceId', requiredAuth, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const auth = (req as any).iotAuth as IoTAuthResult;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const device = await db.select()
      .from(iotDeviceRegistry)
      .where(eq(iotDeviceRegistry.deviceId, deviceId))
      .limit(1);

    if (!device.length) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }
    
    if (!canAccessAccount(auth, device[0].accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this device',
      });
    }

    const transfers = await db.select()
      .from(iotTransfers)
      .where(sql`from_device_id = ${deviceId} OR to_device_id = ${deviceId}`)
      .orderBy(desc(iotTransfers.createdAt))
      .limit(limit)
      .offset(offset);

    const events = await db.select()
      .from(iotBillableEvents)
      .where(eq(iotBillableEvents.deviceId, deviceId))
      .orderBy(desc(iotBillableEvents.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      deviceId,
      transfers: transfers.map(t => ({
        ...t,
        amount: parseFloat(t.amount || '0'),
        fee: parseFloat(t.fee || '0'),
        netAmount: parseFloat(t.netAmount || '0'),
      })),
      billableEvents: events.map(e => ({
        ...e,
        unitPrice: parseFloat(e.unitPrice || '0'),
        totalCost: parseFloat(e.totalCost || '0'),
        balanceAfter: parseFloat(e.balanceAfter || '0'),
      })),
      pagination: {
        limit,
        offset,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Get transactions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
    });
  }
});

router.get('/packs', (req: Request, res: Response) => {
  res.json({
    success: true,
    packs: Object.values(IOT_CREDITS_PACKS).map(pack => ({
      ...pack,
      creditsValueUSD: Number((pack.credits * pack.perCreditPrice).toFixed(2)),
      pricePerCreditUSD: pack.perCreditPrice,
    })),
    feeStructure: {
      transferPercentage: `${IOT_TRANSFER_FEE.percentageFee * 100}%`,
      transferFlat: `$${IOT_TRANSFER_FEE.flatFee}`,
      example: {
        amount: 10.00,
        fee: calculateTransferFee(10.00).fee,
        netAmount: calculateTransferFee(10.00).netAmount,
      },
    },
    eventPricing: IOT_EVENT_TYPES,
    timestamp: new Date().toISOString(),
  });
});

export default router;
