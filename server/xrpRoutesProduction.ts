/**
 * Production XRP Routes
 * Comprehensive XRP functionality with secure wallet management
 */

import type { Express } from "express";
import { XRPLedgerService } from "./services/xrpLedgerService";
import { XRPPaymentService } from "./services/xrpPaymentService";
import { XRPEndpoints } from "./services/xrpEndpoints";
import { SecureWalletManager } from "./services/secureWalletManager";
import { isAuthenticated } from "./replitAuth";
import { authRateLimit } from "./middleware/authSecurity";
import { validateWithSchema, transactionSchema } from "./middleware/inputValidationEnhanced";
import { z } from 'zod';

// Validation schemas
const xrpTransferSchema = z.object({
  toAddress: z.string()
    .min(25, 'XRP address too short')
    .max(34, 'XRP address too long')
    .regex(/^r[0-9A-Za-z]{24,33}$/, 'Invalid XRP address format'),
  amount: z.number()
    .positive('Amount must be positive')
    .min(0.000001, 'Amount below minimum XRP precision')
    .max(100000, 'Amount exceeds maximum limit'),
  memo: z.string()
    .max(1000, 'Memo too long')
    .optional()
});

const walletAddressSchema = z.object({
  address: z.string()
    .regex(/^r[0-9A-Za-z]{24,33}$/, 'Invalid XRP address format')
});

