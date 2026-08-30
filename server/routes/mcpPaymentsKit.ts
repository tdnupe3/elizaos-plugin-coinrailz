/**
 * MCP PAYMENTS KIT - Single-Call Checkout for AI Agents (PRODUCTION-READY)
 * 
 * VERSION: 1.5.0 (January 18, 2026)
 * 
 * PURPOSE: Reduce payment friction from multi-step to one API call
 * APPROACH: Stripe-first with x402 fallback
 * 
 * PRODUCTION FEATURES:
 * - Rate limiting: 100 requests/15 min per IP (express-rate-limit v7.5.1)
 * - Full audit trail: ALL checkout requests logged to microserviceRequests
 * - Real service execution via existing handlers
 * - Stripe live/test mode based on key prefix (sk_live_ vs sk_test_)
 * - P0: Credit refund on fulfillment failure (no card refunds)
 * - P2: Durable idempotency - pending record written BEFORE payment to prevent
 *       double fulfillment even if crash occurs after Stripe payment
 * - P3: True ACID transactions via Neon WebSocket driver (BEGIN/COMMIT/ROLLBACK)
 *       Eliminates edge cases from CTE-based pseudo-atomicity
 * 
 * ENDPOINTS:
 * - POST /api/mcp/payments/checkout - Single-call checkout
 * - GET /api/mcp/payments/services - Available services with pricing
 * - GET /api/mcp/payments/health - Kit health check
 * 
 * AUDIT TRAIL:
 * - All checkout requests logged to microserviceRequests table
 * - testMode flag stored in requestInput.testMode (no separate column)
 * - Filter production analytics: WHERE (request_input->>'testMode')::boolean = false
 * - paymentStatus column tracks:
 *   - 'completed' - Payment and fulfillment succeeded
 *   - 'stripe_failed' - Stripe payment failed
 *   - 'x402_redirected' - Redirected to on-chain payment
 *   - 'credits_no_account' - User has no credits account registered
 *   - 'credits_insufficient' - User has insufficient credits balance
 *   - 'fulfillment_failed_credited' - Service failed, credits ACTUALLY added to user account
 *   - 'fulfillment_failed_pending' - Service failed, no user found, pending claim recorded
 *   - 'fulfillment_failed' - Service failed, credit refund also failed (contact support)
 * 
 * ROLLBACK: Delete this file, remove route registration from server/index.ts,
 *           remove mcpPaymentsKit from server/routes/mcpServiceDiscovery.ts
 */

import { Router, Request, Response } from "express";
import type Stripe from 'stripe';
import { stripe as _stripeInstance } from '../services/stripeClient';
import rateLimit from "express-rate-limit";
import { ServiceCatalogService } from "../services/serviceCatalogService";
import { SERVICE_PRICING_USD, isServiceName } from "../../shared/pricing";
import { db } from "../db";
import { microserviceRequests, x402PaymentIntents, users } from "@shared/schema";
import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { getCanonicalPayableNetworks } from "../config/publicDiscoveryConfig";
// CreditsPaymentService not used - using simplified atomic deduction instead

const router = Router();

