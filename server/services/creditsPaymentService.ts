import { db } from '../db';
import { users, creditsTransactions } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface PaymentRequest {
  userId: string;
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
   */
  static async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const { userId, amount, description, orderId } = request;

    try {
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

      // AUTO-APPROVE: Deduct credits and process payment
      const newCreditsBalance = currentCredits - creditsNeeded;
      const newMonthlySpend = monthlySpend + amount;
      const newTransactionCount = (user.successfulTransactions || 0) + 1;

      // Update user balance and stats
      await db
        .update(users)
        .set({
          creditsBalance: newCreditsBalance.toString(),
          monthlySpendTotal: newMonthlySpend.toString(),
          successfulTransactions: newTransactionCount,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

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
          balanceAfter: newCreditsBalance.toString(),
        })
        .returning();

      return {
        success: true,
        approved: true,
        requiresManualApproval: false,
        message: `Payment approved! Charged ${creditsNeeded} credits ($${amount})`,
        transactionId: transaction.id,
        remainingCredits: newCreditsBalance,
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
