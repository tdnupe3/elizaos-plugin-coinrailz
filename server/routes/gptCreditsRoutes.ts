import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { creditsService } from '../services/creditsService';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { gptPurchaseSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { resolveAuth, getAuthContext, resolveOrCreateSessionUser, extractGptHeaders } from '../services/gptAuthResolver';

console.log('📁 gptCreditsRoutes.ts FILE LOADED at', new Date().toISOString());

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Feature flag: 'elements' = embedded Stripe Elements, 'checkout' = hosted redirect
const CHECKOUT_MODE = process.env.GPT_CHECKOUT_MODE || 'checkout';
console.log(`🔧 GPT Checkout Mode: ${CHECKOUT_MODE}`);

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

    // ELEMENTS MODE: Create PaymentIntent instead of Checkout Session
    if (CHECKOUT_MODE === 'elements') {
      console.log(`🎨 GPT Credits: Using Elements mode (embedded payment form)`);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: pkg.amount * 100,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: gptUserId,
          creditsAmount: pkg.amount.toString(),
          creditsCount: pkg.credits.toString(),
          source: 'gpt',
          gptSessionId: sessionTrackingId,
          packageName
        },
        description: `Coin Railz ${pkg.description}`
      });

      // Store session with PaymentIntent info
      console.log(`🤖 GPT Credits: Saving Elements session ${sessionTrackingId} to database...`);
      try {
        await db.insert(gptPurchaseSessions).values({
          id: sessionTrackingId,
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          userId: gptUserId,
          packageName,
          amount: pkg.amount,
          credits: pkg.credits,
          status: 'pending',
        });
        console.log(`✅ GPT Credits: Elements session ${sessionTrackingId} saved successfully`);
      } catch (dbError: any) {
        console.error(`❌ GPT Credits: CRITICAL - Failed to save Elements session to database`);
        console.error(`   Session ID: ${sessionTrackingId}`);
        console.error(`   Error: ${dbError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Unable to create payment session. Please try again.',
          retryable: true
        });
      }

      console.log(`🤖 GPT Credits: Created Elements session ${sessionTrackingId} for ${packageName} ($${pkg.amount})`);

      return res.json({
        success: true,
        sessionId: sessionTrackingId,
        checkoutUrl: `${baseUrl}/pay/${sessionTrackingId}`,
        mode: 'elements',
        package: {
          name: packageName,
          price: `$${pkg.amount}`,
          credits: pkg.credits
        },
        instructions: 'Click the checkout link to complete your purchase on our secure payment page. After payment, use the status endpoint to get your API key.',
        statusEndpoint: `/api/gpt/credits/status?session=${sessionTrackingId}`,
        _version: 'v6-elements'
      });
    }

    // CHECKOUT MODE (fallback): Create hosted Checkout Session
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
      console.error(`❌ GPT Credits: CRITICAL - Failed to save session to database`);
      console.error(`   Session ID: ${sessionTrackingId}`);
      console.error(`   Stripe Session: ${session.id}`);
      console.error(`   Error: ${dbError.message}`);
      console.error(`   Code: ${dbError.code || 'unknown'}`);
      console.error(`   Full error:`, dbError);
      
      return res.status(500).json({
        success: false,
        error: 'Unable to create checkout session. Please try again.',
        retryable: true
      });
    }

    console.log(`🤖 GPT Credits: Created checkout session ${sessionTrackingId} for ${packageName} ($${pkg.amount})`);

    res.json({
      success: true,
      sessionId: sessionTrackingId,
      checkoutUrl: `${baseUrl}/pay/${sessionTrackingId}`,
      mode: 'checkout',
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

/**
 * GPT Session Bootstrap Endpoint (Phase 3A)
 * 
 * Zero-friction entry point for ChatGPT integrations.
 * Automatically resolves/creates user session from GPT headers.
 * Returns current session status, credits balance, and available services.
 * 
 * Headers supported:
 * - openai-conversation-id / x-openai-conversation-id
 * - openai-ephemeral-user-id / x-openai-session-id
 * - openai-gpt-id (optional email/identifier)
 */
router.post('/bootstrap', async (req: Request, res: Response) => {
  console.log('🚀 GPT Session Bootstrap - Request received');
  
  try {
    // Check if GPT session auth is enabled
    const gptAuthEnabled = process.env.GPT_SESSION_AUTH === 'true';
    
    if (!gptAuthEnabled) {
      return res.json({
        success: true,
        message: 'GPT session auth is currently disabled. Use API key authentication instead.',
        authMode: 'api_key_required',
        instructions: {
          step1: 'Purchase credits at POST /api/gpt/credits/create-session with { "package": "starter" }',
          step2: 'Complete payment at the provided checkout URL',
          step3: 'Get your API key from GET /api/gpt/credits/status?session=YOUR_SESSION_ID',
          step4: 'Use the API key in X-API-KEY header for all service calls'
        }
      });
    }
    
    // Extract GPT headers
    const gptHeaders = extractGptHeaders(req);
    
    if (!gptHeaders) {
      return res.status(400).json({
        success: false,
        error: 'Missing GPT headers',
        message: 'This endpoint requires OpenAI GPT headers (openai-conversation-id and openai-ephemeral-user-id)',
        requiredHeaders: [
          'openai-conversation-id OR x-openai-conversation-id',
          'openai-ephemeral-user-id OR x-openai-session-id'
        ]
      });
    }
    
    console.log(`🔐 GPT Bootstrap: Headers detected - conversationId=${gptHeaders.conversationId?.substring(0,8)}...`);
    
    // Resolve or create session user
    const authContext = await resolveAuth(req);
    
    // Handle different auth modes
    if (authContext.mode === 'anonymous') {
      // Headers present but no session created - likely missing stable identifier
      // openai-gpt-id header (userEmail field) is required for cross-conversation correlation
      // ephemeralUserId is the session ID, not a stable identifier
      const hasStableId = gptHeaders.userEmail; // This is the openai-gpt-id header
      
      if (!hasStableId) {
        console.log(`⚠️ GPT Bootstrap: Headers present but no stable identifier (openai-gpt-id missing)`);
        return res.status(200).json({
          success: true,
          message: 'GPT headers detected but missing stable identifier. Use API key auth or include openai-gpt-id header.',
          authMode: 'anonymous',
          headers_detected: {
            conversationId: !!gptHeaders.conversationId,
            sessionId: !!gptHeaders.sessionId,
            gptId: false // This is what's missing
          },
          fallbackOptions: {
            apiKey: {
              description: 'Purchase credits and get an API key for authenticated access',
              steps: [
                'POST /api/gpt/credits/create-session with { "package": "starter" }',
                'Complete payment at the provided checkout URL',
                'GET /api/gpt/credits/status?session=YOUR_SESSION_ID to get API key'
              ]
            },
            freeServices: [
              { endpoint: '/api/gpt/gas-prices', description: 'Real-time gas prices (FREE)' },
              { endpoint: '/api/gpt/token-info', description: 'Token metadata (FREE)' },
              { endpoint: '/api/gpt/trending', description: 'Trending tokens (FREE)' }
            ]
          }
        });
      }
      
      // Has GPT ID but still failed - unexpected error
      return res.status(500).json({
        success: false,
        error: 'Session resolution failed unexpectedly',
        message: 'Unable to establish GPT session. Please try again or use API key authentication.',
        authMode: 'anonymous'
      });
    }
    
    if (authContext.mode === 'gpt_provisional') {
      // New user - session created but needs linking to billing account
      console.log(`🆕 GPT Bootstrap: New provisional session created (ID: ${authContext.provisionalSessionId})`);
      
      return res.json({
        success: true,
        message: 'Welcome! Your GPT session has been created.',
        authMode: 'gpt_provisional',
        session: {
          id: authContext.provisionalSessionId,
          status: 'provisional',
          requiresBilling: true
        },
        credits: {
          balance: 0,
          status: 'no_credits'
        },
        nextSteps: {
          message: 'You need credits to use paid services. Purchase a credit package or use free services.',
          freeServices: [
            { endpoint: '/api/gpt/gas-prices', description: 'Real-time gas prices across 6 chains' },
            { endpoint: '/api/gpt/token-info', description: 'Token metadata and current price' },
            { endpoint: '/api/gpt/trending', description: 'Currently trending cryptocurrencies' }
          ],
          purchaseCredits: {
            endpoint: 'POST /api/gpt/credits/create-session',
            body: '{ "package": "starter" }',
            packages: Object.entries(CREDIT_PACKAGES).map(([key, value]) => ({
              id: key,
              price: `$${value.amount}`,
              credits: value.credits
            }))
          }
        }
      });
    }
    
    if (authContext.mode === 'gpt_session') {
      // Existing user with linked session
      console.log(`✅ GPT Bootstrap: Existing session found (userId: ${authContext.userId})`);
      
      let creditsBalance = 0;
      let creditsStatus = 'unknown';
      
      if (authContext.userId) {
        try {
          const balance = await creditsService.getBalance(authContext.userId);
          creditsBalance = balance;
          creditsStatus = balance > 0 ? 'active' : 'depleted';
        } catch (err) {
          console.error('[GPT Bootstrap] Error fetching credits:', err);
          creditsStatus = 'error';
        }
      }
      
      return res.json({
        success: true,
        message: 'Welcome back! Your GPT session is active.',
        authMode: 'gpt_session',
        session: {
          id: authContext.session?.id,
          userId: authContext.userId,
          status: 'active'
        },
        credits: {
          balance: creditsBalance,
          status: creditsStatus
        },
        services: {
          free: [
            { endpoint: '/api/gpt/gas-prices', description: 'Real-time gas prices' },
            { endpoint: '/api/gpt/token-info', description: 'Token metadata and price' },
            { endpoint: '/api/gpt/trending', description: 'Trending cryptocurrencies' }
          ],
          paid: [
            { endpoint: '/api/gpt/trade-signals', cost: 10, description: 'AI-powered trade signals' },
            { endpoint: '/api/gpt/wallet-analysis', cost: 25, description: 'Deep wallet analysis' },
            { endpoint: '/api/gpt/arbitrage-scanner', cost: 50, description: 'Cross-chain arbitrage opportunities' }
          ]
        },
        needsMoreCredits: creditsBalance <= 0,
        purchaseCreditsUrl: 'POST /api/gpt/credits/create-session with { "package": "starter" }'
      });
    }
    
    // API key fallback
    if (authContext.mode === 'api_key') {
      return res.json({
        success: true,
        message: 'Authenticated via API key.',
        authMode: 'api_key',
        session: {
          apiKeyId: authContext.apiKeyId,
          status: 'active'
        },
        note: 'For zero-friction GPT sessions, ensure your requests include OpenAI GPT headers.'
      });
    }
    
    // Unknown mode
    return res.status(500).json({
      success: false,
      error: 'Unexpected auth mode',
      authMode: authContext.mode
    });
    
  } catch (error: any) {
    console.error('❌ GPT Bootstrap error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Session bootstrap failed',
      message: error.message
    });
  }
});

// RECOVERY ENDPOINT: Manually check Stripe and fulfill pending sessions
router.post('/recover/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { adminKey } = req.body;
  
  // Simple admin protection
  if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'recover2024') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  console.log(`🔧 RECOVERY: Attempting to recover session ${sessionId}`);
  
  try {
    const [session] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, sessionId))
      .limit(1);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    if (session.status === 'completed') {
      return res.json({
        success: true,
        message: 'Session already completed',
        apiKey: session.apiKey,
        credits: session.credits
      });
    }
    
    // Check Stripe for payment status
    let paymentSucceeded = false;
    let stripeStatus = 'unknown';
    
    if (session.stripePaymentIntentId) {
      // Elements mode - check PaymentIntent
      const paymentIntent = await stripe.paymentIntents.retrieve(session.stripePaymentIntentId);
      stripeStatus = paymentIntent.status;
      paymentSucceeded = paymentIntent.status === 'succeeded';
      console.log(`🔧 RECOVERY: PaymentIntent ${session.stripePaymentIntentId} status: ${paymentIntent.status}`);
    } else if (session.stripeSessionId) {
      // Checkout mode - check Session
      const checkoutSession = await stripe.checkout.sessions.retrieve(session.stripeSessionId);
      stripeStatus = checkoutSession.payment_status;
      paymentSucceeded = checkoutSession.payment_status === 'paid';
      console.log(`🔧 RECOVERY: Checkout session ${session.stripeSessionId} status: ${checkoutSession.payment_status}`);
    }
    
    if (!paymentSucceeded) {
      return res.json({
        success: false,
        message: 'Payment not yet succeeded',
        stripeStatus,
        sessionId,
        sessionStatus: session.status
      });
    }
    
    // Payment succeeded - fulfill the order!
    console.log(`✅ RECOVERY: Payment confirmed! Fulfilling session ${sessionId}`);
    
    const correctCredits = session.credits || 
      CREDIT_PACKAGES[session.packageName as keyof typeof CREDIT_PACKAGES]?.credits || 100;
    
    // Generate API key
    const { apiKey } = await creditsService.generateApiKey(session.userId, 'GPT Purchase API Key (Recovered)');
    
    // Update session
    await db.update(gptPurchaseSessions)
      .set({
        status: 'completed',
        apiKey,
        credits: correctCredits,
        completedAt: new Date(),
      })
      .where(eq(gptPurchaseSessions.id, sessionId));
    
    console.log(`🎉 RECOVERY SUCCESS: Session ${sessionId} fulfilled with ${correctCredits} credits`);
    
    return res.json({
      success: true,
      message: 'Session recovered and fulfilled!',
      apiKey,
      credits: correctCredits,
      recovered: true
    });
    
  } catch (error: any) {
    console.error(`❌ RECOVERY ERROR for session ${sessionId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Recovery failed',
      message: error.message
    });
  }
});