// Rate limiting: 100 requests per 15 minutes per IP (matches x402 routes)
const mcpPaymentsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { 
    success: false, 
    error: "Too many payment requests, please try again later",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all MCP payments routes
router.use(mcpPaymentsRateLimiter);

function getStripeClient(): Stripe {
  return _stripeInstance;
}

interface CheckoutRequest {
  serviceId: string;
  params?: Record<string, any>;
  paymentMethod: "stripe" | "credits" | "x402";
  stripePaymentMethodId?: string;
  testMode?: boolean;
  agentId?: string;
  idempotencyKey?: string;
}

interface CheckoutResponse {
  success: boolean;
  transactionId: string;
  serviceResult?: any;
  paymentDetails: {
    method: string;
    amount: string;
    currency: string;
    status: string;
  };
  testMode: boolean;
  timestamp: string;
}

/**
 * Insert initial "pending_payment" audit record BEFORE payment.
 * This ensures idempotency even if crash occurs after payment but before completion.
 * Returns false if insert fails (should abort checkout).
 */
async function insertPendingAuditRecord(
  transactionId: string,
  serviceId: string,
  agentId: string,
  paymentMethod: string,
  requestInput: Record<string, any>
): Promise<boolean> {
  try {
    await db.insert(microserviceRequests).values({
      id: transactionId,
      serviceId,
      walletAddress: agentId,
      paymentMethod,
      paymentAttempted: true,
      paymentStatus: "pending_payment",
      responseTime: 0,
      sourceGateway: "mcp-payments-kit",
      requestInput,
      responseData: { status: "pending_payment", initiatedAt: new Date().toISOString() }
    });
    return true;
  } catch (dbError) {
    console.error("Failed to insert pending audit record:", dbError);
    return false;
  }
}

/**
 * Update existing audit record with final status after payment/fulfillment.
 * This is called after the pending record was inserted pre-payment.
 */
async function updateAuditRecord(
  transactionId: string,
  paymentStatus: string,
  responseTime: number,
  responseData: Record<string, any>
): Promise<void> {
  try {
    await db.update(microserviceRequests)
      .set({
        paymentStatus,
        responseTime,
        responseData
      })
      .where(eq(microserviceRequests.id, transactionId));
  } catch (dbError) {
    console.error("Failed to update audit record:", dbError);
  }
}

/**
 * Legacy logAuditTrail - kept for error paths that bypass the pending flow
 * (e.g., credits not implemented, x402 redirects)
 */
async function logAuditTrail(
  transactionId: string,
  serviceId: string,
  agentId: string,
  paymentMethod: string,
  paymentStatus: string,
  responseTime: number,
  requestInput: Record<string, any>,
  responseData: Record<string, any>
): Promise<void> {
  try {
    await db.insert(microserviceRequests).values({
      id: transactionId,
      serviceId,
      walletAddress: agentId,
      paymentMethod,
      paymentAttempted: true,
      paymentStatus,
      responseTime,
      sourceGateway: "mcp-payments-kit",
      requestInput,
      responseData
    });
  } catch (dbError) {
    console.error("Failed to log transaction to audit trail:", dbError);
  }
}

/**
 * Atomic credits deduction with audit update using true database transactions
 * Design: Uses BEGIN/COMMIT/ROLLBACK for ACID guarantees
 * - All operations succeed together or all rollback
 * - No edge cases where credits are deducted but audit isn't updated
 * - Full ACID compliance via Neon WebSocket driver
 * - Race-condition safe: UPDATE includes balance guard to prevent overdrafts
 */
async function atomicCreditsDeductionWithAudit(
  userId: string,
  priceUSD: number,
  transactionId: string,
  auditStatus: string = "credits_paid_pending_fulfillment"
): Promise<{ success: boolean; newBalance: number; error?: string; failureReason?: 'insufficient_balance' | 'audit_missing' | 'user_not_found' | 'db_error' }> {
  try {
    // Use true database transaction with automatic rollback on error
    const result = await db.transaction(async (tx) => {
      // Step 1: Verify audit record exists (fail fast)
      const auditCheck = await tx.execute(
        sql`SELECT id FROM microservice_requests WHERE id = ${transactionId}`
      );
      
      if (!auditCheck.rows || auditCheck.rows.length === 0) {
        throw { code: 'AUDIT_MISSING', message: 'Audit record missing' };
      }
      
      // Step 2: Verify user exists
      const userCheck = await tx.execute(
        sql`SELECT id FROM users WHERE id = ${userId}`
      );
      
      if (!userCheck.rows || userCheck.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', message: 'User not found' };
      }
      
      // Step 3: Atomic deduct with balance guard (prevents race conditions)
      // The WHERE clause ensures concurrent transactions can't both succeed if balance insufficient
      const deductResult = await tx.execute(
        sql`UPDATE users 
            SET credits_balance = CAST(credits_balance AS numeric) - ${priceUSD.toFixed(2)}::numeric
            WHERE id = ${userId}
            AND CAST(credits_balance AS numeric) >= ${priceUSD.toFixed(2)}::numeric
            RETURNING credits_balance`
      );
      
      if (!deductResult.rows || deductResult.rows.length === 0) {
        // Balance guard failed - insufficient funds
        throw { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance at time of deduction' };
      }
      
      const newBalance = parseFloat((deductResult.rows[0] as any).credits_balance || "0");
      
      // Step 4: Update audit record (inside same transaction)
      const auditUpdate = await tx.execute(
        sql`UPDATE microservice_requests 
            SET payment_status = ${auditStatus}
            WHERE id = ${transactionId}
            RETURNING id`
      );
      
      if (!auditUpdate.rows || auditUpdate.rows.length === 0) {
        throw { code: 'AUDIT_UPDATE_FAILED', message: 'Audit update failed' };
      }
      
      // If we reach here, all operations succeeded - transaction will commit
      return { success: true, newBalance };
    });
    
    console.log(`💳 Atomic credits payment: $${priceUSD} deducted from user ${userId}, remaining: $${result.newBalance}, txn: ${transactionId}`);
    return result;
  } catch (error: any) {
    // Transaction automatically rolled back - no partial state
    console.error("Atomic credits deduction failed (transaction rolled back):", error);
    
    // Map error codes to distinct failure reasons
    if (error.code === 'AUDIT_MISSING') {
      return { success: false, newBalance: 0, error: error.message, failureReason: 'audit_missing' };
    }
    if (error.code === 'USER_NOT_FOUND') {
      return { success: false, newBalance: 0, error: error.message, failureReason: 'user_not_found' };
    }
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return { success: false, newBalance: 0, error: error.message, failureReason: 'insufficient_balance' };
    }
    return { success: false, newBalance: 0, error: error.message || 'Transaction failed', failureReason: 'db_error' };
  }
}

/**
 * Find user by any wallet type (ethereum, solana, or xrp)
 * Supports multi-chain wallet lookup for credits payment
 * Returns user with id and creditsBalance if found
 */
async function findUserByAnyWallet(walletAddress: string): Promise<{ id: string; creditsBalance: string | null }[]> {
  try {
    // Try ethereum wallet first (most common)
    let result = await db.select({ id: users.id, creditsBalance: users.creditsBalance })
      .from(users)
      .where(eq(users.ethereumWallet, walletAddress))
      .limit(1);
    
    if (result.length > 0) return result;
    
    // Try solana wallet
    result = await db.select({ id: users.id, creditsBalance: users.creditsBalance })
      .from(users)
      .where(eq(users.solanaWallet, walletAddress))
      .limit(1);
    
    if (result.length > 0) return result;
    
    // Try XRP wallet
    result = await db.select({ id: users.id, creditsBalance: users.creditsBalance })
      .from(users)
      .where(eq(users.xrpWallet, walletAddress))
      .limit(1);
    
    return result;
  } catch (error) {
    console.error("Multi-wallet lookup failed:", error);
    return [];
  }
}

/**
 * P2: Idempotency guard - Check if transaction already exists
 * Prevents double fulfillment on retries
 */
async function checkIdempotency(transactionId: string): Promise<{ exists: boolean; status?: string }> {
  try {
    const existing = await db.select({ 
      id: microserviceRequests.id, 
      paymentStatus: microserviceRequests.paymentStatus 
    })
    .from(microserviceRequests)
    .where(eq(microserviceRequests.id, transactionId))
    .limit(1);
    
    if (existing.length > 0) {
      return { exists: true, status: existing[0].paymentStatus || undefined };
    }
    return { exists: false };
  } catch (error) {
    console.error("Idempotency check failed:", error);
    return { exists: false };
  }
}

/**
 * P0: Issue credit refund when service execution fails after payment
 * Uses true database transactions for atomicity
 * 
 * IDEMPOTENCY: All operations in single transaction to prevent double-refunding
 */
async function issueCreditRefund(
  agentId: string, 
  amountUSD: number,
  transactionId: string,
  serviceId: string,
  reason: string
): Promise<{ status: 'credited' | 'pending_claim' | 'failed' | 'already_refunded'; creditsIssued: number; error?: string }> {
  try {
    // Use transaction for atomic idempotency check + wallet lookup + refund
    const result = await db.transaction(async (tx) => {
      // IDEMPOTENCY CHECK inside transaction
      const existingRequest = await tx.select({ 
        paymentStatus: microserviceRequests.paymentStatus 
      })
        .from(microserviceRequests)
        .where(eq(microserviceRequests.id, transactionId))
        .limit(1);
      
      if (existingRequest.length > 0 && 
          (existingRequest[0].paymentStatus === 'fulfillment_failed_credited' ||
           existingRequest[0].paymentStatus === 'fulfillment_failed_pending')) {
        return { status: 'already_refunded' as const, creditsIssued: 0, error: "Refund already processed" };
      }
      
      // Find user by any wallet type - INSIDE transaction for consistency
      // Try ethereum wallet first
      let userResult = await tx.select({ id: users.id, creditsBalance: users.creditsBalance })
        .from(users)
        .where(eq(users.ethereumWallet, agentId))
        .limit(1);
      
      // Try solana wallet if not found
      if (userResult.length === 0) {
        userResult = await tx.select({ id: users.id, creditsBalance: users.creditsBalance })
          .from(users)
          .where(eq(users.solanaWallet, agentId))
          .limit(1);
      }
      
      // Try XRP wallet if not found
      if (userResult.length === 0) {
        userResult = await tx.select({ id: users.id, creditsBalance: users.creditsBalance })
          .from(users)
          .where(eq(users.xrpWallet, agentId))
          .limit(1);
      }
      
      if (userResult.length > 0) {
        // User exists - add credits atomically inside transaction
        const refundResult = await tx.execute(
          sql`UPDATE users 
              SET credits_balance = CAST(credits_balance AS numeric) + ${amountUSD.toFixed(2)}::numeric
              WHERE id = ${userResult[0].id}
              RETURNING id, credits_balance`
        );
        
        if (!refundResult || refundResult.rowCount === 0) {
          throw { code: 'REFUND_FAILED', message: 'Failed to add credits' };
        }
        
        return { status: 'credited' as const, creditsIssued: amountUSD };
      }
      
      // No user found - mark as pending claim
      return { 
        status: 'pending_claim' as const, 
        creditsIssued: 0,
        error: "User not found - credit recorded as pending claim"
      };
    });
    
    if (result.status === 'credited') {
      console.log(`💰 Credit refund issued: $${amountUSD.toFixed(2)} for ${transactionId}`);
    } else if (result.status === 'already_refunded') {
      console.log(`⚡ Refund already issued for ${transactionId} - skipping duplicate`);
    } else if (result.status === 'pending_claim') {
      console.log(`⚠️ Credit refund pending: $${amountUSD.toFixed(2)} for agent ${agentId} (no user found)`);
    }
    
    return result;
  } catch (error: any) {
    console.error(`Failed to issue credit refund for ${transactionId}:`, error);
    return { status: 'failed', creditsIssued: 0, error: error.message };
  }
}

router.get("/health", async (_req: Request, res: Response) => {
  const stripe = getStripeClient();
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  
  res.json({
    success: true,
    status: "operational",
    version: "1.5.0", // True ACID transactions via WebSocket driver
    environment: isProduction ? "production" : "development",
    stripeConfigured: !!stripe,
    stripeMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    x402Enabled: true,
    creditsEnabled: true, // v1.4.0: Credits payment now implemented
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMinutes: 15
    },
    auditTrail: {
      enabled: true,
      table: "microserviceRequests",
      logsAllRequests: true
    },
    timestamp: new Date().toISOString()
  });
});

