/**
 * Async Topup Confirmation Job
 * Periodically checks pending on-chain topups and verifies them on-chain
 * Implements retry logic with exponential backoff
 */

import { db } from '../db';
import { iotTopups, iotAccounts } from '@shared/schema';
import { eq, and, lte, isNotNull, sql, or } from 'drizzle-orm';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';
import { ethers } from 'ethers';

const MAX_VERIFICATION_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 60000; // 1 minute
const MAX_RETRY_DELAY_MS = 3600000; // 1 hour
const TOPUP_EXPIRY_HOURS = 24; // Expire pending topups after 24 hours

interface VerificationResult {
  status: 'completed' | 'pending' | 'failed' | 'amount_mismatch' | 'expired';
  verifiedAmount?: string;
  failureReason?: string;
}

const DB_QUERY_TIMEOUT_MS = 60000; // 60s — allows Neon WS pool to reconnect after transient stall
const MAX_CONSECUTIVE_WARN = 2; // log WARN for first 2 transient timeouts, then escalate to ERROR

export class TopupConfirmationJob {
  private static running = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static consecutiveTimeoutFailures = 0;

  private static readonly RPC_URLS: Record<string, string> = {
    'base-mainnet': 'https://mainnet.base.org',
    'ethereum-mainnet': 'https://eth.llamarpc.com',
    'polygon-mainnet': 'https://polygon-rpc.com',
    'arbitrum-mainnet': 'https://arb1.arbitrum.io/rpc',
  };

