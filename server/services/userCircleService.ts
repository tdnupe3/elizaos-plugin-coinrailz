import { CircleService } from './circleService';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

class UserCircleService {
  private readonly circleService = new CircleService();
  // Create Circle wallet for new user
  async createUserCircleWallet(userId: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB' | 'BASE' = 'ETH') {
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
      const circleService = new CircleService();
      let walletSetId = user.circleWalletSetId;
      if (!walletSetId) {
        const walletSetResult = await this.circleService.createWalletSet({ name: `${user.firstName || 'User'} ${user.lastName || userId} Wallet Set` });
        if (!walletSetResult?.success || !walletSetResult?.data) {
          throw new Error(`Failed to create wallet set: ${walletSetResult?.message || 'Unknown error from Circle API'}`);
        }
        walletSetId = walletSetResult.data?.walletSetId || walletSetResult.data?.id;
        if (!walletSetId) {
          throw new Error('Failed to extract wallet set ID from Circle API response');
        }
      }

      // Create wallet in the wallet set
      const walletResult = await this.circleService.createWallet({ walletSetId, blockchain });
      if (!walletResult?.success || !walletResult?.data) {
        throw new Error(`Failed to create wallet: ${walletResult?.message || 'Unknown error from Circle API'}`);
      }
      const walletData = walletResult.data;
      const walletId = walletData?.walletId || walletData?.wallet?.id;
      const walletAddress = walletData?.address || walletData?.wallet?.address;
      const walletState = walletData?.state || walletData?.wallet?.state;
      const walletAccountType = walletData?.accountType || walletData?.wallet?.accountType;
      if (!walletId) {
        throw new Error('Failed to extract wallet ID from Circle API response');
      }

      // Update user record with Circle wallet details
      await db.update(users)
        .set({
          circleWalletId: walletId,
          circleWalletSetId: walletSetId,
          circleWalletAddress: walletAddress,
          circleBlockchain: blockchain,
          circleWalletState: walletState,
          circleAccountType: walletAccountType,
          usdcBalance: '0.00000000'
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        walletId,
        walletSetId,
        address: walletAddress,
        blockchain,
        state: walletState,
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
      const balanceResponse = await this.circleService.getWalletBalance(user.circleWalletId);
      const balances = balanceResponse.balances;
      
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
      const wallets = await this.circleService.listWallets();
      
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
  async createAdditionalWallet(userId: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB' | 'BASE' | 'BNB') {
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
      const walletResponse = await this.circleService.createWallet({ walletSetId: user.circleWalletSetId, blockchain });
      if (!walletResponse.success) {
        throw new Error('Failed to create additional wallet');
      }

      return {
        success: true,
        wallet: walletResponse.data?.wallet,
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

      const transferAmount = parseFloat(amount);

      // Check KYC/AML compliance for larger transactions
      const { circleKYCService } = await import('./circleKYCService');
      const transactionPermission = await circleKYCService.checkTransactionPermission(userId, transferAmount);
      
      if (!transactionPermission.allowed) {
        throw new Error(transactionPermission.reason || 'Transaction not permitted');
      }

      // Initiate transfer through Circle API
      const transferResponse = await this.circleService.createTransfer({
        walletId: user.circleWalletId,
        destinationAddress: toAddress,
        amount: amount,
        currency: 'USDC'
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
      const transactionsResponse = await this.circleService.listTransactions({ walletId: user.circleWalletId });

      return {
        success: true,
        transactions: transactionsResponse.data?.transactions ?? transactionsResponse.data ?? [],
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

  // Execute DEX swap using Circle USDC wallet
  async executeCircleWalletSwap(userId: string, toToken: string, amount: string, slippage: number, chainId: number) {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult[0];
      
      if (!user.circleWalletId || !user.circleWalletAddress) {
        throw new Error('User does not have a Circle wallet');
      }

      const swapAmount = parseFloat(amount);

      // Check KYC/AML compliance for larger transactions
      const { circleKYCService } = await import('./circleKYCService');
      const transactionPermission = await circleKYCService.checkTransactionPermission(userId, swapAmount);
      
      if (!transactionPermission.allowed) {
        throw new Error(transactionPermission.reason || 'Transaction not permitted');
      }

      // Check USDC balance first
      const balanceResponse = await this.getUserUSDCBalance(userId);
      if (!balanceResponse.success) {
        throw new Error('Failed to check USDC balance');
      }

      const currentBalance = parseFloat(balanceResponse.balance || '0');

      if (currentBalance < swapAmount) {
        throw new Error(`Insufficient USDC balance. Available: ${currentBalance}, Required: ${swapAmount}`);
      }

      // Map chainId to blockchain
      const blockchainMap: { [key: number]: string } = {
        1: 'ETH',
        137: 'MATIC',
        43114: 'AVAX',
        42161: 'ARB',
        8453: 'BASE',
        56: 'BNB'
      };

      const blockchain = blockchainMap[chainId];
      if (!blockchain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      // For now, simulate the swap (in production, integrate with actual DEX)
      // This would involve:
      // 1. Approve USDC spending to DEX contract
      // 2. Execute swap through Circle wallet
      // 3. Update user balance
      
      const mockSwapResult = {
        transactionId: `circle-swap-${Date.now()}`,
        fromAmount: amount,
        fromToken: 'USDC',
        toToken: toToken,
        toAmount: (swapAmount * 2400).toString(), // Mock ETH price
        blockchain: blockchain,
        status: 'completed',
        fee: (swapAmount * 0.0075).toString(), // 0.75% platform fee
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        data: mockSwapResult,
        message: 'Swap executed successfully using Circle wallet'
      };

    } catch (error) {
      console.error('Error executing Circle wallet swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  // Create Circle wallet for user by email
  async createUserWallet(userEmail: string, blockchain: 'ETH' | 'MATIC' | 'AVAX' | 'ARB' | 'BASE' = 'ETH') {
    try {
      // First create a wallet set for this user
      const walletSet = await this.circleService.createWalletSet({ name: `Wallet Set for ${userEmail}` });
      const walletSetId = walletSet.data?.walletSetId ?? walletSet.data?.id;
      if (!walletSet.success || !walletSetId) {
        throw new Error('Failed to create wallet set');
      }

      // Create wallet using the new wallet set
      const wallet = await this.circleService.createWallet({ walletSetId, blockchain });
      const walletData = wallet.data?.wallet;
      if (!wallet.success || !walletData?.id) {
        throw new Error('Failed to create wallet');
      }

      return {
        success: true,
        walletId: walletData.id,
        address: walletData.address,
        blockchain: blockchain,
        state: walletData.state,
        existing: false
      };

    } catch (error) {
      console.error('Error creating user wallet by email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const userCircleService = new UserCircleService();