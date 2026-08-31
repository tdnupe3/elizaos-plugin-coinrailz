// P2P Platform Detection and Routing Service
// Cross-platform recipient detection and optimal routing

import { pncBankService } from "./pncBankService";
import { storage } from "../storage";
import { complianceService } from "./complianceService";
import { ISO20022Utils } from "@shared/iso20022";

interface RecipientInfo {
  email?: string;
  phoneNumber?: string;
  name?: string;
}

interface PlatformAvailability {
  platform: string;
  available: boolean;
  fee: number;
  estimatedTime: string;
  confidence: number;
}

interface TransferRequest {
  userId: string;
  recipient: RecipientInfo;
  amount: number;
  selectedPlatform?: string;
  message?: string;
  securityPin: string;
}

export class P2PPlatformService {
  
  async detectAvailablePlatforms(recipient: RecipientInfo): Promise<PlatformAvailability[]> {
    const platforms: PlatformAvailability[] = [];

    // Zelle detection (via PNC Bank)
    if (recipient.email || recipient.phoneNumber) {
      try {
        const zelleAvailable = await pncBankService.validateZelleRecipient(
          recipient.email || '',
          recipient.phoneNumber
        );
        platforms.push({
          platform: 'Zelle',
          available: zelleAvailable,
          fee: 0.01, // 1% fee
          estimatedTime: 'Instant',
          confidence: zelleAvailable ? 95 : 0,
        });
      } catch (error) {
        platforms.push({
          platform: 'Zelle',
          available: false,
          fee: 5.0,
          estimatedTime: 'Instant',
          confidence: 0,
        });
      }
    }

    // PayPal/Venmo detection
    if (recipient.email) {
      const paypalAvailable = await this.checkPayPalAvailability(recipient.email);
      platforms.push({
        platform: 'PayPal',
        available: paypalAvailable,
        fee: 0.01, // 1% fee
        estimatedTime: 'Instant',
        confidence: paypalAvailable ? 85 : 0,
      });
    }

    // Cash App detection (phone number based)
    if (recipient.phoneNumber) {
      const cashAppAvailable = await this.checkCashAppAvailability(recipient.phoneNumber);
      platforms.push({
        platform: 'Cash App',
        available: cashAppAvailable,
        fee: 0.01, // 1% fee
        estimatedTime: '1-3 minutes',
        confidence: cashAppAvailable ? 75 : 0,
      });
    }

    // Internal Coin Railz user detection
    if (recipient.email) {
      const internalUser = await storage.getUserByEmail(recipient.email);
      platforms.push({
        platform: 'Coin Railz',
        available: !!internalUser,
        fee: 0, // Free for internal transfers
        estimatedTime: 'Instant',
        confidence: !!internalUser ? 100 : 0,
      });
    }

    // Sort by confidence and fee
    return platforms.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.fee - b.fee;
    });
  }

  private async checkPayPalAvailability(email: string): Promise<boolean> {
    if (!process.env.PAYPAL_CLIENT_ID) {
      return false; // No credentials available
    }

    try {
      // Basic email validation for PayPal
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return false;
      }

      // For now, assume PayPal is available for valid emails
      // In production, this would call PayPal's recipient verification API
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkCashAppAvailability(phoneNumber: string): Promise<boolean> {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return false; // No credentials available
    }

    try {
      // This would integrate with Square's Cash App API
      // For now, return false until you provide Square credentials
      return false;
    } catch (error) {
      return false;
    }
  }

  async initiateTransfer(request: TransferRequest): Promise<any> {
    const messageId = ISO20022Utils.generateMessageId();

    // Verify user and balance
    const user = await storage.getUser(request.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentBalance = parseFloat(user.usdBalance || '0');
    const totalCost = this.calculateTotalCost(request.amount, request.selectedPlatform || 'Coin Railz');

    if (currentBalance < totalCost) {
      throw new Error('Insufficient balance for transfer');
    }

    // Compliance check
    const complianceResult = await complianceService.performAMLCheck({
      userId: request.userId,
      transactionAmount: request.amount,
      transactionType: 'fiat',
      counterpartyInfo: request.recipient,
    });

    if (complianceResult.blockedTransaction) {
      throw new Error('Transaction blocked due to compliance requirements');
    }

    // Detect best platform if not specified
    let selectedPlatform = request.selectedPlatform;
    if (!selectedPlatform) {
      const availablePlatforms = await this.detectAvailablePlatforms(request.recipient);
      const bestPlatform = availablePlatforms.find(p => p.available);
      selectedPlatform = bestPlatform?.platform || 'Coin Railz';
    }

    // Route to appropriate service
    let result;
    switch (selectedPlatform) {
      case 'Zelle':
        result = await this.processZelleTransfer(request, messageId);
        break;
      case 'PayPal':
        result = await this.processPayPalTransfer(request, messageId);
        break;
      case 'Cash App':
        result = await this.processCashAppTransfer(request, messageId);
        break;
      case 'Coin Railz':
      default:
        result = await this.processInternalTransfer(request, messageId);
        break;
    }

    // Update user balance
    const newBalance = (currentBalance - totalCost).toFixed(2);
    await storage.updateUserBalance(request.userId, Number(newBalance), 'USD');

    // Create transaction record
    await storage.createTransaction({
      fromUserId: request.userId,
      toEmail: request.recipient.email || '',
      amount: request.amount.toString(),
      currency: 'USD',
      message: request.message,
      status: result.status || 'pending',
      transactionType: 'send',
    });

    return {
      ...result,
      platform: selectedPlatform,
      totalCost,
      newBalance,
      messageId,
    };
  }

  private calculateTotalCost(amount: number, platform: string): number {
    switch (platform) {
      case 'Coin Railz':
        return amount; // Free internal transfers
      default:
        return amount + (amount * 0.01); // 1% fee for all external platforms
    }
  }

  private async processZelleTransfer(request: TransferRequest, messageId: string): Promise<any> {
    try {
      const zelleRequest = {
        fromAccountId: process.env.PNC_ACCOUNT_ID || 'DEMO_ACCOUNT',
        toEmail: request.recipient.email || '',
        toPhoneNumber: request.recipient.phoneNumber,
        amount: request.amount,
        currency: 'USD',
        memo: request.message,
        requestId: messageId,
      };

      const result = await pncBankService.initiateZelleTransfer(zelleRequest);
      return {
        status: 'pending',
        transactionId: result.originalGroupInformationAndStatus?.originalMessageId,
        estimatedCompletion: 'Instant',
      };
    } catch (error) {
      console.error('Zelle transfer failed:', error);
      return {
        status: 'failed',
        error: 'Zelle transfer service unavailable. Please provide PNC Bank API credentials.',
      };
    }
  }

  private async processPayPalTransfer(request: TransferRequest, messageId: string): Promise<any> {
    try {
      const { paypalService } = await import('./paypalService');
      
      // Create actual PayPal payout
      const payout = await paypalService.createPayout({
        recipientEmail: request.recipient.email || '',
        amount: request.amount,
        currency: "USD",
        note: request.message || "Payment from Coin Railz",
        senderItemId: messageId
      });

      return {
        status: 'pending',
        transactionId: messageId,
        estimatedCompletion: '1-3 minutes',
        paypalBatchId: payout.batch_header.payout_batch_id,
        paypalStatus: payout.batch_header.batch_status
      };
    } catch (error) {
      console.error('PayPal transfer error:', error);
      return {
        status: 'failed',
        error: 'PayPal transfer failed. Please try again.',
      };
    }
  }

  private async processCashAppTransfer(request: TransferRequest, messageId: string): Promise<any> {
    try {
      // Cash App integration would go here
      throw new Error('Square/Cash App credentials not configured');
    } catch (error) {
      return {
        status: 'failed',
        error: 'Cash App service unavailable. Please provide Square API credentials.',
      };
    }
  }

  private async processInternalTransfer(request: TransferRequest, messageId: string): Promise<any> {
    const recipientUser = await storage.getUserByEmail(request.recipient.email || '');
    
    if (!recipientUser) {
      return {
        status: 'failed',
        error: 'Recipient not found in Coin Railz system',
      };
    }

    // Update recipient balance
    const recipientBalance = parseFloat(recipientUser.usdBalance || '0') + request.amount;
    await storage.updateUserBalance(recipientUser.id, Number(recipientBalance.toFixed(2)), 'USD');

    // Create recipient transaction record
    await storage.createTransaction({
      fromUserId: request.userId,
      toUserId: recipientUser.id,
      toEmail: request.recipient.email || '',
      amount: request.amount.toString(),
      currency: 'USD',
      message: request.message,
      status: 'completed',
      transactionType: 'receive',
    });

    return {
      status: 'completed',
      transactionId: messageId,
      estimatedCompletion: 'Instant',
      recipientName: `${recipientUser.firstName} ${recipientUser.lastName}`,
    };
  }

  async getTransactionStatus(transactionId: string): Promise<any> {
    const transaction = await storage.getTransactionById(parseInt(transactionId));
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return {
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      createdAt: transaction.createdAt,
      message: transaction.message,
    };
  }
}

export const p2pPlatformService = new P2PPlatformService();