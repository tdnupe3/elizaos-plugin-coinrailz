import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { db } from '../db';
import { agentWallets, agentWalletEvents } from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

const router = Router();

const FREE_WALLET_DAILY_LIMIT_PER_IP = 3;
const FREE_WALLET_AGENT_ID_REUSE_LIMIT = 1;

function getClientIP(req: Request): string {
  let ip: string;
  
  if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1') {
    ip = req.ip || req.socket.remoteAddress || 'unknown';
  } else {
    ip = req.socket.remoteAddress || req.ip || 'unknown';
  }
  
  ip = ip.replace(/^::ffff:/, '');
  
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

const freeWalletInputSchema = z.object({
  agent_id: z.string().min(1, "Agent ID is required").max(255),
  purpose: z.enum(["ephemeral", "persistent"]).default("persistent"),
  chain: z.enum(["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet"]).default("base-mainnet"),
  contact_email: z.string().email().optional(),
  contact_url: z.string().url().optional(),
});

async function checkRateLimits(ipAddress: string, agentId: string): Promise<{ allowed: boolean; reason?: string }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [ipCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentWallets)
    .where(
      and(
        eq(agentWallets.tier, 'free'),
        eq(agentWallets.payerIpAddress, ipAddress),
        gte(agentWallets.createdAt, oneDayAgo)
      )
    );

  if (ipCount && Number(ipCount.count) >= FREE_WALLET_DAILY_LIMIT_PER_IP) {
    return { 
      allowed: false, 
      reason: `Daily limit reached: ${FREE_WALLET_DAILY_LIMIT_PER_IP} free wallets per IP per day` 
    };
  }

  const [agentIdCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentWallets)
    .where(
      and(
        eq(agentWallets.tier, 'free'),
        eq(agentWallets.agentId, agentId)
      )
    );

  if (agentIdCount && Number(agentIdCount.count) >= FREE_WALLET_AGENT_ID_REUSE_LIMIT) {
    return { 
      allowed: false, 
      reason: `Agent ID "${agentId}" already has a free wallet. Use the existing wallet or upgrade to paid tier.` 
    };
  }

  return { allowed: true };
}

router.post('/free', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `fw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    const validation = freeWalletInputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
        requestId
      });
    }

    const { agent_id, purpose, chain, contact_email, contact_url } = validation.data;
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log(`🆓 Free wallet request: agent_id=${agent_id}, ip=${ipAddress}, chain=${chain}`);

    const rateCheck = await checkRateLimits(ipAddress, agent_id);
    if (!rateCheck.allowed) {
      console.log(`⛔ Rate limit hit: ${rateCheck.reason}`);
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        reason: rateCheck.reason,
        requestId,
        alternatives: {
          paidWallet: {
            description: 'Get unlimited wallets with the paid tier ($1.00)',
            endpoint: '/x402/instant-agent-wallet',
            price: '$1.00 USDC'
          },
          apiKeyBundle: {
            description: 'Get API key with free wallet included ($1.00)',
            endpoint: '/acp/v1/checkout',
            productId: 'api-key-instant'
          }
        }
      });
    }

    const cdpWallet = await coinbaseCDPService.createWallet(`free:${agent_id}`, chain);
    
    const [walletRecord] = await db.insert(agentWallets).values({
      agentId: agent_id,
      walletId: cdpWallet.id,
      address: cdpWallet.address,
      chain: chain,
      custodyType: 'cdp',
      purpose: purpose,
      status: 'active',
      tier: 'free',
      metadata: {
        contact_email,
        contact_url,
        requestId,
        createdVia: 'free-wallet-endpoint'
      },
      payerIpAddress: ipAddress,
      payerUserAgent: userAgent,
    }).returning();

    await db.insert(agentWalletEvents).values({
      walletId: cdpWallet.id,
      eventType: 'created',
      actor: agent_id,
      requestId: requestId,
      payload: { agent_id, purpose, chain, tier: 'free' },
      response: { address: cdpWallet.address },
      ipAddress: ipAddress,
    });

    const latencyMs = Date.now() - startTime;
    console.log(`✅ Free wallet created: ${cdpWallet.address} for agent ${agent_id} (${latencyMs}ms)`);

    res.status(201).json({
      success: true,
      wallet: {
        address: cdpWallet.address,
        chain: chain,
        network: chain,
        purpose: purpose,
        tier: 'free',
        status: 'active'
      },
      message: 'Free wallet created successfully! Fund it with USDC to start using x402 services.',
      nextSteps: {
        fundWallet: `Send USDC to ${cdpWallet.address} on ${chain}`,
        useServices: 'Make x402 requests with X-PAYMENT header containing your payment',
        upgradeOption: 'For unlimited wallets and priority support, consider the paid tier'
      },
      requestId,
      latencyMs
    });

  } catch (error: any) {
    console.error('❌ Free wallet creation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create free wallet',
      message: error.message,
      requestId,
      alternatives: {
        retry: 'Please try again in a few moments',
        paidWallet: {
          description: 'Paid tier has higher reliability',
          endpoint: '/x402/instant-agent-wallet'
        }
      }
    });
  }
});

router.get('/free/stats', async (req: Request, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [totalFree] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentWallets)
      .where(eq(agentWallets.tier, 'free'));

    const [last24h] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentWallets)
      .where(
        and(
          eq(agentWallets.tier, 'free'),
          gte(agentWallets.createdAt, oneDayAgo)
        )
      );

    res.json({
      success: true,
      stats: {
        totalFreeWallets: Number(totalFree?.count || 0),
        walletsLast24h: Number(last24h?.count || 0),
        dailyLimitPerIP: FREE_WALLET_DAILY_LIMIT_PER_IP,
        agentIdLimit: FREE_WALLET_AGENT_ID_REUSE_LIMIT
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/free/check/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    
    const existingWallets = await db
      .select()
      .from(agentWallets)
      .where(eq(agentWallets.agentId, agentId));

    if (existingWallets.length > 0) {
      res.json({
        success: true,
        hasWallet: true,
        wallets: existingWallets.map(w => ({
          address: w.address,
          chain: w.chain,
          tier: w.tier,
          status: w.status,
          createdAt: w.createdAt
        }))
      });
    } else {
      res.json({
        success: true,
        hasWallet: false,
        message: 'No wallet found for this agent ID. Create one at POST /x402/wallet/free'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
