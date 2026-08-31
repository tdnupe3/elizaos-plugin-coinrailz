import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { coinbaseCDPService } from '../services/coinbaseCDPService';
import { db } from '../db';
import { agentWallets, agentWalletEvents, freeWalletRateLimits, freeWalletBlacklist } from '../../shared/schema';
import { eq, and, gte, or, isNull, sql, lte } from 'drizzle-orm';
import { creditsService } from '../services/creditsService';

const router = Router();

// Tiered rate limits
const BASELINE_DAILY_LIMIT = 2;  // Unverified requests: 2 wallets/IP/day
const VERIFIED_DAILY_LIMIT = 10; // API key holders: 10 wallets/IP/day
const AGENT_ID_REUSE_LIMIT = 1;  // 1 wallet per agent ID (regardless of tier)

// Velocity thresholds for abuse detection
const VELOCITY_WINDOW_SECONDS = 60;  // 1 minute window
const VELOCITY_MAX_REQUESTS = 3;     // Max 3 requests per minute
const INITIAL_COOLDOWN_HOURS = 1;    // First offense: 1 hour cooldown
const MAX_COOLDOWN_HOURS = 24;       // Max cooldown: 24 hours
const BLACKLIST_THRESHOLD_LEVEL = 4; // After 4 cooldowns (1h→2h→4h→8h), blacklist for 72h

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

async function verifyApiKey(req: Request): Promise<{ verified: boolean; keyId?: string }> {
  const apiKey = req.headers['x-api-key'] as string || 
                 (req.headers['authorization'] as string)?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { verified: false };
  }
  
  try {
    const validation = await creditsService.validateApiKey(apiKey);
    if (validation.valid && validation.keyId) {
      return { verified: true, keyId: validation.keyId };
    }
  } catch (error) {
    console.log('API key verification failed:', error);
  }
  
  return { verified: false };
}

async function checkBlacklist(ipAddress: string, agentId: string): Promise<{ blocked: boolean; reason?: string; expiresAt?: Date }> {
  const now = new Date();
  
  const blacklistEntries = await db
    .select()
    .from(freeWalletBlacklist)
    .where(
      and(
        or(
          eq(freeWalletBlacklist.ipAddress, ipAddress),
          eq(freeWalletBlacklist.agentId, agentId)
        ),
        or(
          isNull(freeWalletBlacklist.expiresAt),
          gte(freeWalletBlacklist.expiresAt, now)
        )
      )
    );
  
  if (blacklistEntries.length > 0) {
    const entry = blacklistEntries[0];
    return {
      blocked: true,
      reason: `Temporarily blocked: ${entry.reason}`,
      expiresAt: entry.expiresAt || undefined
    };
  }
  
  return { blocked: false };
}

async function checkVelocityAndCooldown(ipAddress: string): Promise<{ 
  allowed: boolean; 
  reason?: string; 
  cooldownUntil?: Date;
  shouldEscalate?: boolean;
}> {
  const now = new Date();
  const velocityWindowStart = new Date(now.getTime() - VELOCITY_WINDOW_SECONDS * 1000);
  
  // Get or create rate limit record
  let [rateRecord] = await db
    .select()
    .from(freeWalletRateLimits)
    .where(eq(freeWalletRateLimits.ipAddress, ipAddress));
  
  // Check if in cooldown
  if (rateRecord?.cooldownUntil && rateRecord.cooldownUntil > now) {
    const remainingMs = rateRecord.cooldownUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return {
      allowed: false,
      reason: `Rate limit cooldown active. Try again in ${remainingMinutes} minutes.`,
      cooldownUntil: rateRecord.cooldownUntil
    };
  }
  
  // Check velocity (requests in last minute)
  if (rateRecord?.lastRequestAt && rateRecord.lastRequestAt > velocityWindowStart) {
    // Count recent requests by checking the request_count in last window
    const recentRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentWallets)
      .where(
        and(
          eq(agentWallets.tier, 'free'),
          eq(agentWallets.payerIpAddress, ipAddress),
          gte(agentWallets.createdAt, velocityWindowStart)
        )
      );
    
    // Block on VELOCITY_MAX_REQUESTS - 1 so the Nth request triggers cooldown (not N+1)
    if (Number(recentRequests[0]?.count || 0) >= VELOCITY_MAX_REQUESTS - 1) {
      // Velocity exceeded - escalate cooldown
      const currentLevel = (rateRecord?.cooldownLevel || 0) + 1;
      const cooldownHours = Math.min(INITIAL_COOLDOWN_HOURS * Math.pow(2, currentLevel - 1), MAX_COOLDOWN_HOURS);
      const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);
      
      // Update cooldown in database
      await db
        .update(freeWalletRateLimits)
        .set({
          cooldownUntil,
          cooldownLevel: currentLevel,
          updatedAt: now
        })
        .where(eq(freeWalletRateLimits.ipAddress, ipAddress));
      
      console.log(`⚠️ Velocity exceeded for ${ipAddress}: ${cooldownHours}h cooldown (level ${currentLevel})`);
      
      return {
        allowed: false,
        reason: `Too many requests. Cooldown active for ${cooldownHours} hour(s).`,
        cooldownUntil,
        shouldEscalate: currentLevel >= BLACKLIST_THRESHOLD_LEVEL
      };
    }
  }
  
  return { allowed: true };
}

