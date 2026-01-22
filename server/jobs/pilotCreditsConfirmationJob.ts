/**
 * Pilot Credits Crypto Payment Confirmation Job
 * Periodically checks pending crypto payments and verifies on-chain
 * Implements retry logic with exponential backoff
 */

import { db } from '../db';
import { pilotCreditsPayments } from '@shared/schema';
import { eq, and, lte, isNotNull, sql, or } from 'drizzle-orm';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { unifiedCreditsService } from '../services/unifiedCreditsService';
import { ethers } from 'ethers';

const MAX_VERIFICATION_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 60000; // 1 minute
const MAX_RETRY_DELAY_MS = 3600000; // 1 hour

interface VerificationResult {
  status: 'completed' | 'pending' | 'failed' | 'amount_mismatch' | 'expired';
  verifiedAmount?: string;
  sender?: string;
  failureReason?: string;
}

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
    
    this.runOnce();
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
      const pendingPayments = await db.select()
        .from(pilotCreditsPayments)
        .where(
          and(
            or(
              eq(pilotCreditsPayments.status, 'pending'),
              eq(pilotCreditsPayments.status, 'confirming')
            ),
            isNotNull(pilotCreditsPayments.txHash),
            lte(pilotCreditsPayments.nextCheckAt, new Date())
          )
        )
        .limit(50);

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
    const txHash = payment.txHash;

    if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
      await this.markExpired(payment);
      return;
    }

    const result = await this.verifyTransactionOnChain(
      txHash,
      chain,
      token as 'USDC' | 'USDT',
      payment.expectedAmount,
      payment.depositAddress,
      payment.tokenContract
    );

    if (result.status === 'completed') {
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
    tokenContract: string
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

        if (expectedAmount) {
          const expectedFloat = parseFloat(expectedAmount);
          const receivedFloat = parseFloat(amountFormatted);
          const tolerance = 0.01;

          if (Math.abs(receivedFloat - expectedFloat) > tolerance) {
            return {
              status: 'amount_mismatch',
              verifiedAmount: amountFormatted,
              sender: fromAddress,
              failureReason: `Expected ${expectedAmount}, received ${amountFormatted}`
            };
          }
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
        failureReason: 'Payment window expired',
        lastCheckedAt: new Date(),
      })
      .where(eq(pilotCreditsPayments.id, payment.id));

    console.log(`⏰ Pilot payment ${payment.id} expired`);
  }
}
