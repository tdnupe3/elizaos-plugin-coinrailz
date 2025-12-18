import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { creditsService } from '../services/creditsService';
import { nanoid } from 'nanoid';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const CREDIT_PACKAGES = {
  starter: { amount: 10, credits: 100, description: 'Starter Pack - 100 credits' },
  pro: { amount: 50, credits: 600, description: 'Pro Pack - 600 credits (20% bonus)' },
  enterprise: { amount: 200, credits: 3000, description: 'Enterprise Pack - 3000 credits (50% bonus)' }
};

const gptSessionCache = new Map<string, {
  status: 'pending' | 'completed' | 'expired';
  userId: string;
  apiKey?: string;
  credits?: number;
  createdAt: number;
  completedAt?: number;
}>();

const pollRateLimit = new Map<string, { lastPoll: number; pollCount: number }>();
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_COUNT = 12;
const SESSION_EXPIRY_MS = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of gptSessionCache.entries()) {
    if (now - session.createdAt > SESSION_EXPIRY_MS * 10) {
      gptSessionCache.delete(sessionId);
    }
  }
  for (const [key, data] of pollRateLimit.entries()) {
    if (now - data.lastPoll > SESSION_EXPIRY_MS * 2) {
      pollRateLimit.delete(key);
    }
  }
}, 60000);

router.post('/create-session', async (req: Request, res: Response) => {
  try {
    const { package: packageName } = req.body;
    
    if (!packageName || !CREDIT_PACKAGES[packageName as keyof typeof CREDIT_PACKAGES]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package. Choose: starter ($10), pro ($50), or enterprise ($200)',
        packages: Object.entries(CREDIT_PACKAGES).map(([key, value]) => ({
          id: key,
          price: `$${value.amount}`,
          credits: value.credits,
          description: value.description
        }))
      });
    }

    const pkg = CREDIT_PACKAGES[packageName as keyof typeof CREDIT_PACKAGES];
    const gptUserId = `gpt_${nanoid(16)}`;
    const sessionTrackingId = nanoid(12);
    
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://coinrailz.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Coin Railz ${pkg.description}`,
            description: `${pkg.credits} credits for API access. 1 credit = $0.10`
          },
          unit_amount: pkg.amount * 100
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${baseUrl}/gpt-purchase-success?session=${sessionTrackingId}`,
      cancel_url: `${baseUrl}/credits?canceled=true&source=gpt`,
      metadata: {
        userId: gptUserId,
        creditsAmount: pkg.amount.toString(),
        source: 'gpt',
        gptSessionId: sessionTrackingId,
        packageName
      }
    });

    gptSessionCache.set(sessionTrackingId, {
      status: 'pending',
      userId: gptUserId,
      createdAt: Date.now()
    });

    console.log(`🤖 GPT Credits: Created checkout session ${sessionTrackingId} for ${packageName} ($${pkg.amount})`);

    res.json({
      success: true,
      sessionId: sessionTrackingId,
      checkoutUrl: session.url,
      package: {
        name: packageName,
        price: `$${pkg.amount}`,
        credits: pkg.credits
      },
      instructions: 'Click the checkout link to complete your purchase. After payment, use the status endpoint to get your API key.',
      statusEndpoint: `/api/gpt/credits/status?session=${sessionTrackingId}`
    });

  } catch (error: any) {
    console.error('❌ GPT checkout session error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session as string;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required. Use ?session=YOUR_SESSION_ID'
      });
    }

    const clientKey = `${req.ip}_${sessionId}`;
    const now = Date.now();
    const rateData = pollRateLimit.get(clientKey);

    if (rateData) {
      const timeSinceLastPoll = now - rateData.lastPoll;
      
      if (timeSinceLastPoll < POLL_INTERVAL_MS) {
        return res.status(429).json({
          success: false,
          error: 'Rate limited. Please wait 5 seconds between status checks.',
          retryAfterMs: POLL_INTERVAL_MS - timeSinceLastPoll
        });
      }

      if (rateData.pollCount >= MAX_POLL_COUNT) {
        return res.status(429).json({
          success: false,
          error: 'Maximum poll attempts reached. Please complete payment and try again.',
          suggestion: 'If you completed payment, your API key should be available. Contact support if issues persist.'
        });
      }

      rateData.lastPoll = now;
      rateData.pollCount++;
    } else {
      pollRateLimit.set(clientKey, { lastPoll: now, pollCount: 1 });
    }

    const session = gptSessionCache.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        suggestion: 'Create a new checkout session using the create-session endpoint'
      });
    }

    if (session.status === 'completed' && session.apiKey) {
      return res.json({
        success: true,
        status: 'completed',
        apiKey: session.apiKey,
        credits: session.credits,
        message: 'Payment successful! Use this API key in your requests with the X-API-KEY header.',
        usage: {
          header: 'X-API-KEY',
          example: `curl -H "X-API-KEY: ${session.apiKey}" https://coinrailz.com/api/gpt/trade-signals?symbol=ETH`
        }
      });
    }

    const elapsed = now - session.createdAt;
    const remaining = Math.max(0, SESSION_EXPIRY_MS - elapsed);

    if (elapsed > SESSION_EXPIRY_MS && session.status === 'pending') {
      session.status = 'expired';
      return res.json({
        success: false,
        status: 'expired',
        message: 'Session expired. Please create a new checkout session.',
        suggestion: 'Call POST /api/gpt/credits/create-session to start again'
      });
    }

    const pollData = pollRateLimit.get(clientKey);
    
    res.json({
      success: true,
      status: 'pending',
      message: 'Payment not yet confirmed. Complete checkout and check again.',
      remainingTimeMs: remaining,
      pollsRemaining: MAX_POLL_COUNT - (pollData?.pollCount || 1),
      nextPollAfterMs: POLL_INTERVAL_MS
    });

  } catch (error: any) {
    console.error('❌ GPT status check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check status',
      message: error.message
    });
  }
});

