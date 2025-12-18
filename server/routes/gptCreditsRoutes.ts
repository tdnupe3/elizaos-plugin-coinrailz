import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { creditsService } from '../services/creditsService';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { gptPurchaseSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';

console.log('📁 gptCreditsRoutes.ts FILE LOADED at', new Date().toISOString());

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const CREDIT_PACKAGES = {
  starter: { amount: 10, credits: 100, description: 'Starter Pack - 100 credits' },
  pro: { amount: 50, credits: 600, description: 'Pro Pack - 600 credits (20% bonus)' },
  enterprise: { amount: 200, credits: 3000, description: 'Enterprise Pack - 3000 credits (50% bonus)' }
};

const pollRateLimit = new Map<string, { lastPoll: number; pollCount: number }>();
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_COUNT = 60; // Increased for longer waits
const SESSION_EXPIRY_MS = 600000; // 10 minutes (increased from 60s)

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of pollRateLimit.entries()) {
    if (now - data.lastPoll > SESSION_EXPIRY_MS * 2) {
      pollRateLimit.delete(key);
    }
  }
}, 60000);

router.post('/create-session', async (req: Request, res: Response) => {
  console.log('🚨 GPT CREDITS ROUTE HIT - create-session called');
  try {
    const { package: packageName } = req.body;
    console.log('📦 Package requested:', packageName);
    
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
    
    // Use coinrailz.com for production, only use Replit domain for localhost/dev
    const host = req.get('host') || '';
    const isLocalDev = host.includes('localhost') || host.includes('127.0.0.1');
    const baseUrl = isLocalDev 
      ? `http://${host}`
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
        creditsCount: pkg.credits.toString(),
        source: 'gpt',
        gptSessionId: sessionTrackingId,
        packageName
      }
    });

    // Store session in database (REQUIRED for redirect and fulfillment to work)
    console.log(`🤖 GPT Credits: Saving session ${sessionTrackingId} to database...`);
    try {
      await db.insert(gptPurchaseSessions).values({
        id: sessionTrackingId,
        stripeSessionId: session.id,
        userId: gptUserId,
        packageName,
        amount: pkg.amount,
        credits: pkg.credits,
        status: 'pending',
      });
      console.log(`✅ GPT Credits: Session ${sessionTrackingId} saved to database successfully`);
    } catch (dbError: any) {
      // CRITICAL: If DB save fails, the payment flow cannot work properly
      // The redirect will fail and webhook won't be able to fulfill credits
      console.error(`❌ GPT Credits: CRITICAL - Failed to save session to database`);
      console.error(`   Session ID: ${sessionTrackingId}`);
      console.error(`   Stripe Session: ${session.id}`);
      console.error(`   Error: ${dbError.message}`);
      console.error(`   Code: ${dbError.code || 'unknown'}`);
      console.error(`   Full error:`, dbError);
      
      // Return error so user can retry (don't give broken short URL)
      return res.status(500).json({
        success: false,
        error: 'Unable to create checkout session. Please try again.',
        retryable: true,
        _debug: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    console.log(`🤖 GPT Credits: Created checkout session ${sessionTrackingId} for ${packageName} ($${pkg.amount})`);

    res.json({
      success: true,
      sessionId: sessionTrackingId,
      checkoutUrl: `${baseUrl}/pay/${sessionTrackingId}`,
      package: {
        name: packageName,
        price: `$${pkg.amount}`,
        credits: pkg.credits
      },
      instructions: 'Click the checkout link to complete your purchase. After payment, use the status endpoint to get your API key.',
      statusEndpoint: `/api/gpt/credits/status?session=${sessionTrackingId}`,
      _version: 'v5-db-required'
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

    // Query database for session
    const [session] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({
        success: false,
        status: 'expired',
        message: 'Session expired. Please create a new checkout session.',
        suggestion: 'Call POST /api/gpt/credits/create-session to start again'
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

    // Check if session has expired (10 minutes)
    const sessionCreatedAt = session.createdAt ? new Date(session.createdAt).getTime() : now;
    const elapsed = now - sessionCreatedAt;
    const remaining = Math.max(0, SESSION_EXPIRY_MS - elapsed);

    if (elapsed > SESSION_EXPIRY_MS && session.status === 'pending') {
      // Mark as expired in database
      await db.update(gptPurchaseSessions)
        .set({ status: 'expired' })
        .where(eq(gptPurchaseSessions.id, sessionId));
      
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

// Short URL redirect handler - /pay/:sessionId redirects to Stripe checkout
router.get('/redirect/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  console.log(`🔗 /pay redirect: Looking up session ${sessionId}`);
  
  try {
    const [session] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, sessionId))
      .limit(1);
    
    console.log(`🔗 /pay redirect: DB lookup result:`, session ? `Found (stripeId: ${session.stripeSessionId?.substring(0, 20)}...)` : 'NOT FOUND');
    
    if (!session || !session.stripeSessionId) {
      console.log(`❌ /pay redirect: Session ${sessionId} not found in database`);
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        sessionId,
        suggestion: 'Create a new checkout session'
      });
    }

    // Retrieve the Stripe session to get the checkout URL
    console.log(`🔗 /pay redirect: Retrieving Stripe session ${session.stripeSessionId.substring(0, 20)}...`);
    const stripeSession = await stripe.checkout.sessions.retrieve(session.stripeSessionId);
    
    if (!stripeSession.url) {
      console.log(`❌ /pay redirect: Stripe session has no URL (expired?)`);
      return res.status(400).json({
        success: false,
        error: 'Checkout session expired',
        suggestion: 'Create a new checkout session'
      });
    }

    console.log(`✅ /pay redirect: Redirecting to Stripe checkout`);
    res.redirect(stripeSession.url);
  } catch (error: any) {
    console.error(`❌ /pay redirect error for session ${sessionId}:`, error.message);
    console.error(`   Full error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to redirect to checkout',
      sessionId,
      debug: error.message
    });
  }
});

// Webhook handler called from creditsRoutes when GPT purchase is confirmed
export async function handleGptPurchaseWebhook(
  stripeSession: Stripe.Checkout.Session,
  creditsAmount: number
): Promise<void> {
  const gptSessionId = stripeSession.metadata?.gptSessionId;
  const userId = stripeSession.metadata?.userId;
  
  if (!gptSessionId || !userId) {
    console.log('⚠️ GPT webhook: Missing session metadata, skipping GPT-specific handling');
    return;
  }

  try {
    // Get the original session from database to use correct credits amount
    const [existingSession] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, gptSessionId))
      .limit(1);
    
    // Use credits from: 1) database session, 2) Stripe metadata, 3) package lookup
    const metadataCredits = parseInt(stripeSession.metadata?.creditsCount || '0', 10);
    const correctCredits = existingSession?.credits || metadataCredits || CREDIT_PACKAGES[existingSession?.packageName as keyof typeof CREDIT_PACKAGES]?.credits;
    
    if (!correctCredits) {
      console.error(`❌ GPT webhook: Cannot determine credits for session ${gptSessionId} - aborting fulfillment`);
      throw new Error('Cannot determine credits amount for fulfillment');
    }
    
    // Generate API key
    const { apiKey } = await creditsService.generateApiKey(userId, 'GPT Purchase API Key');

    // Update session in database with CORRECT credits from original session
    await db.update(gptPurchaseSessions)
      .set({
        status: 'completed',
        apiKey,
        credits: correctCredits,
        completedAt: new Date(),
      })
      .where(eq(gptPurchaseSessions.id, gptSessionId));

    console.log(`✅ GPT Purchase Complete: User ${userId} - ${correctCredits} credits - Key: ${apiKey.substring(0, 12)}...`);

  } catch (error: any) {
    console.error('❌ GPT webhook API key generation failed:', error.message);
    throw error;
  }
}

export default router;
