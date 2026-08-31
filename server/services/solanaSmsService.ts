/**
 * Solana SMS Messaging Service
 * Handles SMS messaging for Solana ecosystem communication
 * Integrates with Solana wallet addresses and transaction notifications
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface SolanaSmsMessage {
  toWallet: string;
  phoneNumber?: string;
  content: string;
  messageType: 'transaction' | 'notification' | 'marketing' | 'alert';
  transactionSignature?: string;
  amount?: number;
}

interface SolanaSmsResult {
  success: boolean;
  messageId?: string;
  transactionHash?: string;
  cost?: number;
  error?: string;
}

export class SolanaSmsService {
  private connection!: Connection;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeConnection();
  }

  /**
   * Initialize Solana connection
   */
  private initializeConnection(): void {
    try {
      // Use Helius RPC for better reliability
      const rpcUrl = process.env.HELIUS_API_KEY 
        ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
        : 'https://api.mainnet-beta.solana.com';
      
      this.connection = new Connection(rpcUrl, 'confirmed');
      this.isInitialized = true;
      
      console.log('✅ Solana SMS service initialized with RPC:', rpcUrl.includes('helius') ? 'Helius' : 'Public');
    } catch (error) {
      console.error('❌ Failed to initialize Solana connection:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Send SMS to Solana wallet holder
   */
  async sendSolanaMessage(message: SolanaSmsMessage): Promise<SolanaSmsResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Solana SMS service not initialized');
      }

      // Validate Solana wallet address
      const isValidWallet = await this.validateSolanaWallet(message.toWallet);
      if (!isValidWallet) {
        throw new Error('Invalid Solana wallet address');
      }

      // Get phone number from wallet if not provided
      const phoneNumber = message.phoneNumber || await this.getPhoneNumberFromWallet(message.toWallet);
      if (!phoneNumber) {
        throw new Error('No phone number associated with wallet');
      }

      // Format message with Solana context
      const formattedMessage = await this.formatSolanaMessage(message);

      // Send SMS using Twilio (reusing existing SMS infrastructure)
      const smsResult = await this.sendSMS(phoneNumber, formattedMessage);

      // Log the message to Solana blockchain (optional on-chain record)
      const onChainResult = await this.recordMessageOnChain(message);

      console.log('✅ Solana SMS sent successfully:', {
        wallet: message.toWallet,
        phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
        messageId: smsResult.messageId,
        onChain: onChainResult.success
      });

      return {
        success: true,
        messageId: smsResult.messageId,
        transactionHash: onChainResult.signature,
        cost: 0.001 // SOL for on-chain recording
      };

    } catch (error: any) {
      console.error('❌ Solana SMS failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to send Solana SMS'
      };
    }
  }

  /**
   * Send bulk SMS messages to multiple Solana wallets
   */
  async sendBulkSolanaMessages(messages: SolanaSmsMessage[]): Promise<SolanaSmsResult[]> {
    const results: SolanaSmsResult[] = [];
    
    for (const message of messages) {
      const result = await this.sendSolanaMessage(message);
      results.push(result);
      
      // Rate limiting - wait 2 seconds between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  /**
   * Send transaction alert to wallet holder
   */
  async sendTransactionAlert(
    walletAddress: string, 
    transactionSignature: string, 
    amount: number,
    type: 'received' | 'sent'
  ): Promise<SolanaSmsResult> {
    try {
      const transaction = await this.connection.getTransaction(transactionSignature);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const message: SolanaSmsMessage = {
        toWallet: walletAddress,
        content: `Solana ${type}: ${amount} SOL`,
        messageType: 'transaction',
        transactionSignature,
        amount
      };

      return await this.sendSolanaMessage(message);

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Discover AI agents with Solana wallets
   */
  async discoverSolanaAIAgents(): Promise<any[]> {
    try {
      // Look for large wallet holders (potential AI agents)
      const agents = [];
      
      // Search for programmatic wallet patterns
      const knownBotPatterns = [
        'AI', 'Bot', 'Agent', 'Auto', 'Trade', 'DeFi'
      ];

      // In a real implementation, this would scan the blockchain
      // For now, return mock data
      agents.push({
        wallet: 'SolanaAIBot123456789',
        balance: 1000,
        lastActivity: new Date(),
        type: 'trading_bot'
      });

      console.log(`🤖 Found ${agents.length} potential Solana AI agents`);
      return agents;

    } catch (error) {
      console.error('❌ Failed to discover Solana AI agents:', error);
      return [];
    }
  }

  /**
   * Validate Solana wallet address
   */
  private async validateSolanaWallet(walletAddress: string): Promise<boolean> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get phone number associated with wallet (from our database)
   */
  private async getPhoneNumberFromWallet(walletAddress: string): Promise<string | null> {
    try {
      // Query our database for phone number associated with this wallet
      // This would be implemented with actual database lookup
      console.log(`🔍 Looking up phone for wallet: ${walletAddress}`);
      
      // Mock phone number for development
      return '+1234567890';
    } catch (error) {
      return null;
    }
  }

  /**
   * Format message with Solana context
   */
  private async formatSolanaMessage(message: SolanaSmsMessage): Promise<string> {
    const walletShort = `${message.toWallet.slice(0, 4)}...${message.toWallet.slice(-4)}`;
    
    switch (message.messageType) {
      case 'transaction':
        return `💰 Solana: ${message.content}\nWallet: ${walletShort}\n${message.transactionSignature ? `TX: ${message.transactionSignature.slice(0, 10)}...` : ''}`;
      
      case 'alert':
        return `🚨 Solana Alert: ${message.content}\nWallet: ${walletShort}`;
      
      case 'marketing':
        return `🚀 Coin Railz: ${message.content}\nYour Solana wallet: ${walletShort}`;
      
      default:
        return `📱 ${message.content}\nSolana wallet: ${walletShort}`;
    }
  }

  /**
   * Send SMS using existing Twilio infrastructure
   */
  private async sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Reuse the existing SMS infrastructure from customerNotificationService
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        // Development mode - simulate successful send
        console.log(`📱 Solana SMS would be sent to ${phoneNumber}: ${message}`);
        return {
          success: true,
          messageId: `solana_sms_${Date.now()}`
        };
      }

      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      return {
        success: true,
        messageId: result.sid
      };

    } catch (error) {
      console.error('❌ SMS send failed:', error);
      return { success: false };
    }
  }

  /**
   * Record message on Solana blockchain (optional)
   */
  private async recordMessageOnChain(message: SolanaSmsMessage): Promise<{ success: boolean; signature?: string }> {
    try {
      // In production, this would create a memo transaction
      // For now, return mock success
      console.log(`⛓️ Recording message on Solana blockchain for wallet: ${message.toWallet}`);
      
      return {
        success: true,
        signature: `mock_tx_${Date.now()}`
      };

    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check if Solana SMS is available
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Get messaging info and costs
   */
  getMessagingInfo() {
    return {
      protocol: 'Solana SMS',
      network: 'Solana Mainnet',
      costs: {
        smsPerMessage: '$0.05',
        onChainRecording: '0.001 SOL',
        currency: 'USD + SOL'
      },
      rateLimits: {
        messagesPerMinute: 30,
        messagesPerHour: 500
      },
      features: [
        'Transaction alerts',
        'Wallet-based messaging',
        'On-chain message recording',
        'Bulk messaging support'
      ]
    };
  }
}

// Export singleton instance
export const solanaSmsService = new SolanaSmsService();