/**
 * Payment Processing Routes - Simplified
 */

import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { PaymentCore } from "./paymentCore";
import { z } from "zod";

// Simple validation schemas
const sendMoneySchema = z.object({
  recipientEmail: z.string().email(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  message: z.string().optional()
});

const cryptoTradeSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  tradeType: z.enum(['buy', 'sell'])
});

export function registerPaymentRoutes(app: Express) {

  // Send money (P2P transfer)
  app.post('/api/payments/send', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const validatedData = sendMoneySchema.parse(req.body);
      
      // Process payment with 1% fee
      const paymentResult = await PaymentCore.processPayment({
        userId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        method: 'stripe',
        description: `P2P transfer to ${validatedData.recipientEmail}`
      });

      if (!paymentResult.success) {
        return res.status(400).json({ success: false, error: paymentResult.error });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        toEmail: validatedData.recipientEmail,
        amount: validatedData.amount.toString(),
        currency: validatedData.currency,
        message: validatedData.message || '',
        transactionType: 'send',
        platformFee: paymentResult.platformFee.toString(),
        status: 'completed'
      });

      res.json({
        success: true,
        transactionId: transaction.id,
        platformFee: paymentResult.platformFee,
        message: 'Transfer completed successfully'
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Transfer failed' });
    }
  });

  // Buy/sell crypto
  app.post('/api/payments/crypto-trade', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const validatedData = cryptoTradeSchema.parse(req.body);
      
      // Process crypto trade with 0.5% fee
      const fee = Math.round(validatedData.amount * 0.005 * 100) / 100;
      
      const paymentResult = await PaymentCore.processPayment({
        userId,
        amount: validatedData.amount,
        currency: validatedData.fromCurrency,
        method: 'crypto',
        description: `${validatedData.tradeType} ${validatedData.toCurrency}`
      });

      if (!paymentResult.success) {
        return res.status(400).json({ success: false, error: paymentResult.error });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        fromUserId: userId,
        amount: validatedData.amount.toString(),
        currency: validatedData.fromCurrency,
        transactionType: validatedData.tradeType === 'buy' ? 'buy_crypto' : 'sell_crypto',
        platformFee: fee.toString(),
        status: 'completed'
      });

      res.json({
        success: true,
        transactionId: transaction.id,
        platformFee: fee,
        message: `${validatedData.tradeType} order completed`
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Crypto trade failed' });
    }
  });

  // Get transaction history
  app.get('/api/payments/history', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const transactions = await storage.getUserTransactions(userId);
      
      res.json({
        success: true,
        transactions: transactions.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.transactionType,
          status: tx.status,
          platformFee: tx.platformFee,
          createdAt: tx.createdAt
        }))
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
  });

  // Get wallet balances
  app.get('/api/payments/balances', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const balances = await storage.getUserWalletBalances(userId);
      
      res.json({
        success: true,
        balances: balances || []
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch balances' });
    }
  });

  // Calculate fees for any amount
  app.post('/api/payments/calculate-fee', async (req, res) => {
    try {
      const { amount, type } = req.body;
      
      let feeRate = 0.01; // Default 1%
      if (type === 'crypto') feeRate = 0.005; // 0.5% for crypto
      
      const fee = PaymentCore.calculateFee(amount);
      
      res.json({
        success: true,
        amount,
        fee,
        feeRate: feeRate * 100,
        total: amount + fee
      });

    } catch (error) {
      res.status(500).json({ success: false, error: 'Fee calculation failed' });
    }
  });
}