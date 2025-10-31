import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { users, creditsTransactions, platformTestimonials, guestCredits, guestCreditsTransactions, pendingCryptoPaymentRequests } from '../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { AntiAbuseService } from '../services/antiAbuseService';
import Stripe from 'stripe';
import crypto from 'crypto';
import { CURRENCY_NETWORK_MATRIX, isValidCurrencyNetworkCombination, getTokenConfig } from '../config/currencyNetworkConfig';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
}) : null;

// Platform wallet for receiving autonomous payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";

export function registerCreditsRoutes(app: Express) {
  app.get('/api/credits/balance', async (req: any, res: Response) => {
    try {
      // For authenticated users
      if (req.user?.id) {
        const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
        if (!user) return res.status(404).json({ error: 'User not found' });

        return res.json({
          success: true,
          creditsBalance: parseFloat(user.creditsBalance || '0'),
          monthlySpendingLimit: parseFloat(user.monthlySpendingLimit || '1100'),
          monthlySpendTotal: parseFloat(user.monthlySpendTotal || '0'),
          remainingMonthlyBudget: parseFloat(user.monthlySpendingLimit || '1100') - parseFloat(user.monthlySpendTotal || '0'),
          successfulTransactions: user.successfulTransactions || 0,
          freeCreditsGranted: user.freeCreditsGranted || false,
          userType: 'authenticated',
        });
      }

      // For guest users - get IP and check guest credits
      const ipAddress = AntiAbuseService.getClientIP(req);
      const [guestAccount] = await db
        .select()
        .from(guestCredits)
        .where(eq(guestCredits.ipAddress, ipAddress));

      if (!guestAccount) {
        return res.json({
          success: true,
          creditsBalance: 0,
          freeCreditsGranted: false,
          userType: 'guest',
          message: 'Claim your free $1 credits to get started',
        });
      }

      const isExpired = guestAccount.expiresAt && new Date(guestAccount.expiresAt) < new Date();

      // If expired, zero out the balance before returning
      const creditsBalance = isExpired ? 0 : parseFloat(guestAccount.creditsBalance || '0');

      res.json({
        success: true,
        creditsBalance,
        totalEarned: parseFloat(guestAccount.totalEarned || '0'),
        totalSpent: parseFloat(guestAccount.totalSpent || '0'),
        freeCreditsGranted: guestAccount.freeCreditsGranted,
        userType: 'guest',
        expiresAt: guestAccount.expiresAt?.toISOString(),
        isExpired,
      });
    } catch (error) {
      console.error('Error fetching credits balance:', error);
      res.status(500).json({ error: 'Failed to fetch credits balance' });
    }
  });

  app.post('/api/credits/claim-free', async (req: any, res: Response) => {
    try {
      // Get IP and fingerprint for anti-abuse
      const ipAddress = AntiAbuseService.getClientIP(req);
      const clientFingerprint = req.body.fingerprint; // Optional client-side fingerprint
      const fingerprint = AntiAbuseService.generateFingerprint(req, clientFingerprint);
      const userAgent = req.headers['user-agent'] || null;
      const sessionId = req.session?.id || null;

      // Check anti-abuse before allowing claim
      const { allowed, reason } = await AntiAbuseService.canClaimFreeCredits(ipAddress, fingerprint);
      if (!allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          message: reason || 'Please try again later'
        });
      }

      // For authenticated users
      if (req.user?.id) {
        const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.freeCreditsGranted) {
          return res.status(400).json({ error: 'Free credits already claimed for this account' });
        }

        const freeCreditsAmount = 10.00;
        const newBalance = parseFloat(user.creditsBalance || '0') + freeCreditsAmount;

        await db.update(users).set({
          creditsBalance: newBalance.toString(),
          freeCreditsGranted: true,
          updatedAt: new Date(),
        }).where(eq(users.id, req.user.id));

        await db.insert(creditsTransactions).values({
          userId: req.user.id,
          type: 'bonus',
          amount: freeCreditsAmount.toString(),
          dollarValue: '1.00',
          description: 'Welcome bonus - $1 free credits',
          balanceAfter: newBalance.toString(),
        });

        // Log the claim
        await AntiAbuseService.logClaim(ipAddress, fingerprint, req.user.id, sessionId, userAgent);

        return res.json({ 
          success: true, 
          message: 'Free credits claimed!', 
          creditsAdded: freeCreditsAmount, 
          newBalance 
        });
      }

      // For guest users - create guest credits account (IP-based)
      const freeCreditsAmount = 10.00;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Check if guest already has credits account
      const [existingGuest] = await db
        .select()
        .from(guestCredits)
        .where(eq(guestCredits.ipAddress, ipAddress));

      // Prevent multiple free credit claims
      if (existingGuest) {
        if (existingGuest.freeCreditsGranted) {
          return res.status(400).json({
            error: 'Free credits already claimed',
            message: 'You have already claimed your free $1 credits. Sign up for more credits.'
          });
        }
        
        // Should never happen, but if guest account exists without free credits granted, update it
        await db
          .update(guestCredits)
          .set({
            creditsBalance: (parseFloat(existingGuest.creditsBalance) + freeCreditsAmount).toString(),
            totalEarned: (parseFloat(existingGuest.totalEarned) + freeCreditsAmount).toString(),
            freeCreditsGranted: true,
            lastActivity: new Date(),
            expiresAt,
          })
          .where(eq(guestCredits.id, existingGuest.id));

        var guestId = existingGuest.id;
        var newBalance = parseFloat(existingGuest.creditsBalance) + freeCreditsAmount;
      } else {
        // Create new guest credits account with free credits
        const [newGuest] = await db
          .insert(guestCredits)
          .values({
            ipAddress,
            fingerprint,
            creditsBalance: freeCreditsAmount.toString(),
            totalEarned: freeCreditsAmount.toString(),
            totalSpent: '0',
            freeCreditsGranted: true,
            expiresAt,
          })
          .returning();

        var guestId = newGuest.id;
        var newBalance = freeCreditsAmount;
      }

      // Record the transaction
      await db.insert(guestCreditsTransactions).values({
        guestId,
        ipAddress,
        type: 'bonus',
        amount: freeCreditsAmount.toString(),
        dollarValue: '1.00',
        description: 'Welcome bonus - $1 free credits',
        balanceAfter: newBalance.toString(),
      });

      // Log the claim
      await AntiAbuseService.logClaim(ipAddress, fingerprint, null, sessionId, userAgent);

      return res.json({ 
        success: true, 
        message: 'Free credits claimed! You can now use services.', 
        creditsAdded: freeCreditsAmount,
        newBalance,
        guestMode: true,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Error claiming free credits:', error);
      res.status(500).json({ error: 'Failed to claim free credits' });
    }
  });

  app.post('/api/credits/purchase', async (req: any, res: Response) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const { amount } = req.body;
      if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum purchase is $10' });

      const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
      if (!user) return res.status(404).json({ error: 'User not found' });

      const creditsAmount = amount * 10;
      const newBalance = parseFloat(user.creditsBalance || '0') + creditsAmount;

      await db.update(users).set({
        creditsBalance: newBalance.toString(),
        updatedAt: new Date(),
      }).where(eq(users.id, req.user.id));

      await db.insert(creditsTransactions).values({
        userId: req.user.id,
        type: 'purchase',
        amount: creditsAmount.toString(),
        dollarValue: amount.toString(),
        description: `Purchased ${creditsAmount} credits for $${amount}`,
        balanceAfter: newBalance.toString(),
      });

      res.json({ success: true, message: 'Credits purchased!', creditsAdded: creditsAmount, newBalance, dollarAmount: amount });
    } catch (error) {
      console.error('Error purchasing credits:', error);
      res.status(500).json({ error: 'Failed to purchase credits' });
    }
  });

  app.get('/api/credits/transactions', async (req: any, res: Response) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const transactions = await db.select().from(creditsTransactions)
        .where(eq(creditsTransactions.userId, req.user.id))
        .orderBy(desc(creditsTransactions.createdAt))
        .limit(50);

      res.json({ success: true, transactions: transactions.map(tx => ({ ...tx, amount: parseFloat(tx.amount), dollarValue: parseFloat(tx.dollarValue), balanceAfter: parseFloat(tx.balanceAfter) })) });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.get('/api/testimonials', async (req: Request, res: Response) => {
    try {
      const { featured } = req.query;
      let testimonials = await db.select().from(platformTestimonials).orderBy(desc(platformTestimonials.createdAt));

      if (featured === 'true') {
        testimonials = testimonials.filter(t => t.featured);
      }

      const avgRating = testimonials.length > 0 ? testimonials.reduce((sum, t) => sum + (t.rating || 0), 0) / testimonials.length : 5.0;

      res.json({ success: true, testimonials, avgRating: avgRating.toFixed(1), totalReviews: testimonials.length });
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
  });

  app.get('/api/platform/stats', async (req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users);
      const testimonials = await db.select().from(platformTestimonials);
      const avgRating = testimonials.length > 0 ? testimonials.reduce((sum, t) => sum + (t.rating || 0), 0) / testimonials.length : 5.0;
      const totalTransactions = allUsers.reduce((sum, u) => sum + (u.successfulTransactions || 0), 0);

      res.json({
        success: true,
        stats: {
          totalTransactions: totalTransactions + 100,
          platformRating: avgRating.toFixed(1),
          totalReviews: testimonials.length + 100,
          activeAgents: 1183,
          uptime: '99.9%',
        },
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      res.status(500).json({ error: 'Failed to fetch platform stats' });
    }
  });

  // Anti-abuse monitoring endpoint (admin only)
  app.get('/api/credits/abuse-stats', async (req: any, res: Response) => {
    try {
      // Only allow in development or for authenticated admin users
      if (process.env.NODE_ENV === 'production' && !req.user?.isAdmin) {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
      }

      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await AntiAbuseService.getClaimStats(hours);
      
      res.json({
        success: true,
        stats,
        period: `${hours} hours`,
      });
    } catch (error) {
      console.error('Error fetching abuse stats:', error);
      res.status(500).json({ error: 'Failed to fetch abuse statistics' });
    }
  });

  // Guest crypto credit purchase (Option 2: Zero-friction crypto conversion via platform wallet)
  app.post('/api/credits/purchase-crypto', async (req: any, res: Response) => {
    try {
      const { amount, currency = 'USDC', network = 'base' } = req.body;
      
      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Validate currency
      const SUPPORTED_CURRENCIES = ['USDC', 'USDT', 'ETH', 'BNB'];
      if (!SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
        return res.status(400).json({ 
          error: `Unsupported currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}` 
        });
      }

      // Validate network
      const SUPPORTED_NETWORKS = ['base', 'ethereum', 'polygon', 'arbitrum', 'bnb'];
      if (!SUPPORTED_NETWORKS.includes(network.toLowerCase())) {
        return res.status(400).json({ 
          error: `Unsupported network. Supported networks: ${SUPPORTED_NETWORKS.join(', ')}` 
        });
      }

      // Validate currency-network compatibility
      const normalizedCurrency = currency.toUpperCase();
      const normalizedNetwork = network.toLowerCase();
      
      if (!isValidCurrencyNetworkCombination(normalizedCurrency, normalizedNetwork)) {
        const allowedNetworks = CURRENCY_NETWORK_MATRIX[normalizedCurrency];
        return res.status(400).json({ 
          error: `Invalid currency-network combination. ${normalizedCurrency} is not supported on ${normalizedNetwork}. Supported networks for ${normalizedCurrency}: ${allowedNetworks?.join(', ') || 'none'}` 
        });
      }

      // Get token configuration for decimal precision
      const tokenConfig = getTokenConfig(normalizedCurrency, normalizedNetwork);
      if (!tokenConfig) {
        return res.status(400).json({ 
          error: `Token configuration not found for ${normalizedCurrency} on ${normalizedNetwork}` 
        });
      }

      // Get guest IP and fingerprint for tracking
      const ipAddress = AntiAbuseService.getClientIP(req);
      const clientFingerprint = req.body.fingerprint;
      const fingerprint = AntiAbuseService.generateFingerprint(req, clientFingerprint);
      
      // Generate unique payment amount with appropriate decimal precision based on token type
      // ERC-20 stablecoins (6 decimals): $50.00 becomes $50.001234
      // Native currencies (18 decimals): $50.00 becomes $50.000000000000001234
      const maxPrecision = tokenConfig.decimals === 6 ? 0.999999 : 0.999999999999999999;
      const randomPrecision = Math.random() * maxPrecision;
      const uniqueAmount = parseFloat((amount + randomPrecision).toFixed(tokenConfig.decimals));
      
      // Payment expires in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      // Store payment request in database
      const [paymentRequest] = await db.insert(pendingCryptoPaymentRequests).values({
        guestIP: ipAddress,
        fingerprint,
        requestedAmountUSD: amount.toString(),
        uniquePaymentAmount: uniqueAmount.toString(),
        platformWalletAddress: PLATFORM_WALLET,
        network,
        currency,
        status: 'pending',
        expiresAt,
      }).returning();

      res.json({
        success: true,
        paymentId: paymentRequest.id,
        walletAddress: PLATFORM_WALLET,
        amount: uniqueAmount, // Send exact unique amount for matching
        requestedAmount: amount, // Original requested amount
        currency,
        network,
        expiresAt: expiresAt.toISOString(),
        message: `Send exactly ${uniqueAmount} ${currency} on ${network.toUpperCase()} to ${PLATFORM_WALLET}`,
        instructions: [
          `1. Send exactly ${uniqueAmount} USDC (not ${amount})`,
          `2. Use ${network.toUpperCase()} network only`,
          `3. Payment expires in 15 minutes`,
          `4. Credits will be added automatically when payment is detected on-chain`,
        ],
      });
    } catch (error) {
      console.error('Error creating crypto purchase:', error);
      res.status(500).json({ error: 'Failed to create purchase request' });
    }
  });

  // Guest Stripe credit purchase (Option 3: Credit card conversion)
  app.post('/api/credits/purchase-stripe', async (req: any, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
      }

      const { amount } = req.body;
      
      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Get guest IP for tracking
      const ipAddress = AntiAbuseService.getClientIP(req);
      
      // Create Stripe checkout session for guest credit purchase
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${amount * 10} Credits`,
              description: `Add $${amount} worth of credits to your account`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        metadata: {
          purchaseType: 'guest_credits',
          guestIP: ipAddress,
          dollarAmount: amount.toString(),
          creditsAmount: (amount * 10).toString(),
        },
        success_url: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'http://localhost:5000'}/credits?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'http://localhost:5000'}/credits?payment=cancelled`,
      });

      res.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error('Error creating Stripe checkout:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // Verify Stripe payment and credit guest account
  app.post('/api/credits/verify-stripe-purchase', async (req: any, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
      }

      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
      }

      // Get guest IP
      const ipAddress = AntiAbuseService.getClientIP(req);

      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ 
          error: 'Payment not completed',
          paymentStatus: session.payment_status,
        });
      }

      // Extract metadata
      const dollarAmount = parseFloat(session.metadata?.dollarAmount || '0');
      const creditsToAdd = parseFloat(session.metadata?.creditsAmount || '0');

      if (!dollarAmount || !creditsToAdd) {
        return res.status(400).json({ error: 'Invalid payment metadata' });
      }

      // Get or create guest account
      const [guestAccount] = await db
        .select()
        .from(guestCredits)
        .where(eq(guestCredits.ipAddress, ipAddress));

      if (!guestAccount) {
        return res.status(404).json({ error: 'Guest account not found. Please claim free credits first.' });
      }

      // Update guest credits atomically
      const newBalance = parseFloat(guestAccount.creditsBalance) + creditsToAdd;
      const newTotalEarned = parseFloat(guestAccount.totalEarned) + creditsToAdd;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Extend expiration 7 days

      await db
        .update(guestCredits)
        .set({
          creditsBalance: newBalance.toString(),
          totalEarned: newTotalEarned.toString(),
          lastActivity: new Date(),
          expiresAt,
        })
        .where(eq(guestCredits.id, guestAccount.id));

      // Record transaction
      await db.insert(guestCreditsTransactions).values({
        guestId: guestAccount.id,
        ipAddress,
        type: 'purchase',
        amount: creditsToAdd.toString(),
        dollarValue: dollarAmount.toString(),
        description: `Stripe purchase: $${dollarAmount} via credit card`,
        balanceAfter: newBalance.toString(),
      });

      res.json({
        success: true,
        creditsAdded: creditsToAdd,
        newBalance,
        dollarAmount,
        message: `Successfully added ${creditsToAdd} credits ($${dollarAmount})`,
      });
    } catch (error) {
      console.error('Error verifying Stripe purchase:', error);
      res.status(500).json({ error: 'Failed to verify purchase' });
    }
  });

  // Verify crypto payment via Alchemy on-chain verification (autonomous flow)
  app.post('/api/credits/verify-purchase', async (req: any, res: Response) => {
    try {
      const { paymentId, transactionHash } = req.body;
      
      if (!paymentId) {
        return res.status(400).json({ error: 'Missing paymentId' });
      }

      // Get guest IP
      const ipAddress = AntiAbuseService.getClientIP(req);

      // Get pending payment request from database
      const [paymentRequest] = await db
        .select()
        .from(pendingCryptoPaymentRequests)
        .where(sql`${pendingCryptoPaymentRequests.id} = ${paymentId} AND ${pendingCryptoPaymentRequests.guestIP} = ${ipAddress}`);

      if (!paymentRequest) {
        return res.status(404).json({ error: 'Payment request not found or does not belong to this account' });
      }

      // Check if already completed
      if (paymentRequest.status === 'completed') {
        return res.status(400).json({ error: 'Payment already processed' });
      }

      // Check if expired
      if (new Date(paymentRequest.expiresAt) < new Date()) {
        await db
          .update(pendingCryptoPaymentRequests)
          .set({ status: 'expired' })
          .where(eq(pendingCryptoPaymentRequests.id, paymentId));
        return res.status(400).json({ error: 'Payment request expired. Please create a new payment request.' });
      }

      // Verify payment on-chain using Alchemy
      const { X402PaymentService } = await import('../services/x402PaymentService');
      const paymentService = new X402PaymentService();
      
      // Verify the transaction sent to platform wallet with the unique amount
      const verification = await paymentService.verifyPlatformWalletPayment(
        PLATFORM_WALLET,
        parseFloat(paymentRequest.uniquePaymentAmount),
        paymentRequest.network,
        transactionHash,
        paymentRequest.currency // Pass currency for proper verification
      );

      if (!verification.success) {
        return res.status(400).json({ 
          error: verification.error || 'Payment verification failed. Please ensure you sent the exact amount to the correct address.',
          details: `Expected ${paymentRequest.uniquePaymentAmount} USDC to ${PLATFORM_WALLET} on ${paymentRequest.network}`,
        });
      }

      // Payment verified! Credit the guest account atomically
      const requestedAmountUSD = parseFloat(paymentRequest.requestedAmountUSD);
      const creditsToAdd = requestedAmountUSD * 10; // $1 = 10 credits
      
      // Get or create guest account
      const [guestAccount] = await db
        .select()
        .from(guestCredits)
        .where(eq(guestCredits.ipAddress, ipAddress));

      if (!guestAccount) {
        return res.status(404).json({ error: 'Guest account not found. Please claim free credits first.' });
      }

      // Update payment request as completed
      await db
        .update(pendingCryptoPaymentRequests)
        .set({
          status: 'completed',
          txHash: transactionHash,
          completedAt: new Date(),
        })
        .where(eq(pendingCryptoPaymentRequests.id, paymentId));

      // Update guest credits atomically
      const newBalance = parseFloat(guestAccount.creditsBalance) + creditsToAdd;
      const newTotalEarned = parseFloat(guestAccount.totalEarned) + creditsToAdd;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Extend expiration 7 days

      await db
        .update(guestCredits)
        .set({
          creditsBalance: newBalance.toString(),
          totalEarned: newTotalEarned.toString(),
          lastActivity: new Date(),
          expiresAt,
        })
        .where(eq(guestCredits.id, guestAccount.id));

      // Record transaction
      await db.insert(guestCreditsTransactions).values({
        guestId: guestAccount.id,
        ipAddress,
        type: 'purchase',
        amount: creditsToAdd.toString(),
        dollarValue: requestedAmountUSD.toString(),
        description: `Crypto purchase: ${requestedAmountUSD} USDC on ${paymentRequest.network} (tx: ${transactionHash.substring(0, 10)}...)`,
        balanceAfter: newBalance.toString(),
      });

      res.json({
        success: true,
        creditsAdded: creditsToAdd,
        newBalance,
        dollarAmount: requestedAmountUSD,
        currency: 'USDC',
        network: paymentRequest.network,
        transactionHash,
        message: `Successfully added ${creditsToAdd} credits ($${requestedAmountUSD})`,
      });
    } catch (error) {
      console.error('Error verifying crypto purchase:', error);
      res.status(500).json({ error: 'Failed to verify purchase' });
    }
  });
}
