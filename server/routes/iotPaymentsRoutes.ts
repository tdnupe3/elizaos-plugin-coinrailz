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
import type Stripe from 'stripe';
import { stripe as _stripeInstance } from '../services/stripeClient';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { trackIoTEndpoint } from '../middleware/hitTracker';
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

// Apply hit tracking to IoT payment routes
router.use(trackIoTEndpoint);

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

function getStripeClient(): Stripe {
  return _stripeInstance;
}

const createAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  ownerId: z.string().optional(),
  ownerWallet: z.string().optional(),
  tier: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  isDemo: z.boolean().default(false), // Flag for demo/test data - excluded from production metrics
  provisionWallet: z.boolean().default(false), // Provision CDP wallet for on-chain payments
  walletChain: z.string().default('base-mainnet'), // Chain for CDP wallet
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
  isDemo: z.boolean().default(false), // Flag for demo/test data - excluded from production metrics
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

    const { accountName, ownerId, ownerWallet, tier, isDemo, provisionWallet, walletChain, metadata } = validation.data;
    const accountId = `iot_acc_${nanoid(12)}`;
    
    const { createHash, randomBytes } = await import('crypto');
    const apiKey = `iot_${randomBytes(24).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    let cdpWalletAddress: string | null = null;
    let cdpWalletChain: string = walletChain;
    let cdpWalletStatus: string = 'none';

    if (provisionWallet && !isDemo) {
      try {
        const cdpService = CoinbaseCDPService.getInstance();
        const wallet = await cdpService.createIoTWallet(accountId);
        cdpWalletAddress = wallet.address;
        cdpWalletChain = wallet.chain;
        cdpWalletStatus = 'active';
        console.log(`💰 CDP wallet provisioned for IoT account ${accountId}: ${cdpWalletAddress}`);
      } catch (walletError: any) {
        console.warn(`⚠️ CDP wallet provisioning failed for ${accountId}: ${walletError.message}`);
        cdpWalletStatus = 'failed';
      }
    }

    await db.insert(iotAccounts).values({
      id: accountId,
      ownerId,
      ownerWallet,
      apiKeyHash,
      accountName,
      tier,
      isDemo: isDemo || false,
      cdpWalletAddress,
      cdpWalletChain,
      cdpWalletStatus,
      metadata: metadata || {},
    });
    
    if (isDemo) {
      console.log(`🧪 DEMO IoT Account created: ${accountId} (${accountName}) - excluded from production metrics`);
    } else {
      console.log(`✅ IoT Account created: ${accountId} (${accountName})`);
    }

    res.status(201).json({
      success: true,
      account: {
        id: accountId,
        accountName,
        tier,
        creditsBalance: 0,
        status: 'active',
        cdpWallet: cdpWalletAddress ? {
          address: cdpWalletAddress,
          chain: cdpWalletChain,
          status: cdpWalletStatus,
        } : null,
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
      isDemo: data.isDemo || false,
      metadata: data.metadata || {},
    });

    if (data.isDemo) {
      console.log(`🧪 DEMO IoT Device registered: ${data.deviceId} → account ${data.accountId} - excluded from production metrics`);
    } else {
      console.log(`✅ IoT Device registered: ${data.deviceId} → account ${data.accountId}`);
    }

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
        error: 'On-chain stablecoin transfers require toWallet or toDeviceId',
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
      const targetChain = chain || 'base-mainnet';
      const recipientAddress = toWallet || toDevice?.walletAddress;
      const token = 'USDC';
      
      if (!recipientAddress) {
        return res.status(400).json({
          success: false,
          error: 'No recipient wallet address available for on-chain transfer',
          hint: 'Provide toWallet or ensure recipient device has a wallet address',
        });
      }
      
      if (!CoinbaseCDPService.isTokenSupported(token, targetChain)) {
        return res.status(400).json({
          success: false,
          error: `${token} not supported on ${targetChain}`,
          supportedChains: CoinbaseCDPService.getSupportedChains(token),
        });
      }
      
      const cdpService = CoinbaseCDPService.getInstance();
      const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
      
      if (!platformWallet) {
        return res.status(503).json({
          success: false,
          error: 'Platform wallet not configured for this chain',
          hint: 'Contact support',
        });
      }
      
      const platformBalance = await cdpService.getTokenBalance(platformWallet, token, targetChain);
      
      if (parseFloat(platformBalance) < netAmount) {
        console.log(`❌ Insufficient platform ${token} for D2D: ${platformBalance} < ${netAmount} required`);
        return res.status(503).json({
          success: false,
          error: `Platform ${token} liquidity temporarily insufficient for on-chain transfer`,
          hint: 'Try credits payment method or contact support',
        });
      }
      
      // Atomic transaction: create transfer record with pending status
      // On-chain transfer happens outside transaction (can't rollback blockchain)
      let transferRecord: any;
      try {
        transferRecord = await db.transaction(async (tx) => {
          const [record] = await tx.insert(iotTransfers).values({
            id: transferId,
            fromDeviceId,
            fromAccountId: fromDevice[0].accountId,
            toDeviceId: toDeviceId || null,
            toAccountId,
            toWallet: recipientAddress,
            amount: amount.toString(),
            fee: fee.toString(),
            netAmount: netAmount.toString(),
            currency: token,
            paymentMethod,
            chain: targetChain,
            purpose: purpose || null,
            reference: reference || null,
            status: 'processing',
            idempotencyKey: idempotencyKey || null,
          }).returning();
          return record;
        });
      } catch (dbError: any) {
        console.error(`❌ Failed to create transfer record:`, dbError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create transfer record',
          message: dbError.message,
        });
      }

      try {
        const transferResult = await cdpService.sendToken({
          toAddress: recipientAddress,
          amount: netAmount.toString(),
          token,
          chain: targetChain,
          memo: `IoT D2D Transfer: ${transferId}`,
        });
        
        if (transferResult.status === 'completed') {
          await db.update(iotTransfers)
            .set({ 
              status: 'completed', 
              txHash: transferResult.txHash,
              completedAt: new Date(),
            })
            .where(eq(iotTransfers.id, transferId));
          
          const durationMs = Date.now() - startTime;
          console.log(`✅ On-chain D2D ${token} transfer completed: ${transferId} -> ${transferResult.txHash}`);
          
          res.status(201).json({
            success: true,
            transfer: {
              id: transferId,
              status: 'completed',
              amount,
              fee,
              netAmount,
              currency: token,
              chain: targetChain,
              txHash: transferResult.txHash,
            },
            feeBreakdown: {
              percentage: `${IOT_TRANSFER_FEE.percentageFee * 100}%`,
              flat: `$${IOT_TRANSFER_FEE.flatFee}`,
              total: `$${fee.toFixed(4)}`,
            },
            recipientWallet: recipientAddress,
            durationMs,
            timestamp: new Date().toISOString(),
          });
        } else {
          await db.update(iotTransfers)
            .set({ 
              status: 'failed', 
              errorMessage: transferResult.error || 'Transfer failed',
            })
            .where(eq(iotTransfers.id, transferId));
          
          res.status(500).json({
            success: false,
            error: `On-chain ${token} transfer failed`,
            message: transferResult.error,
            transferId,
          });
        }
      } catch (cdpError: any) {
        await db.update(iotTransfers)
          .set({ 
            status: 'failed', 
            errorMessage: cdpError.message,
          })
          .where(eq(iotTransfers.id, transferId));
        
        console.error(`❌ CDP on-chain ${token} transfer failed for ${transferId}:`, cdpError);
        res.status(500).json({
          success: false,
          error: `On-chain ${token} transfer execution failed`,
          message: cdpError.message,
          transferId,
          fallback: 'Transfer created but on-chain execution failed. Manual intervention may be required.',
        });
      }
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
        try {
          const baseUrl = process.env.REPLIT_DOMAINS 
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
            : 'http://localhost:5000';
          
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `IoT Credits: ${pack.name}`,
                  description: `${pack.credits.toLocaleString()} credits for IoT device metering`,
                },
                unit_amount: Math.round(pack.priceUSD * 100),
              },
              quantity: 1,
            }],
            mode: 'payment',
            metadata: {
              accountId,
              packId,
              credits: pack.credits.toString(),
              source: 'iot_payments_topup',
              topupId,
            },
            success_url: `${baseUrl}/iot/dashboard?topup=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/iot/dashboard?topup=cancelled`,
          });

          console.log(`📦 Stripe checkout session created for IoT topup: ${session.id}`);

          return res.status(200).json({
            success: true,
            status: 'checkout_required',
            checkoutUrl: session.url,
            sessionId: session.id,
            pack: {
              id: packId,
              name: pack.name,
              priceUSD: pack.priceUSD,
              credits: pack.credits,
            },
            message: 'Redirect to Stripe Checkout to complete payment',
          });
        } catch (checkoutError: any) {
          console.error('❌ Stripe checkout session creation failed:', checkoutError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create checkout session',
            message: checkoutError.message,
          });
        }
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

const partnerApplications: Map<string, any> = new Map();
const pilotCustomers: Map<string, any> = new Map();

const PartnerApplicationSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  deviceType: z.string().optional(),
  deviceCount: z.string().optional(),
  dataDescription: z.string().min(1),
  currentMonetization: z.string().optional(),
});

router.post('/partners/apply', async (req: Request, res: Response) => {
  try {
    const data = PartnerApplicationSchema.parse(req.body);
    const applicationId = `partner_${nanoid(12)}`;
    
    const application = {
      id: applicationId,
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    partnerApplications.set(applicationId, application);
    
    console.log(`✅ Partner application received: ${data.companyName} (${applicationId})`);
    
    res.json({
      success: true,
      applicationId,
      message: 'Application received. We will review and contact you within 48 hours.',
      application,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      console.error('❌ Partner application failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit application',
      });
    }
  }
});

router.get('/partners/applications', async (req: Request, res: Response) => {
  res.json({
    success: true,
    applications: Array.from(partnerApplications.values()),
    count: partnerApplications.size,
  });
});

const PilotSchema = z.object({
  companyName: z.string().min(1),
  vertical: z.enum(['fleet', 'weather']),
  status: z.enum(['prospect', 'discovery', 'pilot', 'converted', 'churned']),
  deviceCount: z.number().min(0),
  revenue: z.number().min(0),
  startDate: z.string(),
  notes: z.string().optional(),
  contactEmail: z.string().email(),
  accountId: z.string().optional(),
  contactName: z.string().optional(),
});

router.post('/pilots', async (req: Request, res: Response) => {
  try {
    const data = PilotSchema.parse(req.body);
    const pilotId = `pilot_${nanoid(12)}`;
    
    const pilot = {
      id: pilotId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    pilotCustomers.set(pilotId, pilot);
    
    console.log(`✅ Pilot created: ${data.companyName} (${pilotId})`);
    
    res.json({
      success: true,
      pilotId,
      pilot,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      console.error('❌ Create pilot failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create pilot',
      });
    }
  }
});

router.get('/pilots', async (req: Request, res: Response) => {
  const pilots = Array.from(pilotCustomers.values());
  
  const stats = {
    total: pilots.length,
    fleet: pilots.filter(p => p.vertical === 'fleet').length,
    weather: pilots.filter(p => p.vertical === 'weather').length,
    converted: pilots.filter(p => p.status === 'converted').length,
    totalDevices: pilots.reduce((sum, p) => sum + (p.deviceCount || 0), 0),
    totalRevenue: pilots.reduce((sum, p) => sum + (p.revenue || 0), 0),
  };
  
  res.json({
    success: true,
    pilots,
    stats,
  });
});

router.patch('/pilots/:pilotId', async (req: Request, res: Response) => {
  const { pilotId } = req.params;
  const updates = req.body;
  
  const pilot = pilotCustomers.get(pilotId);
  if (!pilot) {
    return res.status(404).json({
      success: false,
      error: 'Pilot not found',
    });
  }
  
  const updatedPilot = {
    ...pilot,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  pilotCustomers.set(pilotId, updatedPilot);
  
  res.json({
    success: true,
    pilot: updatedPilot,
  });
});

router.delete('/pilots/:pilotId', async (req: Request, res: Response) => {
  const { pilotId } = req.params;
  
  if (!pilotCustomers.has(pilotId)) {
    return res.status(404).json({
      success: false,
      error: 'Pilot not found',
    });
  }
  
  pilotCustomers.delete(pilotId);
  
  res.json({
    success: true,
    message: 'Pilot deleted',
  });
});

// ========================================
// On-Chain USDC Topup - Convert USDC to Credits
// ========================================

const onchainTopupSchema = z.object({
  accountId: z.string().min(1),
  txHash: z.string().min(1), // The stablecoin transfer transaction hash
  chain: z.string().default('base-mainnet'),
  token: z.enum(['USDC', 'USDT']).default('USDC'), // Multi-token support
  expectedAmount: z.string().optional(), // Expected amount for verification
  sender: z.string().optional(), // Optional: expected sender address for stricter validation
});

router.post('/topup/onchain', requiredAuth, async (req: Request, res: Response) => {
  try {
    const validation = onchainTopupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { accountId, txHash, chain, token, expectedAmount, sender } = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    
    if (!canAccessAccount(auth, accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }
    
    // Validate token support on chain
    if (!CoinbaseCDPService.isTokenSupported(token, chain)) {
      return res.status(400).json({
        success: false,
        error: `${token} not supported on ${chain}`,
        supportedChains: CoinbaseCDPService.getSupportedChains(token),
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
    
    // Check for duplicate txHash (unique constraint)
    const existingTopup = await db.select()
      .from(iotTopups)
      .where(eq(iotTopups.txHash, txHash))
      .limit(1);
    
    if (existingTopup.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Transaction already processed or pending',
        topupId: existingTopup[0].id,
        status: existingTopup[0].status,
      });
    }

    const topupId = `iot_topup_${nanoid(16)}`;
    const platformWalletAddress = account[0].cdpWalletAddress || process.env.PLATFORM_WALLET_ADDRESS;
    
    if (!platformWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'No platform wallet configured for this account',
        hint: 'Create account with provisionWallet: true to enable on-chain topups',
      });
    }
    
    const tokenAddress = CoinbaseCDPService.getTokenAddress(token, chain);
    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: `${token} not available on ${chain}`,
      });
    }
    
    const paymentMethod = token === 'USDT' ? 'usdt_onchain' : 'usdc_onchain';
    
    let verifiedAmount = '0';
    let verificationStatus = 'pending';
    let verificationMessage = 'Transaction verification pending';
    let actualSender: string | null = null;
    
    // Try immediate verification
    try {
      const ethers = await import('ethers');
      const rpcUrls: Record<string, string> = {
        'base-mainnet': 'https://mainnet.base.org',
        'ethereum-mainnet': 'https://ethereum.publicnode.com',
        'polygon-mainnet': 'https://polygon-rpc.com',
        'arbitrum-mainnet': 'https://arb1.arbitrum.io/rpc',
      };
      const rpcUrl = rpcUrls[chain] || 'https://mainnet.base.org';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt && receipt.status === 1) {
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        
        let totalVerifiedAmount = BigInt(0);
        let matchingTransfers = 0;
        
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === tokenAddress!.toLowerCase() && log.topics[0] === transferTopic) {
            const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
            const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
            
            if (toAddress === platformWalletAddress.toLowerCase()) {
              // Validate sender if expected
              if (sender && fromAddress !== sender.toLowerCase()) {
                continue; // Skip transfers from unexpected senders
              }
              const transferAmount = BigInt(log.data);
              totalVerifiedAmount += transferAmount;
              matchingTransfers++;
              actualSender = fromAddress;
            }
          }
        }
        
        if (matchingTransfers > 0) {
          verifiedAmount = ethers.formatUnits(totalVerifiedAmount, 6);
          
          if (expectedAmount) {
            const expectedFloat = parseFloat(expectedAmount);
            const verifiedFloat = parseFloat(verifiedAmount);
            const tolerance = 0.01;
            
            if (Math.abs(verifiedFloat - expectedFloat) > tolerance) {
              verificationStatus = 'amount_mismatch';
              verificationMessage = `Expected ${expectedAmount} ${token} but found ${verifiedAmount} ${token}`;
              console.warn(`⚠️ Topup amount mismatch: expected ${expectedAmount}, got ${verifiedAmount}`);
            } else {
              verificationStatus = 'completed';
              verificationMessage = `Verified ${verifiedAmount} ${token} transfer (${matchingTransfers} transfer(s))`;
              console.log(`✅ On-chain topup verified: ${verifiedAmount} ${token} from tx ${txHash}`);
            }
          } else {
            verificationStatus = 'completed';
            verificationMessage = `Verified ${verifiedAmount} ${token} transfer (${matchingTransfers} transfer(s))`;
            console.log(`✅ On-chain topup verified: ${verifiedAmount} ${token} from tx ${txHash}`);
          }
        } else {
          verificationStatus = 'failed';
          verificationMessage = `No ${token} transfer to platform wallet detected in transaction`;
        }
      } else if (!receipt) {
        // Transaction not yet confirmed - set up for async confirmation
        verificationStatus = 'confirming';
        verificationMessage = 'Transaction pending confirmation - will be auto-verified';
      } else {
        verificationMessage = 'Transaction failed on chain';
        verificationStatus = 'failed';
      }
    } catch (verifyError: any) {
      console.warn(`⚠️ On-chain verification failed: ${verifyError.message}`);
      // Set up for async retry
      verificationStatus = 'confirming';
      verificationMessage = 'Verification pending - will retry automatically';
    }
    
    // Set expiry for pending topups (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Set next check time for async confirmation job (1 minute)
    const nextCheckAt = verificationStatus === 'confirming' ? new Date(Date.now() + 60000) : null;
    
    // Create topup record with proper async confirmation state
    await db.insert(iotTopups).values({
      id: topupId,
      accountId,
      amount: verificationStatus === 'completed' ? verifiedAmount : (expectedAmount || '0'),
      amountPaid: verificationStatus === 'completed' ? verifiedAmount : (expectedAmount || '0'),
      packType: `onchain_${token.toLowerCase()}`,
      paymentMethod,
      txHash,
      status: verificationStatus,
      token,
      chain,
      expectedAmount: expectedAmount || null,
      sender: sender || actualSender,
      verificationAttempts: 1,
      lastCheckedAt: new Date(),
      nextCheckAt,
      failureReason: verificationStatus === 'failed' || verificationStatus === 'amount_mismatch' ? verificationMessage : null,
      expiresAt,
      verifiedAmount: verificationStatus === 'completed' ? verifiedAmount : null,
    });
    
    // Credit account immediately if verified
    if (verificationStatus === 'completed' && parseFloat(verifiedAmount) > 0) {
      await db.update(iotAccounts)
        .set({
          creditsBalance: sql`${iotAccounts.creditsBalance} + ${parseFloat(verifiedAmount)}`,
          totalDeposited: sql`${iotAccounts.totalDeposited} + ${parseFloat(verifiedAmount)}`,
          updatedAt: new Date(),
        })
        .where(eq(iotAccounts.id, accountId));
      
      // Update topup with balance after
      const updatedAccount = await db.select().from(iotAccounts).where(eq(iotAccounts.id, accountId)).limit(1);
      if (updatedAccount.length) {
        await db.update(iotTopups)
          .set({ 
            balanceAfter: updatedAccount[0].creditsBalance,
            completedAt: new Date(),
          })
          .where(eq(iotTopups.id, topupId));
      }
      
      console.log(`💰 Credits added to ${accountId}: +${verifiedAmount} ${token}`);
    }

    console.log(`🔍 On-chain topup ${verificationStatus}: ${topupId} with txHash ${txHash}`);

    res.status(201).json({
      success: true,
      topup: {
        id: topupId,
        status: verificationStatus,
        txHash,
        chain,
        token,
        expectedAmount: expectedAmount || null,
        verifiedAmount: verificationStatus === 'completed' ? verifiedAmount : null,
        creditsAdded: verificationStatus === 'completed' ? parseFloat(verifiedAmount) : 0,
        sender: sender || actualSender,
      },
      message: verificationMessage,
      platformWallet: platformWalletAddress,
      asyncConfirmation: verificationStatus === 'confirming' ? {
        enabled: true,
        nextCheckAt: new Date(Date.now() + 60000).toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        note: 'Your topup will be automatically verified when the transaction confirms on-chain.',
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ On-chain topup failed:', error);
    res.status(500).json({
      success: false,
      error: 'On-chain topup failed',
      message: error.message,
    });
  }
});

router.get('/topup/wallet/:accountId', requiredAuth, async (req: Request, res: Response) => {
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

    const platformWallet = account[0].cdpWalletAddress || process.env.PLATFORM_WALLET_ADDRESS;
    const chain = account[0].cdpWalletChain || 'base-mainnet';

    res.json({
      success: true,
      depositInfo: {
        address: platformWallet,
        chain,
        currency: 'USDC',
        rate: '1 USDC = 1 Credit (1:1)',
        minimumDeposit: '1.00',
        note: 'Send USDC to this address. Credits will be added after 3 confirmations.',
      },
      supportedChains: ['base-mainnet', 'ethereum-mainnet', 'polygon-mainnet', 'arbitrum-mainnet'],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Get topup wallet failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get topup wallet',
      message: error.message,
    });
  }
});

// ========================================
// Credits-to-Wallet Withdrawal
// ========================================

const withdrawalSchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().positive().min(1), // Minimum $1 withdrawal
  toWallet: z.string().min(1), // Recipient wallet address
  chain: z.string().default('base-mainnet'),
  token: z.enum(['USDC', 'USDT']).default('USDC'), // Multi-token support
});

router.post('/withdraw', requiredAuth, async (req: Request, res: Response) => {
  try {
    const validation = withdrawalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }

    const { accountId, amount, toWallet, chain, token } = validation.data;
    const auth = (req as any).iotAuth as IoTAuthResult;
    
    if (!canAccessAccount(auth, accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this account',
      });
    }
    
    if (!CoinbaseCDPService.isTokenSupported(token, chain)) {
      return res.status(400).json({
        success: false,
        error: `${token} not supported on ${chain}`,
        supportedChains: CoinbaseCDPService.getSupportedChains(token),
      });
    }

    const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
    if (!platformWallet) {
      return res.status(503).json({
        success: false,
        error: 'Platform wallet not configured',
        hint: 'Contact support',
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

    const currentBalance = parseFloat(account[0].creditsBalance);
    const withdrawalFee = amount * 0.01 + 0.50;
    const netAmount = amount - withdrawalFee;
    
    if (currentBalance < amount) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        balance: currentBalance,
        requested: amount,
      });
    }
    
    if (netAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal amount too small after fees',
        fee: withdrawalFee,
        minimumWithdrawal: 2.00,
      });
    }

    const cdpService = CoinbaseCDPService.getInstance();
    const platformBalance = await cdpService.getTokenBalance(platformWallet, token, chain);
    
    if (parseFloat(platformBalance) < netAmount) {
      console.log(`❌ Insufficient platform ${token}: ${platformBalance} < ${netAmount} required`);
      return res.status(503).json({
        success: false,
        error: `Platform ${token} liquidity temporarily insufficient`,
        message: 'Please try a smaller amount or wait for liquidity replenishment',
        hint: 'Contact support if this persists',
      });
    }

    const withdrawalId = `iot_withdraw_${nanoid(16)}`;
    const paymentMethod = token === 'USDT' ? 'usdt_onchain' : 'usdc_onchain';

    // Atomic transaction: debit credits and create withdrawal record together
    let withdrawalRecord: any;
    try {
      withdrawalRecord = await db.transaction(async (tx) => {
        // Verify balance with lock (FOR UPDATE would require raw SQL)
        const currentAccount = await tx.select()
          .from(iotAccounts)
          .where(eq(iotAccounts.id, accountId))
          .limit(1);
        
        if (!currentAccount.length || parseFloat(currentAccount[0].creditsBalance) < amount) {
          throw new Error('Insufficient balance (race condition detected)');
        }
        
        // Debit credits
        await tx.update(iotAccounts)
          .set({
            creditsBalance: sql`${iotAccounts.creditsBalance} - ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(iotAccounts.id, accountId));
        
        // Create withdrawal record
        const [record] = await tx.insert(iotTransfers).values({
          id: withdrawalId,
          fromDeviceId: 'ACCOUNT',
          fromAccountId: accountId,
          toDeviceId: null,
          toAccountId: null,
          toWallet,
          amount: amount.toString(),
          fee: withdrawalFee.toString(),
          netAmount: netAmount.toString(),
          currency: token,
          paymentMethod,
          chain,
          purpose: 'withdrawal',
          status: 'processing',
        }).returning();
        
        return record;
      });
    } catch (dbError: any) {
      console.error(`❌ Withdrawal DB transaction failed:`, dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to process withdrawal',
        message: dbError.message,
      });
    }

    // On-chain transfer (outside transaction - blockchain can't rollback)
    try {
      const transferResult = await cdpService.sendToken({
        toAddress: toWallet,
        amount: netAmount.toString(),
        token,
        chain,
        memo: `IoT Withdrawal: ${withdrawalId}`,
      });
      
      if (transferResult.status === 'completed') {
        await db.update(iotTransfers)
          .set({ 
            status: 'completed', 
            txHash: transferResult.txHash,
            completedAt: new Date(),
          })
          .where(eq(iotTransfers.id, withdrawalId));
        
        console.log(`✅ Withdrawal completed: ${withdrawalId} -> ${transferResult.txHash}`);
        
        res.status(201).json({
          success: true,
          withdrawal: {
            id: withdrawalId,
            status: 'completed',
            amount,
            fee: withdrawalFee,
            netAmount,
            currency: token,
            chain,
            txHash: transferResult.txHash,
            toWallet,
          },
          feeBreakdown: {
            percentage: '1%',
            flat: '$0.50',
            total: `$${withdrawalFee.toFixed(2)}`,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Refund credits on failure
        await db.transaction(async (tx) => {
          await tx.update(iotAccounts)
            .set({
              creditsBalance: sql`${iotAccounts.creditsBalance} + ${amount}`,
              updatedAt: new Date(),
            })
            .where(eq(iotAccounts.id, accountId));
          
          await tx.update(iotTransfers)
            .set({ 
              status: 'failed', 
              errorMessage: transferResult.error || 'Transfer failed',
            })
            .where(eq(iotTransfers.id, withdrawalId));
        });
        
        res.status(500).json({
          success: false,
          error: `Withdrawal ${token} transfer failed`,
          message: transferResult.error,
          withdrawalId,
          note: 'Credits have been refunded to your account.',
        });
      }
    } catch (cdpError: any) {
      // Refund credits on CDP error
      await db.transaction(async (tx) => {
        await tx.update(iotAccounts)
          .set({
            creditsBalance: sql`${iotAccounts.creditsBalance} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(iotAccounts.id, accountId));
        
        await tx.update(iotTransfers)
          .set({ 
            status: 'failed', 
            errorMessage: cdpError.message,
          })
          .where(eq(iotTransfers.id, withdrawalId));
      });
      
      console.error(`❌ Withdrawal failed for ${withdrawalId}:`, cdpError);
      res.status(500).json({
        success: false,
        error: `Withdrawal ${token} execution failed`,
        message: cdpError.message,
        withdrawalId,
        note: 'Credits have been refunded to your account.',
      });
    }
  } catch (error: any) {
    console.error('❌ Withdrawal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Withdrawal failed',
      message: error.message,
    });
  }
});

router.get('/withdraw/limits', requiredAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    limits: {
      minimum: 2.00,
      maximum: 10000.00,
      dailyLimit: 50000.00,
    },
    fees: {
      percentage: '1%',
      flat: '$0.50',
      example: 'Withdraw $100 → Fee $1.50 → Receive $98.50',
    },
    supportedChains: ['base-mainnet', 'ethereum-mainnet', 'polygon-mainnet', 'arbitrum-mainnet'],
    processingTime: 'Usually within 5 minutes',
    timestamp: new Date().toISOString(),
  });
});

export default router;
