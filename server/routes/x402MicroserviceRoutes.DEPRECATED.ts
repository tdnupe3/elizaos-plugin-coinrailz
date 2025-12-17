/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                           ║
 * ║   ⚠️  DEPRECATED - DO NOT USE - LEGACY CODE ⚠️                           ║
 * ║                                                                           ║
 * ║   This file contains the LEGACY V1 x402 microservice routes.             ║
 * ║   It uses the OLD x402 protocol format:                                  ║
 * ║     - x402Version: 1 (outdated)                                          ║
 * ║     - network: "base" (non-CAIP-2 compliant)                             ║
 * ║     - facilitator.x402.io (deprecated facilitator)                       ║
 * ║                                                                           ║
 * ║   REPLACED BY: x402MicroserviceRoutesV2.ts                               ║
 * ║   The V2 file uses the current x402 protocol format:                     ║
 * ║     - x402Version: 2                                                     ║
 * ║     - network: "eip155:8453" (CAIP-2 compliant)                          ║
 * ║     - x402.org/facilitator (current facilitator)                         ║
 * ║                                                                           ║
 * ║   This file is NOT imported anywhere and exists only for historical      ║
 * ║   reference. All production traffic uses x402MicroserviceRoutesV2.ts     ║
 * ║                                                                           ║
 * ║   Deprecated: December 17, 2025                                          ║
 * ║   Reason: x402 V2 breaking changes (December 11, 2025)                   ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import {
  multiChainBalanceService,
  gasPriceOracleService,
  tokenPriceFeedService,
  contractQuickScanService,
  walletRiskScoreService,
  tradeSignalsService,
  tokenSocialSentimentService,
  trendingTokensFeedService,
  whaleWalletAlertsService,
  dexLiquidityMonitorService,
  transactionBuilderService,
  tokenMetadataService,
  approvalManagerService,
  batchQuoteService,
  portfolioTrackerService,
  instantAgentWalletService,
  verifiedAgentIdentityService,
  seamlessChainBridgeService,
  trackRequest,
  SERVICE_PRICING,
} from "./microservices";
import {
  transactionBuilderInputSchema,
  approvalManagerInputSchema,
  batchQuoteInputSchema,
} from "@shared/schema";
// CDP x402 SDK is installed but facilitator is accessed via direct API calls

const router = Router();

// Platform wallet for receiving payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";

// Rate limiting storage (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper: Check rate limit
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// Helper: Get service description
function getServiceDescription(serviceId: string): string {
  const descriptions: { [key: string]: string } = {
    "multi-chain-balance": "Query wallet balances across 7+ EVM chains in a single API call",
    "gas-price-oracle": "Real-time gas prices for multiple chains with USD cost estimates",
    "token-price": "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
    "contract-scan": "Basic smart contract security scan with safety score and vulnerability checks",
    "wallet-risk": "Wallet risk analysis with compliance flags and transaction pattern detection",
    "trade-signals": "AI-powered crypto trading signals with entry/exit points and risk analysis",
    "token-sentiment": "Social sentiment analysis for tokens with momentum indicators and activity levels",
    "trending-tokens": "Top gaining and losing tokens across DEXs with real-time market data",
    "whale-alerts": "Track large wallet movements (whales) with on-chain transaction monitoring",
    "dex-liquidity": "Real-time DEX liquidity pool monitoring across multiple exchanges",
    "transaction-builder": "Pre-validated transaction encoding for agent-to-agent transfers (B2B2C infrastructure)",
    "token-metadata": "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
    "approval-manager": "Token approval transaction generator - required infrastructure for DeFi agents (B2B2C infrastructure)",
    "batch-quote": "Multi-DEX price quotes in single call - critical infrastructure for trading bot price discovery (B2B2C infrastructure)",
    "portfolio-tracker": "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
    "instant-agent-wallet": "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents (Premium B2B2C Infrastructure)",
    "verified-agent-identity": "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard (Premium B2B2C Infrastructure)",
    "seamless-chain-bridge": "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly (Premium B2B2C Infrastructure)",
  };
  return descriptions[serviceId] || `${serviceId} micropayment service`;
}

