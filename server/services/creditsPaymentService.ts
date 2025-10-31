import { db } from '../db';
import { users, creditsTransactions, guestCredits, guestCreditsTransactions } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface PaymentRequest {
  userId?: string; // Optional for guest payments
  guestIP?: string; // IP address for guest payments
  amount: number; // Amount in USD
  description: string;
  orderId?: string;
}

interface PaymentResult {
  success: boolean;
  approved: boolean;
  requiresManualApproval: boolean;
  message: string;
  transactionId?: number;
  remainingCredits?: number;
  monthlySpendRemaining?: number;
}

export class CreditsPaymentService {
  // Auto-approve threshold: $100
  private static AUTO_APPROVE_THRESHOLD = 100.00;

  /**
   * Process payment using credits with auto-approval for amounts < $100
   * Supports both authenticated users and guest payments (IP-based)
   */
  static async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const { userId, guestIP, amount, description, orderId } = request;

    try {
      // Handle guest payments (IP-based)
      if (!userId && guestIP) {
        return await this.processGuestPayment(guestIP, amount, description, orderId);
      }

      // Handle authenticated user payments
      if (!userId) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: 'User ID or guest IP required',
        };
      }

      // Get user's current credits and monthly spend
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: 'User not found',
        };
      }

      const currentCredits = parseFloat(user.creditsBalance || '0');
      const creditsNeeded = amount * 10; // $1 = 10 credits
      const monthlySpend = parseFloat(user.monthlySpendTotal || '0');
      const monthlyLimit = parseFloat(user.monthlySpendingLimit || '1100');

      // Check if user has enough credits
      if (currentCredits < creditsNeeded) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: `Insufficient credits. Need ${creditsNeeded} credits ($${amount}), have ${currentCredits} credits`,
          remainingCredits: currentCredits,
        };
      }

      // Check monthly spending limit
      if (monthlySpend + amount > monthlyLimit) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: true,
          message: `Monthly spending limit exceeded. Limit: $${monthlyLimit}, Current: $${monthlySpend}, Requested: $${amount}`,
          monthlySpendRemaining: monthlyLimit - monthlySpend,
        };
      }

      // Check if requires manual approval (>$100)
      if (amount > this.AUTO_APPROVE_THRESHOLD) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: true,
          message: `Payment of $${amount} requires manual approval. Threshold: $${this.AUTO_APPROVE_THRESHOLD}`,
          remainingCredits: currentCredits,
        };
      }

      // AUTO-APPROVE: Deduct credits and process payment using atomic transaction
      // Use atomic UPDATE with WHERE clause to prevent race conditions
      const newCreditsBalance = currentCredits - creditsNeeded;
      const newMonthlySpend = monthlySpend + amount;
      const newTransactionCount = (user.successfulTransactions || 0) + 1;

      // Atomic update: only succeeds if balance is still sufficient
      const updateResult = await db
        .update(users)
        .set({
          creditsBalance: sql`CASE 
            WHEN CAST(credits_balance AS DECIMAL) >= ${creditsNeeded} 
            THEN CAST((CAST(credits_balance AS DECIMAL) - ${creditsNeeded}) AS VARCHAR)
            ELSE credits_balance 
          END`,
          monthlySpendTotal: sql`CASE 
            WHEN CAST(credits_balance AS DECIMAL) >= ${creditsNeeded} 
            THEN CAST((CAST(monthly_spend_total AS DECIMAL) + ${amount}) AS VARCHAR)
            ELSE monthly_spend_total 
          END`,
          successfulTransactions: sql`CASE 
            WHEN CAST(credits_balance AS DECIMAL) >= ${creditsNeeded} 
            THEN successful_transactions + 1
            ELSE successful_transactions 
          END`,
          updatedAt: new Date(),
        })
        .where(
          sql`${users.id} = ${userId} AND CAST(${users.creditsBalance} AS DECIMAL) >= ${creditsNeeded}`
        )
        .returning();

      // If no rows updated, balance was insufficient (race condition occurred)
      if (!updateResult || updateResult.length === 0) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: `Insufficient credits due to concurrent transaction. Please retry.`,
        };
      }

      const finalBalance = parseFloat(updateResult[0].creditsBalance || '0');

      // Record transaction
      const [transaction] = await db
        .insert(creditsTransactions)
        .values({
          userId,
          type: 'usage',
          amount: (-creditsNeeded).toString(),
          dollarValue: amount.toString(),
          description,
          relatedOrderId: orderId,
          balanceAfter: finalBalance.toString(),
        })
        .returning();

      return {
        success: true,
        approved: true,
        requiresManualApproval: false,
        message: `Payment approved! Charged ${creditsNeeded} credits ($${amount})`,
        transactionId: transaction.id,
        remainingCredits: finalBalance,
        monthlySpendRemaining: monthlyLimit - newMonthlySpend,
      };
    } catch (error) {
      console.error('Error processing credits payment:', error);
      return {
        success: false,
        approved: false,
        requiresManualApproval: false,
        message: 'Payment processing failed',
      };
    }
  }

  /**
   * Process guest payment (IP-based)
   */
  private static async processGuestPayment(
    guestIP: string,
    amount: number,
    description: string,
    orderId?: string
  ): Promise<PaymentResult> {
    try {
      // Get guest credits account
      const [guestAccount] = await db
        .select()
        .from(guestCredits)
        .where(eq(guestCredits.ipAddress, guestIP));

      if (!guestAccount) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: 'Guest account not found. Claim free credits first.',
        };
      }

      // Check if credits expired
      if (guestAccount.expiresAt && new Date(guestAccount.expiresAt) < new Date()) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: 'Guest credits have expired. Claim new credits to continue.',
        };
      }

      const currentCredits = parseFloat(guestAccount.creditsBalance);
      const creditsNeeded = amount * 10; // $1 = 10 credits

      // Check if guest has enough credits
      if (currentCredits < creditsNeeded) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: `Insufficient credits. Need ${creditsNeeded} credits ($${amount}), have ${currentCredits} credits`,
          remainingCredits: currentCredits,
        };
      }

      // Guests auto-approved for small amounts only (up to $2)
      if (amount > 2.00) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: true,
          message: `Guest payments limited to $2. Amount: $${amount}. Sign up for higher limits.`,
          remainingCredits: currentCredits,
        };
      }

      // Deduct credits atomically
      const newCreditsBalance = currentCredits - creditsNeeded;
      const newTotalSpent = parseFloat(guestAccount.totalSpent) + amount;

      const updateResult = await db
        .update(guestCredits)
        .set({
          creditsBalance: sql`CASE 
            WHEN CAST(credits_balance AS DECIMAL) >= ${creditsNeeded} 
            THEN CAST((CAST(credits_balance AS DECIMAL) - ${creditsNeeded}) AS VARCHAR)
            ELSE credits_balance 
          END`,
          totalSpent: sql`CASE 
            WHEN CAST(credits_balance AS DECIMAL) >= ${creditsNeeded} 
            THEN CAST((CAST(total_spent AS DECIMAL) + ${amount}) AS VARCHAR)
            ELSE total_spent 
          END`,
          lastActivity: new Date(),
        })
        .where(
          sql`${guestCredits.id} = ${guestAccount.id} AND CAST(${guestCredits.creditsBalance} AS DECIMAL) >= ${creditsNeeded}`
        )
        .returning();

      if (!updateResult || updateResult.length === 0) {
        return {
          success: false,
          approved: false,
          requiresManualApproval: false,
          message: 'Insufficient credits due to concurrent transaction. Please retry.',
        };
      }

      const finalBalance = parseFloat(updateResult[0].creditsBalance || '0');

      // Record transaction
      await db.insert(guestCreditsTransactions).values({
        guestId: guestAccount.id,
        ipAddress: guestIP,
        type: 'usage',
        amount: (-creditsNeeded).toString(),
        dollarValue: amount.toString(),
        description,
        balanceAfter: finalBalance.toString(),
      });

      return {
        success: true,
        approved: true,
        requiresManualApproval: false,
        message: `Payment approved! Charged ${creditsNeeded} credits ($${amount})`,
        remainingCredits: finalBalance,
      };
    } catch (error) {
      console.error('Error processing guest payment:', error);
      return {
        success: false,
        approved: false,
        requiresManualApproval: false,
        message: 'Guest payment processing failed',
      };
    }
  }

  /**
   * Check if user can afford a payment
   */
  static async canAfford(userId: string, amount: number): Promise<boolean> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return false;

      const currentCredits = parseFloat(user.creditsBalance || '0');
      const creditsNeeded = amount * 10;

      return currentCredits >= creditsNeeded;
    } catch (error) {
      console.error('Error checking affordability:', error);
      return false;
    }
  }

  /**
   * Get user's payment capacity
   */
  static async getPaymentCapacity(userId: string): Promise<{
    maxPayment: number;
    creditsBalance: number;
    monthlyRemaining: number;
  }> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return { maxPayment: 0, creditsBalance: 0, monthlyRemaining: 0 };
      }

      const creditsBalance = parseFloat(user.creditsBalance || '0');
      const monthlySpend = parseFloat(user.monthlySpendTotal || '0');
      const monthlyLimit = parseFloat(user.monthlySpendingLimit || '1100');

      const maxFromCredits = creditsBalance / 10; // Convert credits to dollars
      const maxFromMonthly = monthlyLimit - monthlySpend;
      const maxPayment = Math.min(maxFromCredits, maxFromMonthly, this.AUTO_APPROVE_THRESHOLD);

      return {
        maxPayment: Math.max(0, maxPayment),
        creditsBalance,
        monthlyRemaining: Math.max(0, maxFromMonthly),
      };
    } catch (error) {
      console.error('Error getting payment capacity:', error);
      return { maxPayment: 0, creditsBalance: 0, monthlyRemaining: 0 };
    }
  }

  /**
   * Reset monthly spend counters (should run monthly via cron)
   */
  static async resetMonthlySpend(): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          monthlySpendTotal: '0.00',
          lastSpendReset: new Date(),
          updatedAt: new Date(),
        })
        .where(sql`EXTRACT(MONTH FROM last_spend_reset) != EXTRACT(MONTH FROM NOW())`);

      console.log('✅ Monthly spend counters reset successfully');
    } catch (error) {
      console.error('❌ Error resetting monthly spend:', error);
    }
  }
}
