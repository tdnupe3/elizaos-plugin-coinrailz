import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "../db";
import { usedTransactionHashes, x402Payments, x402PaymentIntents } from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { creditsService } from "../services/creditsService.js";
import { SERVICE_PRICING_MICRO, SERVICE_PRICING_USD, microToUSD, getServicePricing, getCanonicalResourceUrl } from "@shared/pricing";
import { createPaymentIntentMetadata } from "@shared/schema";

// Alchemy providers for EVM chains
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BASE_MAINNET_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ETH_MAINNET_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const baseProvider = new ethers.JsonRpcProvider(BASE_MAINNET_URL);
const ethereumProvider = new ethers.JsonRpcProvider(ETH_MAINNET_URL);
const provider = baseProvider;

// Stablecoin contract addresses on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";

// Stablecoin contract addresses on Ethereum mainnet
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT_ETH = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

// Accepted stablecoins per chain
const ACCEPTED_STABLECOINS_BASE = [
  { address: USDC_BASE, symbol: "USDC", name: "USD Coin" },
  { address: USDT_BASE, symbol: "USDT", name: "Tether USD" }
];

const ACCEPTED_STABLECOINS_ETH = [
  { address: USDC_ETH, symbol: "USDC", name: "USD Coin" },
  { address: USDT_ETH, symbol: "USDT", name: "Tether USD" }
];

const ACCEPTED_STABLECOINS = ACCEPTED_STABLECOINS_BASE;

type EvmChain = 'base' | 'ethereum';

function getProviderForChain(chain: EvmChain): ethers.JsonRpcProvider {
  return chain === 'ethereum' ? ethereumProvider : baseProvider;
}

function getStablecoinsForChain(chain: EvmChain) {
  return chain === 'ethereum' ? ACCEPTED_STABLECOINS_ETH : ACCEPTED_STABLECOINS_BASE;
}

function parseNetworkToChain(network?: string): EvmChain {
  if (!network) return 'base';
  const n = network.toLowerCase();
  if (n === 'ethereum' || n === 'eip155:1' || n === 'ethereum-mainnet') return 'ethereum';
  return 'base';
}

// Platform wallet address
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";

// Re-export centralized pricing for backward compatibility
// All pricing is now centralized in @shared/pricing.ts
export const SERVICE_PRICING = SERVICE_PRICING_MICRO;
export { SERVICE_PRICING_USD, microToUSD };

interface TransactionReceipt {
  status: boolean;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
  from: string;
  to: string;
  blockNumber: number;
}

/**
 * Hybrid Payment Middleware
 * 
 * Accepts THREE payment formats:
 * 1. API Key (prepaid credits) - X-API-KEY header
 * 2. EIP-712 signatures (standard x402) - passes through to x402-express
 * 3. Raw transaction hashes - verifies on-chain via Alchemy
 * 
 * This maintains Coinbase Bazaar compliance while adding flexibility and prepaid credits
 */
