/**
 * Helius Webhook Handler - Processes Solana transaction events
 * ISOLATED: Completely separate from x402 EVM infrastructure
 */

import crypto from 'crypto';
import { solanaPaymentService } from './solanaPaymentService.js';
import { solanaWalletManager, SUPPORTED_TOKENS, getTokenByMint } from './constants.js';
import type { SolanaPaymentIntent } from '@shared/schema.js';

export interface HeliusTokenTransfer {
  mint: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
}

export interface HeliusAccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges?: {
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
  }[];
}

export interface HeliusInstruction {
  programId: string;
  data: string;
  accounts?: string[];
}

export interface HeliusEnhancedPayload {
  type: string;
  signature: string;
  timestamp: number;
  slot?: number;
  description?: string;
  source?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  accountData?: HeliusAccountData[];
  instructions?: HeliusInstruction[];
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
}

export interface WebhookProcessResult {
  success: boolean;
  intentId?: string;
  status?: string;
  message: string;
  txSignature?: string;
}

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

class HeliusWebhookHandler {
  private static instance: HeliusWebhookHandler;

  private constructor() {}

  static getInstance(): HeliusWebhookHandler {
    if (!HeliusWebhookHandler.instance) {
      HeliusWebhookHandler.instance = new HeliusWebhookHandler();
    }
    return HeliusWebhookHandler.instance;
  }

  /**
   * Check if webhook authentication is properly configured
   * PRODUCTION SAFETY: Returns false if HELIUS_WEBHOOK_SECRET is not set
   */
  isWebhookConfigured(): boolean {
    return !!process.env.HELIUS_WEBHOOK_SECRET;
  }

  /**
   * Verify webhook request using Helius's Authorization header echo pattern
   * Helius sends back the authHeader you configured when creating the webhook
   * SECURITY: Fails closed - rejects if secret not configured
   */
  verifyAuthHeader(authorizationHeader: string | undefined): boolean {
    const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;
    
    // CRITICAL: Fail closed - reject if webhook secret not configured
    if (!webhookSecret) {
      console.error('🔒 SECURITY: HELIUS_WEBHOOK_SECRET not configured - rejecting webhook');
      return false;
    }

    if (!authorizationHeader) {
      console.error('🔒 SECURITY: Missing Authorization header from webhook request');
      return false;
    }

    try {
      // Use constant-time comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(webhookSecret);
      const receivedBuffer = Buffer.from(authorizationHeader);
      
      // DEBUG: Log length comparison to diagnose mismatch
      console.log(`🔍 DEBUG: Expected length=${expectedBuffer.length}, Received length=${receivedBuffer.length}`);
      console.log(`🔍 DEBUG: Expected prefix="${webhookSecret.substring(0, 8)}...", Received prefix="${authorizationHeader.substring(0, 8)}..."`);
      
      if (expectedBuffer.length !== receivedBuffer.length) {
        console.error('🔒 SECURITY: Authorization header length mismatch');
        return false;
      }
      
      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
      if (!isValid) {
        console.error('🔒 SECURITY: Authorization header mismatch');
      }
      return isValid;
    } catch (error) {
      console.error('🔒 SECURITY: Webhook auth verification failed:', error);
      return false;
    }
  }

