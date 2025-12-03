import { Request, Response, NextFunction } from "express";
import { 
  verifyTransactionPayment, 
  markPaymentIntentSucceeded, 
  markPaymentIntentFailed 
} from "./hybridPaymentMiddleware";
import { offerLinkService } from "../services/offerLinkService";
import { SERVICE_PRICING_MICRO, SERVICE_PRICING_USD, microToUSD } from "../../shared/pricing";
import { createWalletClient, http, parseAbi, Hex, createPublicClient } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Platform wallet to receive payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

// USDC on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// EIP-3009 ABI for USDC transferWithAuthorization
const EIP3009_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external"
]);

// Initialize platform wallet client for EIP-3009 execution
let platformWalletClient: ReturnType<typeof createWalletClient> | null = null;
let platformPublicClient: ReturnType<typeof createPublicClient> | null = null;

function getPlatformWalletClient() {
  if (!platformWalletClient) {
    const privateKey = process.env.XMTP_EOA_PRIVATE_KEY || process.env.CDP_PRIVATE_KEY;
    if (!privateKey) {
      console.error("❌ No platform wallet private key available for EIP-3009 execution");
      return null;
    }
    const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as Hex : `0x${privateKey}` as Hex);
    platformWalletClient = createWalletClient({
      account,
      chain: base,
      transport: http("https://mainnet.base.org"),
    });
    platformPublicClient = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });
    console.log(`✅ Platform wallet initialized for EIP-3009: ${account.address}`);
  }
  return platformWalletClient;
}

// Helper to get the correct public URL from request headers
function getPublicBaseUrl(req: Request): string {
  // Use X-Forwarded-Host or Host header to get actual request URL
  const host = req.get('X-Forwarded-Host') || req.get('Host') || 'coinrailz.com';
  const protocol = req.get('X-Forwarded-Proto') || 'https';
  return `${protocol}://${host}`;
}

/**
 * Payment Orchestrator - SELF-CONTAINED x402 payment handling
 * 
 * FIXED: Generates its own 402 responses instead of relying on flaky x402-express facilitator
 * 
 * Decision tree:
 * 1. If bundle subscription → execute handler directly
 * 2. If no X-PAYMENT header → generate 402 with payment requirements
 * 3. If raw 0x transaction hash → verify on-chain, execute handler
 * 4. If Base64 JSON with txHash → verify on-chain, execute handler
 * 5. If EIP-712 signature → verify via facilitator (fallback to next middleware)
 */
