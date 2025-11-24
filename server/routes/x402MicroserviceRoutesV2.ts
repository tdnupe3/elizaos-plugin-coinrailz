import { Router, Request, Response } from "express";
import { paymentMiddleware, Network } from "x402-express";
import { facilitator } from "@coinbase/x402";
import { db } from "../db";
import { sql } from "drizzle-orm";
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
  SERVICE_PRICING as SERVICE_PRICING_USD, // USD float values for analytics/display
  propertyValuationService,
  leaseAnalysisService,
  constructionProgressService,
  creditRiskScoreService,
  fraudDetectionService,
  complianceCheckService,
  tradingSignalService,
  portfolioOptimizationService,
  sentimentAnalysisService,
  arbitrageScannerService,
  correlationMatrixService,
  riskMetricsService,
} from "./microservices";
import {
  transactionBuilderInputSchema,
  approvalManagerInputSchema,
  batchQuoteInputSchema,
  propertyValuationInputSchema,
  leaseAnalysisInputSchema,
  constructionProgressInputSchema,
  creditRiskScoreInputSchema,
  fraudDetectionInputSchema,
  complianceCheckInputSchema,
  tradingSignalInputSchema,
  portfolioOptimizationInputSchema,
  sentimentAnalysisInputSchema,
  arbitrageScannerInputSchema,
  correlationMatrixInputSchema,
  riskMetricsInputSchema,
} from "@shared/schema";
import { x402TrackingMiddleware } from "../middleware/x402TrackingMiddleware";
import { hybridPaymentMiddleware, SERVICE_PRICING } from "../middleware/hybridPaymentMiddleware";
import { usageAnalyticsMiddleware } from "../middleware/usageAnalyticsMiddleware";
import { createPaymentOrchestrator } from "../middleware/paymentOrchestrator";
import { bundleAuthMiddleware } from "../middleware/bundleAuthMiddleware";
import { deductBundleCredits } from "../services/bundleCreditService";

const router = Router();

// Helper to convert micro-USDC (6 decimals) to USD for display
// Example: 500000 micro-USDC → "$0.50"
function microToUSD(microAmount: number): string {
  return (microAmount / 1_000_000).toFixed(2);
}

// Helper function to track bundle credits after successful service execution
async function trackBundleUsage(
  req: Request,
  res: Response,
  serviceSlug: string,
  requestMetadata?: Record<string, any>
) {
  if (req.bundleSubscription) {
    const deductionResult = await deductBundleCredits(
      req.bundleSubscription.id,
      serviceSlug,
      serviceSlug,
      "200",
      requestMetadata || {}
    );
    if (deductionResult.success) {
      res.setHeader("X-Bundle-Credits-Used", deductionResult.creditsDeducted.toString());
      res.setHeader("X-Bundle-Credits-Remaining", deductionResult.creditsRemaining.toString());
      res.setHeader("X-Payment-Method", "bundle-subscription");
    }
  }
}

// Apply analytics and interaction tracking to all x402 routes
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);
router.use(bundleAuthMiddleware); // Check for bundle subscriptions

// CRITICAL FIX: Override Host header for x402-express resource URL generation
// x402-express reads req.get('host') to build resource URLs - we need to inject the public domain
router.use((req: Request, res: Response, next) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    // In production, force coinrailz.com as the host
    req.headers.host = 'coinrailz.com';
    req.headers['x-forwarded-host'] = 'coinrailz.com';
  } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // In workspace, use repl.co URL
    const workspaceHost = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    req.headers.host = workspaceHost;
    req.headers['x-forwarded-host'] = workspaceHost;
  }
  next();
});

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91") as `0x${string}`;

// Network selection based on environment
// CRITICAL FIX: Force BASE MAINNET for Bazaar discovery (testnet services don't appear in Bazaar)
const NETWORK: Network = "base"; // Always use mainnet for production discoverability

// Public base URL for Bazaar discovery (x402 crawler needs public URLs, not localhost)
// CRITICAL: Use REPLIT_DOMAINS for workspace URLs (correct Replit env var)
// OVERRIDE: Set PUBLIC_URL env var to force production URL (e.g., PUBLIC_URL=https://coinrailz.com)
const PUBLIC_BASE_URL: `${string}://${string}` = (
  process.env.PUBLIC_URL 
    ? process.env.PUBLIC_URL
    : process.env.REPLIT_DEPLOYMENT === '1' 
      ? 'https://coinrailz.com'
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : 'http://localhost:5000'
) as `${string}://${string}`;