  static start(intervalMs: number = 300000) { // 5 minutes default - conservative for platform stability
    if (this.intervalId) {
      console.log('⚠️ Topup confirmation job already running');
      return;
    }

    console.log(`🚀 Starting topup confirmation job (interval: ${intervalMs}ms)`);
    // Add ±15s interval jitter to prevent lock-step firing with other jobs
    const jitter = Math.floor(Math.random() * 30000) - 15000;
    this.intervalId = setInterval(() => this.runOnce(), intervalMs + jitter);
    
    // Delay initial run by 30s — Neon WebSocket pool needs time to warm up on cold start.
    // Running immediately causes "timeout exceeded when trying to connect" at startup.
    setTimeout(() => this.runOnce(), 30000);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Topup confirmation job stopped');
    }
  }

  static async runOnce() {
    if (this.running) {
      console.log('⏳ Topup confirmation job already in progress, skipping');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Find pending topups that need verification
      const pendingTopups = await Promise.race([
        db.select()
          .from(iotTopups)
          .where(
            and(
              or(
                eq(iotTopups.status, 'pending'),
                eq(iotTopups.status, 'confirming')
              ),
              isNotNull(iotTopups.txHash),
              or(
                eq(iotTopups.paymentMethod, 'usdc_onchain'),
                eq(iotTopups.paymentMethod, 'usdt_onchain')
              ),
              lte(iotTopups.nextCheckAt, new Date())
            )
          )
          .limit(50),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB query timeout after 30s')), DB_QUERY_TIMEOUT_MS)
        ),
      ]);

      if (pendingTopups.length === 0) {
        this.running = false;
        return;
      }

      console.log(`📋 Processing ${pendingTopups.length} pending topups`);

      for (const topup of pendingTopups) {
        try {
          await this.verifyAndProcessTopup(topup);
        } catch (error: any) {
          console.error(`❌ Failed to process topup ${topup.id}:`, error.message);
          await this.markAttemptFailed(topup, error.message);
        }
      }

      this.consecutiveTimeoutFailures = 0; // reset on successful DB query
      const durationMs = Date.now() - startTime;
      console.log(`✅ Topup confirmation job completed in ${durationMs}ms`);
    } catch (error: any) {
      const isTransientTimeout = error?.message?.includes('DB query timeout after');
      if (isTransientTimeout) {
        this.consecutiveTimeoutFailures++;
        if (this.consecutiveTimeoutFailures <= MAX_CONSECUTIVE_WARN) {
          console.warn(`⚠️ Topup confirmation job: transient DB timeout (occurrence ${this.consecutiveTimeoutFailures}) — Neon WS reconnect, will retry`);
        } else {
          console.error(`❌ Topup confirmation job failed: DB query timeout (${this.consecutiveTimeoutFailures} consecutive) — may need investigation`, error);
        }
      } else {
        this.consecutiveTimeoutFailures = 0;
        console.error('❌ Topup confirmation job failed:', error);
      }
    } finally {
      this.running = false;
    }
  }

  private static async verifyAndProcessTopup(topup: any) {
    const chain = topup.chain || 'base-mainnet';
    const token = topup.token || 'USDC';
    const txHash = topup.txHash;

    // Check if expired
    if (topup.expiresAt && new Date(topup.expiresAt) < new Date()) {
      await this.markExpired(topup);
      return;
    }

    // Verify on-chain
    const result = await this.verifyTransactionOnChain(
      txHash,
      chain,
      token as 'USDC' | 'USDT',
      topup.expectedAmount,
      topup.sender
    );

    if (result.status === 'completed') {
      await this.creditAccountAndComplete(topup, result.verifiedAmount!);
    } else if (result.status === 'pending') {
      await this.scheduleRetry(topup);
    } else if (result.status === 'failed' || result.status === 'amount_mismatch') {
      await this.markFailed(topup, result.status, result.failureReason!);
    }
  }

  private static async verifyTransactionOnChain(
    txHash: string,
    chain: string,
    token: 'USDC' | 'USDT',
    expectedAmount: string | null,
    expectedSender: string | null
  ): Promise<VerificationResult> {
    try {
      const rpcUrl = this.RPC_URLS[chain];
      if (!rpcUrl) {
        return { status: 'failed', failureReason: `Unsupported chain: ${chain}` };
      }

      const tokenAddress = CoinbaseCDPService.getTokenAddress(token, chain);
      if (!tokenAddress) {
        return { status: 'failed', failureReason: `${token} not supported on ${chain}` };
      }

      const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
      if (!platformWallet) {
        return { status: 'failed', failureReason: 'Platform wallet not configured' };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { status: 'pending' };
      }

      if (receipt.status !== 1) {
        return { status: 'failed', failureReason: 'Transaction reverted on chain' };
      }

      // Parse ERC20 Transfer logs
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      let totalVerifiedAmount = BigInt(0);
      let matchingTransfers = 0;
      let actualSender: string | null = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === tokenAddress.toLowerCase() && 
            log.topics[0] === transferTopic) {
          const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
          const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
          
          if (toAddress === platformWallet.toLowerCase()) {
            // Validate sender if expected
            if (expectedSender && fromAddress !== expectedSender.toLowerCase()) {
              continue; // Skip transfers from unexpected senders
            }
            
            const transferAmount = BigInt(log.data);
            totalVerifiedAmount += transferAmount;
            matchingTransfers++;
            actualSender = fromAddress;
          }
        }
      }

      if (matchingTransfers === 0) {
        return { 
          status: 'failed', 
          failureReason: 'No matching transfer to platform wallet found' 
        };
      }

      const verifiedAmount = ethers.formatUnits(totalVerifiedAmount, 6);

      // Validate amount if expected
      if (expectedAmount) {
        const expectedFloat = parseFloat(expectedAmount);
        const verifiedFloat = parseFloat(verifiedAmount);
        const tolerance = 0.01; // $0.01 tolerance

        if (Math.abs(verifiedFloat - expectedFloat) > tolerance) {
          return {
            status: 'amount_mismatch',
            verifiedAmount,
            failureReason: `Expected ${expectedAmount} ${token}, received ${verifiedAmount} ${token}`,
          };
        }
      }

      return { status: 'completed', verifiedAmount };
    } catch (error: any) {
      console.error(`❌ On-chain verification error:`, error.message);
      return { status: 'pending' }; // Treat errors as pending for retry
    }
  }

  private static async creditAccountAndComplete(topup: any, verifiedAmount: string) {
    try {
      await db.transaction(async (tx) => {
        // Credit account
        await tx.update(iotAccounts)
          .set({
            creditsBalance: sql`${iotAccounts.creditsBalance} + ${parseFloat(verifiedAmount)}`,
            updatedAt: new Date(),
          })
          .where(eq(iotAccounts.id, topup.accountId));

        // Get new balance
        const [account] = await tx.select()
          .from(iotAccounts)
          .where(eq(iotAccounts.id, topup.accountId))
          .limit(1);

        // Update topup status
        await tx.update(iotTopups)
          .set({
            status: 'completed',
            verifiedAmount,
            amount: verifiedAmount, // Update with verified amount
            balanceAfter: account?.creditsBalance || '0',
            completedAt: new Date(),
            lastCheckedAt: new Date(),
          })
          .where(eq(iotTopups.id, topup.id));
      });

      console.log(`✅ Topup ${topup.id} completed: ${verifiedAmount} credits added to ${topup.accountId}`);
    } catch (error: any) {
      console.error(`❌ Failed to credit account for topup ${topup.id}:`, error);
      throw error;
    }
  }

  private static async scheduleRetry(topup: any) {
    const attempts = (topup.verificationAttempts || 0) + 1;
    
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await this.markFailed(topup, 'expired', 'Max verification attempts exceeded');
      return;
    }

    // Exponential backoff
    const delayMs = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1),
      MAX_RETRY_DELAY_MS
    );
    const nextCheckAt = new Date(Date.now() + delayMs);

    await db.update(iotTopups)
      .set({
        status: 'confirming',
        verificationAttempts: attempts,
        lastCheckedAt: new Date(),
        nextCheckAt,
      })
      .where(eq(iotTopups.id, topup.id));

    console.log(`⏳ Topup ${topup.id} scheduled for retry (attempt ${attempts}) at ${nextCheckAt.toISOString()}`);
  }

  private static async markFailed(topup: any, status: string, reason: string) {
    await db.update(iotTopups)
      .set({
        status,
        failureReason: reason,
        lastCheckedAt: new Date(),
      })
      .where(eq(iotTopups.id, topup.id));

    console.log(`❌ Topup ${topup.id} marked as ${status}: ${reason}`);
  }

  private static async markExpired(topup: any) {
    await db.update(iotTopups)
      .set({
        status: 'expired',
        failureReason: 'Topup expired before confirmation',
        lastCheckedAt: new Date(),
      })
      .where(eq(iotTopups.id, topup.id));

    console.log(`⏰ Topup ${topup.id} expired`);
  }

  private static async markAttemptFailed(topup: any, errorMessage: string) {
    const attempts = (topup.verificationAttempts || 0) + 1;
    
    // Exponential backoff for next retry
    const delayMs = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1),
      MAX_RETRY_DELAY_MS
    );
    const nextCheckAt = new Date(Date.now() + delayMs);

    await db.update(iotTopups)
      .set({
        verificationAttempts: attempts,
        lastCheckedAt: new Date(),
        nextCheckAt,
        failureReason: errorMessage,
      })
      .where(eq(iotTopups.id, topup.id));
  }
}

export default TopupConfirmationJob;
