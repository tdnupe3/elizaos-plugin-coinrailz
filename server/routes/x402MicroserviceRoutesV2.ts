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
import { x402TrackingMiddleware } from "../middleware/x402TrackingMiddleware";
import { hybridPaymentMiddleware } from "../middleware/hybridPaymentMiddleware";
import { usageAnalyticsMiddleware } from "../middleware/usageAnalyticsMiddleware";
import { createPaymentOrchestrator } from "../middleware/paymentOrchestrator";

const router = Router();

// Apply analytics and interaction tracking to all x402 routes
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);

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
const PUBLIC_BASE_URL: `${string}://${string}` = (process.env.REPLIT_DEPLOYMENT === '1' 
  ? 'https://coinrailz.com'
  : process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : 'http://localhost:5000') as `${string}://${string}`;

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
    price: `$${SERVICE_PRICING["multi-chain-balance"]}`,
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
    price: `$${SERVICE_PRICING["gas-price-oracle"]}`,
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
    price: `$${SERVICE_PRICING["token-price"]}`,
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
    price: `$${SERVICE_PRICING["contract-scan"]}`,
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
    price: `$${SERVICE_PRICING["wallet-risk"]}`,
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
    price: `$${SERVICE_PRICING["trade-signals"]}`,
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
    price: `$${SERVICE_PRICING["token-sentiment"]}`,
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
    price: `$${SERVICE_PRICING["trending-tokens"]}`,
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
    price: `$${SERVICE_PRICING["whale-alerts"]}`,
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
    price: `$${SERVICE_PRICING["dex-liquidity"]}`,
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
    price: `$${SERVICE_PRICING["transaction-builder"]}`,
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
    price: `$${SERVICE_PRICING["token-metadata"]}`,
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
    price: `$${SERVICE_PRICING["approval-manager"]}`,
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
    price: `$${SERVICE_PRICING["portfolio-tracker"]}`,
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
    price: `$${SERVICE_PRICING["instant-agent-wallet"]}`,
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
    price: `$${SERVICE_PRICING["verified-agent-identity"]}`,
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
    price: `$${SERVICE_PRICING["seamless-chain-bridge"]}`,
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
};