// BULK RECOVERY: Check all pending sessions and recover any with successful payments
router.post('/recover-all', async (req: Request, res: Response) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'recover2024') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  console.log(`🔧 BULK RECOVERY: Checking all pending sessions...`);
  
  try {
    const pendingSessions = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.status, 'pending'));
    
    console.log(`🔧 BULK RECOVERY: Found ${pendingSessions.length} pending sessions`);
    
    const results = {
      total: pendingSessions.length,
      recovered: 0,
      notPaid: 0,
      errors: 0,
      details: [] as any[]
    };
    
    for (const session of pendingSessions) {
      try {
        let paymentSucceeded = false;
        let stripeStatus = 'unknown';
        
        if (session.stripePaymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(session.stripePaymentIntentId);
          stripeStatus = paymentIntent.status;
          paymentSucceeded = paymentIntent.status === 'succeeded';
        } else if (session.stripeSessionId) {
          const checkoutSession = await stripe.checkout.sessions.retrieve(session.stripeSessionId);
          stripeStatus = checkoutSession.payment_status;
          paymentSucceeded = checkoutSession.payment_status === 'paid';
        }
        
        if (paymentSucceeded) {
          const correctCredits = session.credits || 
            CREDIT_PACKAGES[session.packageName as keyof typeof CREDIT_PACKAGES]?.credits || 100;
          
          const { apiKey } = await creditsService.generateApiKey(session.userId, 'GPT Purchase API Key (Bulk Recovered)');
          
          await db.update(gptPurchaseSessions)
            .set({
              status: 'completed',
              apiKey,
              credits: correctCredits,
              completedAt: new Date(),
            })
            .where(eq(gptPurchaseSessions.id, session.id));
          
          results.recovered++;
          results.details.push({ sessionId: session.id, status: 'recovered', credits: correctCredits });
          console.log(`✅ BULK RECOVERY: Session ${session.id} recovered with ${correctCredits} credits`);
        } else {
          results.notPaid++;
          results.details.push({ sessionId: session.id, status: 'not_paid', stripeStatus });
        }
      } catch (err: any) {
        results.errors++;
        results.details.push({ sessionId: session.id, status: 'error', error: err.message });
        console.error(`❌ BULK RECOVERY: Error for session ${session.id}:`, err.message);
      }
    }
    
    console.log(`🎉 BULK RECOVERY COMPLETE: ${results.recovered} recovered, ${results.notPaid} not paid, ${results.errors} errors`);
    
    return res.json({
      success: true,
      message: `Bulk recovery complete`,
      ...results
    });
    
  } catch (error: any) {
    console.error(`❌ BULK RECOVERY ERROR:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Bulk recovery failed',
      message: error.message
    });
  }
});

// Get session info for Elements payment page
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  try {
    const [session] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, sessionId))
      .limit(1);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired'
      });
    }

    // Check if already completed
    if (session.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        message: 'Payment already completed',
        apiKey: session.apiKey,
        credits: session.credits
      });
    }

    // For Elements mode, return clientSecret for payment
    if (session.clientSecret) {
      return res.json({
        success: true,
        status: session.status,
        clientSecret: session.clientSecret,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.TESTING_VITE_STRIPE_PUBLIC_KEY,
        package: {
          name: session.packageName,
          amount: session.amount,
          credits: session.credits
        }
      });
    }

    // For Checkout mode, redirect to Stripe
    if (session.stripeSessionId) {
      return res.json({
        success: true,
        status: session.status,
        mode: 'checkout',
        redirectRequired: true,
        message: 'This session uses hosted checkout. Please use the redirect endpoint.'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid session state'
    });
  } catch (error: any) {
    console.error(`❌ Get session error for ${sessionId}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get session info'
    });
  }
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

