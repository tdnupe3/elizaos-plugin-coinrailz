import { storage } from "../storage";
import { nanoid } from "nanoid";
import type { User, InsertReferral } from "@shared/schema";

export class ReferralService {
  async processReferral(refereeId: string, referralCode: string): Promise<void> {
    try {
      // Find the referrer by their referral code
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        throw new Error("Invalid referral code");
      }

      // Check if this user was already referred
      const existingReferral = await storage.getPendingReferralByReferee(refereeId);
      if (existingReferral) {
        throw new Error("User has already been referred");
      }

      // Create the referral record
      const referralData: InsertReferral = {
        referralCode: nanoid(10), // Generate unique referral code
        referrerId: referrer.id,
        refereeId: refereeId,
        status: 'pending',
        bonusAmount: '5.00', // $5 bonus as specified
      };

      await storage.createReferral(referralData);
      console.log(`Referral created: ${referrer.id} referred ${refereeId}`);
    } catch (error) {
      console.error("Failed to process referral:", error);
      throw error;
    }
  }

  async processFirstTransaction(userId: string): Promise<void> {
    try {
      // Check if user has any pending referrals as referee
      const pendingReferral = await storage.getPendingReferralByReferee(userId);
      if (!pendingReferral) {
        return; // No referral to process
      }

      // Update referral status to completed
      await storage.updateReferralStatus(pendingReferral.id, 'completed');

      // Add bonus to referrer's balance
      if (pendingReferral.referrerId && pendingReferral.bonusAmount) {
        await storage.addReferralBonus(pendingReferral.referrerId, parseFloat(pendingReferral.bonusAmount));
        
        // Increment referrer's referral count
        await storage.incrementUserReferralCount(pendingReferral.referrerId);
      }

      console.log(`Referral bonus paid: $${pendingReferral.bonusAmount} to user ${pendingReferral.referrerId}`);
    } catch (error) {
      console.error("Failed to process referral bonus:", error);
      throw error;
    }
  }

  generateReferralCode(): string {
    return nanoid(8).toUpperCase();
  }

  async getUserReferralStats(userId: string): Promise<{
    totalReferrals: number;
    pendingReferrals: number;
    totalEarnings: number;
    referrals: any[];
  }> {
    try {
      const referrals = await storage.getUserReferrals(userId);
      
      const totalReferrals = referrals.length;
      const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
      const totalEarnings = referrals
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.bonusAmount ? parseFloat(r.bonusAmount) : 0), 0);

      return {
        totalReferrals,
        pendingReferrals,
        totalEarnings,
        referrals: referrals.map(r => ({
          id: r.id,
          status: r.status || 'unknown',
          bonusAmount: r.bonusAmount || '0.00',
          createdAt: r.createdAt,
        }))
      };
    } catch (error) {
      console.error("Failed to get referral stats:", error);
      throw error;
    }
  }
}

export const referralService = new ReferralService();