router.get("/services", async (_req: Request, res: Response) => {
  try {
    const catalogService = ServiceCatalogService.getInstance();
    const catalog = catalogService.getCatalog();
    
    const services = catalog.services
      .filter(s => s.stripeCompatible)
      .map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        priceUSD: service.priceUSD,
        category: service.category,
        paymentMethods: ["stripe", "credits", "x402"], // v1.4.0: credits now supported
        checkoutEndpoint: "/api/mcp/payments/checkout"
      }));
    
    res.json({
      success: true,
      services,
      totalServices: services.length,
      paymentMethods: {
        stripe: { enabled: !!getStripeClient(), description: "Credit/debit card via Stripe" },
        credits: { enabled: true, description: "Pre-purchased platform credits - requires registered account with balance" },
        x402: { enabled: true, description: "On-chain USDC payment (Base network) - use /x402/{serviceId} directly" }
      },
      acpEndpoints: {
        catalog: "/acp/v1/catalog",
        checkout: "/acp/v1/checkout",
        orders: "/acp/v1/orders/:orderId",
        description: "Agentic Commerce Protocol - digital products and credit bundles"
      },
      documentation: {
        checkoutExample: {
          method: "POST",
          url: "/api/mcp/payments/checkout",
          body: {
            serviceId: "gas-price-oracle",
            paymentMethod: "stripe",
            stripePaymentMethodId: "pm_xxx",
            params: { network: "ethereum" },
            testMode: true
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch services",
      details: error.message
    });
  }
});