async function checkDailyLimits(
  ipAddress: string, 
  agentId: string, 
  isVerified: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyLimit = isVerified ? VERIFIED_DAILY_LIMIT : BASELINE_DAILY_LIMIT;
  
  // Check IP limit
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

  if (ipCount && Number(ipCount.count) >= dailyLimit) {
    return { 
      allowed: false, 
      reason: `Daily limit reached: ${dailyLimit} free wallets per IP per day${isVerified ? ' (verified tier)' : ''}` 
    };
  }

  // Check agent ID limit (always 1)
  const [agentIdCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentWallets)
    .where(
      and(
        eq(agentWallets.tier, 'free'),
        eq(agentWallets.agentId, agentId)
      )
    );

  if (agentIdCount && Number(agentIdCount.count) >= AGENT_ID_REUSE_LIMIT) {
    return { 
      allowed: false, 
      reason: `Agent ID "${agentId}" already has a free wallet. Use the existing wallet or upgrade to paid tier.` 
    };
  }

  return { allowed: true };
}

async function recordRequest(ipAddress: string, trustTier: string): Promise<void> {
  const now = new Date();
  
  // Upsert rate limit record
  const existing = await db
    .select()
    .from(freeWalletRateLimits)
    .where(eq(freeWalletRateLimits.ipAddress, ipAddress));
  
  if (existing.length > 0) {
    await db
      .update(freeWalletRateLimits)
      .set({
        requestCount: sql`${freeWalletRateLimits.requestCount} + 1`,
        lastRequestAt: now,
        updatedAt: now,
        trustTier
      })
      .where(eq(freeWalletRateLimits.ipAddress, ipAddress));
  } else {
    await db.insert(freeWalletRateLimits).values({
      ipAddress,
      trustTier,
      windowStart: now,
      requestCount: 1,
      lastRequestAt: now
    });
  }
}

async function addToBlacklist(ipAddress: string, agentId: string, reason: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 72 hours - balances abuse prevention with developer experience
  
  await db.insert(freeWalletBlacklist).values({
    ipAddress,
    agentId,
    reason,
    expiresAt,
    createdBy: 'system'
  });
  
  console.log(`🚫 Added to blacklist: IP=${ipAddress}, agent=${agentId}, reason=${reason}, expires=${expiresAt.toISOString()}`);
}