export async function hybridPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
  const xApiKey = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers["authorization"] as string | undefined;
  const xPayment = req.headers["x-payment"] as string | undefined;
  const xInternalAuth = req.headers["x-internal-auth"] as string | undefined;
  const xInternalUserId = req.headers["x-internal-user-id"] as string | undefined;
  
  // OPTION 0: Internal server-to-server authentication (Telegram Mini-App proxy)
  // This allows the Telegram backend to call x402 services on behalf of users
  // without exposing raw API keys (since we only store bcrypt hashes)
  // SECURITY: Validates JWT signature to prevent header spoofing attacks
  if (xInternalAuth && xInternalUserId) {
    // SECURITY: JWT_SECRET must be set - no fallback allowed
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("FATAL: JWT_SECRET not set - internal auth disabled");
      return res.status(500).json({
        error: "Internal authentication unavailable",
        message: "Server misconfiguration: JWT_SECRET not set"
      });
    }
    
    try {
      // Verify JWT signature (throws if invalid/expired)
      const decoded = jwt.verify(xInternalAuth, JWT_SECRET) as { userId: string; service: string };
      
      // Validate token claims
      if (decoded.service !== 'telegram-miniapp-proxy' || decoded.userId !== xInternalUserId) {
        return res.status(401).json({
          error: "Invalid internal auth token",
          message: "Token claims do not match request headers"
        });
      }
    } catch (error) {
      console.error("Internal auth token verification failed:", error);
      return res.status(401).json({
        error: "Invalid or expired internal auth token",
        message: "Token signature verification failed"
      });
    }
    const serviceName = req.path.split("/").pop() || "unknown";
    const requiredAmountUSDC = getServicePricing(serviceName);
    
    if (!requiredAmountUSDC) {
      return res.status(400).json({
        error: "Invalid service",
        serviceName
      });
    }
    
    const requiredAmountUSD = requiredAmountUSDC / 1000000;
    
    try {
      // Verify user exists and has sufficient credits
      const balance = await creditsService.getBalance(xInternalUserId);
      
      if (balance < requiredAmountUSD) {
        return res.status(402).json({
          error: "Insufficient credits",
          required: requiredAmountUSD,
          available: balance,
          message: `User needs $${requiredAmountUSD} but only has $${balance}`
        });
      }
      
      // Deduct credits
      await creditsService.deductCredits({
        userId: xInternalUserId,
        amount: requiredAmountUSD,
        serviceName,
        description: `${serviceName} via Telegram Mini-App`,
        metadata: {
          source: 'telegram_miniapp_proxy',
          endpoint: req.path
        }
      });
      
      console.log(`✅ Internal auth: User ${xInternalUserId} paid $${requiredAmountUSD} for ${serviceName} via Telegram`);
      
      // Attach userId to request for downstream handlers
      (req as any).userId = xInternalUserId;
      (req as any).serviceCost = requiredAmountUSD;
      
      return next();
    } catch (error: any) {
      console.error("Internal auth payment error:", error);
      return res.status(402).json({
        error: "Payment failed",
        message: error.message
      });
    }
  }
  
  // Extract API key from Authorization: Bearer header or X-API-KEY header
  let apiKey = xApiKey;
  if (!apiKey && authHeader?.startsWith("Bearer ")) {
    apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  }
  
  // OPTION 1: API Key authentication (prepaid credits)
  if (apiKey) {
    const serviceName = req.path.split("/").pop() || "unknown";
    const requiredAmountUSDC = getServicePricing(serviceName);
    
    if (!requiredAmountUSDC) {
      return res.status(400).json({
        error: "Invalid service",
        serviceName
      });
    }
    
    // Convert USDC micros to dollars
    const requiredAmountUSD = requiredAmountUSDC / 1000000;
    
    try {
      // Validate API key
      const validation = await creditsService.validateApiKey(apiKey);
      
      if (!validation.valid || !validation.userId) {
        return res.status(401).json({
          error: "Invalid or revoked API key",
          message: "Your API key is invalid, expired, or has been revoked"
        });
      }
      
      // Check if user has sufficient credits
      const balance = await creditsService.getBalance(validation.userId);
      
      if (balance < requiredAmountUSD) {
        return res.status(402).json({
          error: "Insufficient credits",
          required: requiredAmountUSD,
          available: balance,
          message: `You need $${requiredAmountUSD} in credits but only have $${balance}. Please purchase more credits.`
        });
      }
      
      // Deduct credits
      await creditsService.deductCredits({
        userId: validation.userId,
        amount: requiredAmountUSD,
        serviceName,
        description: `${serviceName} API call via API key`,
        metadata: {
          apiKeyId: validation.keyId,
          endpoint: req.path,
          method: req.method
        }
      });
      
      console.log(`✅ API key payment: User ${validation.userId} paid $${requiredAmountUSD} for ${serviceName}`);
      
      // Attach user info to request for downstream use
      (req as any).paidViaApiKey = true;
      (req as any).apiKeyUserId = validation.userId;
      
      // CRITICAL: Set req.user for downstream routes that expect authenticated user
      (req as any).user = { id: validation.userId };
      
      return next();
      
    } catch (error: any) {
      console.error("❌ API key payment error:", error);
      return res.status(500).json({
        error: "Payment processing failed",
        message: error.message
      });
    }
  }
  
  // OPTION 2 & 3: X-PAYMENT header (txHash or EIP-712)
  // If no X-PAYMENT header, let x402-express handle it (will return 402)
  if (!xPayment) {
    return next();
  }

  // Try to parse as Base64-encoded JSON first
  let txHash = xPayment.trim();
  let paymentAmount: number | undefined;
  let paymentChain: EvmChain = 'base';
  
  try {
    // Attempt to decode as Base64 JSON
    const decoded = Buffer.from(xPayment, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    
    // ARCHITECT FIX: Validate decoded payload structure
    if (parsed && typeof parsed === 'object') {
      // Validate txHash field
      if (parsed.txHash && typeof parsed.txHash === 'string') {
        // Validate hex format
        if (!/^0x[a-fA-F0-9]{64}$/.test(parsed.txHash)) {
          console.log(`❌ Invalid txHash format in Base64 JSON: ${parsed.txHash}`);
          return res.status(400).json({
            error: "Invalid payment proof format",
            message: "txHash must be a valid 0x-prefixed hex string"
          });
        }
        
        txHash = parsed.txHash;
        console.log("🔓 Decoded Base64 JSON payment proof");
        
        // Validate amount field (optional)
        if (parsed.amount !== undefined) {
          if (typeof parsed.amount !== 'number' || parsed.amount < 0) {
            console.log(`❌ Invalid amount in Base64 JSON: ${parsed.amount}`);
            return res.status(400).json({
              error: "Invalid payment proof format",
              message: "amount must be a positive number"
            });
          }
          paymentAmount = parsed.amount;
        }
        
        const VALID_NETWORKS = ['base', 'eip155:8453', 'ethereum', 'eip155:1', 'ethereum-mainnet'];
        if (parsed.network && !VALID_NETWORKS.includes(parsed.network)) {
          console.log(`❌ Invalid network in Base64 JSON: ${parsed.network}`);
          return res.status(400).json({
            error: "Invalid payment proof format",
            message: "network must be one of: ethereum, eip155:1, base, eip155:8453"
          });
        }
        paymentChain = parseNetworkToChain(parsed.network);
      }
    }
  } catch {
    // Not Base64 JSON - treat as raw transaction hash
  }
  
  // Check if we have a valid transaction hash
  const isRawTxHash = /^0x[a-fA-F0-9]{64}$/.test(txHash);
  
  if (!isRawTxHash) {
    // Not a valid tx hash format - check if it's a potential EIP-712 signature (Base64 encoded)
    // EIP-712 signatures are typically longer and Base64 encoded
    const isPotentialEIP712 = xPayment.length > 100 && /^[A-Za-z0-9+/=]+$/.test(xPayment);
    
    if (isPotentialEIP712) {
      // Pass to x402-express for EIP-712 verification
      console.log("🔄 X-PAYMENT detected as EIP-712 - passing to x402-express for verification");
      return next();
    }
    
    // Invalid payment proof format - reject with 400
    console.log(`❌ Invalid X-PAYMENT format (not txHash or EIP-712): ${txHash.substring(0, 50)}...`);
    return res.status(400).json({
      error: "Invalid payment proof format",
      message: "X-PAYMENT must be a valid 0x-prefixed transaction hash (66 chars) or EIP-712 signature",
      hint: "For on-chain payments, provide the full transaction hash starting with 0x"
    });
  }

  // This is a raw transaction hash - verify it on-chain
  console.log(`🔍 Raw transaction hash detected: ${txHash}`);
  
  // Extract service name from URL path
  const serviceName = req.path.split("/").pop() || "unknown";
  const requiredAmount = getServicePricing(serviceName);
  
  if (!requiredAmount) {
    console.log(`❌ Unknown service: ${serviceName}`);
    // Return 400 Bad Request for unknown services - not 402
    // Agents need clear machine-readable errors for unknown endpoints
    return res.status(400).json({
      error: "unknown_service",
      message: `Service '${serviceName}' is not a valid x402 endpoint`,
      availableEndpoint: "/x402/catalog",
      hint: "Check /x402/catalog for list of available services"
    });
  }

  // Verify transaction on-chain (detect chain from payment payload)
  verifyTransactionPayment(txHash, serviceName, requiredAmount, paymentChain)
    .then((verified) => {
      if (verified) {
        console.log(`✅ Payment verified on-chain for ${serviceName} (chain: ${paymentChain})`);
        (req as any).paymentAlreadyVerified = true;
        return next();
      } else {
        console.log(`❌ Payment verification failed for ${serviceName} (chain: ${paymentChain})`);
        return res.status(402).json({
          x402Version: 2,
          error: "Payment verification failed",
          message: "Transaction not found, insufficient amount, or already used",
          accepts: [{
            scheme: "exact",
            network: "base",
            maxAmountRequired: requiredAmount.toString(),
            resource: getCanonicalResourceUrl(serviceName),
            payTo: PLATFORM_WALLET,
            asset: USDC_BASE,
          }],
          supportedNetworks: [
            { network: "eip155:1", legacy: "ethereum" },
            { network: "eip155:8453", legacy: "base" }
          ]
        });
      }
    })
    .catch((error) => {
      console.error(`❌ Error verifying payment:`, error);
      return res.status(500).json({
        x402Version: 2,
        error: "Payment verification error",
        message: error.message
      });
    });
}

