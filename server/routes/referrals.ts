import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";

interface ReferralData {
  userId: string;
  referralCode: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  monthlyEarnings: number;
  conversionRate: number;
  createdAt: Date;
}

interface ReferralActivity {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUser: string;
  date: string;
  status: 'pending' | 'active' | 'completed';
  earnings: number;
  activity: string;
  transactionId?: string;
}

// In-memory storage (in production, use proper database)
const referralData: Map<string, ReferralData> = new Map();
const referralActivities: ReferralActivity[] = [];

// Commission rates
const REFERRAL_COMMISSION_RATE = 0.01; // 1%
const TIER_BONUSES = {
  bronze: 0.005,  // Additional 0.5% for 10+ referrals
  silver: 0.01,   // Additional 1% for 25+ referrals  
  gold: 0.015,    // Additional 1.5% for 50+ referrals
  platinum: 0.02  // Additional 2% for 100+ referrals
};

export function setupReferralRoutes(app: Express) {
  
  // Get referral statistics for authenticated user
  app.get("/api/referrals/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get or create referral data
      let userReferralData = referralData.get(userId);
      if (!userReferralData) {
        userReferralData = {
          userId,
          referralCode: generateReferralCode(userId),
          totalReferrals: 0,
          activeReferrals: 0,
          totalEarnings: 0,
          pendingEarnings: 0,
          monthlyEarnings: 0,
          conversionRate: 0,
          createdAt: new Date()
        };
        referralData.set(userId, userReferralData);
      }

      // Calculate current month earnings
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyActivities = referralActivities.filter(activity => 
        activity.referrerId === userId && 
        new Date(activity.date) >= monthStart &&
        activity.status === 'completed'
      );
      
      userReferralData.monthlyEarnings = monthlyActivities.reduce((sum, activity) => 
        sum + activity.earnings, 0
      );

      // Calculate conversion rate
      const totalClicks = userReferralData.totalReferrals + 100; // Simulate clicks
      userReferralData.conversionRate = userReferralData.totalReferrals / totalClicks;

      const response = {
        ...userReferralData,
        referralLink: `https://coinrailz.com/signup?ref=${userReferralData.referralCode}`,
        tier: calculateTier(userReferralData.totalReferrals),
        nextTierRequirement: getNextTierRequirement(userReferralData.totalReferrals)
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ error: "Failed to fetch referral statistics" });
    }
  });

  // Get referral activity for authenticated user
  app.get("/api/referrals/activity", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userActivities = referralActivities
        .filter(activity => activity.referrerId === userId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50); // Latest 50 activities

      res.json(userActivities);
    } catch (error) {
      console.error("Error fetching referral activity:", error);
      res.status(500).json({ error: "Failed to fetch referral activity" });
    }
  });

  // Process referral signup (called when someone signs up with a referral code)
  app.post("/api/referrals/signup", async (req, res) => {
    try {
      const { referralCode, newUserId, newUserEmail } = req.body;
      
      if (!referralCode || !newUserId) {
        return res.status(400).json({ error: "Missing referral code or user ID" });
      }

      // Find referrer
      const referrerEntry = Array.from(referralData.entries()).find(
        ([_, data]) => data.referralCode === referralCode
      );

      if (!referrerEntry) {
        return res.status(404).json({ error: "Invalid referral code" });
      }

      const [referrerId, referrerData] = referrerEntry;

      // Create referral activity
      const activity: ReferralActivity = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        referrerId,
        referredUserId: newUserId,
        referredUser: newUserEmail || `User ${newUserId.slice(-6)}`,
        date: new Date().toISOString(),
        status: 'pending',
        earnings: 0,
        activity: 'Signed up via referral link'
      };

      referralActivities.push(activity);

      // Update referrer stats
      referrerData.totalReferrals += 1;
      referrerData.activeReferrals += 1;

      res.json({ 
        success: true, 
        message: "Referral recorded successfully",
        activityId: activity.id
      });
    } catch (error) {
      console.error("Error processing referral signup:", error);
      res.status(500).json({ error: "Failed to process referral signup" });
    }
  });

  // Process referral commission (called when referred user makes a transaction)
  app.post("/api/referrals/commission", isAuthenticated, async (req, res) => {
    try {
      const { referredUserId, transactionAmount, transactionId } = req.body;
      
      if (!referredUserId || !transactionAmount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find the referral activity
      const activity = referralActivities.find(act => 
        act.referredUserId === referredUserId && act.status === 'pending'
      );

      if (!activity) {
        return res.status(404).json({ error: "No pending referral found for user" });
      }

      // Calculate commission
      const baseCommission = transactionAmount * REFERRAL_COMMISSION_RATE;
      const referrerData = referralData.get(activity.referrerId);
      
      if (!referrerData) {
        return res.status(404).json({ error: "Referrer data not found" });
      }

      // Apply tier bonus
      const tier = calculateTier(referrerData.totalReferrals);
      const tierBonus = TIER_BONUSES[tier as keyof typeof TIER_BONUSES] || 0;
      const totalCommission = baseCommission + (transactionAmount * tierBonus);

      // Update activity
      activity.status = 'completed';
      activity.earnings = totalCommission;
      activity.activity = 'First transaction completed';
      activity.transactionId = transactionId;

      // Update referrer earnings
      referrerData.totalEarnings += totalCommission;
      referrerData.pendingEarnings -= totalCommission; // Remove from pending if it was there

      // Add commission tracking activity
      const commissionActivity: ReferralActivity = {
        id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        referrerId: activity.referrerId,
        referredUserId,
        referredUser: activity.referredUser,
        date: new Date().toISOString(),
        status: 'completed',
        earnings: totalCommission,
        activity: `Commission earned from transaction`,
        transactionId
      };

      referralActivities.push(commissionActivity);

      res.json({ 
        success: true, 
        commission: totalCommission,
        tier,
        message: "Commission processed successfully"
      });
    } catch (error) {
      console.error("Error processing referral commission:", error);
      res.status(500).json({ error: "Failed to process commission" });
    }
  });

  // Get referral leaderboard (public endpoint)
  app.get("/api/referrals/leaderboard", async (req, res) => {
    try {
      const leaderboard = Array.from(referralData.values())
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 100) // Top 100
        .map((data, index) => ({
          rank: index + 1,
          referralCode: data.referralCode,
          totalReferrals: data.totalReferrals,
          totalEarnings: data.totalEarnings,
          tier: calculateTier(data.totalReferrals),
          // Don't expose user IDs or personal info
        }));

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get referral program info (public endpoint)
  app.get("/api/referrals/program-info", async (req, res) => {
    try {
      const programInfo = {
        baseCommissionRate: REFERRAL_COMMISSION_RATE,
        tierBonuses: TIER_BONUSES,
        tiers: {
          bronze: { requirement: 10, bonus: "0.5%" },
          silver: { requirement: 25, bonus: "1.0%" },
          gold: { requirement: 50, bonus: "1.5%" },
          platinum: { requirement: 100, bonus: "2.0%" }
        },
        features: [
          "Lifetime commissions on all transactions",
          "Tier-based bonus rates",
          "Real-time tracking",
          "Monthly payouts",
          "Social sharing tools"
        ]
      };

      res.json(programInfo);
    } catch (error) {
      console.error("Error fetching program info:", error);
      res.status(500).json({ error: "Failed to fetch program information" });
    }
  });
}

// Helper functions
function generateReferralCode(userId: string): string {
  return `CR${userId.slice(-6).toUpperCase()}`;
}

function calculateTier(totalReferrals: number): string {
  if (totalReferrals >= 100) return 'platinum';
  if (totalReferrals >= 50) return 'gold';
  if (totalReferrals >= 25) return 'silver';
  if (totalReferrals >= 10) return 'bronze';
  return 'starter';
}

function getNextTierRequirement(totalReferrals: number): { tier: string; required: number; remaining: number } | null {
  if (totalReferrals < 10) {
    return { tier: 'bronze', required: 10, remaining: 10 - totalReferrals };
  }
  if (totalReferrals < 25) {
    return { tier: 'silver', required: 25, remaining: 25 - totalReferrals };
  }
  if (totalReferrals < 50) {
    return { tier: 'gold', required: 50, remaining: 50 - totalReferrals };
  }
  if (totalReferrals < 100) {
    return { tier: 'platinum', required: 100, remaining: 100 - totalReferrals };
  }
  return null; // Already at highest tier
}