export function createPaymentOrchestrator(
  serviceName: string,
  requiredAmount: number,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if bundle subscription exists (set by bundleAuthMiddleware)
    if (req.bundleSubscription) {
      const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
      console.log(`🎫 Bundle subscription detected for ${serviceName}, executing handler directly`);
      res.locals.payment = { method: "bundle-subscription", subscriptionId: req.bundleSubscription.id, amount: priceUsd, status: 'paid' };
      await handler(req, res);
      
      const offerTrackingId = req.query?.offer_tracking as string;
      if (offerTrackingId) {
        try {
          await offerLinkService.recordConversion(offerTrackingId, priceUsd);
        } catch (convErr: any) {
          console.error(`⚠️ Failed to record bundle conversion: ${convErr.message}`);
        }
      }
      return;
    }

    const xPayment = req.headers["x-payment"] as string | undefined;

    // No payment header → Generate 402 response ourselves (don't rely on x402-express)
    if (!xPayment) {
      console.log(`📊 Orchestrator: No payment for ${serviceName}, generating 402`);
      return generate402Response(req, res, serviceName, requiredAmount);
    }

    let txHash: string | null = null;

    // Case 1: Raw transaction hash (what agents actually send)
    if (xPayment.startsWith("0x") && xPayment.length === 66) {
      txHash = xPayment;
      console.log(`🔐 Orchestrator: Raw 0x hash payment detected for ${serviceName}: ${xPayment.substring(0, 10)}...`);
    } 
    // Case 2: Base64-encoded JSON with txHash (various formats from x402-fetch)
    else {
      try {
        const decoded = JSON.parse(Buffer.from(xPayment, "base64").toString("utf-8"));
        console.log(`🔐 Orchestrator: Decoded payment payload for ${serviceName}:`, JSON.stringify(decoded, null, 2).substring(0, 500));
        
        // x402-fetch sends: { x402Version, scheme, network, payload: { signature, ... } }
        // The actual txHash may be in nested structures
        const payloadObj = decoded.payload || {};
        
        // Extract txHash from various possible locations in x402-fetch payload
        txHash = decoded.txHash 
          || payloadObj.txHash 
          || payloadObj.authorization?.txHash
          || payloadObj.receipt?.transactionHash
          || payloadObj.transactionHash
          || decoded.authorization?.txHash
          || decoded.transactionHash
          || decoded.receipt?.transactionHash;
        
        // Also check for x402 facilitator format
        if (!txHash && decoded.x402 && decoded.x402.txHash) {
          txHash = decoded.x402.txHash;
        }
        
        // Check for signature-based auth that includes tx hash
        if (!txHash && payloadObj.signature && payloadObj.message) {
          try {
            const msgData = typeof payloadObj.message === 'string' 
              ? JSON.parse(payloadObj.message) 
              : payloadObj.message;
            txHash = msgData.txHash || msgData.transactionHash;
          } catch {}
        }
        
        // Check if this is an EIP-3009 authorization that we need to execute
        if (!txHash && payloadObj.signature && payloadObj.authorization) {
          console.log(`🔐 Orchestrator: EIP-3009 authorization detected for ${serviceName}, executing transferWithAuthorization...`);
          
          try {
            const walletClient = getPlatformWalletClient();
            if (!walletClient) {
              console.error(`❌ Orchestrator: No wallet client available for EIP-3009 execution`);
              return generate402Response(req, res, serviceName, requiredAmount);
            }
            
            const auth = payloadObj.authorization;
            const sig = payloadObj.signature as string;
            
            // Parse v, r, s from the signature (65 bytes: r=32, s=32, v=1)
            const sigHex = sig.startsWith("0x") ? sig.slice(2) : sig;
            
            // Validate signature length
            if (sigHex.length !== 130) {
              console.error(`❌ Invalid signature length: ${sigHex.length}, expected 130`);
              return generate402Response(req, res, serviceName, requiredAmount);
            }
            
            const r = `0x${sigHex.slice(0, 64)}` as Hex;
            const s = `0x${sigHex.slice(64, 128)}` as Hex;
            let v = parseInt(sigHex.slice(128, 130), 16);
            if (v < 27) v += 27; // Normalize v value
            
            // Ensure nonce is properly padded to bytes32
            const nonceHex = auth.nonce.startsWith('0x') ? auth.nonce.slice(2) : auth.nonce;
            const paddedNonce = `0x${nonceHex.padStart(64, '0')}` as Hex;
            
            console.log(`🔐 EIP-3009 params: from=${auth.from}, to=${auth.to}, value=${auth.value}`);
            console.log(`🔐 EIP-3009 validity: after=${auth.validAfter}, before=${auth.validBefore}, nonce=${paddedNonce}`);
            
            // Execute the transferWithAuthorization
            const hash = await walletClient.writeContract({
              address: USDC_BASE,
              abi: EIP3009_ABI,
              functionName: "transferWithAuthorization",
              args: [
                auth.from as Hex,
                auth.to as Hex,
                BigInt(auth.value),
                BigInt(auth.validAfter),
                BigInt(auth.validBefore),
                paddedNonce,
                v,
                r,
                s
              ],
            });
            
            console.log(`✅ Orchestrator: EIP-3009 transfer executed! TxHash: ${hash}`);
            txHash = hash;
            
            // Wait for confirmation
            if (platformPublicClient) {
              const receipt = await platformPublicClient.waitForTransactionReceipt({ hash });
              console.log(`✅ Orchestrator: EIP-3009 confirmed in block ${receipt.blockNumber}`);
            }
          } catch (eip3009Error: any) {
            console.error(`❌ Orchestrator: EIP-3009 execution failed:`, eip3009Error.message);
            // Could be already executed, expired, or invalid signature
            return res.status(402).json({
              x402Version: 1,
              error: `Payment authorization failed: ${eip3009Error.message}`,
              hint: "The authorization may have expired or already been used. Please retry the request."
            });
          }
        }
        
        if (txHash) {
          console.log(`🔐 Orchestrator: Extracted/executed txHash for ${serviceName}: ${txHash.substring(0, 10)}...`);
        } else {
          console.log(`🔐 Orchestrator: No txHash found in payload for ${serviceName}, payload keys: ${Object.keys(payloadObj).join(', ')}`);
          // No txHash found - return 402 to request raw tx hash payment
          return generate402Response(req, res, serviceName, requiredAmount);
        }
      } catch (e) {
        console.log(`🔐 Orchestrator: Failed to decode payment header for ${serviceName}: ${(e as Error).message}`);
        // Can't decode - return 402
        return generate402Response(req, res, serviceName, requiredAmount);
      }
    }

    // If we have a transaction hash, verify it on-chain
    if (txHash) {
      try {
        const verified = await verifyTransactionPayment(
          txHash,
          serviceName,
          requiredAmount
        );

        if (verified) {
          const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
          console.log(`✅ Orchestrator: Payment verified for ${serviceName} ($${priceUsd}), executing handler directly`);
          res.locals.payment = { method: "raw-hash", txHash, verified: true, amount: priceUsd, status: 'paid' };
          
          try {
            await handler(req, res);
            await markPaymentIntentSucceeded(txHash, serviceName);
            
            const offerTrackingId = req.query?.offer_tracking as string;
            if (offerTrackingId) {
              try {
                await offerLinkService.recordConversion(offerTrackingId, priceUsd);
              } catch (convErr: any) {
                console.error(`⚠️ Failed to record conversion: ${convErr.message}`);
              }
            }
          } catch (handlerError: any) {
            console.error(`❌ Handler error for ${serviceName}:`, handlerError.message);
            await markPaymentIntentFailed(txHash, serviceName, handlerError.message);
            throw handlerError;
          }
          return;
        } else {
          console.log(`❌ Orchestrator: Payment verification failed for ${serviceName}, returning 402`);
          return generate402Response(req, res, serviceName, requiredAmount);
        }
      } catch (error: any) {
        console.error(`❌ Orchestrator: Payment verification error for ${serviceName}:`, error.message);
        return generate402Response(req, res, serviceName, requiredAmount);
      }
    }

    // No valid payment found - return 402
    console.log(`❌ Orchestrator: No valid payment found for ${serviceName}, returning 402`);
    return generate402Response(req, res, serviceName, requiredAmount);
  };
}

