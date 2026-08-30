/**
 * Payment Poller - Fallback mechanism when Helius webhooks aren't working
 * Uses Helius getSignaturesForAddress to check for recent payments
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { solanaPaymentService } from './solanaPaymentService.js';
import { PLATFORM_WALLETS } from '../../../utils/facilitatorHelper.js';

const HELIUS_RPC = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=demo';
const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

class PaymentPoller {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private connection: Connection;
  private lastProcessedSignature: string | null = null;
  private processedSignatures: Set<string> = new Set();

  constructor() {
    this.connection = new Connection(HELIUS_RPC, 'confirmed');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Payment poller already running');
      return;
    }

    const platformWallet = PLATFORM_WALLETS.solana;

    this.isRunning = true;
    console.log('🔄 Payment poller started (fallback for webhooks)');
    console.log(`   Monitoring wallet: ${platformWallet}`);
    console.log(`   Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

    // Initial poll
    await this.pollForPayments();

    // Start interval
    this.pollInterval = setInterval(async () => {
      await this.pollForPayments();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Payment poller stopped');
  }

  private async pollForPayments(): Promise<void> {
    try {
      const platformWallet = PLATFORM_WALLETS.solana;

      const pubkey = new PublicKey(platformWallet);
      
      // Get recent signatures
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 20,
      });

      if (signatures.length === 0) return;

      // Process new signatures
      for (const sigInfo of signatures) {
        if (this.processedSignatures.has(sigInfo.signature)) continue;
        if (sigInfo.err) continue; // Skip failed transactions

        // Get full transaction
        const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          await this.processTransaction(tx, sigInfo.signature);
        }

        this.processedSignatures.add(sigInfo.signature);
        
        // Limit memory usage
        if (this.processedSignatures.size > 1000) {
          const toDelete = Array.from(this.processedSignatures).slice(0, 500);
          toDelete.forEach(s => this.processedSignatures.delete(s));
        }
      }
    } catch (error) {
      console.error('❌ Payment poll error:', error);
    }
  }

  private async processTransaction(tx: ParsedTransactionWithMeta, signature: string): Promise<void> {
    try {
      // Extract memo if present
      const memo = this.extractMemo(tx);
      if (!memo) return; // No memo = not a Coin Railz payment

      // Check for CRPAY tag
      const tagMatch = memo.match(/CRPAY-[A-Z0-9]{8}/);
      if (!tagMatch) return;

      const memoTag = tagMatch[0];
      console.log(`📥 POLLER: Found payment with memo ${memoTag}`);
      console.log(`   Signature: ${signature}`);

      // Find matching intent
      const intent = await solanaPaymentService.getIntentByMemo(memoTag);
      if (!intent) {
        console.log(`   ⚠️ No matching intent for memo ${memoTag}`);
        return;
      }

      if (intent.status !== 'pending') {
        console.log(`   Already processed: ${intent.status}`);
        return;
      }

      // Extract transfer amount
      const transferAmount = this.extractTransferAmount(tx, PLATFORM_WALLETS.solana);
      
      // Mark as paid
      await solanaPaymentService.markIntentPaid(intent.id, signature, transferAmount);
      console.log(`✅ POLLER: Payment confirmed for ${intent.id}`);
      console.log(`   Amount: ${transferAmount} USDC`);

    } catch (error) {
      console.error('❌ Error processing polled transaction:', error);
    }
  }

  private extractMemo(tx: ParsedTransactionWithMeta): string | null {
    const instructions = tx.transaction.message.instructions;
    
    for (const ix of instructions) {
      if ('programId' in ix && ix.programId.toString() === MEMO_PROGRAM_ID) {
        if ('parsed' in ix && typeof ix.parsed === 'string') {
          return ix.parsed;
        }
        if ('data' in ix && typeof ix.data === 'string') {
          try {
            return Buffer.from(ix.data, 'base64').toString('utf-8');
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  private extractTransferAmount(tx: ParsedTransactionWithMeta, recipientAddress: string): number {
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      const address = typeof key === 'string' ? key : key.pubkey.toString();
      
      if (address === recipientAddress) {
        const received = (postBalances[i] - preBalances[i]) / 1e9;
        if (received > 0) return received;
      }
    }
    return 0;
  }

  getStatus(): { running: boolean; processedCount: number } {
    return {
      running: this.isRunning,
      processedCount: this.processedSignatures.size,
    };
  }
}

export const paymentPoller = new PaymentPoller();