// Helper function to create properly typed resource URLs
function resourceUrl(path: string): `${string}://${string}` {
  return `${PUBLIC_BASE_URL}${path}` as `${string}://${string}`;
}

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
// FIX: Use HTTP method + path format for proper route matching
// Paths are relative to /x402 mount point (e.g., 'POST /multi-chain-balance' = POST /x402/multi-chain-balance)
const x402Routes = {
  // Original 10 trader-focused services
  "POST /multi-chain-balance": {
    price: `$${microToUSD(SERVICE_PRICING["multi-chain-balance"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/multi-chain-balance`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to check" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
            includeTokens: { type: "boolean", description: "Include token balances (optional)" }
          },
          required: ["walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            balances: { type: "array", description: "Wallet balances across chains" },
            totalValueUsd: { type: "number", description: "Total portfolio value in USD" }
          }
        }
      }
    }
  },
  "POST /gas-price-oracle": {
    price: `$${microToUSD(SERVICE_PRICING["gas-price-oracle"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/gas-price-oracle`,
      name: "Gas Price Oracle",
      description: "Real-time gas prices for multiple chains with USD cost estimates",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
          }
        },
        output: {
          type: "object",
          properties: {
            gasPrices: { type: "array", description: "Gas prices across requested chains" }
          }
        }
      }
    }
  },
  "POST /token-price": {
    price: `$${microToUSD(SERVICE_PRICING["token-price"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-price`,
      name: "Token Price Feed",
      description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            price: { type: "number", description: "Current token price in USD" },
            change24h: { type: "number", description: "24-hour price change percentage" },
            volume24h: { type: "number", description: "24-hour trading volume" }
          }
        }
      }
    }
  },
  "POST /contract-scan": {
    price: `$${microToUSD(SERVICE_PRICING["contract-scan"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/contract-scan`,
      name: "Contract Security Scanner",
      description: "Basic smart contract security scan with safety score and vulnerability checks",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          contractAddress: { type: "string", description: "Smart contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["contractAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            safetyScore: { type: "number", description: "Security score 0-100" },
            vulnerabilities: { type: "array", description: "List of detected vulnerabilities" }
          }
        }
      }
    }
  },
  "POST /wallet-risk": {
    price: `$${microToUSD(SERVICE_PRICING["wallet-risk"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/wallet-risk`,
      name: "Wallet Risk Analyzer",
      description: "Wallet risk analysis with compliance flags and transaction pattern detection",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to analyze", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to analyze" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["walletAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            riskScore: { type: "number", description: "Risk score 0-100" },
            complianceFlags: { type: "array", description: "Compliance issues detected" }
          }
        }
      }
    }
  },
  "POST /trade-signals": {
    price: `$${microToUSD(SERVICE_PRICING["trade-signals"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/trade-signals`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            token: { type: "string", description: "Token symbol (optional, default: BTC/USDT)" },
            timeframe: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], description: "Chart timeframe" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk tolerance level" }
          }
        },
        output: {
          type: "object",
          properties: {
            signal: { type: "string", description: "Buy/Sell/Hold signal" },
            entry: { type: "number", description: "Suggested entry price" },
            target: { type: "number", description: "Price target" },
            stopLoss: { type: "number", description: "Stop loss price" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          signal: { type: "string", description: "Buy/Sell/Hold signal" },
          entry: { type: "number", description: "Suggested entry price" },
          target: { type: "number", description: "Price target" },
          stopLoss: { type: "number", description: "Stop loss price" }
        }
      }
    }
  },
  "POST /token-sentiment": {
    price: `$${microToUSD(SERVICE_PRICING["token-sentiment"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-sentiment`,
      name: "Token Sentiment Analyzer",
      description: "Social sentiment analysis for tokens with momentum indicators and activity levels",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenSymbol: { type: "string", description: "Token symbol (e.g., BTC, ETH, PEPE)", required: true },
          chain: { type: "string", description: "Blockchain network (optional, default: ethereum)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenSymbol: { type: "string", description: "Token symbol (e.g., BTC, ETH, PEPE)" },
            chain: { type: "string", description: "Blockchain network (optional, default: ethereum)" }
          },
          required: ["tokenSymbol"]
        },
        output: {
          type: "object",
          properties: {
            sentiment: { type: "string", description: "Bullish/Bearish/Neutral" },
            score: { type: "number", description: "Sentiment score -100 to 100" },
            momentum: { type: "string", description: "Trending momentum indicator" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          sentiment: { type: "string", description: "Bullish/Bearish/Neutral" },
          score: { type: "number", description: "Sentiment score -100 to 100" },
          momentum: { type: "string", description: "Trending momentum indicator" }
        }
      }
    }
  },
  "POST /trending-tokens": {
    price: `$${microToUSD(SERVICE_PRICING["trending-tokens"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/trending-tokens`,
      name: "Trending Tokens Feed",
      description: "Top gaining and losing tokens across DEXs with real-time market data",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          timeframe: { type: "string", description: "Time period (optional, default: 24h)" },
          chain: { type: "string", description: "Blockchain network (optional, default: all)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            timeframe: { type: "string", description: "Time period (optional, default: 24h)" },
            chain: { type: "string", description: "Blockchain network (optional, default: all)" }
          }
        },
        output: {
          type: "object",
          properties: {
            gainers: { type: "array", description: "Top gaining tokens" },
            losers: { type: "array", description: "Top losing tokens" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          gainers: { type: "array", description: "Top gaining tokens" },
          losers: { type: "array", description: "Top losing tokens" }
        }
      }
    }
  },
  "POST /whale-alerts": {
    price: `$${microToUSD(SERVICE_PRICING["whale-alerts"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/whale-alerts`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
            minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
            tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to watch (optional)" }
          }
        },
        output: {
          type: "object",
          properties: {
            transactions: { type: "array", description: "Recent whale movements" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          transactions: { type: "array", description: "Recent whale movements" }
        }
      }
    }
  },
  "POST /dex-liquidity": {
    price: `$${microToUSD(SERVICE_PRICING["dex-liquidity"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/dex-liquidity`,
      name: "DEX Liquidity Monitor",
      description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            liquidityPools: { type: "array", description: "DEX liquidity data" },
            totalLiquidity: { type: "number", description: "Total liquidity in USD" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          liquidityPools: { type: "array", description: "DEX liquidity data" },
          totalLiquidity: { type: "number", description: "Total liquidity in USD" }
        }
      }
    }
  },
  // 5 B2B2C infrastructure services
  "POST /transaction-builder": {
    price: `$${microToUSD(SERVICE_PRICING["transaction-builder"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/transaction-builder`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient address" },
            chain: { type: "string", description: "Blockchain network" },
            tokenAddress: { type: "string", description: "ERC20 token address (optional)" },
            amount: { type: "string", description: "Token amount (optional)" },
            value: { type: "string", description: "ETH value (optional)" },
            data: { type: "string", description: "Custom transaction data (optional)" }
          },
          required: ["to", "chain"]
        },
        output: {
          type: "object",
          properties: {
            transaction: { type: "object", description: "Encoded transaction object ready to sign" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          transaction: { type: "object", description: "Encoded transaction object ready to sign" }
        }
      }
    }
  },
  "POST /token-metadata": {
    price: `$${microToUSD(SERVICE_PRICING["token-metadata"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/token-metadata`,
      name: "Token Metadata Service",
      description: "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      inputSchema: {
        bodyFields: {
          tokenAddress: { type: "string", description: "Token contract address", required: true },
          chain: { type: "string", description: "Blockchain network", required: true }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        },
        output: {
          type: "object",
          properties: {
            name: { type: "string", description: "Token name" },
            symbol: { type: "string", description: "Token symbol" },
            decimals: { type: "number", description: "Token decimals" },
            totalSupply: { type: "string", description: "Total supply" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Token name" },
          symbol: { type: "string", description: "Token symbol" },
          decimals: { type: "number", description: "Token decimals" },
          totalSupply: { type: "string", description: "Total supply" }
        }
      }
    }
  },
  "POST /approval-manager": {
    price: `$${microToUSD(SERVICE_PRICING["approval-manager"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/approval-manager`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token to approve" },
            spender: { type: "string", description: "Spender address (DEX router)" },
            amount: { type: "string", description: "Amount to approve or 'unlimited'" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "spender", "amount", "chain"]
        },
        output: {
          type: "object",
          properties: {
            approvalTransaction: { type: "object", description: "Approval transaction data" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          approvalTransaction: { type: "object", description: "Approval transaction data" }
        }
      }
    }
  },
  "POST /batch-quote": {
    price: `$${microToUSD(SERVICE_PRICING["batch-quote"])}`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            fromToken: { type: "string", description: "Input token address" },
            toToken: { type: "string", description: "Output token address" },
            amount: { type: "string", description: "Input amount" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["fromToken", "toToken", "amount", "chain"]
        },
        output: {
          type: "object",
          properties: {
            quotes: { type: "array", description: "Price quotes from multiple DEXs" },
            bestPrice: { type: "string", description: "Best available price" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          quotes: { type: "array", description: "Price quotes from multiple DEXs" },
          bestPrice: { type: "string", description: "Best available price" }
        }
      }
    }
  },
  "POST /portfolio-tracker": {
    price: `$${microToUSD(SERVICE_PRICING["portfolio-tracker"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/portfolio-tracker`,
      name: "Portfolio Tracker API",
      description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      inputSchema: {
        bodyFields: {
          walletAddress: { type: "string", description: "Wallet address to track", required: true },
          chains: { type: "array", items: { type: "string" }, description: "Chains to track (default: ethereum, base, polygon)" }
        }
      },
      schema: {
        input: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to track" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to track (default: ethereum, base, polygon)" }
          },
          required: ["walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            totalValueUsd: { type: "number", description: "Total portfolio value in USD" },
            holdings: { type: "array", description: "Token holdings across chains" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          totalValueUsd: { type: "number", description: "Total portfolio value in USD" },
          holdings: { type: "array", description: "Token holdings across chains" }
        }
      }
    }
  },
  // 3 Premium B2B2C services
  "POST /instant-agent-wallet": {
    price: `$${microToUSD(SERVICE_PRICING["instant-agent-wallet"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/instant-agent-wallet`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            description: { type: "string", description: "Wallet description/label (optional)" },
            initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
          },
          required: ["agentId"]
        },
        output: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "New wallet address" },
            walletId: { type: "string", description: "Circle wallet ID" },
            network: { type: "string", description: "Blockchain network" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          walletAddress: { type: "string", description: "New wallet address" },
          walletId: { type: "string", description: "Circle wallet ID" },
          network: { type: "string", description: "Blockchain network" }
        }
      }
    }
  },
  "POST /verified-agent-identity": {
    price: `$${microToUSD(SERVICE_PRICING["verified-agent-identity"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/verified-agent-identity`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "AI agent identifier" },
            walletAddress: { type: "string", description: "Wallet address to verify" },
            signature: { type: "string", description: "Optional signature for enhanced verification" },
            metadata: { type: "object", description: "Agent metadata for reputation scoring" }
          },
          required: ["agentId", "walletAddress"]
        },
        output: {
          type: "object",
          properties: {
            verified: { type: "boolean", description: "Verification status" },
            reputationScore: { type: "number", description: "On-chain reputation score" },
            identityNFT: { type: "string", description: "ERC-8004 identity NFT address" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          verified: { type: "boolean", description: "Verification status" },
          reputationScore: { type: "number", description: "On-chain reputation score" },
          identityNFT: { type: "string", description: "ERC-8004 identity NFT address" }
        }
      }
    }
  },
  "POST /seamless-chain-bridge": {
    price: `$${microToUSD(SERVICE_PRICING["seamless-chain-bridge"])}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/seamless-chain-bridge`,
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
      },
      schema: {
        input: {
          type: "object",
          properties: {
            fromChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Source blockchain" },
            toChain: { type: "string", enum: ["ethereum", "polygon", "base", "arbitrum", "optimism"], description: "Destination blockchain" },
            amount: { type: "string", description: "USDC amount to bridge" },
            fromAddress: { type: "string", description: "Sender wallet address" },
            toAddress: { type: "string", description: "Recipient wallet address on destination chain" },
            currency: { type: "string", description: "Currency to bridge (default: USDC)" }
          },
          required: ["fromChain", "toChain", "amount", "fromAddress", "toAddress"]
        },
        output: {
          type: "object",
          properties: {
            bridgeTransaction: { type: "object", description: "Cross-chain bridge transaction details" },
            estimatedTime: { type: "number", description: "Estimated completion time in seconds" }
          }
        }
      },
      outputSchema: {
        type: "object",
        properties: {
          bridgeTransaction: { type: "object", description: "Cross-chain bridge transaction details" },
          estimatedTime: { type: "number", description: "Estimated completion time in seconds" }
        }
      }
    }
  },
  
  // === ENTERPRISE GATED SERVICES ===
  "POST /service/smart-contract-audit": {
    price: "$1000",
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/service/smart-contract-audit`,
      name: "Smart Contract Auditor",
      description: "Comprehensive smart contract security audit with vulnerability detection",
      mimeType: "application/json",
      maxTimeoutSeconds: 900,
    },
  },
  "POST /service/payment-processing": {
    price: "$50",
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/service/payment-processing`,
      name: "Payment Processor",
      description: "Multi-chain payment processing service (hourly rate)",
      mimeType: "application/json",
      maxTimeoutSeconds: 300,
    },
  },
  "POST /service/compliance-consultation": {
    price: "$500",
    network: NETWORK,
    config: {
      discoverable: true,
      resource: `${PUBLIC_BASE_URL}/x402/service/compliance-consultation`,
      name: "Compliance Consultant",
      description: "AML/KYC compliance consultation and risk assessment",
      mimeType: "application/json",
      maxTimeoutSeconds: 600,
    },
  },
};