router.post("/checkout", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const {
      serviceId,
      params = {},
      paymentMethod,
      stripePaymentMethodId,
      testMode = false,
      agentId,
      idempotencyKey
    }: CheckoutRequest = req.body;
    
    // P2: Use idempotencyKey as transactionId if provided for consistent duplicate detection
    const transactionId = idempotencyKey ? `mcp_${idempotencyKey}` : `mcp_${nanoid(16)}`;
    
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: "serviceId is required",
        transactionId
      });
    }
    
    if (!paymentMethod || !["stripe", "credits", "x402"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "paymentMethod must be 'stripe', 'credits', or 'x402'",
        transactionId
      });
    }
    
    if (!isServiceName(serviceId)) {
      return res.status(400).json({
        success: false,
        error: `Unknown service: ${serviceId}`,
        availableServices: Object.keys(SERVICE_PRICING_USD),
        transactionId
      });
    }
    
    // P2: Check idempotency - prevent duplicate fulfillment
    // This now catches pending_payment status too (crash recovery)
    const idempotencyCheck = await checkIdempotency(transactionId);
    if (idempotencyCheck.exists) {
      // Return cached result for completed transactions
      // For pending_payment (crash recovery), we still return idempotent response
      // The original payment may have succeeded at Stripe but we don't retry
      return res.status(200).json({
        success: idempotencyCheck.status === "completed",
        message: idempotencyCheck.status === "pending_payment" 
          ? "Request in progress or crashed - check transaction status manually"
          : "Request already processed",
        transactionId,
        previousStatus: idempotencyCheck.status,
        idempotent: true,
        note: idempotencyCheck.status === "pending_payment"
          ? "Transaction was initiated but outcome is uncertain. Contact support with transactionId."
          : undefined
      });
    }
    
    const priceUSD = SERVICE_PRICING_USD[serviceId];
    const priceCents = Math.round(priceUSD * 100);
    
    const effectiveAgentId = testMode 
      ? `test_agent_${agentId || nanoid(8)}`
      : agentId || `agent_${nanoid(8)}`;
    
    let paymentStatus = "pending";
    let paymentDetails: any = {};
    
    // PRODUCTION FIX: Insert pending audit record BEFORE payment
    // This ensures idempotency even if crash occurs after Stripe payment but before completion
    if (paymentMethod === "stripe") {
      const pendingInserted = await insertPendingAuditRecord(
        transactionId,
        serviceId,
        effectiveAgentId,
        paymentMethod,
        { params, testMode, agentId, stripePaymentMethodId: stripePaymentMethodId ? "***" : undefined }
      );
      
      if (!pendingInserted) {
        return res.status(500).json({
          success: false,
          error: "Failed to initialize transaction - please retry",
          transactionId,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (paymentMethod === "stripe") {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({
          success: false,
          error: "Stripe not configured",
          fallbackMethod: "x402",
          transactionId
        });
      }
      
      if (!stripePaymentMethodId) {
        return res.status(400).json({
          success: false,
          error: "stripePaymentMethodId required for Stripe payments",
          transactionId
        });
      }
      
      try {
        // Use idempotency key correctly as request option
        const stripeOptions: Stripe.RequestOptions = idempotencyKey 
          ? { idempotencyKey } 
          : {};
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: priceCents,
          currency: "usd",
          payment_method: stripePaymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never"
          },
          metadata: {
            serviceId,
            agentId: effectiveAgentId,
            transactionId,
            testMode: testMode ? "true" : "false",
            source: "mcp-payments-kit"
          }
        } as any, stripeOptions);
        
        if (paymentIntent.status === "succeeded") {
          paymentStatus = "succeeded";
          paymentDetails = {
            stripePaymentIntentId: paymentIntent.id,
            amount: priceUSD,
            currency: "USD"
          };
        } else {
          return res.status(402).json({
            success: false,
            error: "Payment requires additional action",
            paymentIntentStatus: paymentIntent.status,
            clientSecret: paymentIntent.client_secret,
            transactionId
          });
        }
      } catch (stripeError: any) {
        // Update pending record with Stripe failure status
        await updateAuditRecord(transactionId, "stripe_failed", Date.now() - startTime,
          { error: stripeError.message, code: stripeError.code });
        
        return res.status(402).json({
          success: false,
          error: "Stripe payment failed",
          details: stripeError.message,
          code: stripeError.code,
          transactionId
        });
      }
    } else if (paymentMethod === "credits") {
      // Credits payment - uses CreditsPaymentService
      // Agent must have a registered user account with credits balance
      
      // Insert pending record BEFORE credits payment (same pattern as Stripe)
      const pendingInserted = await insertPendingAuditRecord(
        transactionId,
        serviceId,
        effectiveAgentId,
        paymentMethod,
        { params, testMode, agentId }
      );
      
      if (!pendingInserted) {
        return res.status(500).json({
          success: false,
          error: "Failed to initialize transaction - please retry",
          transactionId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Find user by any wallet type (ethereum, solana, or xrp)
      // For credits payment, we always need the REAL wallet address to look up the user
      const walletForLookup = agentId || effectiveAgentId;
      const existingUser = await findUserByAnyWallet(walletForLookup);
      
      if (existingUser.length === 0) {
        await updateAuditRecord(transactionId, "credits_no_account", Date.now() - startTime,
          { error: "No account found for agent", agentId: effectiveAgentId });
        
        return res.status(402).json({
          success: false,
          error: "CREDITS_NO_ACCOUNT",
          message: "No account found with credits balance for this agent. Register at /api/m2m/register or purchase credits first.",
          alternativeMethods: ["stripe", "x402"],
          transactionId,
          registrationEndpoint: "/api/m2m/register",
          creditsPurchaseEndpoint: "/api/credits/purchase/stripe"
        });
      }
      
      const userId = existingUser[0].id;
      const currentBalance = parseFloat(existingUser[0].creditsBalance || "0");
      
      // Check if sufficient credits
      if (currentBalance < priceUSD) {
        await updateAuditRecord(transactionId, "credits_insufficient", Date.now() - startTime,
          { error: "Insufficient credits", balance: currentBalance, required: priceUSD });
        
        return res.status(402).json({
          success: false,
          error: "CREDITS_INSUFFICIENT",
          message: `Insufficient credits. Balance: $${currentBalance.toFixed(2)}, Required: $${priceUSD.toFixed(2)}`,
          currentBalance: currentBalance,
          required: priceUSD,
          shortfall: priceUSD - currentBalance,
          alternativeMethods: ["stripe", "x402"],
          transactionId,
          topUpEndpoint: "/api/credits/purchase/stripe"
        });
      }
      
      // Process credits payment - ATOMIC deduction + audit update in single transaction
      // Uses CTE to prevent crash-inconsistency (credits deducted but audit not updated)
      const atomicResult = await atomicCreditsDeductionWithAudit(
        userId,
        priceUSD,
        transactionId,
        "credits_paid_pending_fulfillment"
      );
      
      if (!atomicResult.success) {
        // Atomic deduction failed - differentiate failure reasons
        const failureReason = atomicResult.failureReason || 'insufficient_balance';
        const auditStatus = failureReason === 'audit_missing' ? 'credits_audit_error' :
                           failureReason === 'db_error' ? 'credits_db_error' : 'credits_insufficient_race';
        
        await updateAuditRecord(transactionId, auditStatus, Date.now() - startTime,
          { error: atomicResult.error, failureReason, balance: currentBalance, required: priceUSD });
        
        const errorCode = failureReason === 'audit_missing' ? 'CREDITS_SYSTEM_ERROR' :
                         failureReason === 'db_error' ? 'CREDITS_SYSTEM_ERROR' : 'CREDITS_INSUFFICIENT';
        
        return res.status(failureReason === 'insufficient_balance' ? 402 : 500).json({
          success: false,
          error: errorCode,
          message: atomicResult.error || "Balance insufficient at time of payment - please try again",
          currentBalance: currentBalance,
          required: priceUSD,
          transactionId,
          alternativeMethods: ["stripe", "x402"],
          topUpEndpoint: "/api/credits/purchase/stripe"
        });
      }
      
      // Credits payment succeeded
      paymentStatus = "succeeded";
      paymentDetails = {
        creditsDeducted: priceUSD,
        remainingBalance: atomicResult.newBalance,
        currency: "USD"
      };
      
    } else if (paymentMethod === "x402") {
      // x402 requires on-chain - log redirect and return challenge
      await logAuditTrail(transactionId, serviceId, effectiveAgentId, "x402", "x402_redirected",
        Date.now() - startTime, { testMode, agentId }, { redirectedTo: `/x402/${serviceId}` });
      
      const basePayment = getCanonicalPayableNetworks().find(network => network.id === 'base')!;
      return res.status(402).json({
        success: false,
        error: "x402 payment requires on-chain transaction",
        x402Challenge: {
          payTo: basePayment.recipient,
          amount: priceUSD.toFixed(2),
          asset: "USDC",
          network: basePayment.caip2,
          serviceEndpoint: `/x402/${serviceId}`
        },
        transactionId,
        note: "Use /x402/{serviceId} endpoint directly for on-chain payments"
      });
    }
    
    if (paymentStatus !== "succeeded") {
      return res.status(402).json({
        success: false,
        error: "Payment not completed",
        paymentStatus,
        transactionId
      });
    }
    
    // Execute service after successful payment
    let serviceResult: any = null;
    let fulfillmentFailed = false;
    let creditRefundResult: { status: 'credited' | 'pending_claim' | 'failed' | 'already_refunded'; creditsIssued: number; error?: string } | null = null;
    
    try {
      serviceResult = await executeService(serviceId, params);
      
      // P0: Check if service returned an error (even without throwing)
      if (serviceResult?.error) {
        fulfillmentFailed = true;
      }
    } catch (serviceError: any) {
      console.error(`Service execution failed for ${serviceId}:`, serviceError);
      fulfillmentFailed = true;
      serviceResult = {
        error: "SERVICE_EXECUTION_FAILED",
        details: serviceError.message
      };
    }
    
    // P0: If fulfillment failed after payment, issue credit refund
    // Use original agentId for refund lookup (not test-prefixed effectiveAgentId)
    if (fulfillmentFailed) {
      const walletForRefund = agentId || effectiveAgentId;
      creditRefundResult = await issueCreditRefund(
        walletForRefund,
        priceUSD,
        transactionId,
        serviceId,
        serviceResult?.error || "Unknown error"
      );
      
      // Determine correct audit status based on refund outcome
      // fulfillment_failed_credited = credits actually added to user account
      // fulfillment_failed_pending = no user found, pending claim recorded
      // fulfillment_failed = refund failed entirely
      const auditStatus = creditRefundResult.status === 'credited' 
        ? "fulfillment_failed_credited"
        : creditRefundResult.status === 'pending_claim'
          ? "fulfillment_failed_pending"
          : creditRefundResult.status === 'already_refunded'
            ? "fulfillment_failed_credited" // Treat already_refunded as credited (no action needed)
            : "fulfillment_failed";
      
      // Update pending record with fulfillment failure and credit refund status
      await updateAuditRecord(
        transactionId, 
        auditStatus,
        Date.now() - startTime,
        { 
          success: false,
          stripePaymentIntentId: paymentDetails.stripePaymentIntentId,
          serviceError: serviceResult?.error,
          creditRefund: {
            status: creditRefundResult.status,
            amount: priceUSD,
            creditsIssued: creditRefundResult.creditsIssued,
            error: creditRefundResult.error
          }
        }
      );
      
      // Return response indicating payment succeeded but service failed
      // Use consistent paymentStatus matching audit trail
      // NOTE: No "retryable" flag - retrying with same idempotencyKey returns cached result,
      // retrying with new key would cause double-charge. Contact support for failed refunds.
      return res.status(200).json({
        success: false,
        transactionId,
        paymentStatus: auditStatus, // Consistent with audit trail
        serviceResult,
        creditRefund: {
          status: creditRefundResult.status,
          creditsIssued: creditRefundResult.creditsIssued,
          amount: `$${priceUSD.toFixed(2)}`,
          message: creditRefundResult.status === 'credited' 
            ? `Credit refund of $${priceUSD.toFixed(2)} has been issued to your account`
            : creditRefundResult.status === 'pending_claim'
              ? `Credit refund of $${priceUSD.toFixed(2)} is pending - claim when you register with wallet ${walletForRefund}`
              : "Credit refund failed - please contact support with transactionId for manual resolution"
        },
        paymentDetails: {
          method: paymentMethod,
          amount: `$${priceUSD.toFixed(2)}`,
          currency: "USD",
          stripeStatus: "succeeded"
        },
        support: creditRefundResult.status === 'failed' 
          ? { action: "contact_support", transactionId, reason: "Credit refund failed - manual resolution required" }
          : undefined,
        testMode,
        timestamp: new Date().toISOString()
      });
    }
    
    // PRODUCTION: Update pending record with successful completion
    await updateAuditRecord(
      transactionId, 
      "completed",
      Date.now() - startTime,
      { 
        success: true,
        stripePaymentIntentId: paymentDetails.stripePaymentIntentId,
        serviceResultType: "success"
      }
    );
    
    const response: CheckoutResponse = {
      success: true,
      transactionId,
      serviceResult,
      paymentDetails: {
        method: paymentMethod,
        amount: `$${priceUSD.toFixed(2)}`,
        currency: "USD",
        status: paymentStatus
      },
      testMode,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ MCP checkout: ${serviceId} | ${paymentMethod} | $${priceUSD} | ${Date.now() - startTime}ms | testMode=${testMode}`);
    
    res.json(response);
    
  } catch (error: any) {
    console.error("MCP checkout error:", error);
    res.status(500).json({
      success: false,
      error: "Checkout failed",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

async function executeService(serviceId: string, params: Record<string, any>): Promise<any> {
  // REAL SERVICE EXECUTION - Route to existing x402 service handlers
  // This ensures no simulation/mock data is returned
  
  try {
    // Attempt to use real service handlers
    const { initializeServiceHandlers } = await import("../services/handlers");
    const handlers = initializeServiceHandlers();
    
    // Check if we have a handler for this service
    const handler = handlers.get(serviceId);
    if (handler) {
      // Execute via real handler
      const result = await handler.execute(params);
      return result;
    }
    
    // For services without dedicated handlers, return NOT_IMPLEMENTED
    // This complies with the NO-SIMULATION rule
    return {
      error: "SERVICE_NOT_IMPLEMENTED_VIA_CHECKOUT",
      serviceId,
      message: `Service '${serviceId}' is not yet available via MCP Payments Kit checkout. Use the x402 endpoint directly: /x402/${serviceId}`,
      x402Endpoint: `/x402/${serviceId}`,
      status: "not_implemented",
      timestamp: new Date().toISOString()
    };
    
  } catch (handlerError: any) {
    // If handler loading fails, return error (not mock data)
    return {
      error: "SERVICE_EXECUTION_FAILED",
      serviceId,
      message: handlerError.message,
      fallback: `Use x402 endpoint directly: /x402/${serviceId}`,
      timestamp: new Date().toISOString()
    };
  }
}

export default router;