// HYPOTHESIS TEST: Add discoverable:true to actual HTTP 402 response body
// (Bazaar crawler may be looking for this field in the response, not just in config)
// This middleware MUST run BEFORE paymentMiddleware to intercept the response
router.use((req: Request, res: Response, next) => {
  const originalEnd = res.end.bind(res);
  
  // Intercept at the lowest level - res.end() which all response methods ultimately call
  res.end = function(chunk: any, encoding?: any, callback?: any) {
    console.log(`🔍 res.end intercepted! Status: ${res.statusCode}, Has chunk: ${!!chunk}`);
    
    // Only modify if status is 402 and chunk looks like JSON
    if (res.statusCode === 402 && chunk) {
      console.log('✅ 402 response detected with chunk');
      try {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString();
        const body = JSON.parse(chunkStr);
        console.log(`📦 Parsed body, has x402Version: ${!!body?.x402Version}, has accepts: ${!!body?.accepts}`);
        
        // Check if this is a 402 response with accepts array (x402-express uses "accepts", not "paymentRequirements")
        if (body?.x402Version && body?.accepts && Array.isArray(body.accepts)) {
          console.log('🎯 Modifying paymentRequirements to add discoverable:true AND fix resource URLs');
          
          // Determine the correct public base URL for this environment
          const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
          const isWorkspace = process.env.REPL_SLUG && process.env.REPL_OWNER;
          let publicBaseUrl = 'http://localhost:5000'; // fallback
          
          if (isProduction) {
            publicBaseUrl = 'https://coinrailz.com';
          } else if (isWorkspace) {
            publicBaseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
          }
          
          console.log(`🌐 Fixing resource URLs to use: ${publicBaseUrl}`);
          
          // Modify the response to add discoverable:true AND fix resource URLs
          body.accepts = body.accepts.map((req: any) => {
            // Fix the resource URL if it contains localhost
            let fixedResource = req.resource;
            if (fixedResource && fixedResource.includes('localhost')) {
              // Replace localhost with public domain AND add /x402 prefix
              // Before: http://localhost:5000/multi-chain-balance
              // After:  https://coinrailz.com/x402/multi-chain-balance
              fixedResource = fixedResource.replace(/http:\/\/localhost:\d+\//, `${publicBaseUrl}/x402/`);
              console.log(`   🔧 Fixed resource: ${req.resource} → ${fixedResource}`);
            }
            
            const modifiedReq = {
              ...req,
              resource: fixedResource, // Use fixed resource URL
              discoverable: true, // Add at top level
            };
            
            // Also add to metadata.outputSchema.input (matching arvos.xyz format)
            if (modifiedReq.metadata?.outputSchema?.input) {
              modifiedReq.metadata.outputSchema.input = {
                ...modifiedReq.metadata.outputSchema.input,
                discoverable: true
              };
            }
            
            return modifiedReq;
          });
          
          // Send the modified body with correct Content-Length
          const modifiedChunk = JSON.stringify(body);
          const modifiedLength = Buffer.byteLength(modifiedChunk, 'utf8');
          res.setHeader('Content-Length', modifiedLength.toString());
          console.log(`✅ MODIFIED RESPONSE (${modifiedLength} bytes) BEING SENT WITH DISCOVERABLE:TRUE`);
          return originalEnd.call(this, modifiedChunk, encoding, callback);
        }
      } catch (e) {
        console.error('❌ Error in res.end interception:', e);
      }
    }
    
    // Pass through unmodified
    console.log('➡️ Passing through unmodified response');
    return originalEnd.call(this, chunk, encoding, callback);
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
    
    await trackRequest("multi-chain-balance", req.body, result, responseTime, SERVICE_PRICING["multi-chain-balance"], walletAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("multi-chain-balance", req.body, null, responseTime, SERVICE_PRICING["multi-chain-balance"], req.body.walletAddress || "unknown", error.message);
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
    
    await trackRequest("gas-price-oracle", req.body, result, responseTime, SERVICE_PRICING["gas-price-oracle"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("gas-price-oracle", req.body, null, responseTime, SERVICE_PRICING["gas-price-oracle"], req.ip || "unknown", error.message);
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
    
    await trackRequest("token-price", req.body, result, responseTime, SERVICE_PRICING["token-price"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-price", req.body, null, responseTime, SERVICE_PRICING["token-price"], req.ip || "unknown", error.message);
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
    
    await trackRequest("contract-scan", req.body, result, responseTime, SERVICE_PRICING["contract-scan"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("contract-scan", req.body, null, responseTime, SERVICE_PRICING["contract-scan"], req.ip || "unknown", error.message);
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
    
    await trackRequest("wallet-risk", req.body, result, responseTime, SERVICE_PRICING["wallet-risk"], walletAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("wallet-risk", req.body, null, responseTime, SERVICE_PRICING["wallet-risk"], req.body.walletAddress || "unknown", error.message);
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
    
    await trackRequest("trade-signals", req.body, result, responseTime, SERVICE_PRICING["trade-signals"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trade-signals", req.body, null, responseTime, SERVICE_PRICING["trade-signals"], req.ip || "unknown", error.message);
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
    
    await trackRequest("token-sentiment", req.body, result, responseTime, SERVICE_PRICING["token-sentiment"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-sentiment", req.body, null, responseTime, SERVICE_PRICING["token-sentiment"], req.ip || "unknown", error.message);
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
    
    await trackRequest("trending-tokens", req.body, result, responseTime, SERVICE_PRICING["trending-tokens"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("trending-tokens", req.body, null, responseTime, SERVICE_PRICING["trending-tokens"], req.ip || "unknown", error.message);
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
    
    await trackRequest("whale-alerts", req.body, result, responseTime, SERVICE_PRICING["whale-alerts"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("whale-alerts", req.body, null, responseTime, SERVICE_PRICING["whale-alerts"], req.ip || "unknown", error.message);
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
    
    await trackRequest("dex-liquidity", req.body, result, responseTime, SERVICE_PRICING["dex-liquidity"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("dex-liquidity", req.body, null, responseTime, SERVICE_PRICING["dex-liquidity"], req.ip || "unknown", error.message);
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
    
    await trackRequest("transaction-builder", req.body, result, responseTime, SERVICE_PRICING["transaction-builder"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("transaction-builder", req.body, null, responseTime, SERVICE_PRICING["transaction-builder"], req.ip || "unknown", error.message);
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
    
    await trackRequest("token-metadata", req.body, result, responseTime, SERVICE_PRICING["token-metadata"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("token-metadata", req.body, null, responseTime, SERVICE_PRICING["token-metadata"], req.ip || "unknown", error.message);
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
    
    await trackRequest("approval-manager", req.body, result, responseTime, SERVICE_PRICING["approval-manager"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("approval-manager", req.body, null, responseTime, SERVICE_PRICING["approval-manager"], req.ip || "unknown", error.message);
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
    
    await trackRequest("batch-quote", req.body, result, responseTime, SERVICE_PRICING["batch-quote"], req.ip || "unknown");
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("batch-quote", req.body, null, responseTime, SERVICE_PRICING["batch-quote"], req.ip || "unknown", error.message);
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
    
    await trackRequest("portfolio-tracker", req.body, result, responseTime, SERVICE_PRICING["portfolio-tracker"], walletAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("portfolio-tracker", req.body, null, responseTime, SERVICE_PRICING["portfolio-tracker"], req.body.walletAddress || "unknown", error.message);
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
    
    await trackRequest("instant-agent-wallet", req.body, result, responseTime, SERVICE_PRICING["instant-agent-wallet"], result.walletAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("instant-agent-wallet", req.body, null, responseTime, SERVICE_PRICING["instant-agent-wallet"], req.ip || "unknown", error.message);
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
    
    await trackRequest("verified-agent-identity", req.body, result, responseTime, SERVICE_PRICING["verified-agent-identity"], walletAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("verified-agent-identity", req.body, null, responseTime, SERVICE_PRICING["verified-agent-identity"], req.body.walletAddress || "unknown", error.message);
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
    
    await trackRequest("seamless-chain-bridge", req.body, result, responseTime, SERVICE_PRICING["seamless-chain-bridge"], fromAddress);
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    await trackRequest("seamless-chain-bridge", req.body, null, responseTime, SERVICE_PRICING["seamless-chain-bridge"], req.body.fromAddress || "unknown", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/seamless-chain-bridge",
  createPaymentOrchestrator("seamless-chain-bridge", SERVICE_PRICING["seamless-chain-bridge"], seamlessChainBridgeHandler),
  x402Middleware,
  seamlessChainBridgeHandler
);

export default router;
