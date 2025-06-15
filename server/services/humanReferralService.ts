/**
 * Human User Referral Service
 * Manages referral links, tracking, and commission payments for human users
 */

import { db } from "../db";
import { users, transactions, humanToHumanReferrals } from "../../shared/schema";
import { eq, and, desc, sql, sum } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface HumanReferralCommission {
  referrerId: string;
  referredUserId: string;
  transactionId: number;
  transactionAmount: string;
  commissionAmount: string;
  currency: string;
  isFirstTransaction: boolean;
}

export class HumanReferralService {
  private static readonly COMMISSION_RATES = {
    firstTransaction: 0.05, // 5% for first qualifying transaction
    ongoingTransaction: 0.02, // 2% for subsequent transactions
    minimumTransaction: 10, // $10 minimum to qualify
    maximumCommission: 50, // $50 max per transaction
    minimumCommission: 1 // $1 minimum commission
  };

  /**
   * Generate or retrieve referral code for user
   */
  static async generateReferralCode(userId: string): Promise<string> {
    try {
      // Check if user already has referral code
      const [user] = await db
        .select({ referralCode: users.referralCode })
        .from(users)
        .where(eq(users.id, userId));

      if (user?.referralCode) {
        return user.referralCode;
      }

      // Generate new referral code
      const referralCode = `HUMAN_${nanoid(8).toUpperCase()}`;
      
      // Update user with referral code
      await db
        .update(users)
        .set({ 
          referralCode,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      return referralCode;
    } catch (error) {
      console.error("Error generating referral code:", error);
      throw new Error("Failed to generate referral code");
    }
  }

  /**
   * Generate referral link for user
   */
  static async generateReferralLink(userId: string, baseUrl: string = 'https://coinrailz.com'): Promise<string> {
    const referralCode = await this.generateReferralCode(userId);
    return `${baseUrl}/register?ref=${referralCode}`;
  }

  /**
   * Process referral registration when new user signs up with referral code
   */
  static async processReferralRegistration(
    referralCode: string, 
    newUserId: string
  ): Promise<{ success: boolean; message: string; referrerId?: string }> {
    try {
      // Find referring user by referral code
      const [referrer] = await db
        .select({ 
          id: users.id, 
          email: users.email,
          firstName: users.firstName,
          totalReferrals: users.totalReferrals 
        })
        .from(users)
        .where(eq(users.referralCode, referralCode));

      if (!referrer) {
        return { success: false, message: "Invalid referral code" };
      }

      // Update new user with referral information
      await db
        .update(users)
        .set({
          referredBy: referrer.id,
          referralSource: "human",
          updatedAt: new Date()
        })
        .where(eq(users.id, newUserId));

      // Update referrer's total referrals count
      await db
        .update(users)
        .set({
          totalReferrals: (referrer.totalReferrals || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(users.id, referrer.id));

      return { 
        success: true, 
        message: `Successfully registered referral for ${referrer.firstName || referrer.email}`,
        referrerId: referrer.id
      };
    } catch (error) {
      console.error("Error processing referral registration:", error);
      return { success: false, message: "Failed to process referral registration" };
    }
  }

  /**
   * Calculate and process referral commission when referred user makes a transaction
   */
  static async processReferralCommission(
    transactionData: HumanReferralCommission
  ): Promise<{ success: boolean; commissionAmount?: string; message: string }> {
    try {
      const { referredUserId, transactionId, transactionAmount, currency } = transactionData;

      // Get referral information
      const [referredUser] = await db
        .select({ 
          referredBy: users.referredBy,
          hasCompletedQualifyingTransaction: users.hasCompletedQualifyingTransaction
        })
        .from(users)
        .where(eq(users.id, referredUserId));

      if (!referredUser?.referredBy) {
        return { success: false, message: "User was not referred by anyone" };
      }

      const transactionAmountNum = parseFloat(transactionAmount);
      
      // Check if transaction qualifies for commission
      if (transactionAmountNum < this.COMMISSION_RATES.minimumTransaction) {
        return { 
          success: false, 
          message: `Transaction amount $${transactionAmount} below minimum $${this.COMMISSION_RATES.minimumTransaction}` 
        };
      }

      // Determine commission rate
      const isFirstTransaction = !referredUser.hasCompletedQualifyingTransaction;
      const commissionRate = isFirstTransaction 
        ? this.COMMISSION_RATES.firstTransaction 
        : this.COMMISSION_RATES.ongoingTransaction;

      // Calculate commission amount
      let commissionAmount = transactionAmountNum * commissionRate;
      
      // Apply limits
      commissionAmount = Math.min(commissionAmount, this.COMMISSION_RATES.maximumCommission);
      commissionAmount = Math.max(commissionAmount, this.COMMISSION_RATES.minimumCommission);

      // Record commission in database
      await db.insert(humanToHumanReferrals).values({
        referrerUserId: referredUser.referredBy,
        referredUserId: referredUserId,
        transactionId: transactionId,
        transactionAmount: transactionAmount,
        commissionAmount: commissionAmount.toFixed(2),
        currency: currency,
        isQualifyingTransaction: true,
        isFirstTransaction: isFirstTransaction,
        payoutStatus: "pending",
        createdAt: new Date()
      });

      // Update referred user's qualifying transaction status
      if (isFirstTransaction) {
        await db
          .update(users)
          .set({
            hasCompletedQualifyingTransaction: true,
            updatedAt: new Date()
          })
          .where(eq(users.id, referredUserId));
      }

      // Add commission to referrer's balance
      const [referrer] = await db
        .select({ referralBonus: users.referralBonus })
        .from(users)
        .where(eq(users.id, referredUser.referredBy));

      const currentBonus = parseFloat(referrer?.referralBonus || "0");
      const newBonus = currentBonus + commissionAmount;

      await db
        .update(users)
        .set({
          referralBonus: newBonus.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(users.id, referredUser.referredBy));

      return {
        success: true,
        commissionAmount: commissionAmount.toFixed(2),
        message: `Commission of $${commissionAmount.toFixed(2)} processed successfully`
      };
    } catch (error) {
      console.error("Error processing referral commission:", error);
      return { success: false, message: "Failed to process referral commission" };
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    totalCommissions: string;
    pendingCommissions: string;
    referralCode: string;
    referralLink: string;
    recentReferrals: Array<{
      referredUserId: string;
      referredUserEmail: string;
      commissionAmount: string;
      transactionAmount: string;
      isFirstTransaction: boolean;
      createdAt: Date;
    }>;
  }> {
    try {
      // Get user info and referral code
      const [user] = await db
        .select({
          totalReferrals: users.totalReferrals,
          referralBonus: users.referralBonus,
          referralCode: users.referralCode
        })
        .from(users)
        .where(eq(users.id, userId));

      // Generate referral code if doesn't exist
      const referralCode = user?.referralCode || await this.generateReferralCode(userId);
      const referralLink = await this.generateReferralLink(userId);

      // Get total commissions from humanToHumanReferrals table
      const [totalCommissionsResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${humanToHumanReferrals.commissionAmount}::numeric), 0)`
        })
        .from(humanToHumanReferrals)
        .where(eq(humanToHumanReferrals.referrerUserId, userId));

      // Get recent referral activity
      const recentReferrals = await db
        .select({
          referredUserId: humanToHumanReferrals.referredUserId,
          commissionAmount: humanToHumanReferrals.commissionAmount,
          transactionAmount: humanToHumanReferrals.transactionAmount,
          isFirstTransaction: humanToHumanReferrals.isFirstTransaction,
          createdAt: humanToHumanReferrals.createdAt,
          referredUserEmail: users.email
        })
        .from(humanToHumanReferrals)
        .leftJoin(users, eq(humanToHumanReferrals.referredUserId, users.id))
        .where(eq(humanToHumanReferrals.referrerUserId, userId))
        .orderBy(desc(humanToHumanReferrals.createdAt))
        .limit(10);

      return {
        totalReferrals: user?.totalReferrals || 0,
        totalCommissions: totalCommissionsResult?.total || "0.00",
        pendingCommissions: user?.referralBonus || "0.00",
        referralCode,
        referralLink,
        recentReferrals: recentReferrals.map(r => ({
          referredUserId: r.referredUserId,
          referredUserEmail: r.referredUserEmail || "Unknown",
          commissionAmount: r.commissionAmount,
          transactionAmount: r.transactionAmount,
          isFirstTransaction: r.isFirstTransaction,
          createdAt: r.createdAt || new Date()
        }))
      };
    } catch (error) {
      console.error("Error getting referral stats:", error);
      throw new Error("Failed to get referral statistics");
    }
  }

  /**
   * Withdraw referral commissions to user's balance
   */
  static async withdrawCommissions(
    userId: string,
    withdrawAmount: string
  ): Promise<{ success: boolean; message: string; newBalance?: string }> {
    try {
      const withdrawAmountNum = parseFloat(withdrawAmount);

      // Get current referral bonus
      const [user] = await db
        .select({ 
          referralBonus: users.referralBonus,
          usdBalance: users.usdBalance
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: false, message: "User not found" };
      }

      const currentBonus = parseFloat(user.referralBonus || "0");
      const currentBalance = parseFloat(user.usdBalance || "0");

      if (withdrawAmountNum > currentBonus) {
        return { 
          success: false, 
          message: `Insufficient referral balance. Available: $${currentBonus.toFixed(2)}` 
        };
      }

      if (withdrawAmountNum < 5) {
        return { 
          success: false, 
          message: "Minimum withdrawal amount is $5.00" 
        };
      }

      // Process withdrawal
      const newBonus = currentBonus - withdrawAmountNum;
      const newBalance = currentBalance + withdrawAmountNum;

      await db
        .update(users)
        .set({
          referralBonus: newBonus.toFixed(2),
          usdBalance: newBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Record withdrawal transaction
      await db.insert(transactions).values({
        fromUserId: "system",
        toUserId: userId,
        amount: withdrawAmountNum.toFixed(2),
        currency: "USD",
        transactionType: "referral_withdrawal",
        status: "completed",
        message: "Referral commission withdrawal",
        platformFee: "0.00",
        createdAt: new Date()
      });

      return {
        success: true,
        message: `Successfully withdrew $${withdrawAmountNum.toFixed(2)} to your balance`,
        newBalance: newBalance.toFixed(2)
      };
    } catch (error) {
      console.error("Error withdrawing commissions:", error);
      return { success: false, message: "Failed to process withdrawal" };
    }
  }
}