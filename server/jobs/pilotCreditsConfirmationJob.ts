/**
 * Pilot Credits Crypto Payment Confirmation Job
 * Periodically checks pending crypto payments and verifies on-chain
 * Implements retry logic with exponential backoff
 */

import { db } from '../db';
import { pilotCreditsPayments } from '@shared/schema';
import { eq, and, lte, or } from 'drizzle-orm';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { unifiedCreditsService } from '../services/unifiedCreditsService';
import { creditsService } from '../services/creditsService';
import { ethers } from 'ethers';

const MAX_VERIFICATION_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 60000; // 1 minute
const MAX_RETRY_DELAY_MS = 3600000; // 1 hour

interface VerificationResult {
  status: 'completed' | 'pending' | 'failed' | 'amount_mismatch' | 'expired';
  verifiedAmount?: string;
  sender?: string;
  txHash?: string;
  failureReason?: string;
}

const DB_QUERY_TIMEOUT_MS = 30000; // 30s — prevents Neon serverless query hangs

export class PilotCreditsConfirmationJob {
  private static running = false;
  private static intervalId: NodeJS.Timeout | null = null;

  private static readonly RPC_URLS: Record<string, string> = {
    'base-mainnet': 'https://mainnet.base.org',
    'ethereum-mainnet': 'https://eth.llamarpc.com',
    'polygon-mainnet': 'https://polygon-rpc.com',
    'arbitrum-mainnet': 'https://arb1.arbitrum.io/rpc',
  };

