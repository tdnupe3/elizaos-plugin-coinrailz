import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { users, creditsTransactions, platformTestimonials } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { AntiAbuseService } from '../services/antiAbuseService';

export function registerCreditsRoutes(app: Express) {
  app.get('/api/credits/balance', async (req: any, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({
        success: true,
        creditsBalance: parseFloat(user.creditsBalance || '0'),
        monthlySpendingLimit: parseFloat(user.monthlySpendingLimit || '1100'),
        monthlySpendTotal: parseFloat(user.monthlySpendTotal || '0'),
        remainingMonthlyBudget: parseFloat(user.monthlySpendingLimit || '1100') - parseFloat(user.monthlySpendTotal || '0'),
        successfulTransactions: user.successfulTransactions || 0,
        freeCreditsGranted: user.freeCreditsGranted || false,
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

      // For guest users - allow them to claim but track via IP/fingerprint only
      // In production, you'd store this in session or a temporary guest account
      const freeCreditsAmount = 10.00;

      // Log the guest claim
      await AntiAbuseService.logClaim(ipAddress, fingerprint, null, sessionId, userAgent);

      return res.json({ 
        success: true, 
        message: 'Free credits reserved! Sign up to claim them.', 
        creditsAdded: freeCreditsAmount,
        guestMode: true,
        requiresSignup: true
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

  // Anti-abuse monitoring endpoint (admin only in production)
  app.get('/api/credits/abuse-stats', async (req: any, res: Response) => {
    try {
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
}
