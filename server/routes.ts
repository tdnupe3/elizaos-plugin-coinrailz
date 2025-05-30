import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { complianceService } from "./services/complianceService";
import { referralService } from "./services/referralService";
import { EncryptionUtils } from "./utils/encryption";
import { sendMoneySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Send money route
  app.post('/api/send-money', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = sendMoneySchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentBalance = parseFloat(currentUser.usdBalance || "0");
      const transferAmount = parseFloat(validatedData.amount);
      const fee = transferAmount * 0.01; // 1% fee
      const totalCost = transferAmount + fee;

      // Check if user has sufficient balance
      if (currentBalance < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Check if recipient exists
      const recipient = await storage.getUserByEmail(validatedData.toEmail);
      
      // Create transaction
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        toUserId: recipient?.id || null,
        toEmail: validatedData.toEmail,
        amount: validatedData.amount,
        message: validatedData.message,
        transactionType: "send",
        status: "completed",
      });

      // Update sender balance
      const newSenderBalance = (currentBalance - totalCost).toFixed(2);
      await storage.updateUserBalance(userId, newSenderBalance);

      // Check if this is the user's first transaction and complete any pending referrals
      const userTransactions = await storage.getUserTransactions(userId, 1);
      if (userTransactions.length === 1) { // This is their first transaction
        await referralService.processFirstTransaction(userId);
      }

      // Update recipient balance if they exist
      if (recipient) {
        const recipientBalance = parseFloat(recipient.usdBalance || "0");
        const newRecipientBalance = (recipientBalance + transferAmount).toFixed(2);
        await storage.updateUserBalance(recipient.id, newRecipientBalance);

        // Create receive transaction for recipient
        await storage.createTransaction({
          fromUserId: userId,
          toUserId: recipient.id,
          toEmail: validatedData.toEmail,
          amount: validatedData.amount,
          message: validatedData.message,
          transactionType: "receive",
          status: "completed",
        });
      }

      res.json({ 
        success: true, 
        transaction,
        message: "Payment sent successfully" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error sending money:", error);
      res.status(500).json({ message: "Failed to send payment" });
    }
  });

  // Transaction listing
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const transactions = await storage.getUserTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Crypto holdings
  app.get('/api/crypto/holdings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getUserCryptoHoldings(userId);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching crypto holdings:", error);
      res.status(500).json({ message: "Failed to fetch crypto holdings" });
    }
  });

  // Referral system routes
  app.get('/api/referrals/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await referralService.getUserReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  app.post('/api/referrals/generate-code', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referralCode = referralService.generateReferralCode();
      
      // Update user with new referral code
      await storage.upsertUser({
        id: userId,
        referralCode: referralCode
      });
      
      res.json({ referralCode });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  app.post('/api/referrals/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code is required" });
      }
      
      await referralService.processReferral(userId, referralCode);
      res.json({ success: true, message: "Referral applied successfully" });
    } catch (error) {
      console.error("Error applying referral:", error);
      res.status(500).json({ message: "Failed to apply referral" });
    }
  });

  // Crypto prices (mock data for now)
  app.get('/api/crypto/prices', async (req, res) => {
    try {
      // Mock crypto prices - replace with real API when credentials are available
      const prices = {
        BTC: { price: 43250, change: 2.5 },
        ETH: { price: 2580, change: -1.2 },
        ADA: { price: 0.48, change: 3.1 },
        DOT: { price: 7.25, change: -0.8 }
      };
      res.json(prices);
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}