// CRITICAL FIX: x402-express never writes `discoverable` or `facilitatorUrl` into 402 responses
// These fields must be manually injected by wrapping res.json BEFORE paymentMiddleware runs
// See: https://github.com/coinbase/x402-express/issues - discoverable is metadata-only
router.use((req: Request, res: Response, next) => {
  const originalJson = res.json.bind(res);
  
  // Monkey-patch res.json to inject missing x402scan required fields
  res.json = function(body: any) {
    // Only modify 402 Payment Required responses from x402-express
    if (res.statusCode === 402 && body?.x402Version && body?.accepts) {
      console.log('🔧 Injecting discoverable:true + facilitatorUrl into 402 response');
      
      // Determine correct public base URL for this environment
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const isWorkspace = process.env.REPL_SLUG && process.env.REPL_OWNER;
      let publicBaseUrl = 'http://localhost:5000';
      
      if (isProduction) {
        publicBaseUrl = 'https://coinrailz.com';
      } else if (isWorkspace) {
        publicBaseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      }
      
      // Inject facilitatorUrl at top level (x402scan requirement)
      body.facilitatorUrl = 'https://facilitator.x402.io'; // Coinbase CDP facilitator
      
      // Inject discoverable:true into each payment requirement (x402scan requirement)
      body.accepts = body.accepts.map((paymentReq: any) => ({
        ...paymentReq,
        discoverable: true,
        resource: paymentReq.resource?.replace(/http:\/\/localhost:\d+\//, `${publicBaseUrl}/x402/`) || paymentReq.resource,
      }));
      
      console.log(`✅ Injected: facilitatorUrl=${body.facilitatorUrl}, discoverable=true for ${body.accepts.length} payment requirements`);
    }
    
    return originalJson(body);
  };
  
  next();
});

// Payment orchestrator applied per-route (see individual service registrations below)
// This decides between raw hash verification and EIP-712 verification upfront
// Prevents middleware conflict by choosing verification path before x402-express runs
console.log('🔄 Payment orchestrator configured - will apply per-route for flexibility');

// Apply x402-express middleware ONLY as fallback for EIP-712 signatures
// Orchestrator bypasses this for raw transaction hashes
console.log('🔄 x402-express paymentMiddleware configured as EIP-712 fallback');
console.log(`🌐 PUBLIC_BASE_URL set to: ${PUBLIC_BASE_URL}`);

// NOTE: x402-express doesn't support baseURL parameter - it uses request headers
// We've set resource field in each route config, but x402-express v0.7.1 ignores it
// Will need to upgrade x402-express or modify request headers
const x402Middleware = paymentMiddleware(
  PLATFORM_WALLET,
  x402Routes,
  facilitator // Use the imported CDP facilitator (auto-registers with Bazaar)
);

// Service handler implementations with payment orchestrator
const multiChainBalanceHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chains, includeTokens } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ success: false, error: "walletAddress is required" });
      return;
    }

    const walletKey = `wallet:${walletAddress}`;
    if (!checkRateLimit(walletKey, 100, 3600000)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Maximum 100 requests per hour per wallet",
      });
      return;
    }

    const result = await multiChainBalanceService(walletAddress, chains, includeTokens);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("multi-chain-balance", req.body, result, responseTime, SERVICE_PRICING_USD["multi-chain-balance"], walletAddress);
    await trackBundleUsage(req, res, "multi-chain-balance", { walletAddress, chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("multi-chain-balance", req.body, null, responseTime, SERVICE_PRICING_USD["multi-chain-balance"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/multi-chain-balance",
  createPaymentOrchestrator("multi-chain-balance", SERVICE_PRICING["multi-chain-balance"], multiChainBalanceHandler),
  x402Middleware,
  multiChainBalanceHandler
);

// ✅ TEST ROUTE: gas-price-oracle with payment orchestrator
const gasPriceOracleHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { chains } = req.body;
    const result = await gasPriceOracleService(chains);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("gas-price-oracle", req.body, result, responseTime, SERVICE_PRICING_USD["gas-price-oracle"], req.ip || "unknown");
    await trackBundleUsage(req, res, "gas-price-oracle", { chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("gas-price-oracle", req.body, null, responseTime, SERVICE_PRICING_USD["gas-price-oracle"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/gas-price-oracle", 
  createPaymentOrchestrator("gas-price-oracle", SERVICE_PRICING["gas-price-oracle"], gasPriceOracleHandler),
  x402Middleware,
  gasPriceOracleHandler
);

const tokenPriceHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await tokenPriceFeedService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-price", req.body, result, responseTime, SERVICE_PRICING_USD["token-price"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-price", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-price", req.body, null, responseTime, SERVICE_PRICING_USD["token-price"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-price",
  createPaymentOrchestrator("token-price", SERVICE_PRICING["token-price"], tokenPriceHandler),
  x402Middleware,
  tokenPriceHandler
);

const contractScanHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { contractAddress, chain } = req.body;
    
    if (!contractAddress || !chain) {
      res.status(400).json({ success: false, error: "contractAddress and chain are required" });
      return;
    }

    const result = await contractQuickScanService(contractAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("contract-scan", req.body, result, responseTime, SERVICE_PRICING_USD["contract-scan"], req.ip || "unknown");
    await trackBundleUsage(req, res, "contract-scan", { contractAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("contract-scan", req.body, null, responseTime, SERVICE_PRICING_USD["contract-scan"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/contract-scan",
  createPaymentOrchestrator("contract-scan", SERVICE_PRICING["contract-scan"], contractScanHandler),
  x402Middleware,
  contractScanHandler
);

const walletRiskHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chain } = req.body;
    
    if (!walletAddress || !chain) {
      res.status(400).json({ success: false, error: "walletAddress and chain are required" });
      return;
    }

    const result = await walletRiskScoreService(walletAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("wallet-risk", req.body, result, responseTime, SERVICE_PRICING_USD["wallet-risk"], walletAddress);
    await trackBundleUsage(req, res, "wallet-risk", { walletAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("wallet-risk", req.body, null, responseTime, SERVICE_PRICING_USD["wallet-risk"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/wallet-risk",
  createPaymentOrchestrator("wallet-risk", SERVICE_PRICING["wallet-risk"], walletRiskHandler),
  x402Middleware,
  walletRiskHandler
);

const tradeSignalsHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { token, timeframe, riskLevel } = req.body;
    const result = await tradeSignalsService({ token, timeframe, riskLevel });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trade-signals", req.body, result, responseTime, SERVICE_PRICING_USD["trade-signals"], req.ip || "unknown");
    await trackBundleUsage(req, res, "trade-signals", { token, timeframe, riskLevel });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trade-signals", req.body, null, responseTime, SERVICE_PRICING_USD["trade-signals"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/trade-signals",
  createPaymentOrchestrator("trade-signals", SERVICE_PRICING["trade-signals"], tradeSignalsHandler),
  x402Middleware,
  tradeSignalsHandler
);

const tokenSentimentHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenSymbol, chain } = req.body;
    
    if (!tokenSymbol) {
      res.status(400).json({ success: false, error: "tokenSymbol is required" });
      return;
    }

    const result = await tokenSocialSentimentService(req.body);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-sentiment", req.body, result, responseTime, SERVICE_PRICING_USD["token-sentiment"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-sentiment", req.body);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-sentiment", req.body, null, responseTime, SERVICE_PRICING_USD["token-sentiment"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-sentiment",
  createPaymentOrchestrator("token-sentiment", SERVICE_PRICING["token-sentiment"], tokenSentimentHandler),
  x402Middleware,
  tokenSentimentHandler
);

const trendingTokensHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { timeframe, chain } = req.body;
    const result = await trendingTokensFeedService(timeframe, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("trending-tokens", req.body, result, responseTime, SERVICE_PRICING_USD["trending-tokens"], req.ip || "unknown");
    await trackBundleUsage(req, res, "trending-tokens", { timeframe, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trending-tokens", req.body, null, responseTime, SERVICE_PRICING_USD["trending-tokens"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/trending-tokens",
  createPaymentOrchestrator("trending-tokens", SERVICE_PRICING["trending-tokens"], trendingTokensHandler),
  x402Middleware,
  trendingTokensHandler
);

const whaleAlertsHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { chains, minValueUsd, tokenAddresses } = req.body;
    const result = await whaleWalletAlertsService(chains, minValueUsd, tokenAddresses);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("whale-alerts", req.body, result, responseTime, SERVICE_PRICING_USD["whale-alerts"], req.ip || "unknown");
    await trackBundleUsage(req, res, "whale-alerts", { chains, minValueUsd });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("whale-alerts", req.body, null, responseTime, SERVICE_PRICING_USD["whale-alerts"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/whale-alerts",
  createPaymentOrchestrator("whale-alerts", SERVICE_PRICING["whale-alerts"], whaleAlertsHandler),
  x402Middleware,
  whaleAlertsHandler
);

const dexLiquidityHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await dexLiquidityMonitorService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("dex-liquidity", req.body, result, responseTime, SERVICE_PRICING_USD["dex-liquidity"], req.ip || "unknown");
    await trackBundleUsage(req, res, "dex-liquidity", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("dex-liquidity", req.body, null, responseTime, SERVICE_PRICING_USD["dex-liquidity"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/dex-liquidity",
  createPaymentOrchestrator("dex-liquidity", SERVICE_PRICING["dex-liquidity"], dexLiquidityHandler),
  x402Middleware,
  dexLiquidityHandler
);

const transactionBuilderHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = transactionBuilderInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await transactionBuilderService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("transaction-builder", req.body, result, responseTime, SERVICE_PRICING_USD["transaction-builder"], req.ip || "unknown");
    await trackBundleUsage(req, res, "transaction-builder", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("transaction-builder", req.body, null, responseTime, SERVICE_PRICING_USD["transaction-builder"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/transaction-builder",
  createPaymentOrchestrator("transaction-builder", SERVICE_PRICING["transaction-builder"], transactionBuilderHandler),
  x402Middleware,
  transactionBuilderHandler
);

const tokenMetadataHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress || !chain) {
      res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      return;
    }

    const result = await tokenMetadataService(tokenAddress, chain);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("token-metadata", req.body, result, responseTime, SERVICE_PRICING_USD["token-metadata"], req.ip || "unknown");
    await trackBundleUsage(req, res, "token-metadata", { tokenAddress, chain });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-metadata", req.body, null, responseTime, SERVICE_PRICING_USD["token-metadata"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/token-metadata",
  createPaymentOrchestrator("token-metadata", SERVICE_PRICING["token-metadata"], tokenMetadataHandler),
  x402Middleware,
  tokenMetadataHandler
);

const approvalManagerHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = approvalManagerInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await approvalManagerService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("approval-manager", req.body, result, responseTime, SERVICE_PRICING_USD["approval-manager"], req.ip || "unknown");
    await trackBundleUsage(req, res, "approval-manager", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("approval-manager", req.body, null, responseTime, SERVICE_PRICING_USD["approval-manager"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/approval-manager",
  createPaymentOrchestrator("approval-manager", SERVICE_PRICING["approval-manager"], approvalManagerHandler),
  x402Middleware,
  approvalManagerHandler
);

const batchQuoteHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validationResult = batchQuoteInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ success: false, error: validationResult.error.message });
      return;
    }

    const result = await batchQuoteService(validationResult.data);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("batch-quote", req.body, result, responseTime, SERVICE_PRICING_USD["batch-quote"], req.ip || "unknown");
    await trackBundleUsage(req, res, "batch-quote", validationResult.data);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("batch-quote", req.body, null, responseTime, SERVICE_PRICING_USD["batch-quote"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/batch-quote",
  createPaymentOrchestrator("batch-quote", SERVICE_PRICING["batch-quote"], batchQuoteHandler),
  x402Middleware,
  batchQuoteHandler
);

const portfolioTrackerHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { walletAddress, chains } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ success: false, error: "walletAddress is required" });
      return;
    }

    const result = await portfolioTrackerService(walletAddress, chains || ["ethereum", "base", "polygon"]);
    const responseTime = Date.now() - startTime;
    
    await trackRequest("portfolio-tracker", req.body, result, responseTime, SERVICE_PRICING_USD["portfolio-tracker"], walletAddress);
    await trackBundleUsage(req, res, "portfolio-tracker", { walletAddress, chains });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("portfolio-tracker", req.body, null, responseTime, SERVICE_PRICING_USD["portfolio-tracker"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/portfolio-tracker",
  createPaymentOrchestrator("portfolio-tracker", SERVICE_PRICING["portfolio-tracker"], portfolioTrackerHandler),
  x402Middleware,
  portfolioTrackerHandler
);

const instantAgentWalletHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { agentId, description, initialFundingAmount } = req.body;
    
    if (!agentId) {
      res.status(400).json({ success: false, error: "agentId is required" });
      return;
    }

    const result = await instantAgentWalletService({ agentId, description, initialFundingAmount });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("instant-agent-wallet", req.body, result, responseTime, SERVICE_PRICING_USD["instant-agent-wallet"], result.walletAddress);
    await trackBundleUsage(req, res, "instant-agent-wallet", { agentId });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("instant-agent-wallet", req.body, null, responseTime, SERVICE_PRICING_USD["instant-agent-wallet"], req.ip || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/instant-agent-wallet",
  createPaymentOrchestrator("instant-agent-wallet", SERVICE_PRICING["instant-agent-wallet"], instantAgentWalletHandler),
  x402Middleware,
  instantAgentWalletHandler
);

const verifiedAgentIdentityHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { agentId, walletAddress, signature, metadata } = req.body;
    
    if (!agentId || !walletAddress) {
      res.status(400).json({ success: false, error: "agentId and walletAddress are required" });
      return;
    }

    const result = await verifiedAgentIdentityService({ agentId, walletAddress, signature, metadata });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("verified-agent-identity", req.body, result, responseTime, SERVICE_PRICING_USD["verified-agent-identity"], walletAddress);
    await trackBundleUsage(req, res, "verified-agent-identity", { agentId, walletAddress });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("verified-agent-identity", req.body, null, responseTime, SERVICE_PRICING_USD["verified-agent-identity"], req.body.walletAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/verified-agent-identity",
  createPaymentOrchestrator("verified-agent-identity", SERVICE_PRICING["verified-agent-identity"], verifiedAgentIdentityHandler),
  x402Middleware,
  verifiedAgentIdentityHandler
);

const seamlessChainBridgeHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { fromChain, toChain, amount, fromAddress, toAddress, currency } = req.body;
    
    if (!fromChain || !toChain || !amount || !fromAddress || !toAddress) {
      res.status(400).json({ 
        success: false, 
        error: "fromChain, toChain, amount, fromAddress, and toAddress are required" 
      });
      return;
    }

    const result = await seamlessChainBridgeService({ fromChain, toChain, amount, fromAddress, toAddress, currency });
    const responseTime = Date.now() - startTime;
    
    await trackRequest("seamless-chain-bridge", req.body, result, responseTime, SERVICE_PRICING_USD["seamless-chain-bridge"], fromAddress);
    await trackBundleUsage(req, res, "seamless-chain-bridge", { fromChain, toChain, amount });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("seamless-chain-bridge", req.body, null, responseTime, SERVICE_PRICING_USD["seamless-chain-bridge"], req.body.fromAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/seamless-chain-bridge",
  createPaymentOrchestrator("seamless-chain-bridge", SERVICE_PRICING["seamless-chain-bridge"], seamlessChainBridgeHandler),
  x402Middleware,
  seamlessChainBridgeHandler
);

// === ENTERPRISE GATED SERVICE HANDLERS ===

const smartContractAuditHandler = async (req: Request, res: Response) => {
  try {
    const { contractCode, contractName } = req.body;

    if (!contractCode) {
      return res.status(400).json({
        success: false,
        error: 'Contract code is required',
      });
    }

    const { nanoid } = await import('nanoid');
    const { SmartContractAuditHandler } = await import('../services/handlers/SmartContractAuditHandler');
    const handler = new SmartContractAuditHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'smart-contract-auditor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 1000,
      metadata: { protocol: 'x402', paymentVerified: true },
      contractCode,
      contractName: contractName || 'Contract',
    });

    await trackBundleUsage(req, res, "smart-contract-audit", { contractName });

    res.json({
      success: true,
      result,
      amountPaid: 1000,
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Smart contract audit execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Audit execution failed',
      details: error.message,
    });
  }
};

const paymentProcessingHandler = async (req: Request, res: Response) => {
  try {
    const { amount, currency, network, recipientAddress } = req.body;

    if (!amount || !currency || !network || !recipientAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, currency, network, recipientAddress',
      });
    }

    const { nanoid } = await import('nanoid');
    const { PaymentProcessorHandler } = await import('../services/handlers/PaymentProcessorHandler');
    const handler = new PaymentProcessorHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'payment-processor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 50,
      metadata: { protocol: 'x402', paymentVerified: true },
      paymentDetails: {
        amount,
        currency,
        network,
        recipientAddress,
      },
    });

    await trackBundleUsage(req, res, "payment-processing", { amount, currency, network });

    res.json({
      success: true,
      result,
      amountPaid: 50,
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Payment processing execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      details: error.message,
    });
  }
};

const complianceConsultationHandler = async (req: Request, res: Response) => {
  try {
    const { businessType, jurisdiction, transactionVolume } = req.body;

    if (!businessType || !jurisdiction) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessType, jurisdiction',
      });
    }

    const { nanoid } = await import('nanoid');
    const { ComplianceConsultantHandler } = await import('../services/handlers/ComplianceConsultantHandler');
    const handler = new ComplianceConsultantHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'compliance-consultant',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: 500,
      metadata: { protocol: 'x402', paymentVerified: true },
      complianceRequirements: {
        businessType,
        jurisdiction,
        transactionVolume: transactionVolume || 0,
      },
    });

    await trackBundleUsage(req, res, "compliance-consultation", { businessType, jurisdiction });

    res.json({
      success: true,
      result,
      amountPaid: 500,
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Compliance consultation execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Consultation execution failed',
      details: error.message,
    });
  }
};