  static start(intervalMs: number = 300000) { // 5 minutes default
    if (this.intervalId) {
      console.log('⚠️ Pilot credits confirmation job already running');
      return;
    }

    console.log(`🚀 Starting pilot credits confirmation job (interval: ${intervalMs}ms)`);
    this.intervalId = setInterval(() => this.runOnce(), intervalMs);
    
    // Delay initial run by 30s — Neon WebSocket pool needs time to warm up on cold start.
    // Running immediately causes "timeout exceeded when trying to connect" at startup.
    setTimeout(() => this.runOnce(), 30000);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Pilot credits confirmation job stopped');
    }
  }

  static async runOnce() {
    if (this.running) {
      console.log('⏳ Pilot credits confirmation job already in progress');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      const pendingPayments = await Promise.race([
        db.select()
          .from(pilotCreditsPayments)
          .where(
            and(
              or(
                eq(pilotCreditsPayments.status, 'pending'),
                eq(pilotCreditsPayments.status, 'confirming')
              ),
              lte(pilotCreditsPayments.nextCheckAt, new Date())
            )
          )
          .limit(50),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB query timeout after 30s')), DB_QUERY_TIMEOUT_MS)
        ),
      ]);

      if (pendingPayments.length === 0) {
        this.running = false;
        return;
      }

      console.log(`📋 Processing ${pendingPayments.length} pending pilot crypto payments`);

      for (const payment of pendingPayments) {
        try {
          await this.verifyAndProcessPayment(payment);
        } catch (error: any) {
          console.error(`❌ Failed to process payment ${payment.id}:`, error.message);
          await this.markAttemptFailed(payment, error.message);
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(`✅ Pilot credits confirmation job completed in ${durationMs}ms`);
    } catch (error: any) {
      console.error('❌ Pilot credits confirmation job failed:', error);
    } finally {
      this.running = false;
    }
  }

  private static async verifyAndProcessPayment(payment: any) {
    const chain = payment.chain;
    const token = payment.token;

    if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
      await this.markExpired(payment);
      return;
    }

    // If txHash is provided, verify that specific transaction
    // Otherwise, scan the deposit address for incoming transfers
    const result = payment.txHash
      ? await this.verifyTransactionOnChain(
          payment.txHash,
          chain,
          token as 'USDC' | 'USDT',
          payment.expectedAmount,
          payment.depositAddress,
          payment.tokenContract,
          payment.createdAt // SECURITY: Pass createdAt to validate tx timestamp
        )
      : await this.scanDepositAddress(
          chain,
          token as 'USDC' | 'USDT',
          payment.expectedAmount,
          payment.depositAddress,
          payment.tokenContract,
          payment.createdAt
        );

    if (result.status === 'completed') {
      // Store the discovered txHash if we found it via scanning
      if (result.txHash && !payment.txHash) {
        await db.update(pilotCreditsPayments)
          .set({ txHash: result.txHash })
          .where(eq(pilotCreditsPayments.id, payment.id));
      }
      await this.creditUserAndComplete(payment, result.verifiedAmount!, result.sender);
    } else if (result.status === 'pending') {
      await this.scheduleRetry(payment);
    } else if (result.status === 'failed' || result.status === 'amount_mismatch') {
      await this.markFailed(payment, result.status, result.failureReason!);
    }
  }

  private static async verifyTransactionOnChain(
    txHash: string,
    chain: string,
    token: 'USDC' | 'USDT',
    expectedAmount: string | null,
    depositAddress: string,
    tokenContract: string,
    createdAt: Date | null
  ): Promise<VerificationResult> {
    try {
      const rpcUrl = this.RPC_URLS[chain];
      if (!rpcUrl) {
        return { status: 'failed', failureReason: `Unsupported chain: ${chain}` };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { status: 'pending' };
      }

      if (receipt.status === 0) {
        return { status: 'failed', failureReason: 'Transaction reverted on-chain' };
      }

      // SECURITY: Validate transaction was made AFTER payment intent creation
      // This prevents reusing old transactions to claim free credits
      if (createdAt) {
        const block = await provider.getBlock(receipt.blockNumber);
        if (block && block.timestamp) {
          const txTime = new Date(block.timestamp * 1000);
          if (txTime < createdAt) {
            return {
              status: 'failed',
              failureReason: 'Transaction predates payment intent. Cannot be used for this payment.'
            };
          }
        }
      }

      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const tokenLower = tokenContract.toLowerCase();

      for (const log of receipt.logs) {
        if (log.topics[0] !== transferTopic) continue;
        if (log.address.toLowerCase() !== tokenLower) continue;

        const toAddress = '0x' + log.topics[2].slice(26);
        if (toAddress.toLowerCase() !== depositAddress.toLowerCase()) continue;

        const fromAddress = '0x' + log.topics[1].slice(26);
        const amountBigInt = BigInt(log.data);
        const amountFormatted = ethers.formatUnits(amountBigInt, 6);

        // SECURITY: Strict amount validation to prevent underpayment attacks
        // Example: $0.01 sent should NOT credit $2500 package
        if (!expectedAmount) {
          // No expected amount = reject (should never happen for pilot credits)
          return {
            status: 'failed',
            failureReason: 'Missing expected amount in payment intent'
          };
        }
        
        const expectedFloat = parseFloat(expectedAmount);
        const receivedFloat = parseFloat(amountFormatted);
        
        // Tolerance: $0.01 fixed (sufficient for stablecoins with 6 decimals)
        // This handles minor rounding differences only
        const tolerance = 0.01;
        
        // Reject underpayment - critical security check
        if (receivedFloat < expectedFloat - tolerance) {
          return {
            status: 'amount_mismatch',
            verifiedAmount: amountFormatted,
            sender: fromAddress,
            failureReason: `Underpayment: expected $${expectedAmount}, received $${amountFormatted}`
          };
        }
        
        // Reject significant overpayment (could indicate wrong transaction)
        if (receivedFloat > expectedFloat + tolerance) {
          return {
            status: 'amount_mismatch',
            verifiedAmount: amountFormatted,
            sender: fromAddress,
            failureReason: `Overpayment: expected $${expectedAmount}, received $${amountFormatted}. Contact support.`
          };
        }

        return {
          status: 'completed',
          verifiedAmount: amountFormatted,
          sender: fromAddress
        };
      }

      return { status: 'pending' };
    } catch (error: any) {
      console.error(`Error verifying transaction ${txHash}:`, error.message);
      return { status: 'pending' };
    }
  }

  /**
   * Scan deposit address for incoming ERC20 transfers
   * This enables automatic payment detection without user providing txHash
   */
  private static async scanDepositAddress(
    chain: string,
    token: 'USDC' | 'USDT',
    expectedAmount: string | null,
    depositAddress: string,
    tokenContract: string,
    createdAt: Date | null
  ): Promise<VerificationResult> {
    try {
      const rpcUrl = this.RPC_URLS[chain];
      if (!rpcUrl) {
        return { status: 'failed', failureReason: `Unsupported chain: ${chain}` };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const currentBlock = await provider.getBlockNumber();
      
      // Scan last ~45 minutes of blocks to fully cover 30-minute payment window + buffer
      // Block time estimates: Base/Arbitrum/Polygon ~2s, Ethereum ~12s
      // 45 min = 2700s → 1350 blocks at 2s/block, 225 blocks at 12s/block
      const blocksToScan = chain === 'ethereum-mainnet' ? 250 : 1500;
      const fromBlock = Math.max(0, currentBlock - blocksToScan);
      
      // Fallback for missing createdAt - use 1 hour ago
      const paymentCreatedAt = createdAt || new Date(Date.now() - 3600000);

      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const paddedAddress = '0x' + depositAddress.slice(2).toLowerCase().padStart(64, '0');

      // Query for Transfer events TO the deposit address
      const logs = await provider.getLogs({
        address: tokenContract,
        topics: [
          transferTopic,
          null, // from (any)
          paddedAddress // to (our deposit address)
        ],
        fromBlock,
        toBlock: currentBlock
      });

      if (logs.length === 0) {
        return { status: 'pending' };
      }

      // Process transfers and find matching amount
      for (const log of logs) {
        const fromAddress = '0x' + log.topics[1].slice(26);
        const amountBigInt = BigInt(log.data);
        const amountFormatted = ethers.formatUnits(amountBigInt, 6);

        // Get transaction timestamp to verify it's after payment intent was created
        const block = await provider.getBlock(log.blockNumber);
        if (block && block.timestamp) {
          const txTime = new Date(block.timestamp * 1000);
          if (txTime < paymentCreatedAt) {
            continue; // Skip transfers before payment was created
          }
        }

        // SECURITY: Strict amount validation - require expectedAmount for all payments
        if (!expectedAmount) {
          console.log(`⚠️ Skipping transfer to ${depositAddress}: no expected amount set`);
          continue;
        }
        
        const expectedFloat = parseFloat(expectedAmount);
        const receivedFloat = parseFloat(amountFormatted);
        
        // Tolerance: $0.01 fixed (handles minor rounding only)
        const tolerance = 0.01;
        
        // Only accept if within tolerance (both under and over)
        if (receivedFloat >= expectedFloat - tolerance && 
            receivedFloat <= expectedFloat + tolerance) {
          console.log(`🔍 Found matching transfer to ${depositAddress}: ${amountFormatted} ${token}`);
          return {
            status: 'completed',
            verifiedAmount: amountFormatted,
            sender: fromAddress,
            txHash: log.transactionHash
          };
        }
        // Log mismatches for debugging but continue scanning for correct transfer
        console.log(`⚠️ Amount mismatch for ${depositAddress}: expected $${expectedAmount}, got $${amountFormatted}`);
      }

      return { status: 'pending' };
    } catch (error: any) {
      console.error(`Error scanning deposit address ${depositAddress}:`, error.message);
      return { status: 'pending' };
    }
  }

  private static async creditUserAndComplete(payment: any, verifiedAmount: string, sender?: string) {
    try {
      await unifiedCreditsService.addCredits(
        'user',
        payment.userId,
        payment.credits,
        'crypto',
        {
          referenceType: 'pilot_crypto',
          referenceId: payment.id,
          description: `Pilot credits: ${payment.credits} via ${payment.token} on ${payment.chain}`,
          idempotencyKey: payment.idempotencyKey
        }
      );

      await db.update(pilotCreditsPayments)
        .set({
          status: 'completed',
          verifiedAmount,
          sender,
          completedAt: new Date(),
        })
        .where(eq(pilotCreditsPayments.id, payment.id));

      console.log(`✅ Pilot crypto payment completed: ${payment.id} - ${payment.credits} credits to ${payment.userId}`);

      try {
        await creditsService.addCredits({
          userId: payment.userId,
          amount: payment.credits,
          paymentMethod: (payment.token?.toLowerCase() === 'usdt' ? 'usdt' : 'usdc') as any,
          referenceId: `bridge_crypto_${payment.id}`,
          description: `Pilot credits bridge: crypto ${payment.token} ($${payment.credits})`,
          metadata: { source: 'pilot_credits_bridge', paymentId: payment.id }
        });
        console.log(`🔗 Bridge: Mirrored $${payment.credits} crypto credits to legacy for ${payment.userId}`);
      } catch (bridgeError: any) {
        if ((bridgeError as any).code === '23503') {
          console.log(`🔗 Bridge: User ${payment.userId} not in users table - skipping legacy mirror (unified credits still active)`);
        } else if (bridgeError.message?.includes('duplicate') || bridgeError.message?.includes('already')) {
          console.log(`🔗 Bridge: Already mirrored for crypto ${payment.id} - skipping`);
        } else {
          console.error(`⚠️ Bridge: Failed to mirror crypto credits (non-blocking):`, bridgeError.message);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Idempotency')) {
        console.log(`⚠️ Credits already added for ${payment.id} - marking complete`);
        await db.update(pilotCreditsPayments)
          .set({
            status: 'completed',
            verifiedAmount,
            sender,
            completedAt: new Date(),
          })
          .where(eq(pilotCreditsPayments.id, payment.id));
      } else {
        throw error;
      }
    }
  }

  private static async scheduleRetry(payment: any) {
    const attempts = (payment.verificationAttempts || 0) + 1;
    const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1), MAX_RETRY_DELAY_MS);
    const nextCheckAt = new Date(Date.now() + delay);

    await db.update(pilotCreditsPayments)
      .set({
        verificationAttempts: attempts,
        lastCheckedAt: new Date(),
        nextCheckAt,
      })
      .where(eq(pilotCreditsPayments.id, payment.id));
  }

  private static async markAttemptFailed(payment: any, reason: string) {
    const attempts = (payment.verificationAttempts || 0) + 1;

    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await this.markFailed(payment, 'failed', `Max attempts reached: ${reason}`);
    } else {
      await this.scheduleRetry(payment);
    }
  }

  private static async markFailed(payment: any, status: string, reason: string) {
    await db.update(pilotCreditsPayments)
      .set({
        status,
        failureReason: reason,
        lastCheckedAt: new Date(),
      })
      .where(eq(pilotCreditsPayments.id, payment.id));

    console.log(`❌ Pilot payment ${payment.id} failed: ${reason}`);
  }

  private static async markExpired(payment: any) {
    await db.update(pilotCreditsPayments)
      .set({
        status: 'expired',
        failureReason: 'Payment window expired. If you sent funds after expiry, contact support@coinrailz.com with your payment ID for manual processing.',
        lastCheckedAt: new Date(),
      })
      .where(eq(pilotCreditsPayments.id, payment.id));

    console.log(`⏰ Pilot payment ${payment.id} expired - user notified of recovery path`);
  }
}