// Webhook handler called from creditsRoutes when GPT purchase is confirmed (Checkout mode)
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

// Webhook handler for PaymentIntent success (Elements mode)
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const gptSessionId = paymentIntent.metadata?.gptSessionId;
  const userId = paymentIntent.metadata?.userId;
  
  if (!gptSessionId || !userId) {
    console.log('⚠️ PaymentIntent webhook: Missing metadata, skipping GPT handling');
    return;
  }

  console.log(`🎨 PaymentIntent succeeded for GPT session ${gptSessionId}`);

  try {
    // Get the original session from database
    const [existingSession] = await db.select()
      .from(gptPurchaseSessions)
      .where(eq(gptPurchaseSessions.id, gptSessionId))
      .limit(1);
    
    if (!existingSession) {
      console.error(`❌ PaymentIntent webhook: Session ${gptSessionId} not found`);
      throw new Error('Session not found');
    }

    // Already completed - skip
    if (existingSession.status === 'completed') {
      console.log(`⚠️ PaymentIntent webhook: Session ${gptSessionId} already completed, skipping`);
      return;
    }
    
    const correctCredits = existingSession.credits || 
      parseInt(paymentIntent.metadata?.creditsCount || '0', 10) || 
      CREDIT_PACKAGES[existingSession.packageName as keyof typeof CREDIT_PACKAGES]?.credits;
    
    if (!correctCredits) {
      console.error(`❌ PaymentIntent webhook: Cannot determine credits for session ${gptSessionId}`);
      throw new Error('Cannot determine credits amount');
    }
    
    // Generate API key
    const { apiKey } = await creditsService.generateApiKey(userId, 'GPT Purchase API Key');

    // Update session in database
    await db.update(gptPurchaseSessions)
      .set({
        status: 'completed',
        apiKey,
        credits: correctCredits,
        completedAt: new Date(),
      })
      .where(eq(gptPurchaseSessions.id, gptSessionId));

    console.log(`✅ GPT Elements Purchase Complete: User ${userId} - ${correctCredits} credits - Key: ${apiKey.substring(0, 12)}...`);

  } catch (error: any) {
    console.error('❌ PaymentIntent webhook failed:', error.message);
    throw error;
  }
}

export default router;
