/**
 * IoT Payments Routes - Production-Grade Device Payment Infrastructure
 * 
 * VERSION: 1.0.0 (January 2026)
 * 
 * REVENUE MODEL:
 * - Credits Packs: $25/2,500, $100/12,000, $500/75,000 credits
 * - D2D Transfer Fee: 2% + $0.02 per transfer
 * - Billable Events: $0.01 per event (configurable)
 * 
 * ENDPOINTS:
 * - POST /api/iot/account - Create IoT account
 * - GET /api/iot/account/:accountId - Get account details
 * - POST /api/iot/register - Register device to account
 * - GET /api/iot/balance/:deviceId - Check device/account balance
 * - POST /api/iot/meter - Record billable event and deduct credits
 * - POST /api/iot/transfer - D2D payment with fee extraction
 * - POST /api/iot/topup - Add credits via Stripe
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
  calculateTransferFee,
  isValidPackId,
  getPackById,
  type IotCreditsPackId,
  type IotEventType,
} from '@shared/iotPricing';

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

async function verifyApiKey(apiKey: string, deviceId?: string): Promise<{ valid: boolean; accountId?: string; deviceId?: string }> {
  if (!apiKey) return { valid: false };
  
  const keyHash = require('crypto').createHash('sha256').update(apiKey).digest('hex');
  
  const device = await db.execute(
    sql`SELECT id, device_id, account_id, status FROM iot_device_registry 
        WHERE device_id = (
          SELECT device_id FROM m2m_devices WHERE api_key_hash = ${keyHash} AND status = 'active'
        ) AND status = 'active'`
  );
  
  if (device.rows.length > 0) {
    const d = device.rows[0] as any;
    if (deviceId && d.device_id !== deviceId) {
      return { valid: false };
    }
    return { valid: true, accountId: d.account_id, deviceId: d.device_id };
  }
  
  const account = await db.execute(
    sql`SELECT id, status FROM iot_accounts WHERE owner_wallet = ${apiKey} AND status = 'active'`
  );
  
  if (account.rows.length > 0) {
    return { valid: true, accountId: (account.rows[0] as any).id };
  }
  
  return { valid: false };
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
  amount: z.number().positive().min(0.01),
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
  paymentMethod: z.enum(['stripe']),
  stripePaymentMethodId: z.string().optional(),
});

router.get('/health', (req: Request, res: Response) => {
  const stripe = getStripeClient();
  res.json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    stripeConfigured: !!stripe,
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

    await db.insert(iotAccounts).values({
      id: accountId,
      ownerId,
      ownerWallet,
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

    const effectiveUnitPrice = unitPrice ?? IOT_EVENT_TYPES[eventType as IotEventType]?.defaultUnitPrice ?? 0.01;
    const totalCost = units * effectiveUnitPrice;

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
    const transferId = `iot_txn_${nanoid(16)}`;

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

      if (toDeviceResult.length) {
        toDevice = toDeviceResult[0];
        toAccountId = toDevice.accountId;
        
        if (!toDevice.canReceivePayments) {
          return res.status(403).json({
            success: false,
            error: 'Recipient device cannot receive payments',
          });
        }
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
    const topupId = `iot_topup_${nanoid(16)}`;

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
