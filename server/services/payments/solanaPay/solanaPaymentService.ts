/**
 * Solana Payment Service - Intent management and payment processing
 * ISOLATED: Completely separate from x402 EVM infrastructure
 */

import { nanoid, customAlphabet } from 'nanoid';

const memoAlphabet = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
import { db } from '../../../db.js';
import { 
  solanaPaymentIntents, 
  solanaProcessedSignatures,
  solanaFeeTiers,
  solanaPaymentMetrics,
  type SolanaPaymentIntent,
  type InsertSolanaPaymentIntent,
  type SolanaFeeTier,
} from '@shared/schema.js';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { 
  solanaWalletManager, 
  SUPPORTED_TOKENS, 
  DEFAULT_INTENT_EXPIRATION_MINUTES,
  INTENT_STATUSES,
  getTokenBySymbol,
  type SupportedToken,
} from './constants.js';
import { PLATFORM_WALLETS } from '../../../utils/facilitatorHelper.js';

export interface CreateIntentRequest {
  amount: string;
  tokenSymbol: 'USDC';
  serviceName: string;
  serviceSlug?: string;
  customerWallet?: string;
  customerId?: string;
  partnerId?: string;
  isTestMode?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateIntentResponse {
  intentId: string;
  status: string;
  payment: {
    amount: string;
    tokenSymbol: string;
    tokenMint: string;
    recipientAddress: string;
    memoTag: string;
  };
  fees: {
    platformFee: string;
    platformFeeUsd: string;
    totalAmount: string;
    feePercentage: string;
  };
  expiresAt: string;
  instructions: {
    wallet: string;
    explorerLink: string;
  };
}

export interface FeeCalculation {
  baseAmount: number;
  feeAmount: number;
  feeAmountUsd: number;
  totalAmount: number;
  feePercentage: number;
  feeTierName: string;
}

class SolanaPaymentService {
  private static instance: SolanaPaymentService;
  private defaultFeeTier: SolanaFeeTier | null = null;

  private constructor() {}

  static getInstance(): SolanaPaymentService {
    if (!SolanaPaymentService.instance) {
      SolanaPaymentService.instance = new SolanaPaymentService();
    }
    return SolanaPaymentService.instance;
  }

  async initialize(): Promise<boolean> {
    const walletReady = solanaWalletManager.initialize();
    if (!walletReady) {
      console.warn('⚠️ Solana Payment Service: Wallet not ready');
      return false;
    }

    await this.loadDefaultFeeTier();
    console.log('✅ Solana Payment Service initialized');
    return true;
  }

  private async loadDefaultFeeTier(): Promise<void> {
    try {
      const [tier] = await db
        .select()
        .from(solanaFeeTiers)
        .where(and(eq(solanaFeeTiers.isActive, true), eq(solanaFeeTiers.isDefault, true)))
        .limit(1);
      
      this.defaultFeeTier = tier || null;
      
      if (!this.defaultFeeTier) {
        console.warn('⚠️ No default fee tier found, using fallback');
      }
    } catch (error) {
      console.error('Failed to load fee tier:', error);
    }
  }

  private generateIntentId(): string {
    return `sol_intent_${nanoid(16)}`;
  }

  private generateMemoTag(): string {
    return `CRPAY-${memoAlphabet()}`;
  }

  async calculateFees(amount: number, _tokenSymbol: 'USDC'): Promise<FeeCalculation> {
    const tier = this.defaultFeeTier;
    
    const percentageFee = tier ? parseFloat(tier.percentageFee) : 0.005;
    const minFeeUsdc = tier ? parseFloat(tier.minimumFeeUsdc) : 0.25;
    const tierName = tier?.name || 'standard';

    const calculatedFee = amount * percentageFee;
    const feeAmount = Math.max(calculatedFee, minFeeUsdc);
    const feeAmountUsd = feeAmount;

    return {
      baseAmount: amount,
      feeAmount,
      feeAmountUsd,
      totalAmount: amount + feeAmount,
      feePercentage: percentageFee,
      feeTierName: tierName,
    };
  }