// Helper: Get input schema for each service
function getServiceInputSchema(serviceId: string): Record<string, any> {
  switch (serviceId) {
    case "multi-chain-balance":
      return {
        walletAddress: { type: "string", required: true, description: "Wallet address to check" },
        chains: { type: "array", required: false, description: "Chains to check (default: all)" },
        includeTokens: { type: "boolean", required: false, description: "Include token balances" },
      };
    case "gas-price-oracle":
      return {
        chains: { type: "array", required: false, description: "Chains to check (default: all)" },
      };
    case "token-price":
      return {
        tokenAddress: { type: "string", required: true, description: "Token contract address" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "contract-scan":
      return {
        contractAddress: { type: "string", required: true, description: "Contract address to scan" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "wallet-risk":
      return {
        walletAddress: { type: "string", required: true, description: "Wallet address to analyze" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "trade-signals":
      return {
        token: { type: "string", required: false, description: "Trading pair (default: BTC/USDT)" },
        timeframe: { type: "string", required: false, description: "Timeframe (5m, 15m, 1h, 4h, 1d)" },
        riskLevel: { type: "string", required: false, description: "Risk level: low, medium, high" },
      };
    case "token-sentiment":
      return {
        tokenSymbol: { type: "string", required: true, description: "Token symbol (e.g., BTC, ETH, PEPE)" },
        chain: { type: "string", required: false, description: "Blockchain network (default: ethereum)" },
      };
    case "trending-tokens":
      return {
        timeframe: { type: "string", required: false, description: "Timeframe (default: 24h)" },
        chain: { type: "string", required: false, description: "Chain filter (default: all)" },
        limit: { type: "number", required: false, description: "Number of tokens to return (max: 50)" },
      };
    case "whale-alerts":
      return {
        tokenAddress: { type: "string", required: true, description: "Token contract address to monitor" },
        chain: { type: "string", required: false, description: "Blockchain network (default: ethereum)" },
        threshold: { type: "number", required: false, description: "Minimum USD value for whale detection (default: $100k)" },
      };
    case "dex-liquidity":
      return {
        tokenAddress: { type: "string", required: true, description: "Token contract address" },
        chain: { type: "string", required: false, description: "Blockchain network (default: ethereum)" },
      };
    case "transaction-builder":
      return {
        to: { type: "string", required: true, description: "Recipient address" },
        value: { type: "string", required: false, description: "ETH value to send" },
        data: { type: "string", required: false, description: "Transaction data" },
        chain: { type: "string", required: true, description: "Blockchain network" },
        tokenAddress: { type: "string", required: false, description: "ERC20 token address for token transfers" },
        amount: { type: "string", required: false, description: "Token amount for ERC20 transfers" },
      };
    case "token-metadata":
      return {
        tokenAddress: { type: "string", required: true, description: "Token contract address" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "approval-manager":
      return {
        tokenAddress: { type: "string", required: true, description: "Token to approve" },
        spender: { type: "string", required: true, description: "Spender address (usually DEX router)" },
        amount: { type: "string", required: true, description: "Amount to approve or 'unlimited'" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "batch-quote":
      return {
        fromToken: { type: "string", required: true, description: "Input token address" },
        toToken: { type: "string", required: true, description: "Output token address" },
        amount: { type: "string", required: true, description: "Input amount" },
        chain: { type: "string", required: true, description: "Blockchain network" },
      };
    case "portfolio-tracker":
      return {
        walletAddress: { type: "string", required: true, description: "Wallet address to track" },
        chains: { type: "array", required: false, description: "Chains to track (default: ethereum, base, polygon)" },
      };
    case "instant-agent-wallet":
      return {
        agentId: { type: "string", required: true, description: "Unique AI agent identifier" },
        description: { type: "string", required: false, description: "Wallet description/label" },
        initialFundingAmount: { type: "string", required: false, description: "Optional initial USDC funding amount" },
      };
    case "verified-agent-identity":
      return {
        agentId: { type: "string", required: true, description: "AI agent identifier" },
        walletAddress: { type: "string", required: true, description: "Wallet address to verify ownership" },
        signature: { type: "string", required: false, description: "Optional signature for enhanced verification" },
        metadata: { type: "object", required: false, description: "Optional agent metadata for reputation scoring" },
      };
    case "seamless-chain-bridge":
      return {
        fromChain: { type: "string", required: true, description: "Source blockchain (ethereum, polygon, base, arbitrum, optimism)" },
        toChain: { type: "string", required: true, description: "Destination blockchain" },
        amount: { type: "string", required: true, description: "USDC amount to bridge" },
        fromAddress: { type: "string", required: true, description: "Sender wallet address" },
        toAddress: { type: "string", required: true, description: "Recipient wallet address on destination chain" },
        currency: { type: "string", required: false, description: "Currency to bridge (default: USDC)" },
      };
    default:
      return {};
  }
}

// x402 Payment Wrapper for each service
router.all("/service/:serviceId", async (req: Request, res: Response) => {
  const { serviceId } = req.params;

  // Validate service exists
  if (!SERVICE_PRICING[serviceId as keyof typeof SERVICE_PRICING]) {
    return res.status(404).json({
      success: false,
      error: "Service not found",
      availableServices: Object.keys(SERVICE_PRICING),
    });
  }

  const price = SERVICE_PRICING[serviceId as keyof typeof SERVICE_PRICING];

  // Check for payment header
  const paymentProof = req.headers["x-payment-proof"] as string;
  const paymentId = req.headers["x-payment-id"] as string;

  if (!paymentProof || !paymentId) {
    // No payment, return 402 with CDP facilitator integration
    const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com' 
      : 'http://localhost:5000';
    
    // USDC amount in proper format for CDP facilitator
    const usdcAmount = Math.floor(price * 1000000).toString(); // 6 decimals
    
    const outputSchema = {
      input: {
        type: "http" as const,
        method: "POST" as const,
        bodyType: "json" as const,
        bodyFields: getServiceInputSchema(serviceId),
      },
      output: {
        success: { type: "boolean" },
        data: { type: "object" },
      },
    };
    
    // Return CDP facilitator-compatible payment requirements (x402 protocol v1)
    res.set('Accept', 'application/json');
    return res.status(402).json({
      x402Version: 1,
      paymentRequirements: [
        {
          type: "erc20-transfer",
          network: "base",
          tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
          amount: usdcAmount,
          recipient: PLATFORM_WALLET,
          facilitatorUrl: process.env.CDP_API_KEY_ID 
            ? "https://facilitator.cdp.coinbase.com" 
            : "https://x402.org/facilitator", // Use CDP facilitator for production or fallback for testnet
          description: `${serviceId} micropayment service - ${getServiceDescription(serviceId)}`,
          metadata: {
            serviceId,
            resource: `${baseUrl}/x402/service/${serviceId}`,
            mimeType: "application/json",
            outputSchema,
          }
        }
      ]
    });
  }

  // Verify payment using CDP facilitator
  try {
    // Use CDP facilitator to verify payment
    const facilitatorUrl = process.env.CDP_API_KEY_ID 
      ? "https://facilitator.cdp.coinbase.com/verify" 
      : "https://x402.org/facilitator/verify";
    
    const paymentPayload = JSON.parse(paymentProof);
    
    const verifyResponse = await axios.post(facilitatorUrl, {
      paymentPayload,
      paymentRequirements: [{
        type: "erc20-transfer",
        network: "base",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: Math.floor(price * 1000000).toString(),
        recipient: PLATFORM_WALLET,
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CDP_API_KEY_ID && {
          'X-CDP-Api-Key': process.env.CDP_API_KEY_ID,
          'X-CDP-Private-Key': process.env.CDP_PRIVATE_KEY || ''
        })
      }
    });

    const verificationResult = verifyResponse.data;

    // Extract payer wallet address from verification
    const payerWallet = verificationResult.from || paymentPayload.from || "unknown";

    // Payment verified - apply rate limiting based on actual payer wallet
    const walletKey = `wallet:${payerWallet}`;
    if (!checkRateLimit(walletKey, 100, 3600000)) {
      // 100 requests per hour
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 100 requests per hour per wallet",
      });
    }

    // Call the service function directly (in-process, no HTTP call needed)
    const startTime = Date.now();
    let result: any;

    try {
      switch (serviceId) {
        case "multi-chain-balance":
          const { walletAddress, chains, includeTokens } = req.body;
          if (!walletAddress) {
            return res.status(400).json({ success: false, error: "walletAddress is required" });
          }
          result = await multiChainBalanceService(
            walletAddress,
            chains || ["ethereum", "base", "polygon"],
            includeTokens !== false
          );
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "gas-price-oracle":
          result = await gasPriceOracleService(req.body.chains || ["ethereum", "base", "polygon"]);
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "token-price":
          const { tokenAddress, chain } = req.body;
          if (!tokenAddress || !chain) {
            return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
          }
          result = await tokenPriceFeedService(tokenAddress, chain);
          break;

        case "contract-scan":
          const { contractAddress: contractAddr, chain: contractChain } = req.body;
          if (!contractAddr || !contractChain) {
            return res.status(400).json({ success: false, error: "contractAddress and chain are required" });
          }
          result = await contractQuickScanService(contractAddr, contractChain);
          break;

        case "wallet-risk":
          const { walletAddress: riskWallet, chain: riskChain } = req.body;
          if (!riskWallet || !riskChain) {
            return res.status(400).json({ success: false, error: "walletAddress and chain are required" });
          }
          result = await walletRiskScoreService(riskWallet, riskChain);
          break;

        case "trade-signals":
          const { token, timeframe, riskLevel } = req.body;
          result = await tradeSignalsService({ token, timeframe, riskLevel });
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "token-sentiment":
          const { tokenSymbol, chain: sentimentChain } = req.body;
          if (!tokenSymbol) {
            return res.status(400).json({ success: false, error: "tokenSymbol is required" });
          }
          result = await tokenSocialSentimentService(tokenSymbol, sentimentChain);
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "trending-tokens":
          const { timeframe: trendTimeframe, chain: trendChain, limit: trendLimit } = req.body;
          result = await trendingTokensFeedService(trendTimeframe, trendChain, trendLimit);
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "whale-alerts":
          const { tokenAddress: whaleToken, chain: whaleChain, threshold } = req.body;
          if (!whaleToken) {
            return res.status(400).json({ success: false, error: "tokenAddress is required" });
          }
          result = await whaleWalletAlertsService(whaleToken, whaleChain, threshold);
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "dex-liquidity":
          const { tokenAddress: liquidityToken, chain: liquidityChain } = req.body;
          if (!liquidityToken) {
            return res.status(400).json({ success: false, error: "tokenAddress is required" });
          }
          result = await dexLiquidityMonitorService(liquidityToken, liquidityChain);
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "transaction-builder":
          const txBuilderValidation = transactionBuilderInputSchema.safeParse(req.body);
          if (!txBuilderValidation.success) {
            return res.status(400).json({
              success: false,
              error: "Invalid input",
              details: txBuilderValidation.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            });
          }
          result = await transactionBuilderService(txBuilderValidation.data);
          break;

        case "token-metadata":
          const { tokenAddress: metadataToken, chain: metadataChain } = req.body;
          if (!metadataToken || !metadataChain) {
            return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
          }
          result = await tokenMetadataService(metadataToken, metadataChain);
          break;

        case "approval-manager":
          const approvalValidation = approvalManagerInputSchema.safeParse(req.body);
          if (!approvalValidation.success) {
            return res.status(400).json({
              success: false,
              error: "Invalid input",
              details: approvalValidation.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            });
          }
          result = await approvalManagerService(approvalValidation.data);
          break;

        case "batch-quote":
          const batchQuoteValidation = batchQuoteInputSchema.safeParse(req.body);
          if (!batchQuoteValidation.success) {
            return res.status(400).json({
              success: false,
              error: "Invalid input",
              details: batchQuoteValidation.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            });
          }
          result = await batchQuoteService(batchQuoteValidation.data);
          break;

        case "portfolio-tracker":
          const { walletAddress: portfolioWallet, chains: portfolioChains } = req.body;
          if (!portfolioWallet) {
            return res.status(400).json({ success: false, error: "walletAddress is required" });
          }
          result = await portfolioTrackerService(portfolioWallet, portfolioChains || ["ethereum", "base", "polygon"]);
          break;

        case "instant-agent-wallet":
          const { agentId: walletAgentId, description: walletDesc, initialFundingAmount } = req.body;
          if (!walletAgentId) {
            return res.status(400).json({ success: false, error: "agentId is required" });
          }
          result = await instantAgentWalletService({ agentId: walletAgentId, description: walletDesc, initialFundingAmount });
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "verified-agent-identity":
          const { agentId: identityAgentId, walletAddress: identityWallet, signature, metadata: identityMetadata } = req.body;
          if (!identityAgentId || !identityWallet) {
            return res.status(400).json({ success: false, error: "agentId and walletAddress are required" });
          }
          result = await verifiedAgentIdentityService({ 
            agentId: identityAgentId, 
            walletAddress: identityWallet, 
            signature, 
            metadata: identityMetadata 
          });
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        case "seamless-chain-bridge":
          const { fromChain, toChain, amount: bridgeAmount, fromAddress, toAddress, currency: bridgeCurrency } = req.body;
          if (!fromChain || !toChain || !bridgeAmount || !fromAddress || !toAddress) {
            return res.status(400).json({ 
              success: false, 
              error: "fromChain, toChain, amount, fromAddress, and toAddress are required" 
            });
          }
          result = await seamlessChainBridgeService({ 
            fromChain, 
            toChain, 
            amount: bridgeAmount, 
            fromAddress, 
            toAddress, 
            currency: bridgeCurrency 
          });
          result.queryTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
          break;

        default:
          return res.status(404).json({ error: "Service not found" });
      }

      // Track the successful request
      const responseTime = Date.now() - startTime;
      await trackRequest(serviceId, req.body, result, responseTime, price, payerWallet);

      return res.json({ success: true, data: result });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest(serviceId, req.body, null, responseTime, price, payerWallet, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return res.status(402).json({
      error: "Payment verification failed",
      message: error.response?.data?.message || error.message || "Failed to verify payment with CDP facilitator",
    });
  }
});

// Service catalog endpoint
router.get("/catalog", (req: Request, res: Response) => {
  const services = Object.entries(SERVICE_PRICING).map(([id, price]) => {
    const descriptions: { [key: string]: string } = {
      "multi-chain-balance": "Query wallet balances across 7+ EVM chains in a single API call",
      "gas-price-oracle": "Real-time gas prices for multiple chains with USD cost estimates",
      "token-price": "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
      "contract-scan": "Basic smart contract security scan with safety score and vulnerability checks",
      "wallet-risk": "Wallet risk analysis with compliance flags and transaction pattern detection",
      "trade-signals": "AI-powered crypto trading signals with entry/exit points and risk analysis",
      "token-sentiment": "Social sentiment analysis for tokens with momentum indicators and activity levels",
      "trending-tokens": "Top gaining and losing tokens across DEXs with real-time market data",
      "whale-alerts": "Track large wallet movements (whales) with on-chain transaction monitoring",
      "dex-liquidity": "Real-time DEX liquidity pool monitoring across multiple exchanges",
      "transaction-builder": "Pre-validated transaction encoding for agent-to-agent transfers (B2B2C infrastructure)",
      "token-metadata": "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
      "approval-manager": "Token approval transaction generator - required infrastructure for DeFi agents (B2B2C infrastructure)",
      "batch-quote": "Multi-DEX price quotes in single call - critical infrastructure for trading bot price discovery (B2B2C infrastructure)",
      "portfolio-tracker": "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
    };

    const responseTimes: { [key: string]: string } = {
      "multi-chain-balance": "<1s",
      "gas-price-oracle": "<1s",
      "token-price": "<1s",
      "contract-scan": "<10s",
      "wallet-risk": "<2s",
      "trade-signals": "<1s",
      "token-sentiment": "<2s",
      "trending-tokens": "<5s",
      "whale-alerts": "<3s",
      "dex-liquidity": "<2s",
      "transaction-builder": "<1s",
      "token-metadata": "<1s",
      "approval-manager": "<1s",
      "batch-quote": "<1s",
      "portfolio-tracker": "<2s",
    };

    return {
      id,
      name: id
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      description: descriptions[id],
      price: `${price} USDC`,
      estimatedResponseTime: responseTimes[id],
      endpoint: `/x402/service/${id}`,
      paymentMethod: "x402 Protocol (USDC on Base)",
    };
  });

  res.json({
    success: true,
    platform: "Coin Railz Micropayment Services",
    totalServices: services.length,
    paymentWallet: PLATFORM_WALLET,
    paymentChain: "Base",
    paymentCurrency: "USDC",
    services,
  });
});

// Health check endpoint
router.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "operational",
    services: Object.keys(SERVICE_PRICING),
    timestamp: new Date().toISOString(),
  });
});

export default router;
