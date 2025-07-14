import { circleService } from './circleService';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

class UserCircleService {
  // Create Circle wallet for new user
  async createUserCircleWallet(userId: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB' = 'ETH') {
    try {
      // First check if user already has a Circle wallet
      const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (existingUser.length === 0) {
        throw new Error('User not found');
      }

      const user = existingUser[0];
      
      // If user already has a Circle wallet, return existing details
      if (user.circleWalletId && user.circleWalletSetId) {
        return {
          success: true,
          walletId: user.circleWalletId,
          walletSetId: user.circleWalletSetId,
          address: user.circleWalletAddress,
          blockchain: user.circleBlockchain,
          existing: true
        };
      }

      // Create new wallet set if user doesn't have one
      let walletSetId = user.circleWalletSetId;
      if (!walletSetId) {
        const walletSet = await circleService.createWalletSet(`${user.firstName || 'User'} ${user.lastName || userId} Wallet Set`);
        if (!walletSet || !walletSet.id) {
          throw new Error('Failed to create wallet set');
        }
        walletSetId = walletSet.id;
      }

      // Create wallet in the wallet set
      const wallet = await circleService.createWallet(walletSetId, blockchain);
      if (!wallet || !wallet.id) {
        throw new Error('Failed to create wallet');
      }

      // Update user record with Circle wallet details
      await db.update(users)
        .set({
          circleWalletId: wallet.id,
          circleWalletSetId: walletSetId,
          circleWalletAddress: wallet.address,
          circleBlockchain: blockchain,
          circleWalletState: wallet.state,
          circleAccountType: wallet.accountType,
          usdcBalance: '0.00000000'
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        walletId: wallet.id,
        walletSetId: walletSetId,
        address: wallet.address,
        blockchain: blockchain,
        state: wallet.state,
        existing: false
      };

    } catch (error) {
      console.error('Error creating user Circle wallet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get user's Circle wallet balance
  async getUserUSDCBalance(userId: string) {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletId) {
        return {
          success: false,
          error: 'User does not have a Circle wallet'
        };
      }

      // Get live balance from Circle API
      const balances = await circleService.getWalletBalance(user.circleWalletId);
      
      if (!balances || !Array.isArray(balances)) {
        return {
          success: false,
          error: 'Failed to fetch balance from Circle'
        };
      }

      // Find USDC balance (default to 0 if not found)
      const usdcBalance = balances.find(b => b.tokenId === 'USDC')?.amount || '0.00000000';
      await db.update(users)
        .set({ usdcBalance })
        .where(eq(users.id, userId));

      return {
        success: true,
        balance: usdcBalance,
        walletId: user.circleWalletId,
        address: user.circleWalletAddress
      };

    } catch (error) {
      console.error('Error getting user USDC balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get all user's Circle wallets (multi-chain support)
  async getUserCircleWallets(userId: string) {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletSetId) {
        return {
          success: false,
          error: 'User does not have a Circle wallet set'
        };
      }

      // Get all wallets in the user's wallet set
      const wallets = await circleService.listWallets(user.circleWalletSetId);
      
      if (!wallets || !Array.isArray(wallets)) {
        return {
          success: false,
          error: 'Failed to fetch wallets from Circle'
        };
      }

      return {
        success: true,
        wallets: wallets,
        walletSetId: user.circleWalletSetId
      };

    } catch (error) {
      console.error('Error getting user Circle wallets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Create additional wallet for different blockchain
  async createAdditionalWallet(userId: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB' | 'BNB') {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletSetId) {
        throw new Error('User does not have a Circle wallet set');
      }

      // Create wallet in the existing wallet set
      const walletResponse = await circleService.createWallet(user.circleWalletSetId, blockchain);
      if (!walletResponse.success) {
        throw new Error('Failed to create additional wallet');
      }

      return {
        success: true,
        wallet: walletResponse.wallet,
        walletSetId: user.circleWalletSetId
      };

    } catch (error) {
      console.error('Error creating additional wallet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Transfer USDC between user wallets or to external address
  async transferUSDC(userId: string, toAddress: string, amount: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB') {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletId) {
        throw new Error('User does not have a Circle wallet');
      }

      // Initiate transfer through Circle API
      const transferResponse = await circleService.createTransfer({
        sourceWalletId: user.circleWalletId,
        destinationAddress: toAddress,
        amount: amount,
        blockchain: blockchain
      });

      if (!transferResponse.success) {
        throw new Error('Failed to initiate transfer');
      }

      return {
        success: true,
        transfer: transferResponse.transfer,
        transactionId: transferResponse.transfer.id
      };

    } catch (error) {
      console.error('Error transferring USDC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get user's transaction history
  async getUserTransactionHistory(userId: string) {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletId) {
        return {
          success: false,
          error: 'User does not have a Circle wallet'
        };
      }

      // Get transaction history from Circle API
      const transactionsResponse = await circleService.getWalletTransactions(user.circleWalletId);
      
      if (!transactionsResponse.success) {
        return {
          success: false,
          error: 'Failed to fetch transaction history'
        };
      }

      return {
        success: true,
        transactions: transactionsResponse.transactions,
        walletId: user.circleWalletId
      };

    } catch (error) {
      console.error('Error getting user transaction history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const userCircleService = new UserCircleService();