  async createIntent(request: CreateIntentRequest): Promise<CreateIntentResponse> {
    const recipientAddress = PLATFORM_WALLETS.solana;

    const token = getTokenBySymbol('USDC');
    if (!token) {
      throw new Error(`Unsupported token: ${request.tokenSymbol}`);
    }

    const amount = parseFloat(request.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount');
    }

    const fees = await this.calculateFees(amount, request.tokenSymbol);
    const intentId = this.generateIntentId();
    const memoTag = this.generateMemoTag();
    const expiresAt = new Date(Date.now() + DEFAULT_INTENT_EXPIRATION_MINUTES * 60 * 1000);

    const amountUsd = amount;

    const intent: InsertSolanaPaymentIntent = {
      id: intentId,
      amount: amount.toString(),
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      amountUsd: amountUsd.toFixed(2),
      memoTag,
      recipientAddress,
      recipientAta: token.ataRequired ? null : null,
      customerWallet: request.customerWallet || null,
      customerId: request.customerId || null,
      serviceName: request.serviceName,
      serviceSlug: request.serviceSlug || null,
      status: INTENT_STATUSES.PENDING,
      platformFee: fees.feeAmount.toString(),
      platformFeeUsd: fees.feeAmountUsd.toFixed(2),
      feePercentage: fees.feePercentage.toFixed(4),
      expiresAt,
      partnerId: request.partnerId || null,
      isTestMode: request.isTestMode || false,
      metadata: request.metadata || null,
    };

    await db.insert(solanaPaymentIntents).values(intent);

    return {
      intentId,
      status: INTENT_STATUSES.PENDING,
      payment: {
        amount: amount.toString(),
        tokenSymbol: token.symbol,
        tokenMint: token.mint,
        recipientAddress,
        memoTag,
      },
      fees: {
        platformFee: fees.feeAmount.toFixed(token.decimals > 6 ? 9 : 6),
        platformFeeUsd: fees.feeAmountUsd.toFixed(2),
        totalAmount: fees.totalAmount.toFixed(token.decimals > 6 ? 9 : 6),
        feePercentage: (fees.feePercentage * 100).toFixed(2) + '%',
      },
      expiresAt: expiresAt.toISOString(),
      instructions: {
        wallet: `Send ${fees.totalAmount.toFixed(token.decimals > 6 ? 9 : 6)} ${token.symbol} to ${recipientAddress} with memo: ${memoTag}`,
        explorerLink: `https://solscan.io/account/${recipientAddress}`,
      },
    };
  }

  async getIntentById(intentId: string): Promise<SolanaPaymentIntent | null> {
    const [intent] = await db
      .select()
      .from(solanaPaymentIntents)
      .where(eq(solanaPaymentIntents.id, intentId))
      .limit(1);
    
    return intent || null;
  }

  async getIntentByMemo(memoTag: string): Promise<SolanaPaymentIntent | null> {
    const [intent] = await db
      .select()
      .from(solanaPaymentIntents)
      .where(eq(solanaPaymentIntents.memoTag, memoTag))
      .limit(1);
    
    return intent || null;
  }

  async markIntentPaid(
    intentId: string, 
    txSignature: string, 
    confirmedSlot?: number,
    confirmationStatus?: string
  ): Promise<SolanaPaymentIntent | null> {
    const [updated] = await db
      .update(solanaPaymentIntents)
      .set({
        status: INTENT_STATUSES.CONFIRMING,
        txSignature,
        confirmedSlot: confirmedSlot || null,
        confirmationStatus: confirmationStatus || 'confirmed',
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solanaPaymentIntents.id, intentId))
      .returning();
    
    return updated || null;
  }

