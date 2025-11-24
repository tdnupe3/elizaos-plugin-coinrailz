import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "../db";
import { usedTransactionHashes, x402Payments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { creditsService } from "../services/creditsService.js";

// Alchemy provider for Base mainnet
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BASE_MAINNET_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(BASE_MAINNET_URL);

// USDC contract address on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Platform wallet address
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";

// Service pricing (MUST match agent-chat system prompt in telegramMiniAppRoutes.ts)
// Updated 2025-11-17: Aligned with Telegram Mini-App advertised pricing
// CRITICAL: USDC has 6 decimals, so $1.00 = 1,000,000 micro-USDC
const SERVICE_PRICING: Record<string, number> = {
  // Trading Intelligence Services ($0.10-$0.75)
  "gas-price-oracle": 100000, // $0.10
  "token-metadata": 100000, // $0.10
  "dex-liquidity": 200000, // $0.20
  "approval-manager": 200000, // $0.20
  "token-price": 250000, // $0.25
  "token-sentiment": 250000, // $0.25
  "transaction-builder": 300000, // $0.30
  "whale-alerts": 350000, // $0.35
  "batch-quote": 400000, // $0.40
  "multi-chain-balance": 500000, // $0.50
  "trending-tokens": 500000, // $0.50
  "portfolio-tracker": 500000, // $0.50
  "wallet-risk": 500000, // $0.50
  "trade-signals": 750000, // $0.75
  
  // Execution & Infrastructure Services ($0.50-$2.00)
  "payment-processing": 500000, // $0.50 - ADDED (was missing)
  "contract-scan": 1000000, // $1.00
  "instant-agent-wallet": 1000000, // $1.00
  "seamless-chain-bridge": 2000000, // $2.00
  
  // Premium Services ($5.00-$10.00)
  "verified-agent-identity": 5000000, // $5.00
  "compliance-consultation": 5000000, // $5.00 - ADDED (was missing)
  "smart-contract-audit": 10000000, // $10.00 - ADDED (was missing)
};

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
    const requiredAmountUSDC = SERVICE_PRICING[serviceName];
    
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
    const requiredAmountUSDC = SERVICE_PRICING[serviceName];
    
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
  
  try {
    // Attempt to decode as Base64 JSON
    const decoded = Buffer.from(xPayment, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    
    if (parsed.txHash) {
      console.log("🔓 Decoded Base64 JSON payment proof");
      txHash = parsed.txHash;
      paymentAmount = parsed.amount;
    }
  } catch {
    // Not Base64 JSON - treat as raw transaction hash
  }
  
  // Check if we have a valid transaction hash
  const isRawTxHash = /^0x[a-fA-F0-9]{64}$/.test(txHash);
  
  if (!isRawTxHash) {
    // Not a valid tx hash - pass to x402-express for EIP-712 verification
    console.log("🔄 X-PAYMENT detected - passing to x402-express for EIP-712 verification");
    return next();
  }

  // This is a raw transaction hash - verify it on-chain
  console.log(`🔍 Raw transaction hash detected: ${txHash}`);
  
  // Extract service name from URL path
  const serviceName = req.path.split("/").pop() || "unknown";
  const requiredAmount = SERVICE_PRICING[serviceName];
  
  if (!requiredAmount) {
    console.log(`❌ Unknown service: ${serviceName}`);
    return res.status(402).json({
      x402Version: 1,
      error: "Unknown service",
      accepts: [{
        scheme: "exact",
        network: "base",
        resource: `https://coinrailz.com/x402/${serviceName}`,
        payTo: PLATFORM_WALLET,
        asset: USDC_BASE,
      }]
    });
  }

  // Verify transaction on-chain
  verifyTransactionPayment(txHash, serviceName, requiredAmount)
    .then((verified) => {
      if (verified) {
        console.log(`✅ Payment verified on-chain for ${serviceName}`);
        // Set flag to bypass x402-express verification
        (req as any).paymentAlreadyVerified = true;
        // Payment verified - continue to service handler
        return next();
      } else {
        console.log(`❌ Payment verification failed for ${serviceName}`);
        // Payment not valid - return 402
        return res.status(402).json({
          x402Version: 1,
          error: "Payment verification failed",
          message: "Transaction not found, insufficient amount, or already used",
          accepts: [{
            scheme: "exact",
            network: "base",
            maxAmountRequired: requiredAmount.toString(),
            resource: `https://coinrailz.com/x402/${serviceName}`,
            payTo: PLATFORM_WALLET,
            asset: USDC_BASE,
          }]
        });
      }
    })
    .catch((error) => {
      console.error(`❌ Error verifying payment:`, error);
      return res.status(500).json({
        x402Version: 1,
        error: "Payment verification error",
        message: error.message
      });
    });
}

/**
 * Verify a transaction on Base mainnet
 * EXPORTED for use by payment orchestrator
 */
export async function verifyTransactionPayment(
  txHash: string,
  serviceName: string,
  requiredAmount: number
): Promise<boolean> {
  try {
    // Check if transaction hash has already been used
    const existingUsage = await db
      .select()
      .from(usedTransactionHashes)
      .where(eq(usedTransactionHashes.txHash, txHash))
      .limit(1);

    if (existingUsage.length > 0) {
      console.log(`⚠️ Transaction hash already used: ${txHash}`);
      return false;
    }

    // Get transaction receipt from Base mainnet
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log(`❌ Transaction not found: ${txHash}`);
      return false;
    }

    if (receipt.status !== 1) {
      console.log(`❌ Transaction failed: ${txHash}`);
      return false;
    }

    // Parse USDC Transfer event logs
    // Transfer event signature: Transfer(address,address,uint256)
    // Topic 0: keccak256("Transfer(address,address,uint256)")
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    
    let paymentFound = false;
    let paymentAmount = 0;
    let senderAddress = "";

    for (const log of receipt.logs) {
      // Check if this is a USDC Transfer event
      if (
        log.address.toLowerCase() === USDC_BASE.toLowerCase() &&
        log.topics[0] === transferEventSignature &&
        log.topics.length >= 3
      ) {
        // Topic 1: from address (padded to 32 bytes)
        // Topic 2: to address (padded to 32 bytes)
        // Data: amount (uint256)
        
        const toAddress = "0x" + log.topics[2].slice(26); // Remove padding
        const fromAddress = "0x" + log.topics[1].slice(26);
        
        if (toAddress.toLowerCase() === PLATFORM_WALLET.toLowerCase()) {
          // Payment to our wallet found!
          const amountHex = log.data;
          paymentAmount = parseInt(amountHex, 16);
          senderAddress = fromAddress;
          paymentFound = true;
          
          console.log(`💰 USDC Transfer found:`);
          console.log(`   From: ${fromAddress}`);
          console.log(`   To: ${toAddress}`);
          console.log(`   Amount: ${paymentAmount} (${paymentAmount / 1e6} USDC)`);
          break;
        }
      }
    }

    if (!paymentFound) {
      console.log(`❌ No USDC payment to platform wallet found in transaction`);
      return false;
    }

    if (paymentAmount < requiredAmount) {
      console.log(`❌ Insufficient payment: ${paymentAmount} < ${requiredAmount}`);
      return false;
    }

    // Payment is valid! Mark transaction as used to prevent replay
    await db.insert(usedTransactionHashes).values({
      txHash,
      network: "base",
      serviceName,
      amount: paymentAmount.toString(),
      paidBy: senderAddress,
    });

    // ARCHITECT FIX: Also record to x402_payments table for analytics and tracking
    await db.insert(x402Payments).values({
      id: nanoid(),
      agentId: senderAddress,
      customerId: senderAddress, // Agent is also the customer in this case
      amount: (paymentAmount / 1e6).toString(), // Convert from micro-USDC to USDC
      currency: "USDC",
      status: "completed",
      x402TransactionId: txHash,
      walletAddress: senderAddress,
      network: "base",
      paymentProof: txHash,
      completedAt: new Date(),
      metadata: {
        serviceName,
        requiredAmount,
        actualAmount: paymentAmount,
        verifiedAt: new Date().toISOString(),
        verificationMethod: "on-chain-base",
      },
    });

    console.log(`✅ Transaction verified and marked as used, payment recorded to x402_payments`);
    return true;

  } catch (error: any) {
    console.error(`❌ Error verifying transaction:`, error);
    throw error;
  }
}
