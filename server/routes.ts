import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendMoneySchema, buyCryptoSchema, sellCryptoSchema, depositFundsSchema, withdrawFundsSchema } from "@shared/schema";
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

  // Balance routes
  app.get('/api/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ usdBalance: user.usdBalance });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Transaction routes
  app.post('/api/transactions/send', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = sendMoneySchema.parse(req.body);
      
      // Get sender
      const sender = await storage.getUser(userId);
      if (!sender) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check balance
      const currentBalance = parseFloat(sender.usdBalance || "0");
      const transferAmount = parseFloat(validatedData.amount);
      
      if (currentBalance < transferAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Validate security PIN (simplified - in real app would hash and compare)
      if (sender.securityPin && sender.securityPin !== validatedData.securityPin) {
        return res.status(400).json({ message: "Invalid security PIN" });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(validatedData.toEmail);
      
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
      const newSenderBalance = (currentBalance - transferAmount).toFixed(2);
      await storage.updateUserBalance(userId, newSenderBalance);

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

  // Crypto routes
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

  app.post('/api/crypto/buy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = buyCryptoSchema.parse(req.body);
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const purchaseAmount = parseFloat(validatedData.amount);
      const pricePerCoin = parseFloat(validatedData.pricePerCoin);
      const totalCost = purchaseAmount * pricePerCoin;

      // Check balance
      const currentBalance = parseFloat(user.usdBalance || "0");
      if (currentBalance < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Check if user already has this crypto
      const existingHoldings = await storage.getUserCryptoHoldings(userId);
      const existingHolding = existingHoldings.find(h => h.coinSymbol === validatedData.coinSymbol);

      if (existingHolding) {
        // Update existing holding
        const currentAmount = parseFloat(existingHolding.amount);
        const newAmount = (currentAmount + purchaseAmount).toString();
        await storage.updateCryptoHolding(userId, validatedData.coinSymbol, newAmount);
      } else {
        // Create new holding
        await storage.createCryptoHolding({
          userId,
          coinSymbol: validatedData.coinSymbol,
          coinName: validatedData.coinName,
          amount: validatedData.amount,
          averageBuyPrice: validatedData.pricePerCoin,
        });
      }

      // Create crypto transaction
      await storage.createCryptoTransaction({
        userId,
        coinSymbol: validatedData.coinSymbol,
        transactionType: "buy",
        amount: validatedData.amount,
        pricePerCoin: validatedData.pricePerCoin,
        totalValue: totalCost.toString(),
        status: "completed",
      });

      // Update user balance
      const newBalance = (currentBalance - totalCost).toFixed(2);
      await storage.updateUserBalance(userId, newBalance);

      res.json({ 
        success: true, 
        message: "Crypto purchase successful" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error buying crypto:", error);
      res.status(500).json({ message: "Failed to purchase crypto" });
    }
  });

  app.get('/api/crypto/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const transactions = await storage.getUserCryptoTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching crypto transactions:", error);
      res.status(500).json({ message: "Failed to fetch crypto transactions" });
    }
  });

  // Sell crypto endpoint
  app.post('/api/crypto/sell', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = sellCryptoSchema.parse(req.body);
      
      // Get user and their crypto holdings
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const holdings = await storage.getUserCryptoHoldings(userId);
      const holding = holdings.find(h => h.coinSymbol === validatedData.coinSymbol);
      
      if (!holding) {
        return res.status(400).json({ message: "You don't own this cryptocurrency" });
      }

      const sellAmount = parseFloat(validatedData.amount);
      const currentAmount = parseFloat(holding.amount);
      
      if (currentAmount < sellAmount) {
        return res.status(400).json({ message: "Insufficient crypto balance" });
      }

      const pricePerCoin = parseFloat(validatedData.pricePerCoin);
      const totalValue = sellAmount * pricePerCoin;

      // Update crypto holding
      const newAmount = (currentAmount - sellAmount).toString();
      if (parseFloat(newAmount) > 0) {
        await storage.updateCryptoHolding(userId, validatedData.coinSymbol, newAmount);
      } else {
        // Remove holding if amount becomes 0 (would need to implement this in storage)
        await storage.updateCryptoHolding(userId, validatedData.coinSymbol, "0");
      }

      // Create crypto transaction
      await storage.createCryptoTransaction({
        userId,
        coinSymbol: validatedData.coinSymbol,
        transactionType: "sell",
        amount: validatedData.amount,
        pricePerCoin: validatedData.pricePerCoin,
        totalValue: totalValue.toString(),
        status: "completed",
      });

      // Update user USD balance
      const currentBalance = parseFloat(user.usdBalance || "0");
      const newBalance = (currentBalance + totalValue).toFixed(2);
      await storage.updateUserBalance(userId, newBalance);

      res.json({ 
        success: true, 
        message: "Crypto sold successfully",
        usdReceived: totalValue.toFixed(2)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error selling crypto:", error);
      res.status(500).json({ message: "Failed to sell crypto" });
    }
  });

  // Deposit funds endpoint
  app.post('/api/funds/deposit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = depositFundsSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const depositAmount = parseFloat(validatedData.amount);
      
      // Create deposit transaction
      await storage.createTransaction({
        fromUserId: null,
        toUserId: userId,
        toEmail: user.email || "",
        amount: validatedData.amount,
        message: `Deposit via ${validatedData.paymentMethod.replace('_', ' ')}`,
        transactionType: "deposit",
        status: "completed",
      });

      // Update user balance
      const currentBalance = parseFloat(user.usdBalance || "0");
      const newBalance = (currentBalance + depositAmount).toFixed(2);
      await storage.updateUserBalance(userId, newBalance);

      res.json({ 
        success: true, 
        message: "Funds deposited successfully",
        newBalance: newBalance
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error depositing funds:", error);
      res.status(500).json({ message: "Failed to deposit funds" });
    }
  });

  // Withdraw funds endpoint
  app.post('/api/funds/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = withdrawFundsSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const withdrawAmount = parseFloat(validatedData.amount);
      const currentBalance = parseFloat(user.usdBalance || "0");
      
      if (currentBalance < withdrawAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Validate security PIN
      if (user.securityPin && user.securityPin !== validatedData.securityPin) {
        return res.status(400).json({ message: "Invalid security PIN" });
      }

      // Create withdrawal transaction
      await storage.createTransaction({
        fromUserId: userId,
        toUserId: null,
        toEmail: validatedData.bankAccount,
        amount: validatedData.amount,
        message: "Withdrawal to bank account",
        transactionType: "withdrawal",
        status: "completed",
      });

      // Update user balance
      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      await storage.updateUserBalance(userId, newBalance);

      res.json({ 
        success: true, 
        message: "Withdrawal processed successfully",
        newBalance: newBalance
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error withdrawing funds:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Mock crypto prices endpoint (in real app would fetch from external API)
  app.get('/api/crypto/prices', (req, res) => {
    res.json({
      BTC: { price: 45000, change: 5.2 },
      ETH: { price: 3200, change: -2.1 },
      ADA: { price: 0.85, change: 1.8 },
      DOT: { price: 25.30, change: 3.4 },
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