  async markIntentSettled(intentId: string): Promise<SolanaPaymentIntent | null> {
    const [updated] = await db
      .update(solanaPaymentIntents)
      .set({
        status: INTENT_STATUSES.SUCCEEDED,
        confirmationStatus: 'finalized',
        settledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(solanaPaymentIntents.id, intentId))
      .returning();
    
    return updated || null;
  }

  async markIntentFailed(intentId: string, error: string): Promise<SolanaPaymentIntent | null> {
    const [updated] = await db
      .update(solanaPaymentIntents)
      .set({
        status: INTENT_STATUSES.FAILED,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(solanaPaymentIntents.id, intentId))
      .returning();
    
    return updated || null;
  }

  async expireOldIntents(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(solanaPaymentIntents)
      .set({
        status: INTENT_STATUSES.EXPIRED,
        updatedAt: now,
      })
      .where(
        and(
          eq(solanaPaymentIntents.status, INTENT_STATUSES.PENDING),
          lt(solanaPaymentIntents.expiresAt, now)
        )
      )
      .returning();
    
    return result.length;
  }

  async isSignatureProcessed(txSignature: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(solanaProcessedSignatures)
      .where(eq(solanaProcessedSignatures.txSignature, txSignature))
      .limit(1);
    
    return !!existing;
  }

  async recordProcessedSignature(txSignature: string, intentId: string): Promise<void> {
    await db.insert(solanaProcessedSignatures).values({
      txSignature,
      intentId,
    }).onConflictDoNothing();
  }

  async listPricingTiers(): Promise<SolanaFeeTier[]> {
    return db
      .select()
      .from(solanaFeeTiers)
      .where(eq(solanaFeeTiers.isActive, true));
  }

  async getSupportedTokens(): Promise<SupportedToken[]> {
    return Object.values(SUPPORTED_TOKENS);
  }

  isReady(): boolean {
    return solanaWalletManager.isReady();
  }

  async verifyPaidIntent(intentId: string): Promise<{ valid: boolean; intent: SolanaPaymentIntent | null; error?: string }> {
    try {
      const intent = await this.getIntentById(intentId);
      
      if (!intent) {
        return { valid: false, intent: null, error: 'Intent not found' };
      }

      if (intent.status === INTENT_STATUSES.SUCCEEDED) {
        return { valid: true, intent };
      }

      if (intent.status === INTENT_STATUSES.CONFIRMING) {
        return { valid: true, intent };
      }

      if (intent.status === INTENT_STATUSES.PENDING && intent.expiresAt && new Date(intent.expiresAt) < new Date()) {
        return { valid: false, intent, error: 'Payment not received before intent expiration' };
      }

      return { valid: false, intent, error: `Intent status is ${intent.status}, payment not confirmed` };
    } catch (error) {
      return { valid: false, intent: null, error: error instanceof Error ? error.message : 'Verification failed' };
    }
  }

  async verifyPaidIntentByServiceSlug(serviceSlug: string, customerId?: string): Promise<{ valid: boolean; intent: SolanaPaymentIntent | null; error?: string }> {
    try {
      const conditions = [
        eq(solanaPaymentIntents.serviceSlug, serviceSlug),
        eq(solanaPaymentIntents.status, INTENT_STATUSES.SUCCEEDED),
      ];
      
      if (customerId) {
        conditions.push(eq(solanaPaymentIntents.customerId, customerId));
      }

      const [intent] = await db
        .select()
        .from(solanaPaymentIntents)
        .where(and(...conditions))
        .orderBy(desc(solanaPaymentIntents.paidAt))
        .limit(1);

      if (!intent) {
        return { valid: false, intent: null, error: 'No paid intent found for this service' };
      }

      return { valid: true, intent };
    } catch (error) {
      return { valid: false, intent: null, error: error instanceof Error ? error.message : 'Verification failed' };
    }
  }

  async recordServiceMetric(intentId: string, serviceSlug: string, success: boolean, latencyMs: number): Promise<void> {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const serviceMetric = JSON.stringify({
        success: success ? 1 : 0,
        failed: success ? 0 : 1,
        totalLatencyMs: latencyMs,
        lastIntentId: intentId,
        lastRecordedAt: new Date().toISOString(),
      });
      const updated = await db.update(solanaPaymentMetrics)
        .set({
          byService: sql`
            jsonb_set(
              coalesce(${solanaPaymentMetrics.byService}, '{}'::jsonb),
              array[${serviceSlug}],
              (
                coalesce(${solanaPaymentMetrics.byService} -> ${serviceSlug}, '{}'::jsonb)
                || ${serviceMetric}::jsonb
              ),
              true
            )
          `,
          totalPaymentsReceived: sql`${solanaPaymentMetrics.totalPaymentsReceived} + ${success ? 1 : 0}`,
          totalPaymentsFailed: sql`${solanaPaymentMetrics.totalPaymentsFailed} + ${success ? 0 : 1}`,
          updatedAt: new Date(),
        })
        .where(eq(solanaPaymentMetrics.date, date))
        .returning({ id: solanaPaymentMetrics.id });
      if (updated.length === 0) {
        await db.insert(solanaPaymentMetrics).values({
          date,
          totalPaymentsReceived: success ? 1 : 0,
          totalPaymentsFailed: success ? 0 : 1,
          byService: { [serviceSlug]: JSON.parse(serviceMetric) },
        });
      }
    } catch (error) {
      console.error('Failed to record service metric:', error);
    }
  }
}

export const solanaPaymentService = SolanaPaymentService.getInstance();
