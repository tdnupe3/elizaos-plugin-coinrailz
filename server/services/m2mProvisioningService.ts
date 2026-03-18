/**
 * M2M Provisioning Service — shared idempotent credit + API key provisioning.
 *
 * Used by:
 *   - POST /api/m2m/credits/purchase  (direct PaymentIntent path)
 *   - GET  /api/m2m/credits/purchase/:id (3DS recovery path)
 *   - POST /api/m2m/credits/checkout/session webhook (Stripe Checkout Session path)
 *
 * Guarantees: exactly-once provisioning per Stripe payment reference.
 * Uses two-phase tracking (pending → used) with crash recovery after 2 minutes.
 */

import { db } from '../db.js';
import { paymentIntentTracking, creditTransactions } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { creditsService } from './creditsService.js';

export interface ProvisionParams {
  /** Stripe PaymentIntent ID (pi_...) or Checkout Session ID (cs_...) used as idempotency key */
  paymentIntentId: string;
  /** Deterministic userId derived from payment reference */
  userId: string;
  /** USD amount — must match allowed tiers */
  amount: number;
  email: string;
  keyName: string;
  /** Payment rail description stored in tracking row (default: 'm2m-credits') */
  purpose?: string;
}

export interface ProvisionResult {
  alreadyProvisioned?: boolean;
  inProgress?: boolean;
  apiKey?: string;
  keyPrefix?: string;
  keyId?: string;
  newBalance?: number;
  transactionId?: number;
}

const CRASH_RECOVERY_MS = 2 * 60 * 1000;

/**
 * Crash-safe provisioning: add credits + generate API key with two-phase status tracking.
 *
 * Phase 1: Insert tracking row with status='pending' (locks the provisioning slot)
 * Phase 2: Do the work (addCredits + generateApiKey)
 * Phase 3: Update tracking row to status='used'
 *
 * On retry:
 *   - status='used'  → alreadyProvisioned (no double-grant)
 *   - status='pending' < 2 min → inProgress (caller retries)
 *   - status='pending' > 2 min → stale crash, delete and retry
 */
export async function provisionCreditsAndKey(params: ProvisionParams): Promise<ProvisionResult> {
  const { paymentIntentId, userId, amount, email, keyName, purpose = 'm2m-credits' } = params;

  const existing = await db.query.paymentIntentTracking.findFirst({
    where: eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
  });

  if (existing && existing.purpose === purpose) {
    if (existing.status === 'used') {
      return { alreadyProvisioned: true };
    }
    if (existing.status === 'pending') {
      const age = Date.now() - (existing.usedAt?.getTime() || existing.createdAt?.getTime() || 0);
      if (age < CRASH_RECOVERY_MS) {
        return { inProgress: true };
      }
      console.warn(`⚠️ M2M provisioning recovery: stale pending row for ${paymentIntentId} (${Math.round(age / 1000)}s old), retrying`);
      await db.delete(paymentIntentTracking)
        .where(and(
          eq(paymentIntentTracking.paymentIntentId, paymentIntentId),
          eq(paymentIntentTracking.purpose, purpose)
        ));
    }
  }

  try {
    await db.insert(paymentIntentTracking).values({
      paymentIntentId,
      customerEmail: email,
      amount: Math.round(amount * 100),
      currency: 'usd',
      purpose,
      taskDescription: `M2M Credits — $${amount}`,
      metadata: { userId, amount, keyName, source: purpose },
      status: 'pending',
    });
  } catch (insertErr: any) {
    if (insertErr?.code === '23505' || insertErr?.message?.includes('unique')) {
      return { inProgress: true };
    }
    throw insertErr;
  }

  try {
    const existingCredit = await db.query.creditTransactions.findFirst({
      where: eq(creditTransactions.referenceId, paymentIntentId),
    });

    let creditResult: { newBalance: number; transactionId: number };

    if (existingCredit) {
      console.warn(`⚠️ M2M crash recovery: credits already exist for ${paymentIntentId}, skipping addCredits`);
      const balance = await creditsService.getBalance(userId);
      creditResult = { newBalance: balance, transactionId: existingCredit.id };
    } else {
      creditResult = await creditsService.addCredits({
        userId,
        amount,
        paymentMethod: 'stripe-m2m',
        referenceId: paymentIntentId,
        description: `M2M card purchase — $${amount} via Stripe`,
        metadata: { source: purpose, paymentIntentId, email },
      });
    }

    const keyResult = await creditsService.generateApiKey(userId, keyName);

    await db.update(paymentIntentTracking)
      .set({ status: 'used' })
      .where(eq(paymentIntentTracking.paymentIntentId, paymentIntentId));

    return {
      apiKey: keyResult.apiKey,
      keyPrefix: keyResult.keyPrefix,
      keyId: keyResult.keyId,
      newBalance: creditResult.newBalance,
      transactionId: creditResult.transactionId,
    };

  } catch (workErr: any) {
    console.error(`❌ M2M provisioning work failed for ${paymentIntentId}:`, workErr?.message);
    throw workErr;
  }
}