export function registerXRPProductionRoutes(app: Express) {
  
  // Initialize XRP services
  app.get('/api/xrp/initialize', async (req, res) => {
    try {
      await XRPLedgerService.initialize();
      await SecureWalletManager.initializePlatformWallet();
      
      res.json({
        success: true,
        message: 'XRP services initialized successfully',
        network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'XRP initialization failed',
        message: error.message
      });
    }
  });

  // Get current XRP/USD exchange rate
  app.get('/api/xrp/rate', async (req, res) => {
    try {
      const rateData = await XRPEndpoints.getRate();
      res.json(rateData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch XRP rate',
        message: error.message
      });
    }
  });

  // Calculate XRP transaction fees
  app.post('/api/xrp/calculate-fees', validateWithSchema(z.object({
    amount: z.number().positive('Amount must be positive')
  })), async (req, res) => {
    try {
      const { amount } = req.body;
      const feeData = await XRPEndpoints.calculateFees(amount);
      res.json(feeData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Fee calculation failed',
        message: error.message
      });
    }
  });

  // Create new XRP wallet
  app.post('/api/xrp/create-wallet', isAuthenticated, authRateLimit, async (req, res) => {
    try {
      const walletData = await XRPEndpoints.createWallet();
      res.json(walletData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Wallet creation failed',
        message: error.message
      });
    }
  });

  // Get wallet balance
  app.post('/api/xrp/balance', validateWithSchema(walletAddressSchema), async (req, res) => {
    try {
      const { address } = req.body;
      const balanceData = await XRPEndpoints.getBalance(address);
      res.json(balanceData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Balance check failed',
        message: error.message
      });
    }
  });

  // Send XRP payment
  app.post('/api/xrp/send', 
    isAuthenticated, 
    authRateLimit, 
    validateWithSchema(xrpTransferSchema),
    async (req, res) => {
      try {
        const { toAddress, amount, memo } = req.body;
        const userId = (req.user as any)?.claims?.sub;

        // Get platform wallet for sending
        const platformWallet = await SecureWalletManager.getPlatformWallet();
        const platformSeed = SecureWalletManager.getDecryptedSeed(platformWallet.id);

        // Send XRP payment
        const result = await XRPPaymentService.sendXRP({
          toAddress,
          amount,
          memo: memo || `Payment from user ${userId}`,
          fromUserId: userId
        });

        res.json({
          success: true,
          transaction: result
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: 'XRP payment failed',
          message: error.message
        });
      }
    }
  );

  // Get transaction history
  app.post('/api/xrp/history', validateWithSchema(z.object({
    address: z.string().regex(/^r[0-9A-Za-z]{24,33}$/, 'Invalid XRP address'),
    limit: z.number().min(1).max(50).default(20)
  })), async (req, res) => {
    try {
      const { address, limit } = req.body;
      const historyData = await XRPEndpoints.getTransactionHistory(address, limit);
      res.json(historyData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Transaction history failed',
        message: error.message
      });
    }
  });

  // Cross-border payment processing
  app.post('/api/xrp/cross-border', 
    isAuthenticated,
    authRateLimit,
    validateWithSchema(z.object({
      fromCountry: z.string().min(2).max(3),
      toCountry: z.string().min(2).max(3),
      amount: z.number().positive(),
      currency: z.string().length(3),
      recipientAddress: z.string().regex(/^r[0-9A-Za-z]{24,33}$/),
      memo: z.string().max(500).optional()
    })),
    async (req, res) => {
      try {
        const paymentData = req.body;
        const result = await XRPPaymentService.processCrossBorderPayment(paymentData);
        
        res.json({
          success: result.success,
          crossBorderPayment: {
            amount: result.amount,
            fee: result.fee,
            exchangeRate: result.exchangeRate,
            estimatedArrival: '3-5 seconds',
            savings: result.success ? 'Up to 99% vs traditional banking' : undefined
          },
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: 'Cross-border payment failed',
          message: error.message
        });
      }
    }
  );

  // Currency conversion
  app.post('/api/xrp/convert', validateWithSchema(z.object({
    amount: z.number().positive(),
    from: z.enum(['XRP', 'USD']),
    to: z.enum(['XRP', 'USD'])
  })), async (req, res) => {
    try {
      const { amount, from, to } = req.body;
      const conversionData = await XRPEndpoints.convertCurrency(amount, from, to);
      res.json(conversionData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Currency conversion failed',
        message: error.message
      });
    }
  });

  // Create escrow transaction
  app.post('/api/xrp/create-escrow',
    isAuthenticated,
    authRateLimit,
    validateWithSchema(z.object({
      recipientAddress: z.string().regex(/^r[0-9A-Za-z]{24,33}$/),
      amount: z.number().positive(),
      releaseCondition: z.enum(['time', 'condition']).optional(),
      releaseValue: z.union([z.string(), z.date()]).optional()
    })),
    async (req, res) => {
      try {
        const { recipientAddress, amount, releaseCondition, releaseValue } = req.body;
        
        // Create escrow wallet
        const escrowWallet = await SecureWalletManager.createEscrowWallet(
          `escrow_${Date.now()}`
        );
        const escrowSeed = SecureWalletManager.getDecryptedSeed(escrowWallet.id);

        const result = await XRPPaymentService.createSecureEscrow(
          escrowSeed,
          recipientAddress,
          amount,
          releaseCondition,
          releaseValue
        );

        res.json({
          success: result.success,
          escrow: {
            escrowAddress: escrowWallet.address,
            escrowHash: result.escrowHash,
            amount,
            recipientAddress,
            releaseCondition
          },
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: 'Escrow creation failed',
          message: error.message
        });
      }
    }
  );

  // Validate XRP address
  app.post('/api/xrp/validate-address', validateWithSchema(z.object({
    address: z.string().min(1)
  })), async (req, res) => {
    try {
      const { address } = req.body;
      const validationData = await XRPEndpoints.validateAddress(address);
      res.json(validationData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Address validation failed',
        message: error.message
      });
    }
  });

  // Get XRP network status
  app.get('/api/xrp/network-status', async (req, res) => {
    try {
      const statusData = await XRPEndpoints.getNetworkStatus();
      res.json(statusData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Network status check failed',
        message: error.message
      });
    }
  });

  // Process referral payout (internal use)
  app.post('/api/xrp/referral-payout',
    isAuthenticated,
    authRateLimit,
    validateWithSchema(z.object({
      agentAddress: z.string().regex(/^r[0-9A-Za-z]{24,33}$/),
      rewardAmount: z.number().positive(),
      transactionId: z.string().min(1)
    })),
    async (req, res) => {
      try {
        const { agentAddress, rewardAmount, transactionId } = req.body;
        
        // Get platform wallet
        const platformWallet = await SecureWalletManager.getPlatformWallet();
        const platformSeed = SecureWalletManager.getDecryptedSeed(platformWallet.id);

        const result = await XRPPaymentService.processAgentReferralPayout(
          agentAddress,
          rewardAmount,
          transactionId,
          platformSeed
        );

        res.json({
          success: result.success,
          payout: {
            agentAddress,
            amount: result.amount,
            transactionHash: result.transactionHash,
            fee: result.fee
          },
          error: result.error
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: 'Referral payout failed',
          message: error.message
        });
      }
    }
  );

  // Get wallet security status (admin only)
  app.get('/api/xrp/wallet-security', isAuthenticated, async (req, res) => {
    try {
      const securityStatus = SecureWalletManager.getWalletSecurityStatus();
      res.json({
        success: true,
        security: securityStatus
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Security status check failed',
        message: error.message
      });
    }
  });
}