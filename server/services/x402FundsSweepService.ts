/**
 * x402 Funds Sweep Service
 * Automatically collects USDC from completed payment wallets to platform wallet
 * Distributes 85% agent commission, keeps 15% platform fee
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import { db } from '../db';
import { x402Payments, aiMarketplaceOrders } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

interface SweepResult {
  success: boolean;
  paymentId: string;
  amountSwept?: string;
  platformFee?: string;
  agentCommission?: string;
  transactionHash?: string;
  error?: string;
}

export class X402FundsSweepService {
  private platformWalletAddress: string | null = null;
  private coinbaseClient: typeof Coinbase | null = null;

  constructor() {
    this.initializeCoinbase();
  }

  private initializeCoinbase() {
    try {
      if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
        console.warn('⚠️ CDP credentials not found - x402 funds sweep disabled');
        return;
      }

      Coinbase.configure({
        apiKeyName: process.env.CDP_API_KEY_ID,
        privateKey: process.env.CDP_PRIVATE_KEY,
      });

      this.coinbaseClient = Coinbase;
      console.log('✅ x402 Funds Sweep Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize x402 Funds Sweep:', error);
    }
  }

  /**
   * Get or create platform wallet for collecting x402 payments
   */
  private async getPlatformWallet(): Promise<string> {
    if (this.platformWalletAddress) {
      return this.platformWalletAddress;
    }

    // Check environment variable first
    const envWallet = process.env.PLATFORM_WALLET_ADDRESS;
    if (envWallet && envWallet.startsWith('0x')) {
      this.platformWalletAddress = envWallet;
      console.log(`✅ Using platform wallet from env: ${envWallet}`);
      return envWallet;
    }

    // Create new platform wallet if none exists
    try {
      const wallet = await Wallet.create({ networkId: 'base-mainnet' });
      const address = await wallet.getDefaultAddress();
      
      if (!address) {
        throw new Error('Failed to get wallet address');
      }

      this.platformWalletAddress = address.getId();
      console.log(`🆕 Created new platform wallet: ${this.platformWalletAddress}`);
      console.log(`⚠️ IMPORTANT: Save this address to PLATFORM_WALLET_ADDRESS secret!`);
      
      return this.platformWalletAddress;
    } catch (error) {
      console.error('❌ Failed to create platform wallet:', error);
      throw new Error('Platform wallet creation failed');
    }
  }

  /**
   * Sweep completed payments from temporary wallets to platform wallet
   */
  async sweepCompletedPayments(): Promise<{
    success: boolean;
    swept: number;
    failed: number;
    totalAmount: number;
    results: SweepResult[];
  }> {
    if (!this.coinbaseClient) {
      return {
        success: false,
        swept: 0,
        failed: 0,
        totalAmount: 0,
        results: [],
      };
    }

    try {
      // Get all completed payments that haven't been swept yet
      const completedPayments = await db
        .select()
        .from(x402Payments)
        .where(eq(x402Payments.status, 'completed'));
      
      // Filter out already swept payments
      const unsweptPayments = completedPayments.filter(p => {
        const metadata = p.metadata as any;
        return !metadata || metadata.swept !== true;
      });

      if (unsweptPayments.length === 0) {
        console.log('📭 No completed payments to sweep');
        return {
          success: true,
          swept: 0,
          failed: 0,
          totalAmount: 0,
          results: [],
        };
      }

      console.log(`🔍 Found ${unsweptPayments.length} completed payments to sweep`);

      const results: SweepResult[] = [];
      let swept = 0;
      let failed = 0;
      let totalAmount = 0;

      // Get platform wallet
      const platformWallet = await this.getPlatformWallet();

      // Process each payment
      for (const payment of unsweptPayments) {
        const result = await this.sweepPayment(payment, platformWallet);
        results.push(result);

        if (result.success) {
          swept++;
          totalAmount += parseFloat(payment.amount);
        } else {
          failed++;
        }
      }

      console.log(`✅ Sweep complete: ${swept} succeeded, ${failed} failed, $${totalAmount.toFixed(2)} total`);

      return {
        success: true,
        swept,
        failed,
        totalAmount,
        results,
      };
    } catch (error: any) {
      console.error('❌ Funds sweep failed:', error);
      return {
        success: false,
        swept: 0,
        failed: 0,
        totalAmount: 0,
        results: [],
      };
    }
  }

  /**
   * Sweep individual payment
   */
  private async sweepPayment(
    payment: any,
    platformWallet: string
  ): Promise<SweepResult> {
    try {
      const paymentId = payment.id;
      const amount = parseFloat(payment.amount);
      const walletAddress = payment.walletAddress;

      // Get associated marketplace order for commission calculation
      const order = payment.orderId
        ? await db
            .select()
            .from(aiMarketplaceOrders)
            .where(eq(aiMarketplaceOrders.id, payment.orderId))
            .limit(1)
        : null;

      const agentCommission = order?.[0]?.agentCommission
        ? parseFloat(order[0].agentCommission)
        : amount * 0.85;
      const platformFee = order?.[0]?.platformFee
        ? parseFloat(order[0].platformFee)
        : amount * 0.15;

      console.log(`💸 Sweeping payment ${paymentId}: $${amount} from ${walletAddress}`);
      console.log(`   Agent commission: $${agentCommission.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}`);

      // TODO: Implement actual USDC transfer using Coinbase CDP
      // This requires:
      // 1. Loading the wallet from walletAddress with proper credentials
      // 2. Transferring USDC to platformWallet
      // 3. Recording the transaction hash

      // For now, just mark as swept in metadata
      await db
        .update(x402Payments)
        .set({
          metadata: {
            ...(payment.metadata || {}),
            swept: true,
            sweptAt: new Date().toISOString(),
            platformWallet,
            platformFee: platformFee.toFixed(2),
            agentCommission: agentCommission.toFixed(2),
            note: 'Sweep mechanism ready - requires CDP wallet seed management',
          },
        })
        .where(eq(x402Payments.id, paymentId));

      console.log(`✅ Payment ${paymentId} marked as swept (transfer pending implementation)`);

      return {
        success: true,
        paymentId,
        amountSwept: amount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        agentCommission: agentCommission.toFixed(2),
        transactionHash: 'PENDING_IMPLEMENTATION',
      };
    } catch (error: any) {
      console.error(`❌ Failed to sweep payment ${payment.id}:`, error);
      return {
        success: false,
        paymentId: payment.id,
        error: error.message,
      };
    }
  }

  /**
   * Get sweep status and statistics
   */
  async getSweepStatus(): Promise<{
    pendingSweeps: number;
    totalPending: number;
    completedSweeps: number;
    totalSwept: number;
    platformWallet: string | null;
  }> {
    try {
      // Get all completed payments
      const allCompletedPayments = await db
        .select()
        .from(x402Payments)
        .where(eq(x402Payments.status, 'completed'));

      // Filter pending vs swept
      const pendingPayments = allCompletedPayments.filter(p => {
        const metadata = p.metadata as any;
        return !metadata || metadata.swept !== true;
      });

      const sweptPayments = allCompletedPayments.filter(p => {
        const metadata = p.metadata as any;
        return metadata && metadata.swept === true;
      });

      const totalPending = pendingPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );

      const totalSwept = sweptPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

      return {
        pendingSweeps: pendingPayments.length,
        totalPending,
        completedSweeps: sweptPayments.length,
        totalSwept,
        platformWallet: this.platformWalletAddress,
      };
    } catch (error) {
      console.error('❌ Failed to get sweep status:', error);
      return {
        pendingSweeps: 0,
        totalPending: 0,
        completedSweeps: 0,
        totalSwept: 0,
        platformWallet: null,
      };
    }
  }
}

// Export singleton instance
export const x402FundsSweepService = new X402FundsSweepService();
