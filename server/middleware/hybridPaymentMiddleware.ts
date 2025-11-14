import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { db } from "../db";
import { usedTransactionHashes } from "@shared/schema";
import { eq } from "drizzle-orm";

// Alchemy provider for Base mainnet
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BASE_MAINNET_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(BASE_MAINNET_URL);

// USDC contract address on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Platform wallet address
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";

// Service pricing (must match x402MicroserviceRoutesV2.ts)
const SERVICE_PRICING: Record<string, number> = {
  "multi-chain-balance": 50000, // $0.50 in USDC (6 decimals)
  "gas-price-oracle": 10000, // $0.10
  "token-price": 15000, // $0.15
  "contract-scan": 200000, // $2.00
  "wallet-risk": 100000, // $1.00
  "trade-signals": 75000, // $0.75
  "token-sentiment": 25000, // $0.25
  "trending-tokens": 50000, // $0.50
  "whale-alerts": 35000, // $0.35
  "dex-liquidity": 20000, // $0.20
  "transaction-builder": 30000, // $0.30
  "token-metadata": 10000, // $0.10
  "approval-manager": 20000, // $0.20
  "batch-quote": 40000, // $0.40
  "portfolio-tracker": 50000, // $0.50
  "instant-agent-wallet": 100000, // $1.00
  "verified-agent-identity": 500000, // $5.00
  "seamless-chain-bridge": 200000, // $2.00
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
 * Accepts BOTH payment formats:
 * 1. EIP-712 signatures (standard x402) - passes through to x402-express
 * 2. Raw transaction hashes - verifies on-chain via Alchemy
 * 
 * This maintains Coinbase Bazaar compliance while adding flexibility
 */
export function hybridPaymentMiddleware(req: Request, res: Response, next: NextFunction) {
  const xPayment = req.headers["x-payment"] as string | undefined;
  
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
 */
async function verifyTransactionPayment(
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

    console.log(`✅ Transaction verified and marked as used`);
    return true;

  } catch (error: any) {
    console.error(`❌ Error verifying transaction:`, error);
    throw error;
  }
}