/**
 * Generate a proper x402 402 response with payment requirements
 */
function generate402Response(req: Request, res: Response, serviceName: string, requiredAmount: number) {
  const priceUsd = microToUSD(requiredAmount);
  const endpoint = req.originalUrl || `/x402/${serviceName}`;
  const baseUrl = getPublicBaseUrl(req);
  const resource = `${baseUrl}${endpoint}`;
  
  // Service descriptions
  const descriptions: Record<string, string> = {
    "ping": "x402 Discovery Ping - verify payment infrastructure",
    "gas-price-oracle": "Real-time gas prices for multiple chains with USD cost estimates",
    "token-metadata": "Token contract metadata including name, symbol, decimals",
    "dex-liquidity": "DEX liquidity analysis across major decentralized exchanges",
    "token-price": "Real-time token price from multiple sources",
    "token-sentiment": "AI-powered sentiment analysis for any token",
    "whale-alerts": "Real-time whale movement alerts for any chain",
    "multi-chain-balance": "Multi-chain wallet balance aggregation",
    "trending-tokens": "Trending tokens across all supported chains",
    "portfolio-tracker": "Comprehensive portfolio tracking and analysis",
    "wallet-risk": "Wallet risk scoring and security analysis",
    "trade-signals": "AI-powered trade signals and recommendations",
    "transaction-builder": "Build and simulate transactions before execution",
    "batch-quote": "Batch token price quotes in single request",
    "approval-manager": "Token approval management and security",
    "payment-processing": "Instant USDC payment processing",
    "contract-scan": "Smart contract security scanning",
    "instant-agent-wallet": "Create CDP-managed agent wallet instantly",
    "seamless-chain-bridge": "Cross-chain bridging quotes and execution",
    "property-valuation": "AI-powered real estate property valuation",
    "lease-analysis": "Commercial lease analysis and recommendations",
    "construction-progress": "Construction project progress tracking",
    "fraud-detection": "Real-time transaction fraud detection",
    "credit-risk-score": "Credit risk scoring for DeFi positions",
    "compliance-check": "AML/KYC compliance verification",
    "sentiment-analysis": "Market sentiment analysis for any asset",
    "trading-signal": "Professional trading signals with entry/exit",
    "portfolio-optimization": "AI portfolio optimization recommendations",
    "correlation-matrix": "Asset correlation matrix analysis",
    "risk-metrics": "VaR, Sharpe ratio, and risk metrics",
    "arbitrage-scanner": "Cross-chain arbitrage opportunity detection",
    "polymarket-events": "Trending prediction market events",
    "polymarket-odds": "Current odds for prediction markets",
    "polymarket-search": "Search prediction markets by keyword",
  };

  const response = {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "base",
      maxAmountRequired: requiredAmount.toString(),
      resource: resource,
      description: descriptions[serviceName] || `${serviceName} micropayment service`,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_BASE,
      extra: {
        name: "USD Coin",
        version: "2"
      },
      discoverable: true
    }],
    facilitatorUrl: "https://facilitator.x402.io",
    recommendedServices: [
      { id: "ping", name: "x402 Discovery Ping", priceUSD: "$0.25", endpoint: "/x402/ping" },
      { id: "trade-signals", name: "AI Trade Signals", priceUSD: "$0.75", endpoint: "/x402/trade-signals" },
      { id: "wallet-risk", name: "Wallet Risk Analysis", priceUSD: "$0.50", endpoint: "/x402/wallet-risk" },
      { id: "token-price", name: "Token Price Feed", priceUSD: "$0.25", endpoint: "/x402/token-price" },
      { id: "trending-tokens", name: "Trending Tokens", priceUSD: "$0.50", endpoint: "/x402/trending-tokens" },
    ],
    catalogUrl: `${baseUrl}/x402/catalog`,
    totalServicesAvailable: 39
  };

  console.log(`📊 x402 Funnel: challenge-issued for ${serviceName} | IP: ${req.ip} | Agent: ${req.headers['user-agent']?.substring(0, 20) || 'none'}`);
  
  res.status(402).json(response);
}
