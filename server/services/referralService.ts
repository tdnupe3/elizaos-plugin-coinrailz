import { nanoid } from "nanoid";
import { storage } from "../storage";
import type { InsertReferral } from "@shared/schema";

export class ReferralService {
  // Generate a unique referral code for a user
  generateReferralCode(): string {
    return nanoid(8).toUpperCase();
  }

  // Create a referral when someone signs up with a code
  async processReferral(refereeId: string, referralCode: string): Promise<boolean> {
    try {
      // Find the referrer by their referral code
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return false;
      }

      // Don't allow self-referral
      if (referrer.id === refereeId) {
        return false;
      }

      // Create the referral record
      const referral: InsertReferral = {
        referrerId: referrer.id,
        refereeId: refereeId,
        referralCode: referralCode,
        status: "pending",
        bonusAmount: "15.00",
      };

      await storage.createReferral(referral);
      
      // Update referrer's total referral count
      await storage.incrementUserReferralCount(referrer.id);

      return true;
    } catch (error) {
      console.error("Error processing referral:", error);
      return false;
    }
  }

  // Complete a referral and pay bonuses when referee makes first transaction
  async completeReferral(refereeId: string): Promise<void> {
    try {
      const pendingReferral = await storage.getPendingReferralByReferee(refereeId);
      if (!pendingReferral) {
        return;
      }

      const bonusAmount = parseFloat(pendingReferral.bonusAmount || "15.00");

      // Pay bonus to both referrer and referee
      if (pendingReferral.referrerId) {
        await storage.addReferralBonus(pendingReferral.referrerId, bonusAmount);
      }
      if (pendingReferral.refereeId) {
        await storage.addReferralBonus(pendingReferral.refereeId, bonusAmount);
      }

      // Update referral status
      await storage.updateReferralStatus(pendingReferral.id, "completed");

      console.log(`Referral bonus paid: $${bonusAmount} each to ${pendingReferral.referrerId} and ${pendingReferral.refereeId}`);
    } catch (error) {
      console.error("Error completing referral:", error);
    }
  }

  // Get referral statistics for a user
  async getReferralStats(userId: string) {
    try {
      const user = await storage.getUser(userId);
      const referrals = await storage.getUserReferrals(userId);
      const completedReferrals = referrals.filter((r: any) => r.status === "completed");
      
      return {
        referralCode: user?.referralCode,
        totalReferrals: user?.totalReferrals || 0,
        completedReferrals: completedReferrals.length,
        totalEarned: parseFloat(user?.referralBonus || "0"),
        pendingReferrals: referrals.filter((r: any) => r.status === "pending").length,
        recentReferrals: referrals.slice(0, 5)
      };
    } catch (error) {
      console.error("Error getting referral stats:", error);
      return null;
    }
  }
}

export const referralService = new ReferralService();