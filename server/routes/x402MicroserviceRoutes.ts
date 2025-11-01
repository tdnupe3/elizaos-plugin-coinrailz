import { Router, Request, Response } from "express";
import { X402PaymentService } from "../services/x402PaymentService";
import { nanoid } from "nanoid";
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
  getEthPrice,
  trackRequest,
  SERVICE_PRICING,
} from "./microservices";

// Initialize x402 payment service
const x402Service = new X402PaymentService();

const router = Router();

// Platform wallet for receiving payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";

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
    // No payment, return 402 with x402scan-compliant format
    const paymentRequest = await x402Service.createPaymentRequest({
      amount: price,
      agentId: serviceId,
      serviceDescription: `Micropayment service: ${serviceId}`,
      network: "base",
      currency: "USDC",
    });

    const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com' 
      : 'http://localhost:5000';
    
    // Multi-currency support: USDC, ETH, USDT on Base chain
    const ethPrice = await getEthPrice();
    const usdcAmount = Math.floor(price * 1000000).toString(); // 6 decimals
    const ethAmount = Math.floor(price * 1e18 / ethPrice).toString(); // Live ETH price, 18 decimals
    const usdtAmount = Math.floor(price * 1000000).toString(); // 6 decimals
    
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
    
    return res.status(402).json({
      x402Version: 1,
      accepts: [
        // USDC (Base) - Primary
        {
          scheme: "exact" as const,
          network: "base" as const,
          maxAmountRequired: usdcAmount,
          resource: `${baseUrl}/x402/service/${serviceId}`,
          description: `${serviceId} micropayment service (USDC)`,
          mimeType: "application/json",
          payTo: PLATFORM_WALLET,
          maxTimeoutSeconds: 900,
          asset: "USDC",
          outputSchema,
        },
        // ETH (Base)
        {
          scheme: "exact" as const,
          network: "base" as const,
          maxAmountRequired: ethAmount,
          resource: `${baseUrl}/x402/service/${serviceId}`,
          description: `${serviceId} micropayment service (ETH)`,
          mimeType: "application/json",
          payTo: PLATFORM_WALLET,
          maxTimeoutSeconds: 900,
          asset: "ETH",
          outputSchema,
        },
        // USDT (Base)
        {
          scheme: "exact" as const,
          network: "base" as const,
          maxAmountRequired: usdtAmount,
          resource: `${baseUrl}/x402/service/${serviceId}`,
          description: `${serviceId} micropayment service (USDT)`,
          mimeType: "application/json",
          payTo: PLATFORM_WALLET,
          maxTimeoutSeconds: 900,
          asset: "USDT",
          outputSchema,
        },
      ],
    });
  }

  // Verify payment
  try {
    const verification = await x402Service.verifyPayment(paymentId, paymentProof);

    if (!verification.success || verification.status !== "completed") {
      return res.status(402).json({
        error: "Payment verification failed",
        message: verification.error || "Payment proof could not be verified on-chain",
      });
    }

    // Extract payer wallet address from verification
    const payerWallet = verification.walletAddress || paymentProof.slice(0, 42);

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
    return res.status(500).json({
      error: "Payment processing error",
      message: error.message,
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