router.get('/packages', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    packages: Object.entries(CREDIT_PACKAGES).map(([key, value]) => ({
      id: key,
      price: `$${value.amount}`,
      priceUSD: value.amount,
      credits: value.credits,
      pricePerCredit: `$${(value.amount / value.credits).toFixed(3)}`,
      description: value.description
    })),
    instructions: 'Call POST /api/gpt/credits/create-session with { "package": "starter" } to begin checkout'
  });
});

export async function handleGptPurchaseWebhook(
  session: Stripe.Checkout.Session,
  creditsAmount: number
): Promise<void> {
  const gptSessionId = session.metadata?.gptSessionId;
  const userId = session.metadata?.userId;
  
  if (!gptSessionId || !userId) {
    console.log('⚠️ GPT webhook: Missing session metadata, skipping GPT-specific handling');
    return;
  }

  const cachedSession = gptSessionCache.get(gptSessionId);
  if (!cachedSession) {
    console.log(`⚠️ GPT webhook: Session ${gptSessionId} not in cache, creating new entry`);
    gptSessionCache.set(gptSessionId, {
      status: 'pending',
      userId,
      createdAt: Date.now()
    });
  }

  try {
    const { apiKey } = await creditsService.generateApiKey(userId, 'GPT Purchase API Key');

    const sessionEntry = gptSessionCache.get(gptSessionId)!;
    sessionEntry.status = 'completed';
    sessionEntry.apiKey = apiKey;
    sessionEntry.credits = creditsAmount * 10;
    sessionEntry.completedAt = Date.now();

    console.log(`✅ GPT Purchase Complete: User ${userId} - ${creditsAmount * 10} credits - Key: ${apiKey.substring(0, 12)}...`);

  } catch (error: any) {
    console.error('❌ GPT webhook API key generation failed:', error.message);
    throw error;
  }
}

export { gptSessionCache };
export default router;