/**
 * Verify a transaction on Ethereum or Base mainnet using Payment Intent Ledger Pattern
 * Supports both eip155:1 (Ethereum) and eip155:8453 (Base)
 * 
 * Flow:
 * 1. Check for existing payment intent (SUCCEEDED blocks replay, FAILED allows retry)
 * 2. Create PENDING intent before verification
 * 3. Verify transaction on-chain using chain-specific provider
 * 4. Return true if verified (handler will mark SUCCEEDED after completion)
 * 
 * EXPORTED for use by payment orchestrator
 */
export interface TransactionVerificationResult {
  verified: boolean;
  senderAddress?: string;
  paymentAmount?: number;
  paymentToken?: 'USDC' | 'USDT';
  chain?: EvmChain;
}

export async function verifyTransactionPayment(
  txHash: string,
  serviceName: string,
  requiredAmount: number,
  chain: EvmChain = 'base'
): Promise<TransactionVerificationResult> {
  const MAX_RETRIES = 3;
  const INTENT_TTL_MS = 15 * 60 * 1000; // 15 minutes
  
  try {
    // STEP 1: Check for existing payment intent
    const existingIntents = await db
      .select()
      .from(x402PaymentIntents)
      .where(
        and(
          eq(x402PaymentIntents.txHash, txHash),
          eq(x402PaymentIntents.serviceName, serviceName)
        )
      )
      .limit(1);
    
    const existingIntent = existingIntents[0];
    const now = new Date();
    
    if (existingIntent) {
      // Check if intent is SUCCEEDED - block replay
      if (existingIntent.status === "SUCCEEDED") {
        console.log(`⚠️ Payment intent already SUCCEEDED for ${txHash} + ${serviceName}`);
        return { verified: false };
      }
      
      // Check if intent is expired
      if (existingIntent.expiresAt && existingIntent.expiresAt < now) {
        console.log(`⏰ Payment intent expired for ${txHash}, cleaning up...`);
        // Clean up expired intent
        await db.delete(x402PaymentIntents).where(eq(x402PaymentIntents.id, existingIntent.id));
        // Continue to create new intent below
      }
      // Check if intent is FAILED and within retry limit
      else if (existingIntent.status === "FAILED" || existingIntent.status === "ALLOW_RETRY") {
        if (existingIntent.retries >= MAX_RETRIES) {
          console.log(`❌ Max retries exceeded for ${txHash} + ${serviceName}`);
          return { verified: false };
        }
        console.log(`🔄 Allowing retry ${existingIntent.retries + 1}/${MAX_RETRIES} for ${txHash}`);
        // Will update to PENDING below
      }
      // Check if intent is PENDING (concurrent request)
      else if (existingIntent.status === "PENDING") {
        // Check if it's been pending for too long (likely stale)
        const pendingDuration = now.getTime() - existingIntent.createdAt.getTime();
        if (pendingDuration > 60000) { // 1 minute
          console.log(`⚠️ Stale PENDING intent detected, allowing retry`);
          // Will update to PENDING below with new timestamp
        } else {
          console.log(`⏳ Payment intent already PENDING for ${txHash}, rejecting concurrent request`);
          return { verified: false };
        }
      }
    }

    // STEP 2: Verify transaction on-chain BEFORE creating/updating intent
    // Retry logic: EVM block times vary (Base ~2s, Ethereum ~12s, Polygon ~2s,
    // Arbitrum <1s). RPC indexing can lag further during congestion.
    // Poll up to 10 times with 3-second intervals (30 seconds total max wait).
    // Covers multiple blocks on all supported chains and fixes the ~50%
    // PAYMENT_VERIFICATION_FAILED rate caused by RPC indexing lag.
    const RECEIPT_MAX_RETRIES = 10;
    const RECEIPT_RETRY_DELAY_MS = 3000;
    let receipt = null;
    let receiptLastError = "";

    const chainProvider = getProviderForChain(chain);
    const chainStablecoins = getStablecoinsForChain(chain);
    const chainId = chain === 'ethereum' ? 1 : 8453;
    console.log(`🔍 Verifying tx on ${chain} (chainId: ${chainId})`);

    for (let attempt = 1; attempt <= RECEIPT_MAX_RETRIES; attempt++) {
      try {
        receipt = await chainProvider.getTransactionReceipt(txHash);
        if (receipt) break;
      } catch (rpcError: any) {
        receiptLastError = rpcError.message || "RPC error";
        console.warn(`⚠️ ${chain} RPC error on attempt ${attempt}/${RECEIPT_MAX_RETRIES}: ${receiptLastError}`);
      }

      if (attempt < RECEIPT_MAX_RETRIES) {
        console.log(`⏳ ${chain} tx ${txHash.substring(0, 16)}... receipt not found yet, retry ${attempt}/${RECEIPT_MAX_RETRIES} (waiting ${RECEIPT_RETRY_DELAY_MS}ms)`);
        await new Promise(resolve => setTimeout(resolve, RECEIPT_RETRY_DELAY_MS));
      }
    }
    
    if (!receipt) {
      console.log(`❌ Transaction receipt not found after ${RECEIPT_MAX_RETRIES} attempts: ${txHash} (${receiptLastError || 'not indexed yet'})`);
      return { verified: false };
    }

    if (receipt.status !== 1) {
      console.log(`❌ Transaction failed on-chain: ${txHash}`);
      return { verified: false };
    }

    // Parse stablecoin Transfer event logs (USDC or USDT)
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    
    let paymentFound = false;
    let paymentAmount = 0;
    let senderAddress = "";
    let paymentToken = "" as 'USDC' | 'USDT' | "";
    let paymentTokenAddress = "";

    for (const log of receipt.logs) {
      const matchedToken = chainStablecoins.find(
        token => token.address.toLowerCase() === log.address.toLowerCase()
      );
      
      if (
        matchedToken &&
        log.topics[0] === transferEventSignature &&
        log.topics.length >= 3
      ) {
        const toAddress = "0x" + log.topics[2].slice(26);
        const fromAddress = "0x" + log.topics[1].slice(26);
        
        if (toAddress.toLowerCase() === PLATFORM_WALLET.toLowerCase()) {
          const amountHex = log.data;
          paymentAmount = parseInt(amountHex, 16);
          senderAddress = fromAddress;
          paymentToken = matchedToken.symbol as 'USDC' | 'USDT';
          paymentTokenAddress = matchedToken.address;
          paymentFound = true;
          
          console.log(`💰 ${matchedToken.symbol} Transfer found:`);
          console.log(`   From: ${fromAddress}`);
          console.log(`   To: ${toAddress}`);
          console.log(`   Amount: ${paymentAmount} (${paymentAmount / 1e6} ${matchedToken.symbol})`);
          break;
        }
      }
    }

    if (!paymentFound) {
      console.log(`❌ No USDC/USDT payment to platform wallet found in transaction`);
      return { verified: false };
    }

    if (paymentAmount < requiredAmount) {
      console.log(`❌ Insufficient payment: ${paymentAmount} < ${requiredAmount}`);
      return { verified: false };
    }
    
    // Validate sender address - fall back to receipt.from if Transfer sender is missing or null address
    // This handles cases where payment is routed through a contract (bridge, router, etc.)
    const isValidAddress = (addr: string) => 
      addr && addr !== "" && addr !== "0x0000000000000000000000000000000000000000";
    
    if (!isValidAddress(senderAddress)) {
      // Fall back to transaction sender (receipt.from)
      if (receipt.from && isValidAddress(receipt.from)) {
        console.log(`⚠️ Transfer sender invalid, falling back to receipt.from: ${receipt.from}`);
        senderAddress = receipt.from;
      } else {
        console.log(`❌ Could not extract valid sender address from transaction logs or receipt`);
        return { verified: false };
      }
    }

    // STEP 3: Create or update payment intent as PENDING
    const intentId = existingIntent?.id || nanoid();
    const expiresAt = new Date(now.getTime() + INTENT_TTL_MS);
    
    if (existingIntent) {
      // Update existing intent to PENDING (retry scenario)
      await db
        .update(x402PaymentIntents)
        .set({
          status: "PENDING",
          retries: (existingIntent.retries || 0) + 1,
          updatedAt: now,
          expiresAt,
          lastError: null, // Clear previous error
        })
        .where(eq(x402PaymentIntents.id, existingIntent.id));
      
      console.log(`📝 Updated payment intent ${intentId} to PENDING (retry ${(existingIntent.retries || 0) + 1})`);
    } else {
      // Create new PENDING intent with typed metadata
      // Only include typed metadata if we have valid token info
      const intentMetadata = paymentToken && paymentTokenAddress
        ? createPaymentIntentMetadata(
            paymentTokenAddress,
            paymentToken as 'USDC' | 'USDT',
            chainId,
            { pricingVersion: "2025-12-14" }
          )
        : { token: "unknown" };
      
      await db.insert(x402PaymentIntents).values({
        id: intentId,
        txHash,
        network: chain === 'ethereum' ? "eip155:1" : "eip155:8453",
        serviceName,
        payer: senderAddress,
        amount: (paymentAmount / 1e6).toString(),
        status: "PENDING",
        retries: 0,
        expiresAt,
        metadata: intentMetadata,
      });
      
      console.log(`📝 Created payment intent ${intentId} with status PENDING (token: ${paymentToken})`);
    }

    console.log(`✅ Payment verified on ${chain}, intent ${intentId} is PENDING, payer: ${senderAddress}`);
    return { 
      verified: true, 
      senderAddress, 
      paymentAmount, 
      paymentToken: paymentToken as 'USDC' | 'USDT',
      chain
    };

  } catch (error: any) {
    console.error(`❌ Error verifying transaction:`, error);
    throw error;
  }
}

