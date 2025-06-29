/**
 * CRITICAL API ROUTES - BYPASS VITE MIDDLEWARE
 * These routes must be registered before Vite to ensure JSON responses
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { users, humanToHumanReferrals } from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export function setupCriticalAPIRoutes(app: Express) {
  
  // === REFERRAL API ENDPOINTS ===
  
  // Generate referral link
  app.post('/api/referrals/generate-link', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { userId = 'demo-user' } = req.body;
      
      const referralCode = `ref_${nanoid(12)}`;
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://coinrailz.com' : 'http://localhost:5000';
      const referralLink = `${baseUrl}/register?ref=${referralCode}`;
      
      // Upsert user with referral code
      await db.insert(users).values({
        id: userId,
        email: `${userId}@example.com`,
        referralCode,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          referralCode,
          updatedAt: new Date()
        }
      });

      res.status(200).json({
        success: true,
        referralCode,
        referralLink,
        persistent: true,
        message: 'Referral link generated successfully'
      });

    } catch (error) {
      console.error('Error generating referral link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate referral link'
      });
    }
  });

  // Get referral stats
  app.get('/api/referrals/my-stats', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const userId = (req.headers['user-id'] as string) || 'demo-user';
      
      // Get or create user
      let [user] = await db
        .select({
          id: users.id,
          email: users.email,
          referralCode: users.referralCode,
          totalReferrals: users.totalReferrals,
          referralBonus: users.referralBonus
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        const referralCode = `ref_${nanoid(12)}`;
        await db.insert(users).values({
          id: userId,
          email: `${userId}@example.com`,
          referralCode,
          totalReferrals: 0,
          referralBonus: '0.00',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        user = {
          id: userId,
          email: `${userId}@example.com`,
          referralCode,
          totalReferrals: 0,
          referralBonus: '0.00'
        };
      }

      // Get total commissions
      const [totalCommissions] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${humanToHumanReferrals.commissionAmount}::numeric), 0)`
        })
        .from(humanToHumanReferrals)
        .where(eq(humanToHumanReferrals.referrerUserId, userId));

      // Get recent activity
      const recentReferrals = await db
        .select({
          referredUserId: humanToHumanReferrals.referredUserId,
          commissionAmount: humanToHumanReferrals.commissionAmount,
          transactionAmount: humanToHumanReferrals.transactionAmount,
          isFirstTransaction: humanToHumanReferrals.isFirstTransaction,
          createdAt: humanToHumanReferrals.createdAt
        })
        .from(humanToHumanReferrals)
        .where(eq(humanToHumanReferrals.referrerUserId, userId))
        .orderBy(desc(humanToHumanReferrals.createdAt))
        .limit(10);

      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://coinrailz.com' : 'http://localhost:5000';
      const referralLink = user.referralCode ? `${baseUrl}/register?ref=${user.referralCode}` : null;

      res.status(200).json({
        totalReferrals: user.totalReferrals || 0,
        totalCommissions: totalCommissions?.total || '0.00',
        pendingCommissions: user.referralBonus || '0.00',
        referralCode: user.referralCode,
        referralLink,
        recentReferrals: recentReferrals.map(r => ({
          referredUserId: r.referredUserId,
          referredUserEmail: 'User',
          commissionAmount: r.commissionAmount,
          transactionAmount: r.transactionAmount,
          isFirstTransaction: r.isFirstTransaction,
          createdAt: r.createdAt || new Date()
        }))
      });

    } catch (error) {
      console.error('Error getting referral stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get referral statistics'
      });
    }
  });

  // Calculate commission
  app.post('/api/referrals/calculate-commission', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { transactionAmount, isFirstTransaction = false } = req.body;
      
      const amount = parseFloat(transactionAmount);
      
      if (!amount || amount < 50) {
        return res.status(400).json({
          success: false,
          error: 'Minimum transaction amount is $50'
        });
      }

      // Tiered commission rates
      let commissionRate = 0.003; // 0.3% default
      
      if (amount >= 5000) {
        commissionRate = 0.006; // 0.6%
      } else if (amount >= 1000) {
        commissionRate = 0.005; // 0.5%
      } else if (amount >= 250) {
        commissionRate = 0.004; // 0.4%
      }

      let commission = amount * commissionRate;
      
      // First transaction bonus (additional 0.1%)
      if (isFirstTransaction) {
        commission += amount * 0.001;
      }
      
      // Cap at $15 maximum
      commission = Math.min(commission, 15);

      res.status(200).json({
        success: true,
        transactionAmount: amount,
        commissionRate: commissionRate * 100,
        firstTransactionBonus: isFirstTransaction,
        commission: commission.toFixed(2),
        tier: amount >= 5000 ? 4 : amount >= 1000 ? 3 : amount >= 250 ? 2 : 1
      });

    } catch (error) {
      console.error('Error calculating commission:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate commission'
      });
    }
  });

  // Withdraw commissions
  app.post('/api/referrals/withdraw', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { amount } = req.body;
      const userId = (req.headers['user-id'] as string) || 'demo-user';
      
      const withdrawAmount = parseFloat(amount);
      
      if (!withdrawAmount || withdrawAmount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum withdrawal amount is $5.00'
        });
      }

      // Get user balance
      const [user] = await db
        .select({ referralBonus: users.referralBonus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const currentBalance = parseFloat(user.referralBonus || '0');
      
      if (withdrawAmount > currentBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Available: $${currentBalance.toFixed(2)}`
        });
      }

      // Process withdrawal
      const newBalance = currentBalance - withdrawAmount;
      
      await db
        .update(users)
        .set({
          referralBonus: newBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.status(200).json({
        success: true,
        withdrawnAmount: withdrawAmount.toFixed(2),
        remainingBalance: newBalance.toFixed(2),
        message: `Successfully withdrew $${withdrawAmount.toFixed(2)}`
      });

    } catch (error) {
      console.error('Error processing withdrawal:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process withdrawal'
      });
    }
  });

  // Legacy dashboard endpoint
  app.get('/api/referral/dashboard', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      message: 'Referral dashboard active',
      stats: {
        totalReferrals: 0,
        pendingCommissions: '0.00',
        referralCode: 'demo-ref-code'
      }
    });
  });

  // Process referral signup
  app.post('/api/referrals/process-signup', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { referralCode, newUserId, newUserEmail } = req.body;
      
      if (!referralCode) {
        return res.status(200).json({
          success: true,
          message: 'No referral code provided - direct signup'
        });
      }

      // Find referrer
      const [referrer] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.referralCode, referralCode))
        .limit(1);

      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }

      // Update referrer stats
      await db
        .update(users)
        .set({
          totalReferrals: sql`${users.totalReferrals} + 1`,
          updatedAt: new Date()
        })
        .where(eq(users.id, referrer.id));

      res.status(200).json({
        success: true,
        referrerId: referrer.id,
        message: 'Referral relationship established'
      });

    } catch (error) {
      console.error('Error processing referral signup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process referral signup'
      });
    }
  });
}