// Register enterprise gated service routes
router.post("/service/smart-contract-audit",
  createPaymentOrchestrator("smart-contract-audit", SERVICE_PRICING["smart-contract-audit"], smartContractAuditHandler),
  x402Middleware,
  smartContractAuditHandler
);

router.post("/service/payment-processing",
  createPaymentOrchestrator("payment-processing", SERVICE_PRICING["payment-processing"], paymentProcessingHandler),
  x402Middleware,
  paymentProcessingHandler
);

router.post("/service/compliance-consultation",
  createPaymentOrchestrator("compliance-consultation", SERVICE_PRICING["compliance-consultation"], complianceConsultationHandler),
  x402Middleware,
  complianceConsultationHandler
);

// ========================================
// PAYMENT TESTING & DOCUMENTATION ENDPOINTS
// ========================================

router.get("/payment-status", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE interaction_type = 'view') as total_views,
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as payment_attempts,
        COUNT(*) FILTER (WHERE interaction_type = 'payment') as successful_payments,
        COUNT(*) FILTER (WHERE interaction_type = 'error') as errors,
        COUNT(DISTINCT wallet_address) as unique_wallets,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE interaction_type = 'payment') / 
          NULLIF(COUNT(*) FILTER (WHERE interaction_type = 'attempt'), 0),
          2
        ) as payment_success_rate
      FROM x402_interactions
      WHERE created_at > NOW() - INTERVAL '7 days';
    `;
    
    const result = await db.execute(sql.raw(query));
    const stats = result.rows[0];
    
    const recentPaymentsQuery = `
      SELECT 
        wallet_address,
        amount,
        currency,
        status,
        x402_transaction_id as tx_hash,
        created_at,
        network
      FROM x402_payments
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    
    const recentPayments = await db.execute(sql.raw(recentPaymentsQuery));
    
    res.json({
      success: true,
      stats,
      recentPayments: recentPayments.rows,
      paymentInstructions: {
        network: NETWORK,
        token: "USDC",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        platformWallet: PLATFORM_WALLET,
        facilitator: "https://facilitator.x402.io",
        documentation: `${PUBLIC_BASE_URL}/x402/payment-docs`,
      },
    });
  } catch (error: any) {
    console.error("Payment status check failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/payment-docs", (req: Request, res: Response) => {
  const docs = {
    protocol: "x402",
    version: 1,
    title: "Coin Railz x402 Micropayment Services",
    description: "Pay-per-use API services across 7 blockchains with USDC on Base",
    baseUrl: PUBLIC_BASE_URL,
    network: NETWORK,
    paymentToken: {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      network: "base",
    },
    platformWallet: PLATFORM_WALLET,
    facilitator: "https://facilitator.x402.io",
    pricing: SERVICE_PRICING,
    paymentFlow: {
      step1: "Make API request to any service endpoint",
      step2: "Receive 402 Payment Required with payment instructions",
      step3: "Submit USDC payment on Base to platformWallet",
      step4: "Include X-PAYMENT header with transaction hash",
      step5: "Receive service response",
    },
    example: {
      service: "multi-chain-balance",
      price: "0.50 USDC",
      endpoint: `${PUBLIC_BASE_URL}/x402/multi-chain-balance`,
      method: "POST",
      paymentAmount: "500000",
      paymentAmountDescription: "500000 = $0.50 in USDC (6 decimals)",
    },
    troubleshooting: {
      noPaymentReceived: "Check transaction was sent to correct wallet and confirmed on Base",
      wrongNetwork: "Payment must be on Base mainnet, not Ethereum or other chains",
      wrongToken: "Payment must be USDC, not ETH or other tokens",
      facilitatorError: "Verify facilitator.x402.io is accessible",
    },
    support: {
      statusEndpoint: `${PUBLIC_BASE_URL}/x402/payment-status`,
      analyticsEndpoint: `${PUBLIC_BASE_URL}/api/x402-analytics/dashboard`,
    },
  };
  
  res.json(docs);
});

router.post("/test-payment-flow", async (req: Request, res: Response) => {
  try {
    const { walletAddress, serviceId } = req.body;
    
    if (!walletAddress || !serviceId) {
      res.status(400).json({
        success: false,
        error: "walletAddress and serviceId are required",
      });
      return;
    }
    
    const testResult = {
      success: true,
      walletAddress,
      serviceId,
      testSteps: {
        step1_requestService: {
          status: "ready",
          endpoint: `${PUBLIC_BASE_URL}/x402/${serviceId}`,
          method: "POST",
          expectedResponse: "402 Payment Required",
        },
        step2_paymentInstructions: {
          status: "ready",
          network: NETWORK,
          token: "USDC",
          amount: SERVICE_PRICING[serviceId as keyof typeof SERVICE_PRICING] || 500000,
          payTo: PLATFORM_WALLET,
          facilitator: "https://facilitator.x402.io",
        },
        step3_submitPayment: {
          status: "pending",
          instruction: "Send USDC on Base to platform wallet",
          verify: "Wait for blockchain confirmation",
        },
        step4_retryWithProof: {
          status: "pending",
          instruction: "Retry request with X-PAYMENT header containing tx hash",
          expectedResponse: "200 OK with service data",
        },
      },
      currentStats: {
        totalAttempts: 0,
        successfulPayments: 0,
        pendingPayments: 0,
      },
    };
    
    const statsQuery = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) FILTER (WHERE interaction_type = 'attempt') as attempts,
        COUNT(*) FILTER (WHERE interaction_type = 'payment') as successful
      FROM x402_interactions
      WHERE wallet_address = '${walletAddress}' AND service_id = '${serviceId}';
    `));
    if (statsQuery.rows[0]) {
      testResult.currentStats = {
        totalAttempts: Number(statsQuery.rows[0].attempts || 0),
        successfulPayments: Number(statsQuery.rows[0].successful || 0),
        pendingPayments: 0,
      };
    }
    
    res.json(testResult);
  } catch (error: any) {
    console.error("Test payment flow failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// VERTICAL EXPANSION: 12 NEW SERVICES
// Real Estate, Banking, Trading, Intelligence
// ========================================

// REAL ESTATE SERVICES
router.post("/property-valuation",
  createPaymentOrchestrator("property-valuation", 0.50, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = propertyValuationInputSchema.parse(req.body);
      const result = await propertyValuationService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("property-valuation", req.body, result, responseTime, 0.50, req.ip || "unknown");
      await trackBundleUsage(req, res, "property-valuation", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("property-valuation", req.body, null, responseTime, 0.50, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/lease-analysis",
  createPaymentOrchestrator("lease-analysis", 0.75, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = leaseAnalysisInputSchema.parse(req.body);
      const result = await leaseAnalysisService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("lease-analysis", req.body, result, responseTime, 0.75, req.ip || "unknown");
      await trackBundleUsage(req, res, "lease-analysis", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("lease-analysis", req.body, null, responseTime, 0.75, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/construction-progress",
  createPaymentOrchestrator("construction-progress", 1.00, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = constructionProgressInputSchema.parse(req.body);
      const result = await constructionProgressService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("construction-progress", req.body, result, responseTime, 1.00, req.ip || "unknown");
      await trackBundleUsage(req, res, "construction-progress", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("construction-progress", req.body, null, responseTime, 1.00, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

// BANKING/FINANCE SERVICES
router.post("/credit-risk-score",
  createPaymentOrchestrator("credit-risk-score", 0.50, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = creditRiskScoreInputSchema.parse(req.body);
      const result = await creditRiskScoreService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("credit-risk-score", req.body, result, responseTime, 0.50, req.ip || "unknown");
      await trackBundleUsage(req, res, "credit-risk-score", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("credit-risk-score", req.body, null, responseTime, 0.50, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/fraud-detection",
  createPaymentOrchestrator("fraud-detection", 0.25, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = fraudDetectionInputSchema.parse(req.body);
      const result = await fraudDetectionService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("fraud-detection", req.body, result, responseTime, 0.25, req.ip || "unknown");
      await trackBundleUsage(req, res, "fraud-detection", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("fraud-detection", req.body, null, responseTime, 0.25, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/compliance-check",
  createPaymentOrchestrator("compliance-check", 0.40, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = complianceCheckInputSchema.parse(req.body);
      const result = await complianceCheckService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("compliance-check", req.body, result, responseTime, 0.40, req.ip || "unknown");
      await trackBundleUsage(req, res, "compliance-check", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("compliance-check", req.body, null, responseTime, 0.40, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

// TRADING/INVESTMENT SERVICES
router.post("/trading-signal",
  createPaymentOrchestrator("trading-signal", 1.00, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = tradingSignalInputSchema.parse(req.body);
      const result = await tradingSignalService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("trading-signal", req.body, result, responseTime, 1.00, req.ip || "unknown");
      await trackBundleUsage(req, res, "trading-signal", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("trading-signal", req.body, null, responseTime, 1.00, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/portfolio-optimization",
  createPaymentOrchestrator("portfolio-optimization", 1.50, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = portfolioOptimizationInputSchema.parse(req.body);
      const result = await portfolioOptimizationService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("portfolio-optimization", req.body, result, responseTime, 1.50, req.ip || "unknown");
      await trackBundleUsage(req, res, "portfolio-optimization", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("portfolio-optimization", req.body, null, responseTime, 1.50, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/sentiment-analysis",
  createPaymentOrchestrator("sentiment-analysis", 0.20, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = sentimentAnalysisInputSchema.parse(req.body);
      const result = await sentimentAnalysisService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("sentiment-analysis", req.body, result, responseTime, 0.20, req.ip || "unknown");
      await trackBundleUsage(req, res, "sentiment-analysis", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("sentiment-analysis", req.body, null, responseTime, 0.20, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

// MARKET INTELLIGENCE SERVICES
router.post("/arbitrage-scanner",
  createPaymentOrchestrator("arbitrage-scanner", 0.75, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = arbitrageScannerInputSchema.parse(req.body);
      const result = await arbitrageScannerService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("arbitrage-scanner", req.body, result, responseTime, 0.75, req.ip || "unknown");
      await trackBundleUsage(req, res, "arbitrage-scanner", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("arbitrage-scanner", req.body, null, responseTime, 0.75, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/correlation-matrix",
  createPaymentOrchestrator("correlation-matrix", 0.50, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = correlationMatrixInputSchema.parse(req.body);
      const result = await correlationMatrixService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("correlation-matrix", req.body, result, responseTime, 0.50, req.ip || "unknown");
      await trackBundleUsage(req, res, "correlation-matrix", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("correlation-matrix", req.body, null, responseTime, 0.50, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

router.post("/risk-metrics",
  createPaymentOrchestrator("risk-metrics", 0.60, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const validatedInput = riskMetricsInputSchema.parse(req.body);
      const result = await riskMetricsService(validatedInput);
      const responseTime = Date.now() - startTime;
      await trackRequest("risk-metrics", req.body, result, responseTime, 0.60, req.ip || "unknown");
      await trackBundleUsage(req, res, "risk-metrics", validatedInput);
      res.json(result);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      await trackRequest("risk-metrics", req.body, null, responseTime, 0.60, req.ip || "unknown", error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }),
  x402Middleware
);

export default router;
