/**
 * M2M (Machine-to-Machine) Onboarding Routes
 * 
 * Single-call onboarding for IoT devices and AI agents.
 * Orchestrates: Device registration + API key generation + Wallet provisioning
 * 
 * Target: Cloudflare Agent SDK, IoT platforms, autonomous agents
 * Version: 1.0.0
 * 
 * ROLLBACK: Delete this file, remove registration from server/index.ts
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { agentWallets } from '@shared/schema';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const router = Router();

const m2mOnboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registrations per hour per IP
  message: { 
    success: false, 
    error: 'Too many onboarding requests. Try again in 1 hour.',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const onboardingInputSchema = z.object({
  deviceId: z.string().min(1).max(255).describe("Unique identifier for the device/agent"),
  deviceType: z.enum(["iot_device", "ai_agent", "server", "edge_node", "other"]).default("ai_agent"),
  name: z.string().min(1).max(100).optional().describe("Human-readable device name"),
  capabilities: z.array(z.string()).optional().describe("List of device capabilities"),
  chain: z.enum(["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet", "solana-mainnet"]).default("base-mainnet"),
  metadata: z.record(z.any()).optional().describe("Additional metadata")
});

function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `cr_m2m_${nanoid(32)}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.substring(0, 12);
  return { key, keyHash, keyPrefix };
}

router.post('/register', m2mOnboardingLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `m2m-${Date.now()}-${nanoid(6)}`;
  
  try {
    const validation = onboardingInputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
        requestId,
        documentation: 'https://coinrailz.com/docs/m2m-onboarding'
      });
    }

    const { deviceId, deviceType, name, capabilities, chain, metadata } = validation.data;
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || 'unknown';

    console.log(`🤖 M2M Onboarding: deviceId=${deviceId}, type=${deviceType}, chain=${chain}, ip=${ipAddress}`);

    // Check if device already exists - TRUE IDEMPOTENCY
    const existingDevice = await db.execute(sql`
      SELECT id, device_id, device_type, name, wallet_address, chain, status, api_key_prefix, created_at
      FROM m2m_devices WHERE device_id = ${deviceId}
    `);

    if (existingDevice.rows.length > 0) {
      const device = existingDevice.rows[0] as any;
      // Update last_seen_at only
      await db.execute(sql`
        UPDATE m2m_devices SET last_seen_at = NOW(), ip_address = ${ipAddress}
        WHERE device_id = ${deviceId}
      `);
      
      const durationMs = Date.now() - startTime;
      console.log(`♻️ M2M Existing device: deviceId=${deviceId}, returning cached info`);
      
      return res.status(200).json({
        success: true,
        requestId,
        isExisting: true,
        device: {
          id: device.id,
          deviceId: device.device_id,
          deviceType: device.device_type,
          name: device.name,
          status: device.status
        },
        credentials: {
          apiKeyPrefix: device.api_key_prefix,
          note: "API key was issued at registration time and cannot be retrieved. If lost, contact support to regenerate."
        },
        wallet: device.wallet_address ? {
          address: device.wallet_address,
          chain: device.chain,
          status: 'active'
        } : {
          status: 'not_provisioned',
          retryEndpoint: '/api/agent-wallet/create'
        },
        endpoints: {
          checkout: '/api/mcp/payments/checkout',
          services: '/mcp/services',
          health: '/api/mcp/payments/health',
          credits: {
            balance: '/api/credits/balance',
            purchase: '/api/credits/purchase/stripe'
          }
        },
        gateways: {
          cloudflare: 'https://coinrailz-x402-gateway.coinrailz.workers.dev',
          direct: 'https://coinrailz.com/x402'
        },
        durationMs,
        timestamp: new Date().toISOString()
      });
    }

    // NEW DEVICE - generate credentials and wallet
    const internalId = `m2m_${Date.now()}_${nanoid(8)}`;
    const { key: apiKey, keyHash, keyPrefix } = generateApiKey();

    let walletResult: { id: string; address: string } | null = null;
    let walletError: string | null = null;

    try {
      if (chain === 'solana-mainnet') {
        const solanaResult = await coinbaseCDPService.createSolanaWallet({
          agentId: `m2m:${deviceId}`,
          name: 'persistent'
        });
        if (solanaResult && !solanaResult.error && solanaResult.address) {
          walletResult = { id: solanaResult.agentId, address: solanaResult.address };
        } else {
          walletError = solanaResult?.error || 'Solana wallet creation failed';
        }
      } else {
        walletResult = await coinbaseCDPService.createWallet(`m2m:${deviceId}`, chain);
      }
    } catch (e: any) {
      console.error(`⚠️ Wallet creation failed for ${deviceId}:`, e.message);
      walletError = e.message;
    }

    await db.execute(sql`
      INSERT INTO m2m_devices (
        id, device_id, device_type, name, capabilities, 
        api_key_hash, api_key_prefix, wallet_address, chain,
        ip_address, metadata, status, created_at
      ) VALUES (
        ${internalId}, ${deviceId}, ${deviceType}, ${name || deviceId},
        ${JSON.stringify(capabilities || [])}::jsonb, ${keyHash}, ${keyPrefix},
        ${walletResult?.address || null}, ${chain}, ${ipAddress},
        ${JSON.stringify(metadata || {})}::jsonb, 'active', NOW()
      )
    `);

    if (walletResult) {
      try {
        await db.insert(agentWallets).values({
          agentId: deviceId,
          walletId: walletResult.id,
          address: walletResult.address,
          chain: chain,
          custodyType: 'cdp',
          purpose: 'persistent',
          status: 'active',
          tier: 'm2m',
          metadata: {
            deviceType,
            onboardingRequestId: requestId,
            capabilities
          }
        });
      } catch (e: any) {
        console.error(`⚠️ Wallet record failed:`, e.message);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ M2M Onboarding complete: deviceId=${deviceId}, wallet=${walletResult?.address || 'failed'}, duration=${durationMs}ms`);

    res.status(201).json({
      success: true,
      requestId,
      device: {
        id: internalId,
        deviceId,
        deviceType,
        name: name || deviceId,
        status: 'active'
      },
      credentials: {
        apiKey,
        apiKeyPrefix: keyPrefix,
        warning: "Save this API key now - it will NOT be shown again!"
      },
      wallet: walletResult ? {
        address: walletResult.address,
        chain,
        status: 'active'
      } : {
        status: 'failed',
        error: walletError,
        retryEndpoint: '/api/agent-wallet/create'
      },
      endpoints: {
        checkout: '/api/mcp/payments/checkout',
        services: '/mcp/services',
        health: '/api/mcp/payments/health',
        credits: {
          balance: '/api/credits/balance',
          purchase: '/api/credits/purchase/stripe'
        }
      },
      gateways: {
        cloudflare: 'https://coinrailz-x402-gateway.coinrailz.workers.dev',
        direct: 'https://coinrailz.com/x402'
      },
      usage: {
        rateLimit: '100 requests per 15 minutes',
        authentication: 'Include API key in X-API-Key header'
      },
      durationMs,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ M2M Onboarding error:', error);
    res.status(500).json({
      success: false,
      error: 'Onboarding failed',
      message: error.message,
      requestId,
      support: 'Contact support with requestId for assistance'
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    endpoints: {
      register: 'POST /api/m2m/register',
      verify: 'GET /api/m2m/verify/:deviceId'
    },
    rateLimit: {
      registrations: '10 per hour per IP'
    },
    timestamp: new Date().toISOString()
  });
});

router.get('/verify/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const result = await db.execute(sql`
      SELECT id, device_id, device_type, name, wallet_address, chain, status, created_at, last_seen_at
      FROM m2m_devices 
      WHERE device_id = ${deviceId}
    `);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        onboardingEndpoint: 'POST /api/m2m/register'
      });
    }

    const device = result.rows[0] as any;
    
    res.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.device_id,
        deviceType: device.device_type,
        name: device.name,
        walletAddress: device.wallet_address,
        chain: device.chain,
        status: device.status,
        createdAt: device.created_at,
        lastSeenAt: device.last_seen_at
      }
    });
  } catch (error: any) {
    console.error('❌ Device verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

export default router;
