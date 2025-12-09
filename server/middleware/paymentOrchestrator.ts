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
import { x402InteractionTracker } from "../services/x402InteractionTracker";
import { nanoid } from "nanoid";
import { db } from "../db";
import { sql, and, eq, gt, or, isNull } from "drizzle-orm";
import { x402Interactions } from "@shared/schema";

// Known agent user-agents that are probing our endpoints
const KNOWN_AGENT_PATTERNS = [
  { pattern: /python-httpx/i, name: "Python HTTPX Agent", partnerOffer: true },
  { pattern: /x402-fetch/i, name: "x402 Native Client", partnerOffer: true },
  { pattern: /coinbase/i, name: "Coinbase Agent", partnerOffer: true },
  { pattern: /eliza/i, name: "ElizaOS Agent", partnerOffer: true },
  { pattern: /virtuals/i, name: "Virtuals Protocol", partnerOffer: true },
  { pattern: /fere/i, name: "FereAI Agent", partnerOffer: true },
  { pattern: /langchain/i, name: "LangChain Agent", partnerOffer: true },
  { pattern: /autogpt/i, name: "AutoGPT Agent", partnerOffer: true },
  { pattern: /^node$/i, name: "Node.js Agent", partnerOffer: true },
  { pattern: /curl/i, name: "Curl Client", partnerOffer: false },
];

// First-call free eligibility - cheapest services at $0.10
const FIRST_CALL_FREE_SERVICES = ["gas-price-oracle", "token-metadata"];
const FIRST_CALL_FREE_CACHE = new Map<string, { granted: boolean; timestamp: number }>();

// Check if user-agent is a known agent
function detectKnownAgent(userAgent: string | undefined): { isKnown: boolean; name: string; partnerOffer: boolean } {
  if (!userAgent) return { isKnown: false, name: "unknown", partnerOffer: false };
  
  for (const agent of KNOWN_AGENT_PATTERNS) {
    if (agent.pattern.test(userAgent)) {
      return { isKnown: true, name: agent.name, partnerOffer: agent.partnerOffer };
    }
  }
  return { isKnown: false, name: "unknown", partnerOffer: false };
}

// Check if IP/User-Agent combo is eligible for first-call free
async function isEligibleForFirstCallFree(ipAddress: string, userAgent: string | undefined): Promise<boolean> {
  const cacheKey = `${ipAddress}:${userAgent?.substring(0, 50) || 'none'}`;
  
  // Check in-memory cache first
  const cached = FIRST_CALL_FREE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
    return !cached.granted; // If already granted, not eligible
  }
  
  try {
    // Check database for previous free calls from this IP/UA combo
    // Using Drizzle ORM to avoid raw SQL issues in Neon HTTP fetch mode
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const normalizedUserAgent = userAgent || '';
    
    // Build user-agent predicate: match exact UA, or if no UA provided, match null/empty
    const userAgentPredicate = normalizedUserAgent 
      ? eq(x402Interactions.userAgent, normalizedUserAgent)
      : or(isNull(x402Interactions.userAgent), eq(x402Interactions.userAgent, ''));
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(x402Interactions)
      .where(
        and(
          eq(x402Interactions.ipAddress, ipAddress),
          userAgentPredicate,
          eq(sql`metadata->>'first_call_free'`, 'granted'),
          gt(x402Interactions.createdAt, thirtyDaysAgo)
        )
      );
    
    const count = Number(result[0]?.count || 0);
    const eligible = count === 0;
    
    FIRST_CALL_FREE_CACHE.set(cacheKey, { granted: !eligible, timestamp: Date.now() });
    
    if (eligible) {
      console.log(`🎁 First-call-free eligibility CHECK: IP=${ipAddress.substring(0, 15)}... UA=${normalizedUserAgent.substring(0, 30) || '(none)'}... → ELIGIBLE (0 previous grants)`);
    }
    
    return eligible;
  } catch (error: any) {
    console.error(`❌ First-call-free eligibility check FAILED: ${error.message}`, { ipAddress: ipAddress.substring(0, 15), userAgent: userAgent?.substring(0, 30) });
    return false; // Fail closed
  }
}

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

// CANONICAL_BASE_URL - Always use production domain for 402 responses
// This ensures agents receive consistent resource URLs regardless of which environment serves the request
const CANONICAL_BASE_URL = process.env.PUBLIC_URL || 'https://coinrailz.com';

// Helper to get the canonical public URL - always returns production domain
function getPublicBaseUrl(req: Request): string {
  // Always return canonical production URL for 402 resource consistency
  // Agents need stable URLs to match payment verification
  return CANONICAL_BASE_URL;
}

