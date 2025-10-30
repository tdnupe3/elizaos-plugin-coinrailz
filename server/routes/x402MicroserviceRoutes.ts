import { Router, Request, Response } from "express";
import { X402PaymentService } from "../services/x402PaymentService";
import { nanoid } from "nanoid";

// Initialize x402 payment service
const x402Service = new X402PaymentService();

const router = Router();

// Platform wallet for receiving payments
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";

// Pricing configuration (in USDC)
const SERVICE_PRICING = {
  "multi-chain-balance": 0.01,
  "gas-price-oracle": 0.01,
  "token-price": 0.05,
  "contract-scan": 2.0,
  "wallet-risk": 0.5,
};

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
    // No payment, return 402 Payment Required with payment details
    const paymentRequest = await x402Service.createPaymentRequest({
      amount: price,
      agentId: serviceId,
      serviceDescription: `Micropayment service: ${serviceId}`,
      network: "base",
      currency: "USDC",
    });

    return res.status(402).json({
      error: "Payment Required",
      service: serviceId,
      price: `${price} USDC`,
      paymentDetails: {
        paymentId: paymentRequest.paymentId,
        address: paymentRequest.walletAddress,
        amount: price,
        currency: "USDC",
        chain: "base",
        expiresAt: paymentRequest.expiresAt,
      },
      instructions: {
        step1: "Send exactly " + price + " USDC to " + paymentRequest.walletAddress + " on Base chain",
        step2: "Include transaction hash in X-Payment-Proof header",
        step3: "Include payment ID (" + paymentRequest.paymentId + ") in X-Payment-ID header",
        step4: "Retry this request with payment headers",
      },
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

    // Payment verified - apply rate limiting
    const walletKey = `wallet:${paymentProof.slice(0, 42)}`;
    if (!checkRateLimit(walletKey, 100, 3600000)) {
      // 100 requests per hour
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 100 requests per hour per wallet",
      });
    }

    // Forward to actual service implementation
    const microservicesRouter = await import("./microservices");
    
    // Map service ID to microservice endpoint
    const endpointMap: { [key: string]: string } = {
      "multi-chain-balance": "/multi-chain-balance",
      "gas-price-oracle": "/gas-price-oracle",
      "token-price": "/token-price",
      "contract-scan": "/contract-scan",
      "wallet-risk": "/wallet-risk",
    };

    const endpoint = endpointMap[serviceId];
    if (!endpoint) {
      return res.status(500).json({ error: "Service implementation not found" });
    }

    // Call the microservice
    const response = await fetch(`http://localhost:5000/api/microservices${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.json(data);
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
