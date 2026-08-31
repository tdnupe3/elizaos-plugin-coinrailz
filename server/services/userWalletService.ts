/**
 * User Wallet Service - XRP Wallet Management
 * Handles user wallet connections, balance tracking, and transaction verification
 */

import { storage } from '../storage';
import { XRPServiceSimple } from './xrpServiceSimple';
import { XRPLedgerService } from './xrpLedgerService';

interface WalletConnectionResult {
  success: boolean;
  message?: string;
  walletInfo?: {
    address: string;
    balance: number;
    isValid: boolean;
  };
}

interface UserWalletInfo {
  address: string;
  balance: number;
  isConnected: boolean;
  lastUpdated: string;
}

export class UserWalletService {
  /**
   * Connect user's XRP wallet to their account
   */
  static async connectXRPWallet(userId: string, walletAddress: string): Promise<WalletConnectionResult> {
    try {
      // Validate XRP address format
      if (!this.isValidXRPAddress(walletAddress)) {
        return {
          success: false,
          message: 'Invalid XRP wallet address format'
        };
      }

      // Check if wallet exists and get balance
      const balance = await XRPLedgerService.getBalance(walletAddress);

      // Update user record with wallet address
      await storage.updateUserWallet(userId, 'xrp', walletAddress);
      
      // Create or update wallet balance record
      await storage.updateWalletBalance(userId, 'XRP', balance.toString(), 'set');

      return {
        success: true,
        message: 'XRP wallet connected successfully',
        walletInfo: {
          address: walletAddress,
          balance,
          isValid: true
        }
      };
    } catch (error) {
      console.error('Error connecting XRP wallet:', error);
      return {
        success: false,
        message: 'Failed to connect wallet. Please try again.'
      };
    }
  }

  /**
   * Disconnect user's XRP wallet
   */
  static async disconnectXRPWallet(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await storage.updateUserWallet(userId, 'xrp', null);
      
      return {
        success: true,
        message: 'XRP wallet disconnected successfully'
      };
    } catch (error) {
      console.error('Error disconnecting XRP wallet:', error);
      return {
        success: false,
        message: 'Failed to disconnect wallet'
      };
    }
  }

  /**
   * Get user's XRP wallet information
   */
  static async getUserXRPWallet(userId: string): Promise<UserWalletInfo | null> {
    try {
      const user = await storage.getUser(userId);
      
      if (!user?.xrpWallet) {
        return null;
      }

      // Get current balance from XRP Ledger
      const balance = await XRPLedgerService.getBalance(user.xrpWallet);
      
      return {
        address: user.xrpWallet,
        balance,
        isConnected: true,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting user XRP wallet:', error);
      return null;
    }
  }

  /**
   * Refresh user's XRP wallet balance
   */
  static async refreshXRPBalance(userId: string): Promise<{ success: boolean; balance?: number; message?: string }> {
    try {
      const user = await storage.getUser(userId);
      
      if (!user?.xrpWallet) {
        return {
          success: false,
          message: 'No XRP wallet connected'
        };
      }

      const balance = await XRPLedgerService.getBalance(user.xrpWallet);

      // Update balance in database
      await storage.updateWalletBalance(userId, 'XRP', balance.toString(), 'set');

      return {
        success: true,
        balance,
        message: 'Balance updated successfully'
      };
    } catch (error) {
      console.error('Error refreshing XRP balance:', error);
      return {
        success: false,
        message: 'Failed to refresh balance'
      };
    }
  }

  /**
   * Validate XRP address format
   */
  private static isValidXRPAddress(address: string): boolean {
    // XRP addresses start with 'r' and are typically 25-34 characters
    if (!address || !address.startsWith('r')) {
      return false;
    }

    if (address.length < 25 || address.length > 34) {
      return false;
    }

    // Basic character validation (alphanumeric + some special chars)
    const validChars = /^[rA-Za-z0-9]+$/;
    return validChars.test(address);
  }

  /**
   * Check if user has sufficient XRP balance for transaction
   */
  static async checkSufficientBalance(userId: string, requiredAmount: number): Promise<{ sufficient: boolean; currentBalance: number; message?: string }> {
    try {
      const walletInfo = await this.getUserXRPWallet(userId);
      
      if (!walletInfo) {
        return {
          sufficient: false,
          currentBalance: 0,
          message: 'No XRP wallet connected'
        };
      }

      // Account for 20 XRP reserve requirement
      const availableBalance = Math.max(0, walletInfo.balance - 20);
      const sufficient = availableBalance >= requiredAmount;

      return {
        sufficient,
        currentBalance: walletInfo.balance,
        message: sufficient ? undefined : `Insufficient balance. Available: ${availableBalance.toFixed(6)} XRP`
      };
    } catch (error) {
      console.error('Error checking XRP balance:', error);
      return {
        sufficient: false,
        currentBalance: 0,
        message: 'Failed to check balance'
      };
    }
  }

  /**
   * Verify XRP transaction on ledger
   */
  static async verifyTransaction(transactionHash: string): Promise<{ verified: boolean; transaction?: any; message?: string }> {
    try {
      const txInfo = await XRPLedgerService.getTransactionInfo(transactionHash);
      if (!txInfo) {
        return {
          verified: false,
          message: 'Transaction not found on XRP Ledger'
        };
      }

      return {
        verified: true,
        transaction: txInfo,
        message: 'Transaction verified successfully'
      };
    } catch (error) {
      console.error('Error verifying XRP transaction:', error);
      return {
        verified: false,
        message: 'Failed to verify transaction'
      };
    }
  }
}