/**
 * Mark payment intent as SUCCEEDED after handler completes successfully
 * Called by payment orchestrator after service handler returns
 */
export async function markPaymentIntentSucceeded(
  txHash: string,
  serviceName: string,
  senderAddress?: string
): Promise<void> {
  try {
    const intents = await db
      .select()
      .from(x402PaymentIntents)
      .where(
        and(
          eq(x402PaymentIntents.txHash, txHash),
          eq(x402PaymentIntents.serviceName, serviceName)
        )
      )
      .limit(1);
    
    const intent = intents[0];
    if (!intent) {
      console.warn(`⚠️ No payment intent found for ${txHash} + ${serviceName}`);
      return;
    }

    const now = new Date();
    
    // Mark intent as SUCCEEDED
    await db
      .update(x402PaymentIntents)
      .set({
        status: "SUCCEEDED",
        succeededAt: now,
        updatedAt: now,
      })
      .where(eq(x402PaymentIntents.id, intent.id));
    
    // Also record to usedTransactionHashes for backward compatibility
    const existingHash = await db
      .select()
      .from(usedTransactionHashes)
      .where(eq(usedTransactionHashes.txHash, txHash))
      .limit(1);
    
    if (existingHash.length === 0) {
      await db.insert(usedTransactionHashes).values({
        txHash,
        network: "eip155:8453",
        serviceName,
        amount: (parseFloat(intent.amount) * 1e6).toString(),
        paidBy: senderAddress || intent.payer,
      });
    }
    
    // Record to x402_payments table for analytics
    // FIX: walletAddress should be the RECEIVING wallet (platform), not the payer
    const payerAddress = senderAddress || intent.payer;
    // Derive currency from intent metadata (USDC or USDT)
    const intentMetadata = intent.metadata as { token?: string } | null;
    const paymentCurrency = intentMetadata?.token || "USDC"; // Default to USDC for backward compatibility
    await db.insert(x402Payments).values({
      id: nanoid(),
      agentId: payerAddress,
      customerId: payerAddress,
      amount: intent.amount,
      currency: paymentCurrency,
      status: "completed",
      x402TransactionId: txHash,
      walletAddress: PLATFORM_WALLET,
      network: "eip155:8453",
      paymentProof: txHash,
      completedAt: now,
      metadata: {
        serviceName,
        intentId: intent.id,
        retries: intent.retries,
        verifiedAt: now.toISOString(),
        verificationMethod: "on-chain-base-intent",
        payer: payerAddress,
        token: paymentCurrency,
      },
    });
    
    console.log(`✅ Payment intent ${intent.id} marked as SUCCEEDED, recorded to payments table`);
  } catch (error: any) {
    console.error(`❌ Error marking payment intent as succeeded:`, error);
    // Don't throw - this is cleanup, shouldn't break the response
  }
}

/**
 * Mark payment intent as FAILED after handler throws error
 * Called by payment orchestrator when service handler fails
 */
export async function markPaymentIntentFailed(
  txHash: string,
  serviceName: string,
  errorMessage: string
): Promise<void> {
  try {
    const intents = await db
      .select()
      .from(x402PaymentIntents)
      .where(
        and(
          eq(x402PaymentIntents.txHash, txHash),
          eq(x402PaymentIntents.serviceName, serviceName)
        )
      )
      .limit(1);
    
    const intent = intents[0];
    if (!intent) {
      console.warn(`⚠️ No payment intent found for ${txHash} + ${serviceName}`);
      return;
    }

    // Mark intent as ALLOW_RETRY so user can retry with same transaction
    await db
      .update(x402PaymentIntents)
      .set({
        status: "ALLOW_RETRY",
        lastError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(x402PaymentIntents.id, intent.id));
    
    console.log(`⚠️ Payment intent ${intent.id} marked as ALLOW_RETRY due to handler failure`);
  } catch (error: any) {
    console.error(`❌ Error marking payment intent as failed:`, error);
    // Don't throw - this is cleanup
  }
}