/**
 * Payment Orchestrator - SELF-CONTAINED x402 payment handling with full funnel instrumentation
 * 
 * ENHANCED: Full funnel tracking for Discovery → Probe → Pay conversion analysis
 * 
 * Decision tree:
 * 0. If first-call free eligible + cheapest service → execute handler directly (with tracking)
 * 1. If bundle subscription → execute handler directly
 * 2. If no X-PAYMENT header → generate 402 with payment requirements (TRACKED)
 * 3. If raw 0x transaction hash → verify on-chain, execute handler (TRACKED)
 * 4. If Base64 JSON with txHash → verify on-chain, execute handler (TRACKED)
 * 5. If EIP-712 signature → verify via facilitator (fallback to next middleware)
 */
export function createPaymentOrchestrator(
  serviceName: string,
  requiredAmount: number,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = nanoid();
    const startTime = Date.now();
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];
    const offerTrackingId = req.query?.offer_tracking as string;
    const knownAgent = detectKnownAgent(userAgent);
    
    // Check if bundle subscription exists (set by bundleAuthMiddleware)
    if (req.bundleSubscription) {
      const priceUsd = SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD] || 1.00;
      console.log(`🎫 Bundle subscription detected for ${serviceName}, executing handler directly`);
      res.locals.payment = { method: "bundle-subscription", subscriptionId: req.bundleSubscription.id, amount: priceUsd, status: 'paid' };
      await handler(req, res);
      
      // Track bundle payment
      await x402InteractionTracker.trackInteraction({
        serviceId: serviceName,
        ipAddress,
        userAgent,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: 200,
        paid: true,
        amount: priceUsd,
        interactionType: 'payment',
        requestId,
        eventType: 'bundle-payment',
        serviceName,
        latencyMs: Date.now() - startTime,
        paymentReceived: true,
        paymentAmount: priceUsd,
        offerTrackingId,
        metadata: { method: 'bundle-subscription', knownAgent: knownAgent.name }
      });
      
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

    // FIRST-CALL FREE: Check if eligible for free call on cheapest services
    if (!xPayment && FIRST_CALL_FREE_SERVICES.includes(serviceName)) {
      const eligible = await isEligibleForFirstCallFree(ipAddress, userAgent);
      
      if (eligible) {
        console.log(`🎁 First-call FREE granted for ${serviceName} to ${knownAgent.name} (${ipAddress})`);
        
        res.locals.payment = { method: "first-call-free", amount: 0, status: 'complimentary' };
        
        try {
          await handler(req, res);
          
          // Track the free call for future eligibility checks
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 200,
            paid: false,
            amount: 0,
            interactionType: 'payment',
            requestId,
            eventType: 'first-call-free',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            paymentAmount: 0,
            offerTrackingId,
            metadata: { 
              first_call_free: 'granted', 
              knownAgent: knownAgent.name,
              originalPrice: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD]
            }
          });
          
          // Update cache
          const cacheKey = `${ipAddress}:${userAgent?.substring(0, 50) || 'none'}`;
          FIRST_CALL_FREE_CACHE.set(cacheKey, { granted: true, timestamp: Date.now() });
          
          return;
        } catch (handlerError: any) {
          console.error(`❌ First-call-free handler error for ${serviceName}:`, handlerError.message);
          // Continue to 402 on error
        }
      }
    }

    // No payment header → Generate 402 response ourselves (don't rely on x402-express)
    if (!xPayment) {
      console.log(`📊 Orchestrator: No payment for ${serviceName}, generating 402`);
      
      // FUNNEL TRACKING: Log 402 challenge issuance
      await x402InteractionTracker.trackInteraction({
        serviceId: serviceName,
        ipAddress,
        userAgent,
        requestPath: req.originalUrl,
        requestMethod: req.method,
        responseStatus: 402,
        paid: false,
        interactionType: 'attempt',
        requestId,
        eventType: 'challenge-issued',
        serviceName,
        latencyMs: Date.now() - startTime,
        paymentReceived: false,
        offerTrackingId,
        metadata: { 
          reason: 'no-payment-header',
          knownAgent: knownAgent.name,
          isKnownAgent: knownAgent.isKnown,
          priceUsd: SERVICE_PRICING_USD[serviceName as keyof typeof SERVICE_PRICING_USD]
        }
      });
      
      return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
              return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
            }
            
            const auth = payloadObj.authorization;
            const sig = payloadObj.signature as string;
            
            // Parse v, r, s from the signature (65 bytes: r=32, s=32, v=1)
            const sigHex = sig.startsWith("0x") ? sig.slice(2) : sig;
            
            // Validate signature length
            if (sigHex.length !== 130) {
              console.error(`❌ Invalid signature length: ${sigHex.length}, expected 130`);
              return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
          
          // FUNNEL TRACKING: Payment header parse failure - no txHash found
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 402,
            paid: false,
            interactionType: 'error',
            requestId,
            eventType: 'payment-parse-failed',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            errorMessage: `No txHash found in payload. Keys: ${Object.keys(payloadObj).join(', ')}`,
            offerTrackingId,
            metadata: { 
              reason: 'no-txhash-in-payload',
              knownAgent: knownAgent.name,
              payloadKeys: Object.keys(payloadObj)
            }
          });
          
          return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
        }
      } catch (e) {
        console.log(`🔐 Orchestrator: Failed to decode payment header for ${serviceName}: ${(e as Error).message}`);
        
        // FUNNEL TRACKING: Payment header decode failure
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 402,
          paid: false,
          interactionType: 'error',
          requestId,
          eventType: 'payment-decode-failed',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: false,
          errorMessage: (e as Error).message,
          offerTrackingId,
          metadata: { 
            reason: 'base64-decode-failed',
            knownAgent: knownAgent.name,
            headerLength: xPayment.length
          }
        });
        
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
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
            
            // FUNNEL TRACKING: Successful payment and service delivery
            await x402InteractionTracker.trackInteraction({
              serviceId: serviceName,
              ipAddress,
              userAgent,
              requestPath: req.originalUrl,
              requestMethod: req.method,
              responseStatus: 200,
              paid: true,
              amount: priceUsd,
              interactionType: 'payment',
              requestId,
              eventType: 'payment-verified',
              serviceName,
              latencyMs: Date.now() - startTime,
              paymentReceived: true,
              paymentAmount: priceUsd,
              offerTrackingId,
              metadata: { 
                txHash: txHash.substring(0, 20),
                knownAgent: knownAgent.name,
                verificationMethod: 'on-chain'
              }
            });
            
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
          
          // FUNNEL TRACKING: Payment verification failed
          await x402InteractionTracker.trackInteraction({
            serviceId: serviceName,
            ipAddress,
            userAgent,
            requestPath: req.originalUrl,
            requestMethod: req.method,
            responseStatus: 402,
            paid: false,
            interactionType: 'error',
            requestId,
            eventType: 'verification-failed',
            serviceName,
            latencyMs: Date.now() - startTime,
            paymentReceived: false,
            errorMessage: 'On-chain verification returned false',
            offerTrackingId,
            metadata: { 
              reason: 'verification-failed',
              knownAgent: knownAgent.name,
              txHash: txHash?.substring(0, 20)
            }
          });
          
          return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
        }
      } catch (error: any) {
        console.error(`❌ Orchestrator: Payment verification error for ${serviceName}:`, error.message);
        
        // FUNNEL TRACKING: Verification threw error
        await x402InteractionTracker.trackInteraction({
          serviceId: serviceName,
          ipAddress,
          userAgent,
          requestPath: req.originalUrl,
          requestMethod: req.method,
          responseStatus: 402,
          paid: false,
          interactionType: 'error',
          requestId,
          eventType: 'verification-error',
          serviceName,
          latencyMs: Date.now() - startTime,
          paymentReceived: false,
          errorMessage: error.message,
          offerTrackingId,
          metadata: { 
            reason: 'verification-exception',
            knownAgent: knownAgent.name,
            txHash: txHash?.substring(0, 20)
          }
        });
        
        return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
      }
    }

    // No valid payment found - return 402
    console.log(`❌ Orchestrator: No valid payment found for ${serviceName}, returning 402`);
    return generate402Response(req, res, serviceName, requiredAmount, knownAgent, requestId);
  };
}

