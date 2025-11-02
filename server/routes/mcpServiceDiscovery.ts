import { Router, Request, Response } from "express";
import { SERVICE_PRICING } from "./microservices";

const router = Router();

// MCP-compatible service discovery endpoint for AI agents
// Based on Model Context Protocol specification for service discovery
router.get("/mcp/services", async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
      ? `https://${process.env.REPL_SLUG}.replit.app`
      : `http://localhost:5000`;

    const services = [
      // === TRADER-FOCUSED SERVICES (Original 10) ===
      {
        id: "multi-chain-balance",
        name: "Multi-Chain Balance Query",
        description: "Query wallet balances across 7+ EVM chains in a single API call",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["multi-chain-balance"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/multi-chain-balance`,
        protocol: "x402",
        inputSchema: {
          walletAddress: { type: "string", required: true, description: "Wallet address to check" },
          chains: { type: "array", required: false, description: "Chains to check (default: all)" },
          includeTokens: { type: "boolean", required: false, description: "Include token balances" }
        },
        outputSchema: {
          success: { type: "boolean" },
          balances: { type: "array", description: "Balance data per chain" },
          totalValueUSD: { type: "number" }
        }
      },
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas prices for multiple chains with USD cost estimates",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["gas-price-oracle"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/gas-price-oracle`,
        protocol: "x402",
        inputSchema: {
          chains: { type: "array", required: false, description: "Chains to check (default: all)" }
        },
        outputSchema: {
          success: { type: "boolean" },
          gasPrices: { type: "object", description: "Gas prices per chain" }
        }
      },
      {
        id: "token-price",
        name: "Token Price Feed",
        description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["token-price"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/token-price`,
        protocol: "x402",
        inputSchema: {
          tokenAddress: { type: "string", required: true },
          chain: { type: "string", required: true }
        },
        outputSchema: {
          success: { type: "boolean" },
          price: { type: "object" }
        }
      },
      {
        id: "contract-scan",
        name: "Contract Quick Scan",
        description: "Basic smart contract security scan with safety score and vulnerability checks",
        category: "security",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["contract-scan"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/contract-scan`,
        protocol: "x402",
        inputSchema: {
          contractAddress: { type: "string", required: true },
          chain: { type: "string", required: true }
        }
      },
      {
        id: "wallet-risk",
        name: "Wallet Risk Score",
        description: "Wallet risk analysis with compliance flags and transaction pattern detection",
        category: "security",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["wallet-risk"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/wallet-risk`,
        protocol: "x402",
        inputSchema: {
          walletAddress: { type: "string", required: true },
          chain: { type: "string", required: true }
        }
      },
      {
        id: "trade-signals",
        name: "AI Trading Signals",
        description: "AI-powered crypto trading signals with entry/exit points and risk analysis",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["trade-signals"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/trade-signals`,
        protocol: "x402",
        inputSchema: {
          token: { type: "string", required: false, default: "BTC/USDT" },
          timeframe: { type: "string", required: false, default: "15m" },
          riskLevel: { type: "string", required: false, default: "medium" }
        }
      },
      {
        id: "token-sentiment",
        name: "Token Social Sentiment",
        description: "Social sentiment analysis for tokens with momentum indicators and activity levels",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["token-sentiment"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/token-sentiment`,
        protocol: "x402",
        inputSchema: {
          tokenSymbol: { type: "string", required: true },
          chain: { type: "string", required: false }
        }
      },
      {
        id: "trending-tokens",
        name: "Trending Tokens Feed",
        description: "Top gaining and losing tokens across DEXs with real-time market data",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["trending-tokens"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/trending-tokens`,
        protocol: "x402",
        inputSchema: {
          timeframe: { type: "string", required: false, default: "24h" },
          chain: { type: "string", required: false }
        }
      },
      {
        id: "whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large wallet movements (whales) with on-chain transaction monitoring",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["whale-alerts"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/whale-alerts`,
        protocol: "x402",
        inputSchema: {
          chains: { type: "array", required: false },
          minValueUsd: { type: "number", required: false },
          tokenAddresses: { type: "array", required: false }
        }
      },
      {
        id: "dex-liquidity",
        name: "DEX Liquidity Monitor",
        description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
        category: "trading-intelligence",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["dex-liquidity"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/dex-liquidity`,
        protocol: "x402",
        inputSchema: {
          tokenAddress: { type: "string", required: true },
          chain: { type: "string", required: true }
        }
      },

      // === B2B2C INFRASTRUCTURE SERVICES (5 services) ===
      {
        id: "transaction-builder",
        name: "Transaction Builder",
        description: "Pre-validated transaction encoding for agent-to-agent transfers (B2B2C infrastructure)",
        category: "infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["transaction-builder"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/transaction-builder`,
        protocol: "x402",
        inputSchema: {
          from: { type: "string", required: true },
          to: { type: "string", required: true },
          value: { type: "string", required: true },
          data: { type: "string", required: false },
          chain: { type: "string", required: true }
        }
      },
      {
        id: "token-metadata",
        name: "Token Metadata Service",
        description: "Unified token info across all chains - essential building block for trading agent UIs (B2B2C infrastructure)",
        category: "infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["token-metadata"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/token-metadata`,
        protocol: "x402",
        inputSchema: {
          tokenAddress: { type: "string", required: true },
          chain: { type: "string", required: true }
        }
      },
      {
        id: "approval-manager",
        name: "Approval Manager",
        description: "Token approval transaction generator - required infrastructure for DeFi agents (B2B2C infrastructure)",
        category: "infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["approval-manager"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/approval-manager`,
        protocol: "x402",
        inputSchema: {
          tokenAddress: { type: "string", required: true },
          spender: { type: "string", required: true },
          amount: { type: "string", required: true },
          chain: { type: "string", required: true }
        }
      },
      {
        id: "batch-quote",
        name: "Batch Quote Service",
        description: "Multi-DEX price quotes in single call - critical infrastructure for trading bot price discovery (B2B2C infrastructure)",
        category: "infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["batch-quote"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/batch-quote`,
        protocol: "x402",
        inputSchema: {
          pairs: { type: "array", required: true, description: "Array of trading pairs to quote" }
        }
      },
      {
        id: "portfolio-tracker",
        name: "Portfolio Tracker",
        description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents (B2B2C infrastructure)",
        category: "infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["portfolio-tracker"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/portfolio-tracker`,
        protocol: "x402",
        inputSchema: {
          walletAddress: { type: "string", required: true },
          chains: { type: "array", required: false }
        }
      },

      // === PREMIUM B2B2C INFRASTRUCTURE (3 services) ===
      {
        id: "instant-agent-wallet",
        name: "Instant Agent Wallet Creation",
        description: "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents (Premium B2B2C Infrastructure)",
        category: "premium-infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["instant-agent-wallet"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/instant-agent-wallet`,
        protocol: "x402",
        inputSchema: {
          agentId: { type: "string", required: true },
          description: { type: "string", required: false },
          initialFundingAmount: { type: "number", required: false }
        },
        outputSchema: {
          success: { type: "boolean" },
          walletAddress: { type: "string" },
          walletId: { type: "string" },
          walletSetId: { type: "string" }
        }
      },
      {
        id: "verified-agent-identity",
        name: "Verified Agent Identity (KYA)",
        description: "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard (Premium B2B2C Infrastructure)",
        category: "premium-infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["verified-agent-identity"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/verified-agent-identity`,
        protocol: "x402",
        inputSchema: {
          agentId: { type: "string", required: true },
          walletAddress: { type: "string", required: true },
          signature: { type: "string", required: false },
          metadata: { type: "object", required: false }
        },
        outputSchema: {
          success: { type: "boolean" },
          identityNFT: { type: "object" },
          reputationScore: { type: "number" }
        }
      },
      {
        id: "seamless-chain-bridge",
        name: "Seamless Cross-Chain Bridge",
        description: "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly (Premium B2B2C Infrastructure)",
        category: "premium-infrastructure",
        pricing: {
          model: "pay-per-use",
          amount: SERVICE_PRICING["seamless-chain-bridge"],
          currency: "USD"
        },
        endpoint: `${baseUrl}/x402/service/seamless-chain-bridge`,
        protocol: "x402",
        inputSchema: {
          fromChain: { type: "string", required: true },
          toChain: { type: "string", required: true },
          amount: { type: "string", required: true },
          fromAddress: { type: "string", required: true },
          toAddress: { type: "string", required: true },
          currency: { type: "string", required: false, default: "USDC" }
        }
      }
    ];

    // MCP-compatible response format
    res.json({
      protocol: "x402",
      version: 1,
      provider: {
        name: "Coin Railz",
        description: "B2B2C micropayment infrastructure for AI agent builders",
        url: baseUrl,
        facilitator: "https://facilitator.cdp.coinbase.com"
      },
      services: services,
      totalServices: services.length,
      categories: [
        { id: "trading-intelligence", name: "Trading Intelligence", count: 10 },
        { id: "infrastructure", name: "B2B2C Infrastructure", count: 5 },
        { id: "premium-infrastructure", name: "Premium Infrastructure", count: 3 },
        { id: "security", name: "Security & Compliance", count: 2 }
      ],
      paymentMethods: ["x402-erc20-usdc"],
      supportedNetworks: ["base", "base-sepolia"],
      documentation: `${baseUrl}/docs/x402`
    });
  } catch (error: any) {
    console.error('MCP service discovery error:', error);
    res.status(500).json({ error: "Failed to retrieve service directory", message: error.message });
  }
});

// Service detail endpoint (MCP-compatible)
router.get("/mcp/services/:serviceId", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    
    const price = SERVICE_PRICING[serviceId as keyof typeof SERVICE_PRICING];
    if (price === undefined) {
      return res.status(404).json({ error: "Service not found" });
    }

    const baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
      ? `https://${process.env.REPL_SLUG}.replit.app`
      : `http://localhost:5000`;

    res.json({
      id: serviceId,
      endpoint: `${baseUrl}/x402/service/${serviceId}`,
      protocol: "x402",
      pricing: {
        model: "pay-per-use",
        amount: price,
        currency: "USD"
      },
      facilitator: "https://facilitator.cdp.coinbase.com",
      paymentToken: {
        network: "base",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6
      }
    });
  } catch (error: any) {
    console.error('MCP service detail error:', error);
    res.status(500).json({ error: "Failed to retrieve service details", message: error.message });
  }
});

export default router;
