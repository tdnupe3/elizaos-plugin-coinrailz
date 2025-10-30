import { Router, Request, Response } from "express";
import { X402PaymentService } from "../services/x402PaymentService";
import { nanoid } from "nanoid";
import {
  multiChainBalanceService,
  gasPriceOracleService,
  tokenPriceFeedService,
  contractQuickScanService,
  walletRiskScoreService,
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
    // No payment, return 402 Payment Required with x402 protocol compliant format
    const paymentRequest = await x402Service.createPaymentRequest({
      amount: price,
      agentId: serviceId,
      serviceDescription: `Micropayment service: ${serviceId}`,
      network: "base",
      currency: "USDC",
    });

    // Set x402 protocol headers
    res.setHeader("Accept-Payment", "coinbase-commerce, crypto-address");
    res.setHeader("Content-Type", "application/json");
    
    return res.status(402).json({
      type: "https://x402.org/errors/payment-required",
      title: "Payment Required",
      status: 402,
      detail: `Payment of ${price} USDC required to access ${serviceId} service`,
      paymentMethods: [
        {
          type: "crypto-address",
          network: "base",
          currency: "USDC",
          address: paymentRequest.walletAddress,
          amount: price.toString(),
          paymentId: paymentRequest.paymentId,
          expiresAt: paymentRequest.expiresAt,
        }
      ],
      instructions: `Send ${price} USDC to ${paymentRequest.walletAddress} on Base chain, then retry with X-Payment-Proof (tx hash) and X-Payment-ID (${paymentRequest.paymentId}) headers`
    });
  }

  // Verify payment
  try {
    const verification = await x402Service.verifyPayment(paymentId, {
      transactionHash: paymentProof,
      verificationMethod: "alchemy_rpc",
    });

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
    };

    const responseTimes: { [key: string]: string } = {
      "multi-chain-balance": "<1s",
      "gas-price-oracle": "<1s",
      "token-price": "<1s",
      "contract-scan": "<10s",
      "wallet-risk": "<2s",
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