/**
 * Generate a proper x402 402 response with payment requirements
 * Enhanced with partner CTA for known agents and first-call-free info
 */
function generate402Response(
  req: Request, 
  res: Response, 
  serviceName: string, 
  requiredAmount: number,
  knownAgent: { isKnown: boolean; name: string; partnerOffer: boolean } = { isKnown: false, name: 'unknown', partnerOffer: false },
  requestId?: string
) {
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
    "agent-create-wallet": "Provision persistent CDP-managed wallet for AI agents ($2.00 USDC)",
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
    "prediction-market-odds": "Current odds for any prediction market event",
  };

  // Build base response
  const response: any = {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: [{
      scheme: "exact",
      network: "base",
      maxAmountRequired: requiredAmount.toString(),
      maxAmountRequiredUSD: priceUsd,
      resource: resource,
      description: descriptions[serviceName] || `${serviceName} micropayment service`,
      mimeType: "application/json",
      payTo: PLATFORM_WALLET,
      maxTimeoutSeconds: 60,
      asset: USDC_BASE,
      extra: {
        name: "USD Coin",
        version: "2",
        decimals: 6,
        chainId: 8453,
        chainName: "Base"
      },
      discoverable: true
    }],
    facilitatorUrl: "https://facilitator.x402.io",
    paymentInstructions: {
      step1: "Obtain USDC on Base chain",
      step2: "Sign EIP-3009 authorization for the exact amount",
      step3: "Include Base64-encoded authorization in X-PAYMENT header",
      step4: "Retry the request with X-PAYMENT header",
      alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC",
      supportedMethods: ["eip3009-authorization", "raw-transaction-hash", "api-key"]
    },
    alternativePaymentMethods: {
      apiKey: {
        description: "Use prepaid credits with an API key (EASIEST - no blockchain required)",
        howToGet: "Purchase credits at https://coinrailz.com/credits with Stripe (credit card) or USDC",
        usage: "Include X-API-KEY header or Authorization: Bearer <api-key> header",
        benefits: ["No blockchain knowledge required", "Instant setup with credit card", "Single API key for all 37 services", "50-70% higher conversion than manual USDC"],
        getStarted: `${baseUrl}/credits`,
        example: `curl -X GET "${resource}" -H "X-API-KEY: your-api-key-here"`
      },
      rawTransaction: {
        description: "Send USDC directly to platform wallet, include tx hash in X-PAYMENT header",
        usage: "X-PAYMENT: 0x... (raw transaction hash)",
        platformWallet: PLATFORM_WALLET
      }
    },
    recommendedServices: [
      { id: "gas-price-oracle", name: "Gas Price Oracle", priceUSD: "$0.10", endpoint: "/x402/gas-price-oracle", note: "FIRST CALL FREE for new agents!" },
      { id: "token-metadata", name: "Token Metadata", priceUSD: "$0.10", endpoint: "/x402/token-metadata", note: "FIRST CALL FREE for new agents!" },
      { id: "trade-signals", name: "AI Trade Signals", priceUSD: "$0.75", endpoint: "/x402/trade-signals" },
      { id: "wallet-risk", name: "Wallet Risk Analysis", priceUSD: "$0.50", endpoint: "/x402/wallet-risk" },
      { id: "agent-create-wallet", name: "Agent Wallet Provisioning", priceUSD: "$2.00", endpoint: "/x402/agent-create-wallet" },
    ],
    catalogUrl: `${baseUrl}/x402/catalog`,
    totalServicesAvailable: 37,
    requestId: requestId,
    
    // FIRST-CALL FREE promotion
    firstCallFree: {
      eligible: FIRST_CALL_FREE_SERVICES.includes(serviceName),
      services: ["gas-price-oracle", "token-metadata"],
      priceNormally: "$0.10",
      note: "New agents get their first call FREE on gas-price-oracle or token-metadata! Just make the request - no payment needed."
    },
    
    // Quick start script for agents
    quickStart: {
      curlExample: `curl -X GET "${baseUrl}/x402/gas-price-oracle" -H "Content-Type: application/json"`,
      note: "First call is FREE - try it now! After that, include X-PAYMENT header with your transaction hash.",
      docsUrl: `${baseUrl}/docs/x402-quick-start`
    }
  };

  // Add partner CTA for known agents
  if (knownAgent.isKnown && knownAgent.partnerOffer) {
    response.partnerProgram = {
      detected: knownAgent.name,
      message: `Welcome ${knownAgent.name}! We've detected you as a known AI agent platform.`,
      offer: {
        type: "partner-integration",
        benefits: [
          "Priority API access with higher rate limits",
          "10% revenue share on referred agent payments",
          "Custom integration support",
          "Featured listing in our agent directory"
        ],
        contact: "partners@coinrailz.com",
        quickOnboard: `${baseUrl}/partners/onboard?agent=${encodeURIComponent(knownAgent.name)}`
      }
    };
    
    console.log(`🤝 Partner CTA injected for ${knownAgent.name}`);
  }

  console.log(`📊 x402 Funnel: challenge-issued for ${serviceName} | IP: ${req.ip} | Agent: ${knownAgent.name} | RequestId: ${requestId || 'none'}`);
  
  res.status(402).json(response);
}