const freeWalletInputSchema = z.object({
  agent_id: z.string().min(1, "Agent ID is required").max(255),
  purpose: z.enum(["ephemeral", "persistent"]).default("persistent"),
  chain: z.enum(["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet", "solana-mainnet"]).default("base-mainnet"),
  contact_email: z.string().email().optional(),
  contact_url: z.string().url().optional(),
});

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

    // Step 1: Check blacklist first
    const blacklistCheck = await checkBlacklist(ipAddress, agent_id);
    if (blacklistCheck.blocked) {
      console.log(`🚫 Blacklisted: ${blacklistCheck.reason}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        reason: blacklistCheck.reason,
        expiresAt: blacklistCheck.expiresAt?.toISOString(),
        requestId
      });
    }

    // Step 2: Check API key for verified tier
    const { verified, keyId } = await verifyApiKey(req);
    const trustTier = verified ? 'verified' : 'baseline';
    
    if (verified) {
      console.log(`✅ Verified via API key: ${keyId}`);
    }

    // Step 3: Check velocity and cooldown
    const velocityCheck = await checkVelocityAndCooldown(ipAddress);
    if (!velocityCheck.allowed) {
      console.log(`⏱️ Velocity/cooldown: ${velocityCheck.reason}`);
      
      // If escalated beyond threshold, add to blacklist
      if (velocityCheck.shouldEscalate) {
        await addToBlacklist(ipAddress, agent_id, 'Repeated velocity violations');
      }
      
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        reason: velocityCheck.reason,
        cooldownUntil: velocityCheck.cooldownUntil?.toISOString(),
        requestId,
        alternatives: {
          paidWallet: {
            description: 'Paid tier has no cooldowns',
            endpoint: '/x402/instant-agent-wallet',
            price: '$1.00 USDC'
          }
        }
      });
    }

    // Step 4: Check daily limits (tiered based on verification)
    const dailyCheck = await checkDailyLimits(ipAddress, agent_id, verified);
    if (!dailyCheck.allowed) {
      console.log(`⛔ Daily limit hit: ${dailyCheck.reason}`);
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        reason: dailyCheck.reason,
        tier: trustTier,
        dailyLimit: verified ? VERIFIED_DAILY_LIMIT : BASELINE_DAILY_LIMIT,
        requestId,
        alternatives: {
          paidWallet: {
            description: 'Get unlimited wallets with the paid tier ($1.00)',
            endpoint: '/x402/instant-agent-wallet',
            price: '$1.00 USDC'
          },
          apiKeyBundle: verified ? undefined : {
            description: 'Get an API key for higher limits (10/day)',
            endpoint: '/acp/v1/checkout',
            productId: 'api-key-instant'
          }
        }
      });
    }

    // Step 5: Create the wallet (route Solana to separate method)
    let cdpWallet: { id: string; address: string };
    
    if (chain === 'solana-mainnet') {
      const solanaResult = await coinbaseCDPService.createSolanaWallet({
        agentId: `free:${agent_id}`,
        name: purpose
      });
      if (!solanaResult || solanaResult.error) {
        throw new Error(solanaResult?.error || 'Solana wallet creation failed');
      }
      if (!solanaResult.address) {
        throw new Error('Solana wallet creation returned no address');
      }
      cdpWallet = { id: solanaResult.agentId, address: solanaResult.address };
    } else {
      cdpWallet = await coinbaseCDPService.createWallet(`free:${agent_id}`, chain);
    }
    
    // Step 6: Record in database
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
        createdVia: 'free-wallet-endpoint',
        trustTier,
        verifiedKeyId: keyId
      },
      payerIpAddress: ipAddress,
      payerUserAgent: userAgent,
    }).returning();

    // Step 7: Record event
    await db.insert(agentWalletEvents).values({
      walletId: cdpWallet.id,
      eventType: 'created',
      actor: agent_id,
      requestId: requestId,
      payload: { agent_id, purpose, chain, tier: 'free', trustTier },
      response: { address: cdpWallet.address },
      ipAddress: ipAddress,
    });

    // Step 8: Update rate limit tracking
    await recordRequest(ipAddress, trustTier);

    const latencyMs = Date.now() - startTime;
    console.log(`✅ Free wallet created: ${cdpWallet.address} for agent ${agent_id} (${latencyMs}ms, tier=${trustTier})`);

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
      trustTier,
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

    const [blacklistCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeWalletBlacklist)
      .where(
        or(
          isNull(freeWalletBlacklist.expiresAt),
          gte(freeWalletBlacklist.expiresAt, new Date())
        )
      );

    const [cooldownCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(freeWalletRateLimits)
      .where(gte(freeWalletRateLimits.cooldownUntil, new Date()));

    res.json({
      success: true,
      stats: {
        totalFreeWallets: Number(totalFree?.count || 0),
        walletsLast24h: Number(last24h?.count || 0),
        activeBlacklists: Number(blacklistCount?.count || 0),
        activeCooldowns: Number(cooldownCount?.count || 0),
        limits: {
          baseline: `${BASELINE_DAILY_LIMIT}/day per IP`,
          verified: `${VERIFIED_DAILY_LIMIT}/day per IP (API key holders)`,
          agentId: `${AGENT_ID_REUSE_LIMIT} wallet per agent ID`
        },
        velocityRules: {
          maxRequestsPerMinute: VELOCITY_MAX_REQUESTS,
          initialCooldownHours: INITIAL_COOLDOWN_HOURS,
          maxCooldownHours: MAX_COOLDOWN_HOURS
        }
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

// Admin endpoint to view blacklist - SECURED: only accessible in dev or with admin API key
router.get('/free/blacklist', async (req: Request, res: Response) => {
  try {
    // Security: Block in production unless admin authenticated
    const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
    const adminKey = req.headers['x-admin-key'] as string;
    const validAdminKey = process.env.ADMIN_API_KEY;
    
    if (isProduction && (!validAdminKey || adminKey !== validAdminKey)) {
      return res.status(403).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const entries = await db
      .select()
      .from(freeWalletBlacklist)
      .where(
        or(
          isNull(freeWalletBlacklist.expiresAt),
          gte(freeWalletBlacklist.expiresAt, new Date())
        )
      );

    res.json({
      success: true,
      count: entries.length,
      entries: entries.map(e => ({
        ipAddress: e.ipAddress,
        agentId: e.agentId,
        reason: e.reason,
        expiresAt: e.expiresAt?.toISOString(),
        createdAt: e.createdAt.toISOString()
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
