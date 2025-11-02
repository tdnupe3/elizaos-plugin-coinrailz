import { Router, Request, Response } from "express";
import { paymentMiddleware, Network } from "x402-express";
import { facilitator } from "@coinbase/x402";
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

const router = Router();

// Ensure CDP facilitator credentials are available (x402-express expects CDP_API_KEY_SECRET)
if (process.env.CDP_PRIVATE_KEY && !process.env.CDP_API_KEY_SECRET) {
  process.env.CDP_API_KEY_SECRET = process.env.CDP_PRIVATE_KEY;
}

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321") as `0x${string}`;

// Network selection based on environment
const NETWORK: Network = process.env.REPLIT_DEPLOYMENT === '1' ? "base" : "base-sepolia";

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

// Configure all x402 routes with official middleware
const x402Routes = {
  // Original 10 trader-focused services
  "/x402/service/multi-chain-balance": {
    price: `$${SERVICE_PRICING["multi-chain-balance"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Multi-Chain Balance Checker",
      description: "Query wallet balances across 7+ EVM chains in a single API call",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to check", required: true },
          chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
          includeTokens: { type: "boolean", description: "Include token balances (optional)" }
        }
      }
    }
  },
  "/x402/service/gas-price-oracle": {
    price: `$${SERVICE_PRICING["gas-price-oracle"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Gas Price Oracle",
      description: "Real-time gas prices for multiple chains with USD cost estimates",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
        }
      }
    }
  },
  "/x402/service/token-price": {
    price: `$${SERVICE_PRICING["token-price"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Token Price Feed",
      description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/contract-scan": {
    price: `$${SERVICE_PRICING["contract-scan"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Contract Security Scanner",
      description: "Basic smart contract security scan with safety score and vulnerability checks",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          contractAddress: { type: "string", description: "Smart contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/wallet-risk": {
    price: `$${SERVICE_PRICING["wallet-risk"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Wallet Risk Analyzer",
      description: "Wallet risk analysis with compliance flags and transaction pattern detection",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to analyze", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/trade-signals": {
    price: `$${SERVICE_PRICING["trade-signals"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "AI Trade Signals",
      description: "AI-powered crypto trading signals with entry/exit points and risk analysis",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          token: { type: "string", description: "Token symbol (optional, default: BTC/USDT)" },
          timeframe: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], description: "Chart timeframe" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk tolerance level" }
        }
      }
    }
  },
  "/x402/service/token-sentiment": {
    price: `$${SERVICE_PRICING["token-sentiment"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Token Sentiment Analyzer",
      description: "Social sentiment analysis for tokens with momentum indicators and activity levels",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenSymbol: { type: "string", description: "Token symbol (e.g., BTC, ETH, PEPE)", required: true },
          chain: { type: "string", description: "Blockchain network (optional, default: ethereum)" }
        }
      }
    }
  },
  "/x402/service/trending-tokens": {
    price: `$${SERVICE_PRICING["trending-tokens"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Trending Tokens Feed",
      description: "Top gaining and losing tokens across DEXs with real-time market data",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          timeframe: { type: "string", description: "Time period (optional, default: 24h)" },
          chain: { type: "string", description: "Blockchain network (optional, default: all)" }
        }
      }
    }
  },
  "/x402/service/whale-alerts": {
    price: `$${SERVICE_PRICING["whale-alerts"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Whale Movement Tracker",
      description: "Track large wallet movements (whales) with on-chain transaction monitoring",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
          minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
          tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to watch (optional)" }
        }
      }
    }
  },
  "/x402/service/dex-liquidity": {
    price: `$${SERVICE_PRICING["dex-liquidity"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "DEX Liquidity Monitor",
      description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  // 5 B2B2C infrastructure services
  "/x402/service/transaction-builder": {
    price: `$${SERVICE_PRICING["transaction-builder"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Transaction Builder API",
      description: "Pre-validated transaction encoding for agent-to-agent transfers (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          to: { type: "string", description: "Recipient address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true },
          tokenAddress: { type: "string", description: "ERC20 token address (optional)" },
          amount: { type: "string", description: "Token amount (optional)" },
          value: { type: "string", description: "ETH value (optional)" },
          data: { type: "string", description: "Custom transaction data (optional)" }
        }
      }
    }
  },
  "/x402/service/token-metadata": {
    price: `$${SERVICE_PRICING["token-metadata"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Token Metadata Service",
      description: "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/approval-manager": {
    price: `$${SERVICE_PRICING["approval-manager"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Token Approval Manager",
      description: "Token approval transaction generator - required infrastructure for DeFi agents (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token to approve", required: true },
          spender: { type: "string", description: "Spender address (DEX router)", required: true },
          amount: { type: "string", description: "Amount to approve or 'unlimited'", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/batch-quote": {
    price: `$${SERVICE_PRICING["batch-quote"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Multi-DEX Quote Engine",
      description: "Multi-DEX price quotes in single call - critical infrastructure for trading bot price discovery (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          fromToken: { type: "string", description: "Input token address", required: true },
          toToken: { type: "string", description: "Output token address", required: true },
          amount: { type: "string", description: "Input amount", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      }
    }
  },
  "/x402/service/portfolio-tracker": {
    price: `$${SERVICE_PRICING["portfolio-tracker"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Portfolio Tracker API",
      description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to track", required: true },
          chains: { type: "array", items: { type: "string" }, description: "Chains to track (default: ethereum, base, polygon)" }
        }
      }
    }
  },
  // 3 Premium B2B2C services
  "/x402/service/instant-agent-wallet": {
    price: `$${SERVICE_PRICING["instant-agent-wallet"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Instant Agent Wallet Creator",
      description: "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
      inputSchema: {
        bodyFields: {
          agentId: { type: "string", description: "Unique AI agent identifier", required: true },
          description: { type: "string", description: "Wallet description/label (optional)" },
          initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
        }
      }
    }
  },
  "/x402/service/verified-agent-identity": {
    price: `$${SERVICE_PRICING["verified-agent-identity"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Agent Identity Verification",
      description: "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 180,
      inputSchema: {
        bodyFields: {
          agentId: { type: "string", description: "AI agent identifier", required: true },
          walletAddress: { type: "string", description: "Wallet address to verify", required: true },
          signature: { type: "string", description: "Optional signature for enhanced verification" },
          metadata: { type: "object", description: "Agent metadata for reputation scoring" }
        }
      }
    }
  },
  "/x402/service/seamless-chain-bridge": {
    price: `$${SERVICE_PRICING["seamless-chain-bridge"]}`,
    network: NETWORK,
    config: {
      discoverable: true,
      name: "Cross-Chain USDC Bridge",
      description: "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly (Premium B2B2C Infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 240,
      inputSchema: {
        bodyFields: {
          fromChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Source blockchain", required: true },
          toChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Destination blockchain", required: true },
          amount: { type: "string", description: "USDC amount to bridge", required: true },
          fromAddress: { type: "string", description: "Sender wallet address", required: true },
          toAddress: { type: "string", description: "Recipient wallet address on destination chain", required: true },
          currency: { type: "string", description: "Currency to bridge (default: USDC)" }
        }
      }
    }
  },
};

// Apply official x402-express middleware to all routes
router.use(paymentMiddleware(
  PLATFORM_WALLET,
  x402Routes,
  facilitator // Use official CDP facilitator
));

// Service handler implementations (called AFTER payment is verified by middleware)
router.post("/x402/service/multi-chain-balance", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Payment already verified by middleware
    const { walletAddress, chains, includeTokens } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: "walletAddress is required" });
    }

    // Rate limiting
    const walletKey = `wallet:${walletAddress}`;
    if (!checkRateLimit(walletKey, 100, 3600000)) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 100 requests per hour per wallet",
      });
    }

    const result = await multiChainBalanceService(walletAddress, chains, includeTokens);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("multi-chain-balance", req.body, result, responseTime, SERVICE_PRICING["multi-chain-balance"], walletAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("multi-chain-balance", req.body, null, responseTime, SERVICE_PRICING["multi-chain-balance"], req.body.walletAddress || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/gas-price-oracle", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { chains } = req.body;
    const result = await gasPriceOracleService(chains);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("gas-price-oracle", req.body, result, responseTime, SERVICE_PRICING["gas-price-oracle"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("gas-price-oracle", req.body, null, responseTime, SERVICE_PRICING["gas-price-oracle"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/token-price", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
    }

    const result = await tokenPriceFeedService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-price", req.body, result, responseTime, SERVICE_PRICING["token-price"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-price", req.body, null, responseTime, SERVICE_PRICING["token-price"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/contract-scan", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { contractAddress, chain } = req.body;
    
    if (!contractAddress || !chain) {
      return res.status(400).json({ success: false, error: "contractAddress and chain are required" });
    }

    const result = await contractQuickScanService(contractAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("contract-scan", req.body, result, responseTime, SERVICE_PRICING["contract-scan"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("contract-scan", req.body, null, responseTime, SERVICE_PRICING["contract-scan"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/wallet-risk", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chain } = req.body;
    
    if (!walletAddress || !chain) {
      return res.status(400).json({ success: false, error: "walletAddress and chain are required" });
    }

    const result = await walletRiskScoreService(walletAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("wallet-risk", req.body, result, responseTime, SERVICE_PRICING["wallet-risk"], walletAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("wallet-risk", req.body, null, responseTime, SERVICE_PRICING["wallet-risk"], req.body.walletAddress || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/trade-signals", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { token, timeframe, riskLevel } = req.body;
    const result = await tradeSignalsService({ token, timeframe, riskLevel });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trade-signals", req.body, result, responseTime, SERVICE_PRICING["trade-signals"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trade-signals", req.body, null, responseTime, SERVICE_PRICING["trade-signals"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/token-sentiment", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenSymbol, chain } = req.body;
    
    if (!tokenSymbol) {
      return res.status(400).json({ success: false, error: "tokenSymbol is required" });
    }

    const result = await tokenSocialSentimentService(req.body);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-sentiment", req.body, result, responseTime, SERVICE_PRICING["token-sentiment"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-sentiment", req.body, null, responseTime, SERVICE_PRICING["token-sentiment"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/trending-tokens", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { timeframe, chain } = req.body;
    const result = await trendingTokensFeedService(timeframe, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trending-tokens", req.body, result, responseTime, SERVICE_PRICING["trending-tokens"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trending-tokens", req.body, null, responseTime, SERVICE_PRICING["trending-tokens"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/whale-alerts", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { chains, minValueUsd, tokenAddresses } = req.body;
    const result = await whaleWalletAlertsService(chains, minValueUsd, tokenAddresses);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("whale-alerts", req.body, result, responseTime, SERVICE_PRICING["whale-alerts"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("whale-alerts", req.body, null, responseTime, SERVICE_PRICING["whale-alerts"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/dex-liquidity", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
    }

    const result = await dexLiquidityMonitorService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("dex-liquidity", req.body, result, responseTime, SERVICE_PRICING["dex-liquidity"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("dex-liquidity", req.body, null, responseTime, SERVICE_PRICING["dex-liquidity"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/transaction-builder", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = transactionBuilderInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.message });
    }

    const result = await transactionBuilderService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("transaction-builder", req.body, result, responseTime, SERVICE_PRICING["transaction-builder"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("transaction-builder", req.body, null, responseTime, SERVICE_PRICING["transaction-builder"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/token-metadata", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
    }

    const result = await tokenMetadataService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-metadata", req.body, result, responseTime, SERVICE_PRICING["token-metadata"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-metadata", req.body, null, responseTime, SERVICE_PRICING["token-metadata"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/approval-manager", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = approvalManagerInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.message });
    }

    const result = await approvalManagerService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("approval-manager", req.body, result, responseTime, SERVICE_PRICING["approval-manager"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("approval-manager", req.body, null, responseTime, SERVICE_PRICING["approval-manager"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/batch-quote", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = batchQuoteInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.message });
    }

    const result = await batchQuoteService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("batch-quote", req.body, result, responseTime, SERVICE_PRICING["batch-quote"], req.ip || "unknown");
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("batch-quote", req.body, null, responseTime, SERVICE_PRICING["batch-quote"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/portfolio-tracker", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chains } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: "walletAddress is required" });
    }

    const result = await portfolioTrackerService(walletAddress, chains || ["ethereum", "base", "polygon"]);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("portfolio-tracker", req.body, result, responseTime, SERVICE_PRICING["portfolio-tracker"], walletAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("portfolio-tracker", req.body, null, responseTime, SERVICE_PRICING["portfolio-tracker"], req.body.walletAddress || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/instant-agent-wallet", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { agentId, description, initialFundingAmount } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: "agentId is required" });
    }

    const result = await instantAgentWalletService({ agentId, description, initialFundingAmount });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("instant-agent-wallet", req.body, result, responseTime, SERVICE_PRICING["instant-agent-wallet"], result.walletAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("instant-agent-wallet", req.body, null, responseTime, SERVICE_PRICING["instant-agent-wallet"], req.ip || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/verified-agent-identity", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { agentId, walletAddress, signature, metadata } = req.body;
    
    if (!agentId || !walletAddress) {
      return res.status(400).json({ success: false, error: "agentId and walletAddress are required" });
    }

    const result = await verifiedAgentIdentityService({ agentId, walletAddress, signature, metadata });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("verified-agent-identity", req.body, result, responseTime, SERVICE_PRICING["verified-agent-identity"], walletAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("verified-agent-identity", req.body, null, responseTime, SERVICE_PRICING["verified-agent-identity"], req.body.walletAddress || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/x402/service/seamless-chain-bridge", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { fromChain, toChain, amount, fromAddress, toAddress, currency } = req.body;
    
    if (!fromChain || !toChain || !amount || !fromAddress || !toAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "fromChain, toChain, amount, fromAddress, and toAddress are required" 
      });
    }

    const result = await seamlessChainBridgeService({ fromChain, toChain, amount, fromAddress, toAddress, currency });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("seamless-chain-bridge", req.body, result, responseTime, SERVICE_PRICING["seamless-chain-bridge"], fromAddress);
    
    return res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("seamless-chain-bridge", req.body, null, responseTime, SERVICE_PRICING["seamless-chain-bridge"], req.body.fromAddress || "unknown", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
