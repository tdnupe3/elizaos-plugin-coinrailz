import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { websocketService } from "./services/websocketService";
import { env, hasStripeCredentials } from "./environment";
import { loggingService } from "./services/loggingService";
import { complianceService } from "./services/complianceService";
import { referralService } from "./services/referralService";
import { FeeCalculator } from "./utils/feeCalculator";
import { ValidationUtils } from "./utils/validation";
import { TransactionMonitor } from "./utils/transactionMonitor";
import { 
  sendMoneySchema, 
  buyCryptoSchema, 
  sellCryptoSchema,
  walletDepositSchema,
  walletWithdrawSchema
} from "@shared/schema";
import { z } from "zod";
import { pncBankService } from './services/pncBankService';
import { dexAggregatorService } from './services/dexAggregatorService';
import { solanaService } from './services/solanaService';

export async function registerRoutes(app: Express): Promise<Server> {
  // API logging temporarily disabled due to database constraint issues
  // TODO: Fix database schema for api_integration_logs table

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

  // Digital Wallet Routes
  app.get('/api/wallet/balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balances = await storage.getUserWalletBalances(userId);

      // If user has no wallet balances, create default USD wallet
      if (balances.length === 0) {
        await storage.createWalletBalance({
          userId,
          currency: 'USD',
          balance: '0.00000000',
          availableBalance: '0.00000000',
          frozenBalance: '0.00000000'
        });
        const newBalances = await storage.getUserWalletBalances(userId);
        return res.json(newBalances);
      }

      res.json(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
      res.status(500).json({ message: "Failed to fetch wallet balances" });
    }
  });

  app.post('/api/wallet/deposit', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = walletDepositSchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Get or create wallet for currency
      let wallet = await storage.getWalletBalance(userId, validatedData.currency);
      if (!wallet) {
        wallet = await storage.createWalletBalance({
          userId,
          currency: validatedData.currency,
          balance: '0.00000000',
          availableBalance: '0.00000000',
          frozenBalance: '0.00000000'
        });
      }

      // Create funding transaction
      const fundingTransaction = await storage.createFundingTransaction({
        userId,
        walletId: wallet.id,
        type: 'deposit',
        method: validatedData.method,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'pending',
        bankAccount: validatedData.bankAccount || null,
        platformFee: '0.00',
        metadata: { requestedAt: new Date().toISOString() }
      });

      // For demonstration: simulate immediate completion for small amounts
      const amount = parseFloat(validatedData.amount);
      if (amount <= 1000) {
        await storage.updateFundingTransactionStatus(fundingTransaction.id, 'completed');
        await storage.updateWalletBalance(userId, validatedData.currency, validatedData.amount, 'add');
      }

      res.json({ 
        message: 'Deposit initiated successfully',
        transactionId: fundingTransaction.id,
        status: amount <= 1000 ? 'completed' : 'pending'
      });
    } catch (error) {
      console.error("Error processing deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = walletWithdrawSchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Check wallet balance
      const wallet = await storage.getWalletBalance(userId, validatedData.currency);
      if (!wallet) {
        return res.status(400).json({ message: 'Wallet not found for this currency' });
      }

      const requestedAmount = parseFloat(validatedData.amount);
      const availableBalance = parseFloat(wallet.availableBalance);

      if (requestedAmount > availableBalance) {
        return res.status(400).json({ message: 'Insufficient funds' });
      }

      // Freeze funds during withdrawal processing
      await storage.freezeWalletFunds(userId, validatedData.currency, validatedData.amount);

      // Create withdrawal transaction
      const fundingTransaction = await storage.createFundingTransaction({
        userId,
        walletId: wallet.id,
        type: 'withdrawal',
        method: 'bank_transfer',
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'processing',
        bankAccount: validatedData.bankAccount,
        platformFee: '2.50', // Standard withdrawal fee
        metadata: { requestedAt: new Date().toISOString() }
      });

      res.json({ 
        message: 'Withdrawal initiated successfully',
        transactionId: fundingTransaction.id,
        estimatedTime: '1-3 business days'
      });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;

      const fundingTransactions = await storage.getUserFundingTransactions(userId, limit);
      const regularTransactions = await storage.getUserTransactions(userId, limit);

      // Combine and sort transactions by date
      const allTransactions = [
        ...fundingTransactions.map(t => ({ ...t, category: 'funding' })),
        ...regularTransactions.map(t => ({ ...t, category: 'transfer' }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(allTransactions.slice(0, limit));
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Send money route
  app.post('/api/send-money', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = sendMoneySchema.parse(req.body);
      const userId = req.user.claims.sub;

      // Check if user is blocked
      const isBlocked = await TransactionMonitor.isUserBlocked(userId);
      if (isBlocked) {
        return res.status(403).json({ message: 'Account temporarily restricted. Please contact support.' });
      }

      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate and sanitize amounts
      const transferAmount = ValidationUtils.validateAmount(validatedData.amount);

      // Assess transaction risk
      const riskAssessment = await TransactionMonitor.assessTransactionRisk(
        userId, 
        transferAmount, 
        validatedData.toEmail
      );

      if (riskAssessment.riskLevel === 'blocked') {
        return res.status(403).json({ 
          message: riskAssessment.blockedReason || 'Transaction blocked by security screening' 
        });
      }

      const feeCalculation = FeeCalculator.calculateSendMoneyFee(transferAmount);
      const totalCost = transferAmount + feeCalculation.fee;

      // Validate balance operation
      const balanceCheck = ValidationUtils.validateBalanceOperation(
        currentUser.usdBalance, 
        totalCost, 
        'debit'
      );

      if (!balanceCheck.isValid) {
        return res.status(400).json({ message: balanceCheck.error || "Insufficient balance" });
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

      // Update sender balance using validated calculation
      await storage.updateUserBalance(userId, balanceCheck.newBalance.toFixed(2));

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
        message: "Payment sent successfully",
        fee: feeCalculation.fee,
        riskLevel: riskAssessment.riskLevel
      });
    } catch (error) {
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

  // Fee calculation endpoints
  app.post('/api/calculate-fee', async (req: any, res) => {
    try {
      const { amount, type } = req.body;
      const numAmount = parseFloat(amount);

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      let feeCalculation;
      switch (type) {
        case 'send_money':
          feeCalculation = FeeCalculator.calculateSendMoneyFee(numAmount);
          break;
        case 'buy_crypto':
          feeCalculation = FeeCalculator.calculateCryptoFee(numAmount, 'buy');
          break;
        case 'sell_crypto':
          feeCalculation = FeeCalculator.calculateCryptoFee(numAmount, 'sell');
          break;
        case 'swap_crypto':
          feeCalculation = FeeCalculator.calculateSwapFee(numAmount);
          break;
        case 'deposit':
          feeCalculation = FeeCalculator.calculateDepositFee(numAmount);
          break;
        case 'withdraw':
          feeCalculation = FeeCalculator.calculateWithdrawFee(numAmount);
          break;
        default:
          return res.status(400).json({ message: "Invalid transaction type" });
      }

      res.json({
        amount: numAmount,
        fee: feeCalculation.fee,
        total: numAmount + feeCalculation.fee,
        breakdown: feeCalculation.breakdown
      });
    } catch (error) {
      console.error("Error calculating fee:", error);
      res.status(500).json({ message: "Failed to calculate fee" });
    }
  });

  // System monitoring and health endpoints
  app.get('/api/system/health', async (req, res) => {
    try {
      const health = await loggingService.getSystemHealth();
      res.json(health);
    } catch (error) {
      await loggingService.log('ERROR', 'Health check failed', { error: error.message });
      res.status(500).json({ status: 'unhealthy', error: 'Health check failed' });
    }
  });

  app.get('/api/system/logs', isAuthenticated, async (req: any, res) => {
    try {
      const { level, count = 100 } = req.query;
      const logs = level 
        ? loggingService.getLogsByLevel(level as any, parseInt(count))
        : loggingService.getRecentLogs(parseInt(count));

      res.json({ logs });
    } catch (error) {
      await loggingService.log('ERROR', 'Failed to retrieve logs', { error: error.message });
      res.status(500).json({ message: 'Failed to retrieve logs' });
    }
  });

  app.get('/api/system/metrics', isAuthenticated, async (req, res) => {
    try {
      const metrics = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      };

      res.json(metrics);
    } catch (error) {
      await loggingService.log('ERROR', 'Failed to retrieve metrics', { error: error.message });
      res.status(500).json({ message: 'Failed to retrieve metrics' });
    }
  });

  const httpServer = createServer(app);

  // Initialize WebSocket service
  websocketService.initialize(httpServer);

  return httpServer;
}