  extractMemoFromInstructions(instructions: HeliusInstruction[] | undefined): string | null {
    if (!instructions) return null;

    const memoInstruction = instructions.find(i => i.programId === MEMO_PROGRAM_ID);
    if (!memoInstruction?.data) return null;

    try {
      return Buffer.from(memoInstruction.data, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  extractMemoTag(memo: string | null): string | null {
    if (!memo) return null;
    
    const match = memo.match(/CRPAY-[A-Z0-9]{8}/);
    return match ? match[0] : null;
  }

  async processWebhook(payloads: HeliusEnhancedPayload[]): Promise<WebhookProcessResult[]> {
    const results: WebhookProcessResult[] = [];
    const platformAddress = solanaWalletManager.getPublicKeyString();

    if (!platformAddress) {
      console.error('Platform wallet not initialized');
      return [{ success: false, message: 'Platform wallet not initialized' }];
    }

    for (const payload of payloads) {
      try {
        const result = await this.processSingleTransaction(payload, platformAddress);
        results.push(result);
      } catch (error) {
        console.error(`Error processing transaction ${payload.signature}:`, error);
        results.push({
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          txSignature: payload.signature,
        });
      }
    }

    return results;
  }

  private async processSingleTransaction(
    payload: HeliusEnhancedPayload,
    platformAddress: string
  ): Promise<WebhookProcessResult> {
    const { signature, tokenTransfers, nativeTransfers, instructions, slot } = payload;

    const alreadyProcessed = await solanaPaymentService.isSignatureProcessed(signature);
    if (alreadyProcessed) {
      return {
        success: true,
        message: 'Transaction already processed (idempotent)',
        txSignature: signature,
      };
    }

    const memo = this.extractMemoFromInstructions(instructions);
    const memoTag = this.extractMemoTag(memo);

    if (!memoTag) {
      return {
        success: false,
        message: 'No valid memo tag found',
        txSignature: signature,
      };
    }

    const intent = await solanaPaymentService.getIntentByMemo(memoTag);
    if (!intent) {
      return {
        success: false,
        message: `No intent found for memo: ${memoTag}`,
        txSignature: signature,
      };
    }

    if (intent.status !== 'pending') {
      return {
        success: false,
        message: `Intent ${intent.id} is not pending (status: ${intent.status})`,
        txSignature: signature,
        intentId: intent.id,
      };
    }

    if (new Date(intent.expiresAt) < new Date()) {
      await solanaPaymentService.markIntentFailed(intent.id, 'Intent expired');
      return {
        success: false,
        message: 'Intent expired',
        txSignature: signature,
        intentId: intent.id,
      };
    }

    const verification = this.verifyPaymentAmount(
      intent,
      platformAddress,
      tokenTransfers || [],
      nativeTransfers || []
    );

    if (!verification.valid) {
      await solanaPaymentService.markIntentFailed(intent.id, verification.reason);
      return {
        success: false,
        message: verification.reason,
        txSignature: signature,
        intentId: intent.id,
      };
    }

    await solanaPaymentService.markIntentPaid(intent.id, signature, slot, 'confirmed');
    await solanaPaymentService.recordProcessedSignature(signature, intent.id);

    await solanaPaymentService.markIntentSettled(intent.id);

    console.log(`✅ Payment verified for intent ${intent.id}: ${signature}`);

    return {
      success: true,
      intentId: intent.id,
      status: 'succeeded',
      message: 'Payment verified and settled',
      txSignature: signature,
    };
  }

  private verifyPaymentAmount(
    intent: SolanaPaymentIntent,
    platformAddress: string,
    tokenTransfers: HeliusTokenTransfer[],
    nativeTransfers: { fromUserAccount: string; toUserAccount: string; amount: number }[]
  ): { valid: boolean; reason: string } {
    const requiredAmount = parseFloat(intent.amount) + parseFloat(intent.platformFee || '0');
    const tokenSymbol = intent.tokenSymbol;

    if (tokenSymbol === 'SOL') {
      const solTransfer = nativeTransfers.find(t => t.toUserAccount === platformAddress);
      if (!solTransfer) {
        return { valid: false, reason: 'No SOL transfer to platform wallet' };
      }

      const receivedAmount = solTransfer.amount / 1_000_000_000;
      if (receivedAmount < requiredAmount * 0.99) {
        return { 
          valid: false, 
          reason: `Insufficient amount: received ${receivedAmount} SOL, required ${requiredAmount} SOL` 
        };
      }

      return { valid: true, reason: 'OK' };
    }

    const tokenTransfer = tokenTransfers.find(t => 
      t.toUserAccount === platformAddress && 
      t.mint === intent.tokenMint
    );

    if (!tokenTransfer) {
      return { valid: false, reason: `No ${tokenSymbol} transfer to platform wallet` };
    }

    if (tokenTransfer.tokenAmount < requiredAmount * 0.99) {
      return { 
        valid: false, 
        reason: `Insufficient amount: received ${tokenTransfer.tokenAmount} ${tokenSymbol}, required ${requiredAmount} ${tokenSymbol}` 
      };
    }

    return { valid: true, reason: 'OK' };
  }
}

export const heliusWebhookHandler = HeliusWebhookHandler.getInstance();
