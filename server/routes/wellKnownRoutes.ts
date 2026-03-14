/**
 * WELL-KNOWN ENDPOINTS - x402 Protocol Discovery
 * 
 * These endpoints enable autonomous discovery by AI agents and x402 indexers
 * Required for Coinbase x402 indexing and organic traffic
 */

import { Router, Request, Response } from 'express';
import { SERVICE_PRICING_USD } from '@shared/pricing';
import { getFacilitatorUrl, getAllFacilitatorUrls } from '../utils/facilitatorHelper';
import { trackDiscovery } from '../middleware/hitTracker';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

// --- In-memory rate limiter for POST /.well-known/agent-registration.json ---
// 10 POST attempts per IP per 60 seconds. Map<ip, { count, windowStart }>
const registrationRateLimit = new Map<string, { count: number; windowStart: number }>();
const REGISTRATION_RATE_WINDOW_MS = 60_000;
const REGISTRATION_RATE_MAX = 10;

function checkRegistrationRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registrationRateLimit.get(ip);
  if (!entry || now - entry.windowStart > REGISTRATION_RATE_WINDOW_MS) {
    registrationRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= REGISTRATION_RATE_MAX) return false;
  entry.count++;
  return true;
}

const router = Router();

router.use((req, res, next) => {
  if (req.path.startsWith('/.well-known')) {
    return trackDiscovery(req, res, next);
  }
  next();
});

// Get base URL for the platform
const getBaseUrl = (req?: any) => {
  // Use PUBLIC_BASE_URL if set (preferred)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  
  // Use request hostname if available (production)
  if (req && req.get('host')) {
    const host = req.get('host');
    
    // Only use http for localhost/127.0.0.1, otherwise ALWAYS use https
    // (req.protocol is often 'http' in production behind reverse proxy/load balancer)
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://${host}`;
    }
    
    // For all other domains (production), use HTTPS
    // Check X-Forwarded-Proto header first (standard proxy header)
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto || 'https';
    return `${protocol}://${host}`;
  }
  
  // Fallback based on deployment flag
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  
  return 'http://localhost:5000';
};

/**
 * GET /.well-known/agent.json
 * 
 * A2A v0.3 compliant agent card for Google Agent2Agent protocol
 * Enables semantic skill matching and agent-to-agent collaboration
 */
router.get('/.well-known/agent.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const a2aAgentCard = {
    name: "Coin Railz Multi-Chain Payment Infrastructure",
    description: "Production-grade blockchain infrastructure for AI agents. 59 x402 micropayment services across 8 chains (7 EVM + Solana) + Native Coinbase Agentic Wallet support + MoonPay Agents compatible + Satellite Data APIs (NASA/ESA) + AI Inference Gateway (GPT-4o-mini, $0.05/call) + SDK packages (@coinrailz/agent-payments NPM, coinrailz PyPI, Docker) + Real Estate + Banking + Trading + Market Intelligence + Traditional Markets. Processing fee: 1.5% + $0.01 per transaction.",
    version: "0.6.0",
    agentId: "coinrailz-x402-infrastructure",
    
    // A2A v0.3 service endpoint
    serviceUrl: `${baseUrl}/x402`,
    
    // Machine-readable onboarding instructions for AI agents
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,

    // Agent self-registration — record your wallet & capabilities before making first call
    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,
    
    // A2A v0.3 capabilities object (required for Google A2A compliance)
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    
    // Skills array with semantic descriptions for AI matching
    skills: [
      {
        id: "first_call",
        name: "Golden Path — First Paid Call",
        description: "START HERE. The canonical first payment for any agent integrating with Coin Railz. Pay $0.05 USDC on Base or Solana and receive a verified onboarding receipt plus executable templates for the next 3 services. Both EVM and Solana supported. Lowest price on the platform.",
        price: "$0.05 USDC",
        amountMicroUSDC: 50000,
        chainsAccepted: ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
        facilitators: {
          evm: "https://api.cdp.coinbase.com/platform/v2/x402",
          solana: "https://x402.dexter.cash"
        },
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Optional agent identifier for tracking" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            goldenPath: { type: "boolean" },
            sessionId: { type: "string" },
            payment: { type: "object", description: "Payment receipt with chain, amount, timestamp" },
            nextServices: { type: "array", description: "3 executable next-step service templates" }
          }
        },
        examples: [
          {
            name: "curl (EVM — Base)",
            code: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <evm_tx_hash>' -d '{}'`
          },
          {
            name: "curl (Solana)",
            code: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-Solana-Wallet: <pubkey>' -H 'X-PAYMENT: <solana_payload>' -d '{}'`
          },
          {
            name: "python (httpx)",
            code: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call', headers={'X-PAYMENT': tx_hash}, json={})\nprint(resp.json())`
          }
        ]
      },
      {
        id: "multi_chain_balance",
        name: "Multi-Chain Balance Checker",
        description: "Check wallet balances across 7 EVM chains in one API call. Use when user asks 'what's my balance', 'check wallet on multiple chains', 'show my assets', 'balance on Ethereum', 'balance on Base', or 'balance on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Multi-Chain Balance Request",
          description: "Request wallet balances across multiple EVM chains",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string", 
              title: "Wallet Address",
              description: "EVM wallet address (0x...)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chains: { 
              type: "array", 
              title: "Target Chains",
              description: "Optional: Specific chains to check",
              items: { 
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            },
            includeTokens: { 
              type: "boolean", 
              title: "Include Tokens",
              description: "Include ERC-20 token balances",
              default: true
            }
          },
          required: ["walletAddress"]
        },
        outputSchema: {
          type: "object",
          title: "Multi-Chain Balance Response",
          additionalProperties: false,
          properties: {
            balances: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  chain: { type: "string", title: "Chain Name", enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"] },
                  nativeBalance: { type: "string", title: "Native Balance", description: "Native token balance (ETH, MATIC, etc.)" },
                  tokens: { type: "array", title: "Token Balances" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "analytics"
      },
      {
        id: "gas_price_oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas prices across multiple chains with USD cost estimates. Use when user asks 'how much is gas', 'current gas fees', 'gas price on Ethereum', 'gas price on Base', 'gas price on Polygon', or 'cheapest time to transact'.",
        inputSchema: {
          type: "object",
          title: "Gas Price Request",
          description: "Request gas prices for specific chains",
          additionalProperties: false,
          properties: {
            chains: { 
              type: "array", 
              title: "Target Chains",
              description: "Chains to check (default: all supported chains)",
              items: {
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Gas Price Response",
          additionalProperties: false,
          properties: {
            gasPrices: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  chain: { type: "string", title: "Chain Name", enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"] },
                  slow: { type: "number", title: "Slow Gas Price (gwei)" },
                  standard: { type: "number", title: "Standard Gas Price (gwei)" },
                  fast: { type: "number", title: "Fast Gas Price (gwei)" },
                  usdCost: { type: "object", title: "USD Cost Estimates" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "utilities"
      },
      {
        id: "token_price",
        name: "Token Price Lookup",
        description: "Get real-time token prices with 24h change, volume, and market cap from CoinGecko/DEX Screener. Use when user asks 'what's the price of', 'token value', 'price check', 'token price on Ethereum', 'token price on Base', or 'token price on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Token Price Request",
          description: "Request real-time token price data",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Contract Address",
              description: "Token contract address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Blockchain network where token exists",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Price Response",
          additionalProperties: false,
          properties: {
            price: { type: "number", title: "Current Price USD" },
            priceChange24h: { type: "number", title: "24h Price Change %" },
            volume24h: { type: "number", title: "24h Trading Volume USD" },
            marketCap: { type: "number", title: "Market Cap USD" },
            source: { type: "string", title: "Data Source", enum: ["coingecko", "dexscreener"] }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "trading"
      },
      {
        id: "wallet_risk_analysis",
        name: "Wallet Risk Assessment",
        description: "Analyze wallet for suspicious activity, scam exposure, and security risks. Use when user asks 'is this wallet safe', 'check wallet security', 'wallet reputation', 'wallet risk on Ethereum', 'wallet risk on Base', or 'is this address safe'.",
        inputSchema: {
          type: "object",
          title: "Wallet Risk Analysis Request",
          description: "Request security analysis for a wallet address",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string", 
              title: "Wallet Address",
              description: "Wallet address to analyze",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Blockchain network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["walletAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Wallet Risk Assessment Response",
          additionalProperties: false,
          properties: {
            riskScore: { type: "number", title: "Risk Score", description: "0-100 (0=safe, 100=high risk)", minimum: 0, maximum: 100 },
            flags: { type: "array", title: "Risk Flags", items: { type: "string" } },
            scamExposure: { type: "boolean", title: "Scam Exposure Detected" },
            recommendations: { type: "array", title: "Security Recommendations", items: { type: "string" } }
          }
        },
        pricing: { amount: 0.75, currency: "USD" },
        category: "security"
      },
      {
        id: "trade_signals",
        name: "AI Trading Signals",
        description: "Generate trading signals based on technical analysis and on-chain data. Use when user asks 'should I buy/sell', 'trading recommendation', 'market opportunity', 'trade signal for token on Ethereum', 'trade signal for token on Base', or 'should I buy this token'.",
        inputSchema: {
          type: "object",
          title: "Trade Signal Request",
          description: "Request AI-powered trading signals",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Address",
              description: "Token to analyze",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            timeframe: { 
              type: "string", 
              title: "Analysis Timeframe",
              description: "Chart timeframe for analysis",
              enum: ["1h", "4h", "1d", "1w"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Trade Signal Response",
          additionalProperties: false,
          properties: {
            signal: { type: "string", title: "Signal", enum: ["buy", "sell", "hold"] },
            confidence: { type: "number", title: "Confidence Score", minimum: 0, maximum: 1 },
            indicators: { type: "object", title: "Technical Indicators" },
            reasoning: { type: "string", title: "Analysis Reasoning" }
          }
        },
        pricing: { amount: 0.20, currency: "USD" },
        category: "trading"
      },
      {
        id: "smart_contract_scan",
        name: "Smart Contract Security Scan",
        description: "Basic security scan of smart contracts with vulnerability detection. Use when user asks 'is this contract safe', 'check contract security', 'audit contract', 'scan contract on Ethereum', 'scan contract on Base', or 'contract vulnerabilities'.",
        inputSchema: {
          type: "object",
          title: "Smart Contract Scan Request",
          description: "Request security scan for a smart contract",
          additionalProperties: false,
          properties: {
            contractAddress: { 
              type: "string", 
              title: "Contract Address",
              description: "Contract address to scan",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["contractAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Contract Security Scan Response",
          additionalProperties: false,
          properties: {
            safetyScore: { type: "number", title: "Safety Score", minimum: 0, maximum: 100 },
            vulnerabilities: { type: "array", title: "Detected Vulnerabilities", items: { type: "string" } },
            contractType: { type: "string", title: "Contract Type" },
            verified: { type: "boolean", title: "Source Code Verified" }
          }
        },
        pricing: { amount: 1.00, currency: "USD" },
        category: "security"
      },
      {
        id: "token_sentiment",
        name: "Token Sentiment Analysis",
        description: "Social sentiment analysis from Twitter/Reddit for tokens. Use when user asks 'what people say about', 'token sentiment', 'community opinion', 'sentiment on Ethereum', 'sentiment on Base', or 'social buzz'.",
        inputSchema: {
          type: "object",
          title: "Token Sentiment Request",
          description: "Request social sentiment analysis for a token",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Sentiment Response",
          additionalProperties: false,
          properties: {
            sentiment: { type: "string", title: "Overall Sentiment", enum: ["positive", "neutral", "negative"] },
            score: { type: "number", title: "Sentiment Score", minimum: -1, maximum: 1 },
            mentions24h: { type: "number", title: "Social Mentions (24h)" },
            trending: { type: "boolean", title: "Is Trending" }
          }
        },
        pricing: { amount: 0.30, currency: "USD" },
        category: "analytics"
      },
      {
        id: "trending_tokens",
        name: "Trending Tokens Discovery",
        description: "Find trending tokens by volume, price movement, or social activity. Use when user asks 'what's trending', 'hot tokens', 'new opportunities', 'trending on Ethereum', 'trending on Base', or 'trending on Polygon'.",
        inputSchema: {
          type: "object",
          title: "Trending Tokens Request",
          description: "Request trending tokens by specific metrics",
          additionalProperties: false,
          properties: {
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            metric: { 
              type: "string", 
              title: "Sorting Metric",
              enum: ["volume", "price_change", "social"], 
              description: "Metric to sort trending tokens by"
            },
            limit: { 
              type: "number", 
              title: "Result Limit",
              description: "Number of results to return (default: 10)",
              minimum: 1,
              maximum: 100,
              default: 10
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Trending Tokens Response",
          additionalProperties: false,
          properties: {
            tokens: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  address: { type: "string", title: "Token Address" },
                  name: { type: "string", title: "Token Name" },
                  price: { type: "number", title: "Current Price USD" },
                  change24h: { type: "number", title: "24h Price Change %" },
                  volume24h: { type: "number", title: "24h Volume USD" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.40, currency: "USD" },
        category: "trading"
      },
      {
        id: "whale_alerts",
        name: "Whale Movement Tracker",
        description: "Track large wallet movements and whale activity in real-time. Use when user asks 'whale movements', 'large transfers', 'big wallet activity', 'whale alerts on Ethereum', 'whale alerts on Base', or 'large transactions'.",
        inputSchema: {
          type: "object",
          title: "Whale Tracker Request",
          description: "Request whale movement tracking",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string", 
              title: "Token Address",
              description: "Token to monitor (optional - leave empty for all tokens)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            minAmount: { 
              type: "number", 
              title: "Minimum USD Value",
              description: "Minimum transaction value in USD to track",
              minimum: 0
            }
          },
          required: ["chain"]
        },
        outputSchema: {
          type: "object",
          title: "Whale Movements Response",
          additionalProperties: false,
          properties: {
            movements: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  from: { type: "string", title: "Sender Address" },
                  to: { type: "string", title: "Recipient Address" },
                  amount: { type: "string", title: "Amount" },
                  usdValue: { type: "number", title: "USD Value" },
                  timestamp: { type: "number", title: "Timestamp (Unix)" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.30, currency: "USD" },
        category: "analytics"
      },
      {
        id: "dex_liquidity",
        name: "DEX Liquidity Scanner",
        description: "Analyze liquidity pools across DEXs with APY and impermanent loss calculations. Use when user asks 'liquidity pool info', 'best APY', 'LP opportunity', 'liquidity on Ethereum', 'liquidity on Base', or 'pool analysis'.",
        inputSchema: {
          type: "object",
          title: "DEX Liquidity Request",
          description: "Request liquidity pool analysis",
          additionalProperties: false,
          properties: {
            tokenPair: { 
              type: "string", 
              title: "Token Pair",
              description: "Trading pair to analyze (e.g., 'ETH/USDC', 'WBTC/ETH')"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            dex: { 
              type: "string", 
              title: "DEX Platform",
              description: "Specific DEX to query (e.g., 'uniswap', 'sushiswap') or 'all'"
            }
          },
          required: ["tokenPair", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "DEX Liquidity Response",
          additionalProperties: false,
          properties: {
            pools: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  dex: { type: "string", title: "DEX Name" },
                  liquidity: { type: "number", title: "Total Liquidity USD" },
                  apy: { type: "number", title: "APY %" },
                  volume24h: { type: "number", title: "24h Volume USD" },
                  impermanentLoss: { type: "number", title: "Estimated IL %" }
                }
              }
            }
          }
        },
        pricing: { amount: 0.35, currency: "USD" },
        category: "defi"
      },
      {
        id: "transaction_builder",
        name: "Transaction Builder",
        description: "Build optimized transactions with gas estimation. Use when user asks 'create transaction', 'prepare swap', 'build tx', 'build transaction on Ethereum', 'build transaction on Base', or 'prepare transfer'.",
        inputSchema: {
          type: "object",
          title: "Transaction Builder Request",
          description: "Request transaction construction with gas estimates",
          additionalProperties: false,
          properties: {
            from: { 
              type: "string", 
              title: "Sender Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            to: { 
              type: "string", 
              title: "Recipient Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            value: { 
              type: "string", 
              title: "Value (wei)",
              description: "Transaction value in wei"
            },
            data: { 
              type: "string", 
              title: "Transaction Data",
              description: "Optional contract call data (0x...)"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["from", "to", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Transaction Builder Response",
          additionalProperties: false,
          properties: {
            transaction: { type: "object", title: "Transaction Object" },
            gasEstimate: { type: "number", title: "Gas Estimate" },
            gasCostUSD: { type: "number", title: "Estimated Gas Cost USD" }
          }
        },
        pricing: { amount: 0.15, currency: "USD" },
        category: "utilities"
      },
      {
        id: "token_metadata",
        name: "Token Metadata Fetcher",
        description: "Get comprehensive token information (name, symbol, decimals, total supply, holders). Use when user asks 'token info', 'token details', 'what is this token', 'token info on Ethereum', or 'token info on Base'.",
        inputSchema: {
          type: "object",
          title: "Token Metadata Request",
          description: "Request comprehensive token information",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Token Metadata Response",
          additionalProperties: false,
          properties: {
            name: { type: "string", title: "Token Name" },
            symbol: { type: "string", title: "Token Symbol" },
            decimals: { type: "number", title: "Token Decimals" },
            totalSupply: { type: "string", title: "Total Supply" },
            holders: { type: "number", title: "Holder Count" },
            verified: { type: "boolean", title: "Contract Verified" }
          }
        },
        pricing: { amount: 0.10, currency: "USD" },
        category: "utilities"
      },
      {
        id: "approval_manager",
        name: "Token Approval Manager",
        description: "Check and revoke token approvals for security. Use when user asks 'check approvals', 'revoke permissions', 'wallet security audit', 'check approvals on Ethereum', 'check approvals on Base', or 'security check'.",
        inputSchema: {
          type: "object",
          title: "Approval Manager Request",
          description: "Request token approval security audit",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string",
              title: "Wallet Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["walletAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Approval Manager Response",
          additionalProperties: false,
          properties: {
            approvals: {
              type: "array",
              title: "Active Approvals",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  token: { type: "string", title: "Token Address" },
                  spender: { type: "string", title: "Spender Address" },
                  amount: { type: "string", title: "Approved Amount" },
                  riskLevel: { type: "string", title: "Risk Level", enum: ["low", "medium", "high"] }
                }
              }
            },
            revokeTransactions: { type: "array", title: "Revoke Transaction Data" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "security"
      },
      {
        id: "batch_price_quote",
        name: "Batch DEX Quote",
        description: "Get best swap prices across all DEX aggregators. Use when user asks 'best swap price', 'compare DEX prices', 'cheapest route', 'best price on Ethereum', 'best price on Base', or 'swap quote'.",
        inputSchema: {
          type: "object",
          title: "Batch DEX Quote Request",
          description: "Request best swap prices across DEX aggregators",
          additionalProperties: false,
          properties: {
            tokenIn: { 
              type: "string",
              title: "Input Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            tokenOut: { 
              type: "string",
              title: "Output Token Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            amount: { 
              type: "string",
              title: "Input Amount",
              description: "Amount to swap (in token decimals)"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            }
          },
          required: ["tokenIn", "tokenOut", "amount", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Batch DEX Quote Response",
          additionalProperties: false,
          properties: {
            quotes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  dex: { type: "string", title: "DEX Name" },
                  amountOut: { type: "string", title: "Output Amount" },
                  priceImpact: { type: "number", title: "Price Impact %" },
                  gasEstimate: { type: "number", title: "Gas Estimate" }
                }
              }
            },
            bestQuote: { type: "object", title: "Best Quote" }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "trading"
      },
      {
        id: "portfolio_tracker",
        name: "Portfolio Analytics",
        description: "Complete portfolio analysis with P&L, allocation, and performance metrics. Use when user asks 'portfolio value', 'my holdings', 'investment performance', 'portfolio on Ethereum', 'portfolio on Base', or 'how am I doing'.",
        inputSchema: {
          type: "object",
          title: "Portfolio Analytics Request",
          description: "Request comprehensive portfolio analysis",
          additionalProperties: false,
          properties: {
            walletAddress: { 
              type: "string",
              title: "Wallet Address",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chains: { 
              type: "array", 
              title: "Target Chains",
              items: { 
                type: "string",
                enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
              }
            }
          },
          required: ["walletAddress"]
        },
        outputSchema: {
          type: "object",
          title: "Portfolio Analytics Response",
          additionalProperties: false,
          properties: {
            totalValueUSD: { type: "number", title: "Total Portfolio Value USD" },
            profitLoss: { type: "number", title: "Total P&L USD" },
            allocation: { type: "array", title: "Asset Allocation" },
            topHoldings: { type: "array", title: "Top Holdings" },
            performance30d: { type: "number", title: "30-Day Performance %" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "analytics"
      },
      {
        id: "instant_agent_wallet",
        name: "Instant Agent Wallet Creation",
        description: "Create a new wallet for AI agent with USDC funding. Use when agent needs 'create wallet', 'agent wallet', 'autonomous wallet', 'new wallet on Base', or 'setup wallet'.",
        inputSchema: {
          type: "object",
          title: "Agent Wallet Creation Request",
          description: "Request new wallet creation for AI agent",
          additionalProperties: false,
          properties: {
            fundingAmount: { 
              type: "number", 
              title: "Initial Funding Amount",
              description: "Initial USDC amount to fund wallet",
              minimum: 0
            },
            chain: { 
              type: "string", 
              title: "Blockchain Network",
              description: "Preferred chain (default: base)",
              enum: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
              default: "base"
            }
          }
        },
        outputSchema: {
          type: "object",
          title: "Agent Wallet Creation Response",
          additionalProperties: false,
          properties: {
            walletAddress: { type: "string", title: "Wallet Address" },
            privateKeyEncrypted: { type: "string", title: "Encrypted Private Key" },
            balance: { type: "number", title: "Initial Balance USDC" },
            chain: { type: "string", title: "Blockchain Network" }
          }
        },
        pricing: { amount: 2.00, currency: "USD" },
        category: "utilities"
      },
      {
        id: "verified_agent_identity",
        name: "Agent Identity Verification",
        description: "Verify AI agent identity on-chain using ERC-8004. Use when agent needs 'verify identity', 'agent reputation', 'on-chain proof', 'prove identity', or 'verify on Base'.",
        inputSchema: {
          type: "object",
          title: "Agent Identity Verification Request",
          description: "Request on-chain identity verification for AI agent",
          additionalProperties: false,
          properties: {
            agentId: { 
              type: "string",
              title: "Agent Identifier",
              description: "Unique identifier for the AI agent"
            },
            metadata: { 
              type: "object", 
              title: "Agent Metadata",
              description: "Agent metadata to store on-chain (optional)"
            }
          },
          required: ["agentId"]
        },
        outputSchema: {
          type: "object",
          title: "Agent Identity Verification Response",
          additionalProperties: false,
          properties: {
            identityAddress: { type: "string", title: "Identity Contract Address" },
            verified: { type: "boolean", title: "Verification Status" },
            reputationScore: { type: "number", title: "On-Chain Reputation Score" },
            transactionHash: { type: "string", title: "Transaction Hash" }
          }
        },
        pricing: { amount: 5.00, currency: "USD" },
        category: "utilities"
      },
      {
        id: "cross_chain_bridge",
        name: "Cross-Chain Bridge Monitor",
        description: "Track bridge transactions and get best bridge rates. Use when user asks 'bridge tokens', 'move assets', 'cross-chain transfer', 'bridge from Ethereum to Base', 'bridge from Polygon to Arbitrum', or 'transfer between chains'.",
        inputSchema: {
          type: "object",
          title: "Cross-Chain Bridge Request",
          description: "Request bridge options for cross-chain transfers",
          additionalProperties: false,
          properties: {
            tokenAddress: { 
              type: "string",
              title: "Token Address",
              description: "Token to bridge (optional - leave empty for native token)",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            fromChain: { 
              type: "string",
              title: "Source Chain",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            toChain: { 
              type: "string",
              title: "Destination Chain",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            amount: { 
              type: "string",
              title: "Amount to Bridge",
              description: "Amount to bridge (optional)"
            }
          },
          required: ["fromChain", "toChain"]
        },
        outputSchema: {
          type: "object",
          title: "Cross-Chain Bridge Response",
          additionalProperties: false,
          properties: {
            bridges: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string", title: "Bridge Name" },
                  fee: { type: "number", title: "Bridge Fee %" },
                  estimatedTime: { type: "string", title: "Estimated Time" },
                  security: { type: "string", title: "Security Rating", enum: ["high", "medium", "low"] }
                }
              }
            },
            recommended: { type: "object", title: "Recommended Bridge" }
          }
        },
        pricing: { amount: 0.40, currency: "USD" },
        category: "utilities"
      },
      {
        id: "payment_processing",
        name: "Payment Processing Service",
        description: "Process Stripe, PayPal, and crypto payments with instant settlement. Use when user asks 'process payment', 'accept payment', 'settle transaction', or 'handle checkout'.",
        inputSchema: {
          type: "object",
          title: "Payment Processing Request",
          description: "Process a payment transaction",
          additionalProperties: false,
          properties: {
            amount: { 
              type: "number",
              title: "Payment Amount",
              description: "Amount to process"
            },
            currency: { 
              type: "string",
              title: "Currency",
              enum: ["USD", "EUR", "USDC", "USDT"]
            },
            paymentMethod: { 
              type: "string",
              title: "Payment Method",
              enum: ["stripe", "paypal", "crypto"]
            },
            metadata: { 
              type: "object",
              title: "Payment Metadata",
              description: "Optional payment metadata"
            }
          },
          required: ["amount", "currency", "paymentMethod"]
        },
        outputSchema: {
          type: "object",
          title: "Payment Processing Response",
          additionalProperties: false,
          properties: {
            transactionId: { type: "string", title: "Transaction ID" },
            status: { type: "string", title: "Payment Status", enum: ["pending", "completed", "failed"] },
            settlementTime: { type: "string", title: "Settlement Time Estimate" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "payments"
      },
      {
        id: "compliance_consultation",
        name: "Compliance Consultation Service",
        description: "AI-powered KYC/AML compliance guidance and regulatory analysis. Use when user asks 'check compliance', 'KYC requirements', 'AML rules', or 'regulatory guidance'.",
        inputSchema: {
          type: "object",
          title: "Compliance Consultation Request",
          description: "Request compliance guidance",
          additionalProperties: false,
          properties: {
            jurisdiction: { 
              type: "string",
              title: "Jurisdiction",
              description: "Target jurisdiction (e.g., 'USA', 'EU', 'Singapore')"
            },
            transactionType: { 
              type: "string",
              title: "Transaction Type",
              description: "Type of transaction requiring compliance check"
            },
            amount: { 
              type: "number",
              title: "Transaction Amount",
              description: "Optional transaction amount for thresholds"
            }
          },
          required: ["jurisdiction", "transactionType"]
        },
        outputSchema: {
          type: "object",
          title: "Compliance Consultation Response",
          additionalProperties: false,
          properties: {
            compliant: { type: "boolean", title: "Compliance Status" },
            requirements: { type: "array", title: "Required Actions" },
            riskLevel: { type: "string", title: "Risk Assessment", enum: ["low", "medium", "high"] },
            recommendations: { type: "array", title: "Compliance Recommendations" }
          }
        },
        pricing: { amount: 5.00, currency: "USD" },
        category: "compliance"
      },
      {
        id: "smart_contract_audit",
        name: "Smart Contract Security Audit",
        description: "Deep security audit using Slither static analysis and vulnerability detection. Use when user asks 'audit contract', 'security review', 'check vulnerabilities', or 'analyze smart contract'.",
        inputSchema: {
          type: "object",
          title: "Smart Contract Audit Request",
          description: "Request comprehensive contract security audit",
          additionalProperties: false,
          properties: {
            contractAddress: { 
              type: "string",
              title: "Contract Address",
              description: "Smart contract address to audit",
              pattern: "^0x[a-fA-F0-9]{40}$"
            },
            chain: { 
              type: "string",
              title: "Blockchain Network",
              enum: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"]
            },
            auditDepth: { 
              type: "string",
              title: "Audit Depth",
              enum: ["basic", "comprehensive", "expert"],
              default: "comprehensive"
            }
          },
          required: ["contractAddress", "chain"]
        },
        outputSchema: {
          type: "object",
          title: "Smart Contract Audit Response",
          additionalProperties: false,
          properties: {
            overallScore: { type: "number", title: "Security Score (0-100)" },
            vulnerabilities: { type: "array", title: "Detected Vulnerabilities" },
            gasOptimizations: { type: "array", title: "Gas Optimization Suggestions" },
            codeQuality: { type: "string", title: "Code Quality Assessment" },
            recommendation: { type: "string", title: "Final Recommendation", enum: ["safe", "caution", "dangerous"] }
          }
        },
        pricing: { amount: 10.00, currency: "USD" },
        category: "security"
      },
      // REAL ESTATE VERTICAL (3 services)
      {
        id: "property_valuation",
        name: "AI Property Valuation",
        description: "AI-powered property valuation using GPT-4 analysis. Use when user asks 'value my property', 'property appraisal', 'real estate value', 'home worth', or 'estimate property value'.",
        inputSchema: {
          type: "object",
          title: "Property Valuation Request",
          properties: {
            address: { type: "string", title: "Property Address" },
            propertyType: { type: "string", enum: ["residential", "commercial", "industrial", "land"], title: "Property Type" },
            squareFeet: { type: "number", title: "Square Footage" },
            bedrooms: { type: "number", title: "Bedrooms (optional)" },
            bathrooms: { type: "number", title: "Bathrooms (optional)" },
            yearBuilt: { type: "number", title: "Year Built (optional)" }
          },
          required: ["address", "propertyType", "squareFeet"]
        },
        outputSchema: {
          type: "object",
          properties: {
            estimatedValue: { type: "number", title: "Estimated Value (USD)" },
            confidenceScore: { type: "number", title: "Confidence (0-100)" },
            comparables: { type: "array", title: "Comparable Properties" },
            marketAnalysis: { type: "string", title: "Market Analysis" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["property-valuation"], currency: "USD" },
        category: "real_estate"
      },
      {
        id: "lease_analysis",
        name: "Lease Agreement Analyzer",
        description: "AI analysis of lease terms and obligations. Use when user asks 'review lease', 'analyze rental agreement', 'lease terms review', or 'check lease contract'.",
        inputSchema: {
          type: "object",
          properties: {
            leaseText: { type: "string", title: "Lease Agreement Text" },
            analysisType: { type: "string", enum: ["comprehensive", "key-terms", "risks-only"], default: "comprehensive" }
          },
          required: ["leaseText"]
        },
        outputSchema: {
          type: "object",
          properties: {
            keyTerms: { type: "object", title: "Key Terms Summary" },
            redFlags: { type: "array", title: "Potential Issues" },
            obligations: { type: "object", title: "Tenant/Landlord Obligations" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["lease-analysis"], currency: "USD" },
        category: "real_estate"
      },
      {
        id: "construction_progress",
        name: "Construction Progress Tracker",
        description: "Track construction milestones with AI photo analysis. Use when user asks 'analyze construction photos', 'track building progress', 'construction status', or 'verify construction work'.",
        inputSchema: {
          type: "object",
          properties: {
            projectName: { type: "string", title: "Project Name" },
            phase: { type: "string", enum: ["foundation", "framing", "exterior", "interior", "finishing"], title: "Current Phase" },
            photos: { type: "array", items: { type: "string" }, title: "Photo URLs or Base64" },
            expectedCompletion: { type: "string", format: "date", title: "Expected Completion Date" }
          },
          required: ["projectName", "phase", "photos"]
        },
        outputSchema: {
          type: "object",
          properties: {
            completionEstimate: { type: "number", title: "% Complete" },
            milestones: { type: "array", title: "Completed Milestones" },
            issues: { type: "array", title: "Identified Issues" },
            progressReport: { type: "string", title: "AI Progress Report" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["construction-progress"], currency: "USD" },
        category: "real_estate"
      },
      // BANKING/FINANCE VERTICAL (3 services)
      {
        id: "credit_risk_score",
        name: "Credit Risk Assessment",
        description: "AI credit risk scoring using financial data. Use when user asks 'credit risk', 'assess creditworthiness', 'loan risk analysis', or 'credit score evaluation'.",
        inputSchema: {
          type: "object",
          properties: {
            financialData: { type: "object", title: "Financial Information" },
            loanAmount: { type: "number", title: "Requested Loan Amount" },
            purpose: { type: "string", enum: ["personal", "business", "mortgage", "auto"], title: "Loan Purpose" }
          },
          required: ["financialData", "loanAmount"]
        },
        outputSchema: {
          type: "object",
          properties: {
            creditScore: { type: "number", title: "Risk Score (0-100)" },
            riskCategory: { type: "string", enum: ["low", "medium", "high"], title: "Risk Level" },
            factors: { type: "array", title: "Key Risk Factors" },
            recommendation: { type: "string", title: "Lending Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["credit-risk-score"], currency: "USD" },
        category: "banking"
      },
      {
        id: "fraud_detection",
        name: "Transaction Fraud Detection",
        description: "Real-time fraud pattern detection. Use when user asks 'check fraud', 'suspicious transaction', 'fraud analysis', or 'verify transaction'.",
        inputSchema: {
          type: "object",
          properties: {
            transaction: { type: "object", title: "Transaction Details" },
            userHistory: { type: "array", items: { type: "object" }, title: "Historical Transactions (optional)" }
          },
          required: ["transaction"]
        },
        outputSchema: {
          type: "object",
          properties: {
            fraudScore: { type: "number", title: "Fraud Risk (0-100)" },
            alerts: { type: "array", title: "Red Flags" },
            recommendation: { type: "string", enum: ["approve", "review", "decline"], title: "Action" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["fraud-detection"], currency: "USD" },
        category: "banking"
      },
      {
        id: "compliance_check",
        name: "Regulatory Compliance Check",
        description: "AML/KYC compliance verification. Use when user asks 'compliance check', 'AML verification', 'KYC analysis', or 'regulatory review'.",
        inputSchema: {
          type: "object",
          properties: {
            entityData: { type: "object", title: "Entity Information" },
            checkTypes: { type: "array", items: { type: "string", enum: ["aml", "kyc", "sanctions", "pep"] }, title: "Compliance Checks" }
          },
          required: ["entityData", "checkTypes"]
        },
        outputSchema: {
          type: "object",
          properties: {
            complianceStatus: { type: "string", enum: ["pass", "review", "fail"], title: "Overall Status" },
            findings: { type: "array", title: "Compliance Findings" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"], title: "Risk Level" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["compliance-check"], currency: "USD" },
        category: "banking"
      },
      // TRADING/INVESTMENT VERTICAL (3 services)
      {
        id: "trading_signal",
        name: "AI Trading Signal Generator",
        description: "Generate trading signals using technical analysis. Use when user asks 'trading signal', 'should I buy/sell', 'trading recommendation', or 'market signal'.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string", title: "Token/Stock Symbol" },
            timeframe: { type: "string", enum: ["1h", "4h", "1d", "1w"], default: "1d", title: "Analysis Timeframe" },
            strategy: { type: "string", enum: ["momentum", "mean-reversion", "breakout", "trend-following"], default: "momentum" }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          properties: {
            signal: { type: "string", enum: ["strong-buy", "buy", "hold", "sell", "strong-sell"], title: "Trading Signal" },
            confidence: { type: "number", title: "Confidence (0-100)" },
            entryPrice: { type: "number", title: "Suggested Entry" },
            targets: { type: "array", items: { type: "number" }, title: "Price Targets" },
            stopLoss: { type: "number", title: "Stop Loss" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["trading-signal"], currency: "USD" },
        category: "trading"
      },
      {
        id: "portfolio_optimization",
        name: "Portfolio Optimizer",
        description: "AI portfolio allocation and rebalancing. Use when user asks 'optimize portfolio', 'rebalance assets', 'portfolio allocation', or 'diversification strategy'.",
        inputSchema: {
          type: "object",
          properties: {
            currentHoldings: { type: "array", items: { type: "object" }, title: "Current Holdings" },
            riskTolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"], default: "moderate" },
            investmentGoal: { type: "string", title: "Investment Goal (optional)" }
          },
          required: ["currentHoldings", "riskTolerance"]
        },
        outputSchema: {
          type: "object",
          properties: {
            recommendations: { type: "array", title: "Rebalancing Recommendations" },
            targetAllocation: { type: "object", title: "Target Allocation %" },
            expectedReturn: { type: "number", title: "Expected Annual Return %" },
            riskMetrics: { type: "object", title: "Risk Analysis" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["portfolio-optimization"], currency: "USD" },
        category: "trading"
      },
      {
        id: "sentiment_analysis",
        name: "Market Sentiment Analyzer",
        description: "Analyze market sentiment from social/news data. Use when user asks 'market sentiment', 'social sentiment', 'crypto news analysis', or 'sentiment score'.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string", title: "Asset Symbol" },
            sources: { type: "array", items: { type: "string", enum: ["twitter", "reddit", "news", "telegram"] }, default: ["twitter", "reddit"] }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          properties: {
            sentimentScore: { type: "number", title: "Sentiment (-100 to +100)" },
            trend: { type: "string", enum: ["bullish", "neutral", "bearish"], title: "Overall Trend" },
            keyMentions: { type: "array", title: "Top Mentions" },
            volumeChange: { type: "number", title: "Mention Volume Change %" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["sentiment-analysis"], currency: "USD" },
        category: "trading"
      },
      // MARKET INTELLIGENCE VERTICAL (3 services)
      {
        id: "arbitrage_scanner",
        name: "Cross-Exchange Arbitrage Scanner",
        description: "Identify arbitrage opportunities across chains/exchanges. Use when user asks 'arbitrage opportunities', 'price differences', 'cross-exchange arbitrage', or 'profit opportunities'.",
        inputSchema: {
          type: "object",
          properties: {
            tokens: { type: "array", items: { type: "string" }, title: "Tokens to Scan" },
            minProfit: { type: "number", default: 0.5, title: "Min Profit % Threshold" },
            chains: { type: "array", items: { type: "string" }, title: "Chains to Compare (optional)" }
          },
          required: ["tokens"]
        },
        outputSchema: {
          type: "object",
          properties: {
            opportunities: { type: "array", title: "Arbitrage Opportunities" },
            topOpportunity: { type: "object", title: "Best Opportunity" },
            totalOpportunities: { type: "number", title: "Total Found" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["arbitrage-scanner"], currency: "USD" },
        category: "intelligence"
      },
      {
        id: "correlation_matrix",
        name: "Asset Correlation Matrix",
        description: "Correlation analysis between crypto assets. Use when user asks 'correlation analysis', 'asset correlation', 'price relationship', or 'correlated tokens'.",
        inputSchema: {
          type: "object",
          properties: {
            assets: { type: "array", items: { type: "string" }, title: "Assets to Analyze" },
            timeframe: { type: "string", enum: ["7d", "30d", "90d", "1y"], default: "30d", title: "Analysis Period" }
          },
          required: ["assets"]
        },
        outputSchema: {
          type: "object",
          properties: {
            correlationMatrix: { type: "object", title: "Correlation Matrix" },
            strongCorrelations: { type: "array", title: "Strong Correlations (>0.7)" },
            diversificationScore: { type: "number", title: "Portfolio Diversification Score" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["correlation-matrix"], currency: "USD" },
        category: "intelligence"
      },
      {
        id: "risk_metrics",
        name: "Portfolio Risk Metrics",
        description: "Comprehensive risk analysis: VaR, Sharpe, drawdown. Use when user asks 'portfolio risk', 'risk metrics', 'value at risk', 'volatility analysis', or 'risk assessment'.",
        inputSchema: {
          type: "object",
          properties: {
            portfolio: { type: "array", items: { type: "object" }, title: "Portfolio Holdings" },
            timeHorizon: { type: "string", enum: ["1m", "3m", "6m", "1y"], default: "1m", title: "Time Horizon" }
          },
          required: ["portfolio"]
        },
        outputSchema: {
          type: "object",
          properties: {
            valueAtRisk: { type: "number", title: "Value at Risk (95%)" },
            sharpeRatio: { type: "number", title: "Sharpe Ratio" },
            maxDrawdown: { type: "number", title: "Max Drawdown %" },
            volatility: { type: "number", title: "Annualized Volatility %" },
            riskGrade: { type: "string", enum: ["A", "B", "C", "D", "F"], title: "Overall Risk Grade" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["risk-metrics"], currency: "USD" },
        category: "intelligence"
      },
      // TRADITIONAL MARKETS VERTICAL (2 services)
      {
        id: "stock_sentiment",
        name: "Stock Market Sentiment Analysis",
        description: "AI-powered stock market sentiment analysis with news sentiment, technical indicators, and institutional activity. Use when user asks 'stock sentiment', 'market sentiment', 'stock news analysis', 'equity sentiment', or 'stock market outlook'.",
        inputSchema: {
          type: "object",
          title: "Stock Sentiment Request",
          description: "Request stock market sentiment analysis",
          additionalProperties: false,
          properties: {
            symbol: { 
              type: "string", 
              title: "Stock Symbol",
              description: "Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)"
            }
          },
          required: ["symbol"]
        },
        outputSchema: {
          type: "object",
          title: "Stock Sentiment Response",
          additionalProperties: false,
          properties: {
            symbol: { type: "string", title: "Stock Symbol" },
            overallSentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], title: "Overall Sentiment" },
            sentimentScore: { type: "number", title: "Sentiment Score (-1 to 1)" },
            newsAnalysis: { type: "object", title: "News Sentiment Analysis" },
            technicalIndicators: { type: "object", title: "Technical Indicators" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["stock-sentiment"], currency: "USD" },
        category: "traditional-markets"
      },
      {
        id: "forex_sentiment",
        name: "Forex Sentiment Analysis",
        description: "AI-powered forex/currency sentiment analysis with central bank policy, economic indicators, and cross-rate analysis. Use when user asks 'forex sentiment', 'currency outlook', 'FX analysis', 'exchange rate sentiment', or 'currency pair analysis'.",
        inputSchema: {
          type: "object",
          title: "Forex Sentiment Request",
          description: "Request forex market sentiment analysis",
          additionalProperties: false,
          properties: {
            pair: { 
              type: "string", 
              title: "Currency Pair",
              description: "Forex pair (e.g., EUR/USD, GBP/JPY, USD/CHF)"
            }
          },
          required: ["pair"]
        },
        outputSchema: {
          type: "object",
          title: "Forex Sentiment Response",
          additionalProperties: false,
          properties: {
            pair: { type: "string", title: "Currency Pair" },
            overallSentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], title: "Overall Sentiment" },
            sentimentScore: { type: "number", title: "Sentiment Score (-1 to 1)" },
            centralBankAnalysis: { type: "object", title: "Central Bank Policy Analysis" },
            economicIndicators: { type: "object", title: "Economic Indicators" },
            recommendation: { type: "string", title: "AI Recommendation" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["forex-sentiment"], currency: "USD" },
        category: "traditional-markets"
      },
      // Satellite Data Services (6 services) - NASA Earthdata + ESA Copernicus
      {
        id: "fire_alerts",
        name: "Fire Alert Detection",
        description: "Real-time active fire detection from NASA FIRMS satellite data. Use when user asks 'active fires', 'fire hotspots', 'wildfire detection', 'FIRMS data', or 'fire alerts near me'.",
        inputSchema: {
          type: "object",
          title: "Fire Alert Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude", description: "Latitude coordinate" },
            lon: { type: "number", title: "Longitude", description: "Longitude coordinate" },
            radius: { type: "number", title: "Search Radius (km)", description: "Search radius in kilometers" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Fire Alert Response",
          additionalProperties: false,
          properties: {
            fires: { type: "array", title: "Active Fires" },
            count: { type: "number", title: "Fire Count" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["fire-alerts"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "weather_imagery",
        name: "Satellite Weather Imagery",
        description: "High-resolution weather satellite imagery from NASA GIBS. Use when user asks 'satellite weather', 'cloud cover', 'weather imagery', 'GIBS data', or 'atmospheric conditions'.",
        inputSchema: {
          type: "object",
          title: "Weather Imagery Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            layer: { type: "string", title: "Imagery Layer", description: "Specific layer type" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Weather Imagery Response",
          additionalProperties: false,
          properties: {
            imagery: { type: "object", title: "Imagery Data" },
            timestamp: { type: "string", title: "Data Timestamp" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["weather-imagery"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "vegetation_health",
        name: "Vegetation Health Analysis",
        description: "NDVI vegetation health indices from NASA MODIS and ESA Sentinel-2. Use when user asks 'vegetation health', 'NDVI', 'crop monitoring', 'forest health', or 'agriculture satellite data'.",
        inputSchema: {
          type: "object",
          title: "Vegetation Health Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            area_km2: { type: "number", title: "Area (km²)", description: "Area in square kilometers" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Vegetation Health Response",
          additionalProperties: false,
          properties: {
            ndvi: { type: "number", title: "NDVI Value" },
            healthStatus: { type: "string", title: "Health Status" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["vegetation"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "flood_detection",
        name: "Flood Detection",
        description: "ESA Sentinel-1 SAR-based flood and water body detection. Use when user asks 'flood monitoring', 'flood detection', 'water extent', 'flood mapping', or 'disaster response satellite'.",
        inputSchema: {
          type: "object",
          title: "Flood Detection Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            radius: { type: "number", title: "Detection Radius (km)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Flood Detection Response",
          additionalProperties: false,
          properties: {
            floodExtent: { type: "object", title: "Flood Extent Data" },
            riskLevel: { type: "string", title: "Risk Level" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["flood-detection"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "air_quality",
        name: "Air Quality Analysis",
        description: "ESA Sentinel-5P TROPOMI air quality data including NO2, SO2, CO, and aerosols. Use when user asks 'air quality', 'pollution levels', 'air pollution satellite', 'TROPOMI data', or 'atmospheric quality'.",
        inputSchema: {
          type: "object",
          title: "Air Quality Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            pollutant: { type: "string", title: "Pollutant Type", description: "Specific pollutant (NO2, SO2, CO, etc.)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Air Quality Response",
          additionalProperties: false,
          properties: {
            aqi: { type: "number", title: "Air Quality Index" },
            pollutants: { type: "object", title: "Pollutant Levels" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["air-quality"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "land_use",
        name: "Land Use Classification",
        description: "NASA Landsat + ESA Sentinel-2 land use classification. Use when user asks 'land use', 'land classification', 'urban detection', 'forest cover', or 'land cover satellite'.",
        inputSchema: {
          type: "object",
          title: "Land Use Request",
          additionalProperties: false,
          properties: {
            lat: { type: "number", title: "Latitude" },
            lon: { type: "number", title: "Longitude" },
            area_km2: { type: "number", title: "Area (km²)" }
          },
          required: ["lat", "lon"]
        },
        outputSchema: {
          type: "object",
          title: "Land Use Response",
          additionalProperties: false,
          properties: {
            classification: { type: "object", title: "Land Classification" },
            landTypes: { type: "array", title: "Land Types" },
            source: { type: "string", title: "Data Source" }
          }
        },
        pricing: { amount: SERVICE_PRICING_USD["land-use"], currency: "USD" },
        category: "satellite-data"
      },
      {
        id: "kalshi_markets",
        name: "Kalshi Prediction Markets",
        description: "Get active markets from Kalshi, the CFTC-regulated prediction exchange. Use when user asks 'prediction markets', 'Kalshi markets', 'what events can I bet on', 'CFTC regulated markets', or 'election markets'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Markets Request",
          description: "Request active prediction markets from Kalshi",
          additionalProperties: false,
          properties: {
            limit: { type: "number", title: "Result Limit", description: "Number of markets to return (max 50)", minimum: 1, maximum: 50, default: 10 },
            status: { type: "string", title: "Market Status", enum: ["open", "closed", "settled"], default: "open" },
            category: { type: "string", title: "Category", description: "Filter by series ticker (e.g., 'KXBTC' for Bitcoin)" }
          }
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Markets Response",
          additionalProperties: false,
          properties: {
            markets: { type: "array", title: "Active Markets", items: { type: "object", properties: { ticker: { type: "string" }, title: { type: "string" }, yesPrice: { type: "number" }, noPrice: { type: "number" }, volume: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "kalshi_odds",
        name: "Kalshi Odds Lookup",
        description: "Get current odds, orderbook depth, and event details for a specific Kalshi market. Use when user asks 'Kalshi odds', 'prediction odds', 'market probability', 'event odds', or 'orderbook depth'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Odds Request",
          description: "Request odds for a specific Kalshi market or event",
          additionalProperties: false,
          properties: {
            ticker: { type: "string", title: "Market Ticker", description: "Kalshi market ticker (e.g., 'KXBTC-26FEB14-B55500')" },
            eventTicker: { type: "string", title: "Event Ticker", description: "Kalshi event ticker (e.g., 'KXBTC-26FEB14')" }
          }
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Odds Response",
          additionalProperties: false,
          properties: {
            market: { type: "object", title: "Market Details" },
            orderbook: { type: "object", title: "Orderbook Depth" }
          }
        },
        pricing: { amount: 0.50, currency: "USD" },
        category: "prediction-markets"
      },
      {
        id: "kalshi_search",
        name: "Kalshi Market Search",
        description: "Search Kalshi prediction markets by keyword with relevance scoring. Use when user asks 'search predictions', 'find Kalshi market', 'prediction about bitcoin', 'search election markets', or 'find prediction market'.",
        inputSchema: {
          type: "object",
          title: "Kalshi Search Request",
          description: "Search Kalshi markets by keyword",
          additionalProperties: false,
          properties: {
            query: { type: "string", title: "Search Query", description: "Keywords to search for" },
            limit: { type: "number", title: "Result Limit", minimum: 1, maximum: 20, default: 10 },
            status: { type: "string", title: "Market Status", enum: ["open", "closed", "settled"], default: "open" }
          },
          required: ["query"]
        },
        outputSchema: {
          type: "object",
          title: "Kalshi Search Response",
          additionalProperties: false,
          properties: {
            results: { type: "array", title: "Matching Markets", items: { type: "object", properties: { ticker: { type: "string" }, title: { type: "string" }, relevanceScore: { type: "number" } } } }
          }
        },
        pricing: { amount: 0.25, currency: "USD" },
        category: "prediction-markets"
      }
    ],
    
    // Error schemas for A2A v0.3 compliance
    errors: {
      PaymentRequired: {
        code: "PAYMENT_REQUIRED",
        httpStatus: 402,
        description: "x402 payment required to access this service",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            price_usd: { type: "number", title: "Service Price USD" },
            payment_address: { type: "string", title: "Payment Wallet Address" },
            network: { type: "string", title: "Payment Network", enum: ["base", "ethereum", "polygon", "arbitrum", "optimism"] },
            currency: { type: "string", title: "Payment Currency", enum: ["USDC", "USDT"] }
          },
          required: ["error", "code", "price_usd", "payment_address", "network", "currency"]
        }
      },
      InvalidRequest: {
        code: "INVALID_REQUEST",
        httpStatus: 400,
        description: "Request validation failed",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            details: { 
              type: "array", 
              title: "Validation Errors",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          },
          required: ["error", "code"]
        }
      },
      ServiceError: {
        code: "SERVICE_ERROR",
        httpStatus: 500,
        description: "Internal service error",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            requestId: { type: "string", title: "Request ID for support" }
          },
          required: ["error", "code"]
        }
      },
      RateLimitExceeded: {
        code: "RATE_LIMIT_EXCEEDED",
        httpStatus: 429,
        description: "Rate limit exceeded",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            error: { type: "string", title: "Error Message" },
            code: { type: "string", title: "Error Code" },
            retryAfter: { type: "number", title: "Retry After (seconds)" }
          },
          required: ["error", "code", "retryAfter"]
        }
      }
    },
    
    // Authentication (OpenAPI-style)
    authentication: {
      type: "custom",
      scheme: "x402",
      description: "x402 protocol: Send USDC payment on Base, include txHash in X-PAYMENT header",
      headerName: "X-PAYMENT",
      paymentNetworks: ["base", "ethereum", "polygon", "arbitrum", "optimism"],
      acceptedCurrencies: ["USDC", "USDT"]
    },
    
    // Supported transports
    transports: ["REST", "x402"],
    
    // Modalities
    modalities: ["text", "data"],
    
    // Protocol info
    protocolVersion: "0.3.0",
    a2aCompliant: true,
    x402Compliant: true,
    
    // Endpoints
    endpoints: {
      openapi: `${baseUrl}/.well-known/openapi.json`,
      serviceManifest: `${baseUrl}/.well-known/service-manifest.json`,
      pricing: `${baseUrl}/.well-known/pricing.json`,
      documentation: `${baseUrl}/developers`,
      marketplace: `${baseUrl}/marketplace`
    },
    
    // Rate limiting metadata (A2A v0.3 optional field)
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10
    },
    
    // Platform metadata
    platform: {
      name: "Coin Railz",
      url: baseUrl,
      type: "payment_infrastructure",
      chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      positioning: "Multi-Chain Payment Infrastructure for Crypto Communities"
    }
  };
  
  res.status(200).json(a2aAgentCard);
});

/**
 * GET /.well-known/agent-instructions.json
 * 
 * Machine-readable onboarding instructions for AI agents
 * Explains how to create wallets, fund them, and purchase services
 * This endpoint helps agents understand the complete business flow
 */
router.get('/.well-known/agent-instructions.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const instructions = {
    title: "How to Do Business with Coin Railz",
    version: "1.0.0",
    lastUpdated: "2026-01-31",
    summary: "Step-by-step guide for AI agents to purchase blockchain analytics and trading services via x402 micropayments or prepaid credits.",
    
    quickStart: {
      description: "Two paths to get started — card (easier) or on-chain USDC",
      recommendedPath: "cardPayment",
      paths: {
        cardPayment: {
          label: "Card Payment (Recommended — no crypto required)",
          steps: [
            {
              step: 1,
              action: "Create a Stripe PaymentMethod",
              description: "Use Stripe.js or the Stripe API to tokenize a card. Returns a pm_... PaymentMethod ID.",
              stripeDocsUrl: "https://stripe.com/docs/api/payment_methods/create"
            },
            {
              step: 2,
              action: "Purchase credits and get your API key",
              endpoint: `${baseUrl}/api/m2m/credits/purchase`,
              method: "POST",
              body: { paymentMethodId: "pm_...", amountUsd: 10, idempotencyKey: "your-unique-uuid-v4" },
              tiers: [
                { amountUsd: 10, calls: "~200 service calls" },
                { amountUsd: 25, calls: "~500 service calls" },
                { amountUsd: 100, calls: "~2,000 service calls" }
              ],
              response: "{ apiKey: 'cr_live_...', keyPrefix, creditsAdded, newBalance }",
              warning: "SAVE the apiKey from the response — shown once only"
            },
            {
              step: 3,
              action: "Call any service with your API key",
              description: "Pass the key as X-API-KEY header on any /x402/* endpoint. Credits deducted per call.",
              curlExample: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'X-API-KEY: cr_live_...' -H 'Content-Type: application/json' -d '{"chains":["base"]}'`,
              catalogUrl: `${baseUrl}/x402/catalog`
            }
          ]
        },
        onChainUsdc: {
          label: "On-Chain USDC via x402 (crypto-native)",
          steps: [
            {
              step: 1,
              action: "Get a Wallet",
              description: "Create a free agent wallet or use your own EVM wallet with USDC on Base",
              endpoint: `${baseUrl}/x402/wallet/free`,
              method: "POST",
              example: { agentId: "your-agent-id", purpose: "payments" }
            },
            {
              step: 2,
              action: "Fund with USDC",
              description: "Send USDC to your wallet on Base mainnet (Chain ID 8453)",
              network: "Base Mainnet",
              chainId: 8453,
              token: {
                symbol: "USDC",
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                decimals: 6
              },
              bridges: [
                { name: "Base Bridge", url: "https://bridge.base.org" },
                { name: "Across Protocol", url: "https://app.across.to" },
                { name: "Stargate", url: "https://stargate.finance" }
              ]
            },
            {
              step: 3,
              action: "Make Your First Paid Call",
              description: "Start with the Golden Path endpoint — $0.05 USDC, lowest price on platform. Receive 402, pay via facilitator, retry with X-PAYMENT header.",
              facilitator: {
                evm: "https://api.cdp.coinbase.com/platform/v2/x402",
                solana: "https://x402.dexter.cash"
              },
              goldenPathEndpoint: `${baseUrl}/x402/first-call`,
              price: "$0.05 USDC",
              chainsAccepted: ["Base (eip155:8453)", "Solana mainnet"],
              curlExample: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <tx_hash>' -d '{}'`,
              pythonExample: `import httpx\nresp = httpx.post('${baseUrl}/x402/first-call', headers={'X-PAYMENT': tx_hash}, json={})\nprint(resp.json())`
            }
          ]
        }
      }
    },

    goldenPath: {
      description: "START HERE. The canonical first payment endpoint for any new agent integrating with Coin Railz.",
      endpoint: `${baseUrl}/x402/first-call`,
      method: "POST",
      price: "$0.05 USDC",
      amountMicroUSDC: 50000,
      chainsAccepted: ["Base (eip155:8453)", "Solana mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)"],
      onSuccess: "Returns sessionId, payment receipt, and 3 next-service templates with executable curl examples"
    },
    
    walletOptions: {
      description: "Three ways to get a wallet for payments",
      options: [
        {
          id: "free-wallet",
          name: "Free Agent Wallet",
          description: "Instant wallet creation via Coinbase CDP - no cost, ready in seconds",
          endpoint: `${baseUrl}/x402/wallet/free`,
          method: "POST",
          cost: "Free",
          features: ["Instant creation", "CDP-managed", "Base mainnet ready"]
        },
        {
          id: "instant-agent-wallet",
          name: "Premium Agent Wallet",
          description: "Enhanced wallet with additional features via x402 payment",
          endpoint: `${baseUrl}/x402/instant-agent-wallet`,
          method: "POST",
          cost: "$1.00 USDC",
          features: ["Priority support", "Analytics dashboard", "Multi-chain ready"]
        },
        {
          id: "self-custody",
          name: "Self-Custody Wallet",
          description: "Use any existing EVM wallet (MetaMask, Rainbow, etc.)",
          requirements: ["EVM wallet with Base network support", "USDC on Base mainnet"],
          cost: "Free (you manage keys)"
        }
      ]
    },
    
    paymentMethods: {
      description: "Multiple ways to pay for services",
      methods: [
        {
          id: "x402",
          name: "x402 Micropayments",
          description: "Pay-per-call USDC payments via HTTP 402 protocol",
          howItWorks: [
            "1. Make request to any service endpoint",
            "2. Receive 402 Payment Required response with payment details",
            "3. Sign and submit USDC payment via facilitator",
            "4. Retry request with X-PAYMENT header containing tx hash",
            "5. Receive service response"
          ],
          facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
          platformWallet: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
          network: "eip155:8453",
          token: "USDC"
        },
        {
          id: "credits",
          name: "Prepaid Credits",
          description: "Buy credits in bulk for discounted access",
          endpoint: `${baseUrl}/api/credits`,
          dashboard: `${baseUrl}/credits`,
          benefits: ["Volume discounts", "No per-transaction signing", "Usage tracking"]
        },
        {
          id: "sdk",
          name: "SDK Integration",
          description: "Use our SDK packages for seamless payment handling",
          packages: {
            npm: "@coinrailz/agent-payments",
            npmSolana: "@coinrailz/agent-payments-solana",
            python: "coinrailz",
            pythonSolana: "coinrailz-solana",
            docker: "tdnupe3/agent-payments"
          },
          documentation: `${baseUrl}/docs/sdk`
        }
      ]
    },
    
    pricing: {
      description: "Service pricing ranges from $0.05 to $10.00 USDC per call",
      pricingTiers: [
        { tier: "Basic", range: "$0.05 - $0.25", examples: ["ping", "gas-price-oracle", "fire-alerts", "kalshi-markets", "kalshi-search"] },
        { tier: "Standard", range: "$0.25 - $1.00", examples: ["multi-chain-balance", "wallet-risk", "trade-signals", "kalshi-odds"] },
        { tier: "Premium", range: "$1.00 - $5.00", examples: ["instant-agent-wallet", "verified-agent-identity"] },
        { tier: "Enterprise", range: "$5.00 - $10.00", examples: ["smart-contract-audit", "compliance-consultation"] }
      ],
      fullCatalog: `${baseUrl}/x402/catalog`,
      paymentDocs: `${baseUrl}/x402/payment-docs`
    },
    
    troubleshooting: {
      commonIssues: [
        {
          issue: "402 Payment Required but payment not recognized",
          solutions: [
            "Verify transaction was sent to correct wallet: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
            "Confirm transaction is on Base mainnet (not Ethereum or other chains)",
            "Ensure payment is in USDC (not ETH or other tokens)",
            "Wait for transaction confirmation (1-2 blocks)"
          ]
        },
        {
          issue: "Insufficient funds error",
          solutions: [
            "Bridge USDC to Base via bridge.base.org or across.to",
            "Minimum recommended balance: $5 USDC for testing",
            "Consider buying prepaid credits for bulk usage"
          ]
        },
        {
          issue: "Wallet creation failed",
          solutions: [
            "Use unique agentId for each wallet request",
            "Check /x402/wallet/free endpoint is accessible",
            "Contact support if issue persists"
          ]
        }
      ],
      support: {
        statusEndpoint: `${baseUrl}/x402/payment-status`,
        documentation: `${baseUrl}/x402/payment-docs`,
        contact: "support@coinrailz.com"
      }
    },
    
    links: {
      agentRegistration: `${baseUrl}/.well-known/agent-registration.json`,
      serviceCatalog: `${baseUrl}/x402/catalog`,
      paymentDocs: `${baseUrl}/x402/payment-docs`,
      agentCard: `${baseUrl}/.well-known/agent.json`,
      x402Manifest: `${baseUrl}/.well-known/x402.json`,
      apiDiscovery: `${baseUrl}/api/discovery/resources`,
      mcpServices: `${baseUrl}/mcp/services`,
      freeWallet: `${baseUrl}/x402/wallet/free`,
      credits: `${baseUrl}/credits`,
      documentation: `${baseUrl}/docs`
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(instructions);
});

/**
 * GET /.well-known/agent-card.json
 * 
 * A2A Protocol v0.3.0 compliant agent card for registry submission
 * Main platform agent card - describes Coin Railz as a service provider
 * Discoverable by ChatGPT, Google AI, x402 indexers, A2A Registry, and other A2A platforms
 * 
 * UPDATED: Dec 2024 - Now includes all 38 x402 services with correct pricing
 */
router.get('/.well-known/agent-card.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  // A2A Protocol v0.3.0 compliant agent card - ALL 41 SERVICES
  const agentCard = {
    protocolVersion: "0.3.0",
    name: "Coin Railz",
    description: "Multi-chain x402 micropayment infrastructure for AI agents. 44+ pay-per-call API services for crypto analytics, trading signals, security audits, satellite data (NASA/ESA), real estate, banking, market intelligence, prediction markets, and traditional markets. Native Coinbase Agentic Wallet compatible. Pay with USDC on Ethereum or Base - prices from $0.05 to $10.00 per request.",
    url: `${baseUrl}/a2a/v1`,
    version: "3.1.0",
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true
    },

    iconUrl: "https://coinrailz.com/favicon.ico",
    preferredTransport: "HTTP+JSON",

    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,

    agenticWallet: {
      compatible: true,
      sdkVersion: "0.10.3",
      walletProvisioningEndpoint: `${baseUrl}/x402/wallet/free`,
      paidWalletEndpoint: `${baseUrl}/x402/instant-agent-wallet`,
      supportedSkills: ["search-for-service", "pay-for-service", "monetize-service"],
      onboardingFlow: "instant",
      cli: "npx awal"
    },

    ap2: {
      version: "0.1",
      endpoint: `${baseUrl}/ap2/v1/merchant`,
      supportedPaymentMethods: ["X402", "CARD", "VISA", "MASTERCARD", "AMEX", "STRIPE"],
      supportedCurrencies: ["USDC", "USD"],
      supportedChains: ["base", "solana"],
      cardPayment: {
        processor: "Stripe",
        minAmount: 1.00,
        maxAmount: 2500.00,
        note: "Card payments (CARD/VISA/MASTERCARD/AMEX/STRIPE) purchase API credits. Include Stripe pm_ token for automated payment, or use checkoutUrl for browser-based payment.",
        checkoutUrl: `${baseUrl}/pilots/buy`
      },
      description: "AP2 v0.1 merchant endpoint — accepts PaymentMandate VDCs for x402 crypto (per-call) or card payments via Stripe (credits-based)"
    },
    
    skills: [
      // Trading Intelligence Services ($0.10-$0.75)
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas price predictions across multiple chains. $0.10 per request.",
        tags: ["utilities", "gas", "ethereum", "multi-chain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Ethereum gas prices",
          description: "Get current gas prices on Ethereum with USD cost estimates",
          input: { chains: ["ethereum"] },
          output: { gasPrices: [{ chain: "ethereum", slow: 12, standard: 15, fast: 22, usdCostEstimate: "$0.45" }] }
        }]
      },
      {
        id: "token-metadata",
        name: "Token Metadata",
        description: "Comprehensive token information including name, symbol, decimals, and contract details. $0.10 per request.",
        tags: ["tokens", "metadata", "crypto", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "USDC token info",
          description: "Get metadata for USDC stablecoin on Base",
          input: { tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" },
          output: { name: "USD Coin", symbol: "USDC", decimals: 6, totalSupply: "1000000000" }
        }]
      },
      {
        id: "dex-liquidity",
        name: "DEX Liquidity Scanner",
        description: "Analyze liquidity pools, depths, and trading conditions across DEXs. $0.20 per request.",
        tags: ["defi", "liquidity", "dex", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "ETH/USDC liquidity on Base",
          description: "Analyze liquidity for ETH/USDC trading pair across DEXs on Base",
          input: { tokenPair: "ETH/USDC", chain: "base", dex: "all" },
          output: { pools: [{ dex: "uniswap-v3", liquidity: 45000000, apy: 8.2, volume24h: 12000000 }] }
        }]
      },
      {
        id: "approval-manager",
        name: "Token Approval Manager",
        description: "Check and manage token approvals for smart contracts. $0.20 per request.",
        tags: ["security", "approvals", "tokens", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "token-price",
        name: "Token Price Feed",
        description: "Real-time token prices from multiple sources. $0.25 per request.",
        tags: ["prices", "tokens", "data", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "token-sentiment",
        name: "Token Sentiment Analysis",
        description: "AI-powered sentiment analysis for tokens from social and on-chain data. $0.25 per request.",
        tags: ["sentiment", "ai", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "transaction-builder",
        name: "Transaction Builder",
        description: "Build optimized blockchain transactions with gas estimation. $0.30 per request.",
        tags: ["transactions", "utilities", "blockchain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "whale-alerts",
        name: "Whale Alerts",
        description: "Real-time monitoring of large wallet movements and whale activity. $0.35 per request.",
        tags: ["whales", "monitoring", "alerts", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "batch-quote",
        name: "Batch Quote Service",
        description: "Get multiple swap quotes in a single request. $0.40 per request.",
        tags: ["trading", "quotes", "batch", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "multi-chain-balance",
        name: "Multi-Chain Balance",
        description: "Check wallet balances across all supported chains in one call. $0.50 per request.",
        tags: ["wallets", "balances", "multi-chain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trending-tokens",
        name: "Trending Tokens",
        description: "Discover trending and hot tokens based on volume and social activity. $0.50 per request.",
        tags: ["trending", "tokens", "discovery", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "portfolio-tracker",
        name: "Portfolio Tracker",
        description: "Complete portfolio breakdown with P&L and allocation insights. $0.50 per request.",
        tags: ["portfolio", "tracking", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "wallet-risk",
        name: "Wallet Risk Analysis",
        description: "Evaluate wallet risk levels and suspicious activity patterns. $0.50 per request.",
        tags: ["security", "risk", "wallets", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trade-signals",
        name: "Trade Signals",
        description: "AI-powered trading signals based on technical analysis and on-chain data. $0.75 per request.",
        tags: ["trading", "signals", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Execution & Infrastructure Services ($0.50-$2.00)
      {
        id: "payment-processing",
        name: "Payment Processing",
        description: "Process crypto payments across 7 blockchains. $0.50 per request.",
        tags: ["payments", "crypto", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "contract-scan",
        name: "Contract Scanner",
        description: "Deep analysis of smart contract code and security vulnerabilities. $1.00 per request.",
        tags: ["security", "smart-contracts", "auditing", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "instant-agent-wallet",
        name: "Instant Agent Wallet",
        description: "Create managed wallets for AI agents instantly. $1.00 per request.",
        tags: ["wallets", "agents", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "seamless-chain-bridge",
        name: "Cross-Chain Bridge",
        description: "Bridge assets seamlessly across supported chains. $2.00 per request.",
        tags: ["bridges", "cross-chain", "infrastructure", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Premium Services ($5.00-$10.00)
      {
        id: "verified-agent-identity",
        name: "Verified Agent Identity",
        description: "On-chain identity verification and reputation for AI agents. $5.00 per request.",
        tags: ["identity", "verification", "agents", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "compliance-consultation",
        name: "Compliance Consultation",
        description: "AI-powered compliance analysis for crypto operations. $5.00 per request.",
        tags: ["compliance", "legal", "consulting", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "smart-contract-audit",
        name: "Smart Contract Audit",
        description: "Comprehensive security audit with vulnerability detection. $10.00 per request.",
        tags: ["security", "auditing", "smart-contracts", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Real Estate Vertical ($0.75-$1.50)
      {
        id: "property-valuation",
        name: "Property Valuation",
        description: "AI-powered real estate property valuation and market analysis. $0.75 per request.",
        tags: ["real-estate", "valuation", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "lease-analysis",
        name: "Lease Analysis",
        description: "Analyze commercial and residential lease terms and conditions. $1.00 per request.",
        tags: ["real-estate", "leases", "analysis", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "construction-progress",
        name: "Construction Progress",
        description: "Track and analyze construction project progress and milestones. $1.50 per request.",
        tags: ["real-estate", "construction", "tracking", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Banking/Finance Vertical ($0.75-$1.75)
      {
        id: "fraud-detection",
        name: "Fraud Detection",
        description: "AI-powered fraud detection for financial transactions. $0.75 per request.",
        tags: ["banking", "fraud", "security", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "credit-risk-score",
        name: "Credit Risk Score",
        description: "Calculate credit risk scores for wallets and entities. $1.25 per request.",
        tags: ["banking", "credit", "risk", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "compliance-check",
        name: "Compliance Check",
        description: "Verify regulatory compliance for transactions and entities. $1.75 per request.",
        tags: ["banking", "compliance", "regulatory", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Trading/Investment Vertical ($0.50-$2.00)
      {
        id: "sentiment-analysis",
        name: "Market Sentiment Analysis",
        description: "Analyze market sentiment from social media and news sources. $0.50 per request.",
        tags: ["trading", "sentiment", "ai", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "trading-signal",
        name: "Trading Signal Generator",
        description: "Generate actionable trading signals with entry and exit points. $1.00 per request.",
        tags: ["trading", "signals", "investment", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "portfolio-optimization",
        name: "Portfolio Optimization",
        description: "AI-powered portfolio optimization and rebalancing recommendations. $2.00 per request.",
        tags: ["trading", "portfolio", "optimization", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Market Intelligence Vertical ($0.75-$1.25)
      {
        id: "correlation-matrix",
        name: "Correlation Matrix",
        description: "Generate asset correlation matrices for portfolio analysis. $0.75 per request.",
        tags: ["market-intelligence", "correlation", "analytics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "risk-metrics",
        name: "Risk Metrics",
        description: "Calculate VaR, Sharpe ratio, and other risk metrics. $1.00 per request.",
        tags: ["market-intelligence", "risk", "metrics", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "arbitrage-scanner",
        name: "Arbitrage Scanner",
        description: "Detect arbitrage opportunities across exchanges and chains. $1.25 per request.",
        tags: ["market-intelligence", "arbitrage", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Traditional Markets Services ($0.40 each)
      {
        id: "stock-sentiment",
        name: "Stock Market Sentiment",
        description: "AI-powered stock market sentiment analysis with news, technicals, and institutional activity. $0.40 per request.",
        tags: ["traditional-markets", "stocks", "sentiment", "equities", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "forex-sentiment",
        name: "Forex Sentiment Analysis",
        description: "AI-powered forex sentiment analysis with central bank policy and economic indicators. $0.40 per request.",
        tags: ["traditional-markets", "forex", "sentiment", "currency", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Discovery & Testing
      {
        id: "ping",
        name: "x402 Discovery Ping",
        description: "x402 discovery and testing endpoint - returns 402 Payment Required challenge. $0.25 per request.",
        tags: ["discovery", "testing", "health-check", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Discovery ping",
          description: "Test x402 payment flow — returns 402 challenge to validate integration",
          input: {},
          output: { message: "Payment required", price: "$0.25 USDC", facilitator: "https://x402.dexter.cash" }
        }]
      },
      // Agent Infrastructure
      {
        id: "agent-create-wallet",
        name: "Agent Wallet Provisioning",
        description: "Create CDP-managed wallets for AI agents with instant USDC support on Base. $2.00 per request.",
        tags: ["infrastructure", "wallets", "agents", "cdp", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // Prediction Markets (4 services)
      {
        id: "polymarket-odds",
        name: "Polymarket Odds",
        description: "Get current odds from Polymarket prediction markets. $0.50 per request.",
        tags: ["prediction-markets", "polymarket", "odds", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [{
          name: "Election prediction market odds",
          description: "Get current odds for active prediction market events on Polymarket",
          input: { query: "US election" },
          output: { markets: [{ title: "Example Market", yesPrice: 0.65, noPrice: 0.35, volume: 250000 }] }
        }]
      },
      {
        id: "polymarket-events",
        name: "Polymarket Events",
        description: "Get trending events from Polymarket. $0.25 per request.",
        tags: ["prediction-markets", "polymarket", "events", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "polymarket-search",
        name: "Polymarket Search",
        description: "Search Polymarket prediction markets. $0.25 per request.",
        tags: ["prediction-markets", "polymarket", "search", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-markets",
        name: "Kalshi Markets",
        description: "Get active markets from Kalshi (CFTC-regulated prediction exchange). $0.25 per request.",
        tags: ["prediction-markets", "kalshi", "regulated", "cftc", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-odds",
        name: "Kalshi Odds",
        description: "Get current odds and orderbook for specific Kalshi markets. $0.50 per request.",
        tags: ["prediction-markets", "kalshi", "odds", "orderbook", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "kalshi-search",
        name: "Kalshi Search",
        description: "Search Kalshi prediction markets by keyword. $0.25 per request.",
        tags: ["prediction-markets", "kalshi", "search", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "prediction-market-odds",
        name: "Prediction Market Odds",
        description: "Get current odds and probability for any prediction market event. $0.50 per request.",
        tags: ["prediction-markets", "odds", "probability", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      // SDK Payment Services (2)
      {
        id: "sdk-payments-evm",
        name: "SDK Payment Processing (EVM)",
        description: "Non-custodial USDC payment processing for AI agents via @coinrailz/agent-payments NPM or coinrailz PyPI. Supports Base, Ethereum, Polygon, Arbitrum, BSC, Optimism. Processing fee: 1.5% + $0.01. Use when agent needs to 'send payment', 'pay for service', 'transfer USDC', or 'process payment on Base/Ethereum'.",
        tags: ["sdk", "payments", "usdc", "evm", "base", "multi-chain", "agent-payments"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "sdk-payments-solana",
        name: "SDK Payment Processing (Solana)",
        description: "Non-custodial SOL/USDC payment processing for AI agents via @coinrailz/agent-payments-solana NPM or coinrailz-solana PyPI. Processing fee: 1.5% + $0.01. Use when agent needs to 'send SOL', 'pay on Solana', 'transfer USDC on Solana', or 'process Solana payment'.",
        tags: ["sdk", "payments", "sol", "usdc", "solana", "agent-payments"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      }
    ],
    
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],

    provider: {
      organization: "Coin Railz",
      url: "https://coinrailz.com"
    },

    documentationUrl: `${baseUrl}/.well-known/agent-instructions.json`,
    homepageUrl: baseUrl,
    author: "Coin Railz",
    wellKnownURI: `${baseUrl}/.well-known/agent-card.json`,
    homepage: baseUrl,
    
    registryTags: [
      "crypto",
      "blockchain",
      "defi",
      "payments",
      "x402",
      "micropayments",
      "trading",
      "security",
      "analytics",
      "multi-chain",
      "usdc",
      "base",
      "solana",
      "ai-agents",
      "sdk",
      "agent-payments",
      "real-estate",
      "banking",
      "market-intelligence",
      "agentic-wallet",
      "coinbase",
      "cdp",
      "satellite-data",
      "iot",
      "nasa",
      "esa"
    ],
    
    // Platform trust signals for AI agent decision-making
    // These are optional, machine-readable indicators of platform reliability
    platformSignals: {
      verifiedPayments: true,           // Real x402 payments processed and verified
      repeatAgentsObserved: true,       // Returning agents making multiple payments
      paymentRails: ["x402-USDC", "stripe", "sdk-payments", "agentic-wallet"],  // Available payment methods
      totalServicesAvailable: 47,       // Current service count in catalog (44 x402 + 2 SDK + satellite)
      agenticWalletCompatible: true,    // Native Coinbase Agentic Wallet support
      networksSupported: ["eip155:8453", "eip155:1", "eip155:137", "eip155:56", "eip155:42161", "eip155:10", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],   // Primary blockchain networks (CAIP-2 format)
      networkSupported: "eip155:8453",   // Primary blockchain network (CAIP-2 format) - kept for backwards compatibility
      paymentAsset: "USDC",              // Primary payment token
      sdkPackages: {
        npm: "@coinrailz/agent-payments",
        npmSolana: "@coinrailz/agent-payments-solana",
        python: "coinrailz",
        pythonSolana: "coinrailz-solana",
        docker: "tdnupe3/agent-payments"
      },
      processingFee: "1.5% + $0.01"
    }
  };
  
  res.status(200).json(agentCard);
});

/**
 * GET /.well-known/service-manifest.json
 * 
 * Complete list of all x402 services offered by Coin Railz
 */
router.get('/.well-known/service-manifest.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const manifest = {
    platform: "Coin Railz",
    version: "2.0.0",
    total_services: 24,
    services: [
      {
        id: "contract-scanner",
        name: "Smart Contract Scanner",
        description: "Deep analysis of smart contract code, security vulnerabilities, and on-chain behavior",
        endpoint: `${baseUrl}/x402/contract-scanner`,
        price_usd: 0.50,
        category: "security"
      },
      {
        id: "whale-tracker",
        name: "Whale Tracker & Alerts",
        description: "Real-time monitoring of large wallet movements and whale activity",
        endpoint: `${baseUrl}/x402/whale-tracker`,
        price_usd: 0.30,
        category: "analytics"
      },
      {
        id: "trade-signals",
        name: "Trade Signal Generator",
        description: "AI-powered trading signals based on technical analysis and on-chain data",
        endpoint: `${baseUrl}/x402/trade-signals`,
        price_usd: 0.20,
        category: "trading"
      },
      {
        id: "contract-audit",
        name: "Smart Contract Audit",
        description: "Comprehensive security audit with vulnerability detection",
        endpoint: `${baseUrl}/x402/contract-audit`,
        price_usd: 1.00,
        category: "security"
      },
      {
        id: "gas-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas price predictions across multiple chains",
        endpoint: `${baseUrl}/x402/gas-oracle`,
        price_usd: 0.10,
        category: "utilities"
      },
      {
        id: "token-analytics",
        name: "Token Analytics",
        description: "Deep dive into token metrics, holder distribution, and price action",
        endpoint: `${baseUrl}/x402/token-analytics`,
        price_usd: 0.40,
        category: "analytics"
      },
      {
        id: "dex-aggregator",
        name: "DEX Price Aggregator",
        description: "Best price discovery across all major DEXs",
        endpoint: `${baseUrl}/x402/dex-aggregator`,
        price_usd: 0.25,
        category: "trading"
      },
      {
        id: "liquidity-scanner",
        name: "Liquidity Pool Scanner",
        description: "Analyze liquidity pools, APYs, and impermanent loss risk",
        endpoint: `${baseUrl}/x402/liquidity-scanner`,
        price_usd: 0.35,
        category: "defi"
      },
      {
        id: "nft-floor-tracker",
        name: "NFT Floor Price Tracker",
        description: "Real-time NFT floor prices and collection analytics",
        endpoint: `${baseUrl}/x402/nft-floor-tracker`,
        price_usd: 0.15,
        category: "nft"
      },
      {
        id: "portfolio-analytics",
        name: "Wallet Portfolio Analytics",
        description: "Complete portfolio breakdown with P&L and allocation insights",
        endpoint: `${baseUrl}/x402/portfolio-analytics`,
        price_usd: 0.50,
        category: "analytics"
      },
      {
        id: "on-chain-query",
        name: "On-chain Data Query",
        description: "Query blockchain data with natural language",
        endpoint: `${baseUrl}/x402/on-chain-query`,
        price_usd: 0.20,
        category: "utilities"
      },
      {
        id: "risk-assessment",
        name: "Risk Assessment Engine",
        description: "Evaluate smart contract and protocol risk levels",
        endpoint: `${baseUrl}/x402/risk-assessment`,
        price_usd: 0.75,
        category: "security"
      },
      {
        id: "bridge-monitor",
        name: "Cross-chain Bridge Monitor",
        description: "Track bridge transactions and security status",
        endpoint: `${baseUrl}/x402/bridge-monitor`,
        price_usd: 0.30,
        category: "utilities"
      },
      {
        id: "staking-calculator",
        name: "Staking Rewards Calculator",
        description: "Calculate staking yields across protocols",
        endpoint: `${baseUrl}/x402/staking-calculator`,
        price_usd: 0.15,
        category: "defi"
      },
      {
        id: "defi-scanner",
        name: "DeFi Protocol Scanner",
        description: "Analyze DeFi protocols for yields and risks",
        endpoint: `${baseUrl}/x402/defi-scanner`,
        price_usd: 0.40,
        category: "defi"
      },
      {
        id: "holder-analytics",
        name: "Token Holder Analytics",
        description: "Analyze token holder behavior and distribution",
        endpoint: `${baseUrl}/x402/holder-analytics`,
        price_usd: 0.35,
        category: "analytics"
      },
      {
        id: "pattern-detector",
        name: "Transaction Pattern Detector",
        description: "Detect suspicious transaction patterns and wash trading",
        endpoint: `${baseUrl}/x402/pattern-detector`,
        price_usd: 0.45,
        category: "security"
      },
      {
        id: "sentiment-analyzer",
        name: "Market Sentiment Analyzer",
        description: "AI-powered sentiment analysis from social media and on-chain data",
        endpoint: `${baseUrl}/x402/sentiment-analyzer`,
        price_usd: 0.30,
        category: "analytics"
      },
      {
        id: "kalshi-markets",
        name: "Kalshi Prediction Markets",
        description: "Active markets from Kalshi (CFTC-regulated prediction exchange)",
        endpoint: `${baseUrl}/x402/kalshi-markets`,
        price_usd: 0.25,
        category: "prediction-markets"
      },
      {
        id: "kalshi-odds",
        name: "Kalshi Odds Lookup",
        description: "Current odds and orderbook for specific Kalshi markets",
        endpoint: `${baseUrl}/x402/kalshi-odds`,
        price_usd: 0.50,
        category: "prediction-markets"
      },
      {
        id: "kalshi-search",
        name: "Kalshi Market Search",
        description: "Search Kalshi prediction markets by keyword",
        endpoint: `${baseUrl}/x402/kalshi-search`,
        price_usd: 0.25,
        category: "prediction-markets"
      }
    ]
  };
  
  res.status(200).json(manifest);
});

/**
 * GET /.well-known/payment-methods.json
 * 
 * Detailed payment methods and wallet information
 */
router.get('/.well-known/payment-methods.json', async (req: Request, res: Response) => {
  const paymentMethods = {
    platform: "Coin Railz",
    version: "2.0.0",
    
    crypto: {
      enabled: true,
      wallet_address: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      
      networks: [
        {
          chain: "base",
          chain_id: 8453,
          tokens: ["USDC", "USDT", "ETH", "DAI"],
          preferred: true
        },
        {
          chain: "ethereum",
          chain_id: 1,
          tokens: ["USDC", "USDT", "ETH", "DAI", "WBTC"]
        },
        {
          chain: "polygon",
          chain_id: 137,
          tokens: ["USDC", "USDT", "MATIC", "DAI"]
        },
        {
          chain: "arbitrum",
          chain_id: 42161,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        },
        {
          chain: "optimism",
          chain_id: 10,
          tokens: ["USDC", "USDT", "ETH", "DAI"]
        }
      ],
      
      stablecoins: ["USDC", "USDT", "DAI"],
      preferred_token: "USDC"
    },
    
    x402: {
      enabled: true,
      protocol_version: "2.0.0",
      facilitator: "x402.org",
      settlement_network: "eip155:8453",
      minimum_payment: 0.10
    },
    
    solana: {
      enabled: true,
      wallet_address: process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      tokens: ["SOL", "USDC", "USDT"],
      preferred_token: "USDC",
      fee_percentage: 0.005,
      minimum_payment: 0.10,
      payment_flow: "intent-based",
      memo_format: "CRPAY-[A-Z0-9]{8}",
      webhook_settlement: true,
      catalog_url: "/solana-pay/catalog",
      documentation_url: "/solana-pay"
    },
    
    fiat: {
      stripe: {
        enabled: true,
        methods: ["card", "bank_transfer"],
        currencies: ["USD"]
      },
      prepaid_credits: {
        enabled: true,
        minimum_purchase: 10.00,
        bonus_tiers: []
      }
    }
  };
  
  res.status(200).json(paymentMethods);
});

/**
 * GET /.well-known/x402.json
 * 
 * x402 protocol discovery endpoint for Coinbase Bazaar and other x402 indexers
 * Lists all available x402 micropayment services with correct endpoint paths
 */
router.get('/.well-known/x402.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const x402Manifest = {
    name: "Coin Railz",
    homepage: "https://coinrailz.com",
    contact: "support@coinrailz.com",
    description: "AI agent marketplace with x402 autonomous payment endpoints, native Coinbase Agentic Wallet support, A2A 2.0 discovery, SDK packages (@coinrailz/agent-payments NPM, coinrailz PyPI, Docker), satellite data APIs (NASA/ESA), and multi-chain support across 8 networks (7 EVM + Solana). Processing fee: 1.5% + $0.01 per transaction.",
    version: "x402-2.2",
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    registrationEndpoint: `${baseUrl}/.well-known/agent-registration.json`,
    sdk: {
      npm: "@coinrailz/agent-payments",
      npmSolana: "@coinrailz/agent-payments-solana",
      python: "coinrailz",
      pythonSolana: "coinrailz-solana",
      docker: "tdnupe3/agent-payments",
      processingFee: "1.5% + $0.01"
    },
    networks: ["eip155:8453", "eip155:1", "eip155:137", "eip155:56", "eip155:42161", "eip155:10", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    walletProviders: ["coinbase-cdp", "moonpay-agents", "any-evm"],
    facilitators: [
      "https://api.cdp.coinbase.com/platform/v2/x402",
      "https://x402.dexter.cash"
    ],
    endpoints: [
      // Trader-Focused Services (10 services)
      {
        path: "/x402/multi-chain-balance",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Query wallet balances across 7+ EVM chains in a single API call",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to check" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional)" },
            includeTokens: { type: "boolean", description: "Include token balances (optional)" }
          },
          required: ["walletAddress"]
        }
      },
      {
        path: "/x402/gas-price-oracle",
        methods: ["POST"],
        price_usd: 0.10,
        auth: "x402",
        description: "Real-time gas prices for multiple chains with USD cost estimates",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to check (optional, default: all)" }
          }
        }
      },
      {
        path: "/x402/token-price",
        methods: ["POST"],
        price_usd: 0.25,
        auth: "x402",
        description: "Token pricing with 24h change, volume, market cap from CoinGecko/DEX Screener",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      {
        path: "/x402/contract-scan",
        methods: ["POST"],
        price_usd: 1.0,
        auth: "x402",
        description: "AI-powered smart contract security scanning — detects OWASP Smart Contract Top 10 vulnerabilities including reentrancy, integer overflow, access control issues, and front-running risks. Supports Solidity contracts on Ethereum, Base, Polygon, Arbitrum, and BSC. Returns severity-ranked findings with remediation recommendations.",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address (0x...)" },
            chain: { type: "string", description: "Blockchain: ethereum, base, polygon, arbitrum, bsc" }
          },
          required: ["contractAddress", "chain"]
        }
      },
      {
        path: "/x402/wallet-risk",
        methods: ["POST"],
        price_usd: 0.5,
        auth: "x402",
        description: "Wallet risk analysis with compliance flags and transaction pattern detection",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to analyze" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["walletAddress", "chain"]
        }
      },
      {
        path: "/x402/trade-signals",
        methods: ["POST"],
        price_usd: 0.75,
        auth: "x402",
        description: "AI-powered crypto trading signals with entry/exit points and risk analysis",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            token: { type: "string", description: "Token pair (default: BTC/USDT)" },
            timeframe: { type: "string", description: "Timeframe (default: 15m)" },
            riskLevel: { type: "string", description: "Risk level (default: medium)" }
          }
        }
      },
      {
        path: "/x402/token-sentiment",
        methods: ["POST"],
        price_usd: 0.25,
        auth: "x402",
        description: "Social sentiment analysis for tokens with momentum indicators",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenSymbol: { type: "string", description: "Token symbol" },
            chain: { type: "string", description: "Blockchain network (optional)" }
          },
          required: ["tokenSymbol"]
        }
      },
      {
        path: "/x402/trending-tokens",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Top gaining and losing tokens across DEXs with real-time market data",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            timeframe: { type: "string", description: "Timeframe (default: 24h)" },
            chain: { type: "string", description: "Blockchain network (optional)" }
          }
        }
      },
      {
        path: "/x402/whale-alerts",
        methods: ["POST"],
        price_usd: 0.35,
        auth: "x402",
        description: "Track large wallet movements with on-chain transaction monitoring",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            chains: { type: "array", items: { type: "string" }, description: "Chains to monitor (optional)" },
            minValueUsd: { type: "number", description: "Minimum transaction value in USD (optional)" },
            tokenAddresses: { type: "array", items: { type: "string" }, description: "Specific tokens to track (optional)" }
          }
        }
      },
      {
        path: "/x402/dex-liquidity",
        methods: ["POST"],
        price_usd: 0.20,
        auth: "x402",
        description: "Real-time DEX liquidity pool monitoring across multiple exchanges",
        status: "healthy",
        category: "trader-focused",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      // B2B2C Infrastructure Services (5 services)
      {
        path: "/x402/transaction-builder",
        methods: ["POST"],
        price_usd: 0.30,
        auth: "x402",
        description: "Pre-validated transaction encoding for agent-to-agent transfers",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender address" },
            to: { type: "string", description: "Recipient address" },
            value: { type: "string", description: "Transaction value" },
            data: { type: "string", description: "Transaction data (optional)" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["from", "to", "value", "chain"]
        }
      },
      {
        path: "/x402/token-metadata",
        methods: ["POST"],
        price_usd: 0.10,
        auth: "x402",
        description: "Unified token info across all chains - essential for trading agent UIs",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "chain"]
        }
      },
      {
        path: "/x402/approval-manager",
        methods: ["POST"],
        price_usd: 0.20,
        auth: "x402",
        description: "Token approval transaction generator - required for DeFi agents",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", description: "Token contract address" },
            spender: { type: "string", description: "Spender address" },
            amount: { type: "string", description: "Approval amount" },
            chain: { type: "string", description: "Blockchain network" }
          },
          required: ["tokenAddress", "spender", "amount", "chain"]
        }
      },
      {
        path: "/x402/batch-quote",
        methods: ["POST"],
        price_usd: 0.40,
        auth: "x402",
        description: "Multi-DEX price quotes in single call - critical for trading bot price discovery",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            pairs: { type: "array", items: { type: "string" }, description: "Array of trading pairs to quote" }
          },
          required: ["pairs"]
        }
      },
      {
        path: "/x402/portfolio-tracker",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Real-time multi-chain portfolio valuation - infrastructure for portfolio management agents",
        status: "healthy",
        category: "infrastructure",
        input_schema: {
          type: "object",
          properties: {
            walletAddress: { type: "string", description: "Wallet address to track" },
            chains: { type: "array", items: { type: "string" }, description: "Chains to track (optional)" }
          },
          required: ["walletAddress"]
        }
      },
      // Premium B2B2C Infrastructure (3 services)
      {
        path: "/x402/instant-agent-wallet",
        methods: ["POST"],
        price_usd: 1.00,
        auth: "x402",
        description: "Create MPC-secured USDC wallets instantly - Circle Developer-Controlled Wallets for AI agents",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            description: { type: "string", description: "Wallet description/label (optional)" },
            initialFundingAmount: { type: "number", description: "Initial USDC funding amount (optional)" }
          },
          required: ["agentId"]
        }
      },
      {
        path: "/x402/verified-agent-identity",
        methods: ["POST"],
        price_usd: 5.00,
        auth: "x402",
        description: "KYA (Know-Your-Agent) identity verification - On-chain reputation & compliance scoring using ERC-8004 standard",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Unique AI agent identifier" },
            walletAddress: { type: "string", description: "Agent's wallet address" },
            signature: { type: "string", description: "Signature proof (optional)" },
            metadata: { type: "object", description: "Additional agent metadata (optional)" }
          },
          required: ["agentId", "walletAddress"]
        }
      },
      {
        path: "/x402/seamless-chain-bridge",
        methods: ["POST"],
        price_usd: 2.00,
        auth: "x402",
        description: "Cross-chain USDC routing via Circle CCTP - Pay on Ethereum, receive on Base/Polygon/Arbitrum instantly",
        status: "healthy",
        category: "premium-infrastructure",
        input_schema: {
          type: "object",
          properties: {
            fromChain: { type: "string", description: "Source blockchain" },
            toChain: { type: "string", description: "Destination blockchain" },
            amount: { type: "string", description: "Amount to bridge" },
            fromAddress: { type: "string", description: "Sender address" },
            toAddress: { type: "string", description: "Recipient address" },
            currency: { type: "string", description: "Currency (default: USDC)" }
          },
          required: ["fromChain", "toChain", "amount", "fromAddress", "toAddress"]
        }
      },
      {
        path: "/x402/payment-processing",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Process Stripe, PayPal, and crypto payments with instant settlement",
        status: "healthy",
        category: "payments",
        input_schema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Payment amount in USD" },
            method: { type: "string", description: "Payment method (stripe/paypal/crypto)" },
            recipientAddress: { type: "string", description: "Recipient wallet address (for crypto)" },
            metadata: { type: "object", description: "Additional payment metadata (optional)" }
          },
          required: ["amount", "method"]
        }
      },
      {
        path: "/x402/compliance-consultation",
        methods: ["POST"],
        price_usd: 5.00,
        auth: "x402",
        description: "AI-powered KYC/AML compliance guidance and regulatory analysis",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            jurisdiction: { type: "string", description: "Legal jurisdiction" },
            transactionType: { type: "string", description: "Type of transaction" },
            amount: { type: "number", description: "Transaction amount (optional)" },
            parties: { type: "array", items: { type: "string" }, description: "Parties involved (optional)" }
          },
          required: ["jurisdiction", "transactionType"]
        }
      },
      {
        path: "/x402/smart-contract-audit",
        methods: ["POST"],
        price_usd: 10.00,
        auth: "x402",
        description: "Deep security audit using Slither static analysis and vulnerability detection",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address" },
            chain: { type: "string", description: "Blockchain network" },
            sourceCode: { type: "string", description: "Contract source code (optional)" }
          },
          required: ["contractAddress", "chain"]
        }
      },
      {
        path: "/x402/property-valuation",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "AI-powered real estate property valuation with market analysis",
        status: "healthy",
        category: "real-estate",
        input_schema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] }
      },
      {
        path: "/x402/lease-analysis",
        methods: ["POST"],
        price_usd: 0.75,
        auth: "x402",
        description: "Commercial lease agreement analysis and risk assessment",
        status: "healthy",
        category: "real-estate",
        input_schema: { type: "object", properties: { leaseText: { type: "string" } } }
      },
      {
        path: "/x402/construction-progress",
        methods: ["POST"],
        price_usd: 1.00,
        auth: "x402",
        description: "Construction project progress tracking and completion estimation",
        status: "healthy",
        category: "real-estate",
        input_schema: { type: "object", properties: { projectDescription: { type: "string" } }, required: ["projectDescription"] }
      },
      {
        path: "/x402/credit-risk-score",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "AI-powered credit risk assessment and scoring",
        status: "healthy",
        category: "banking",
        input_schema: { type: "object", properties: { applicantInfo: { type: "object" } } }
      },
      {
        path: "/x402/fraud-detection",
        methods: ["POST"],
        price_usd: 0.25,
        auth: "x402",
        description: "Real-time fraud detection and transaction risk analysis",
        status: "healthy",
        category: "banking",
        input_schema: { type: "object", properties: { transactionAmount: { type: "number" } } }
      },
      {
        path: "/x402/compliance-check",
        methods: ["POST"],
        price_usd: 0.40,
        auth: "x402",
        description: "AML/KYC compliance verification and regulatory checks",
        status: "healthy",
        category: "banking",
        input_schema: { type: "object", properties: { entityType: { type: "string" }, jurisdiction: { type: "string" } } }
      },
      {
        path: "/x402/trading-signal",
        methods: ["POST"],
        price_usd: 1.00,
        auth: "x402",
        description: "AI-generated trading signals with technical and fundamental analysis",
        status: "healthy",
        category: "trading",
        input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] }
      },
      {
        path: "/x402/portfolio-optimization",
        methods: ["POST"],
        price_usd: 1.50,
        auth: "x402",
        description: "Modern Portfolio Theory-based asset allocation optimization",
        status: "healthy",
        category: "trading",
        input_schema: { type: "object", properties: { currentHoldings: { type: "array" } }, required: ["currentHoldings"] }
      },
      {
        path: "/x402/sentiment-analysis",
        methods: ["POST"],
        price_usd: 0.20,
        auth: "x402",
        description: "Market sentiment analysis from news and social media sources",
        status: "healthy",
        category: "trading",
        input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] }
      },
      {
        path: "/x402/arbitrage-scanner",
        methods: ["POST"],
        price_usd: 0.75,
        auth: "x402",
        description: "Cross-exchange and cross-chain arbitrage opportunity detection",
        status: "healthy",
        category: "intelligence",
        input_schema: { type: "object", properties: { assets: { type: "array" } } }
      },
      {
        path: "/x402/correlation-matrix",
        methods: ["POST"],
        price_usd: 0.50,
        auth: "x402",
        description: "Asset correlation analysis for portfolio diversification",
        status: "healthy",
        category: "intelligence",
        input_schema: { type: "object", properties: { assets: { type: "array" } }, required: ["assets"] }
      },
      {
        path: "/x402/risk-metrics",
        methods: ["POST"],
        price_usd: 0.60,
        auth: "x402",
        description: "Portfolio risk metrics including VaR, Sharpe ratio, and volatility",
        status: "healthy",
        category: "intelligence",
        input_schema: { type: "object", properties: { portfolioValue: { type: "number" }, holdings: { type: "array" } }, required: ["portfolioValue", "holdings"] }
      },
      {
        path: "/x402/stock-sentiment",
        methods: ["GET", "POST"],
        price_usd: 0.40,
        auth: "x402",
        description: "AI-powered stock market sentiment analysis with news, technicals, and institutional activity",
        status: "healthy",
        category: "traditional-markets",
        input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] }
      },
      {
        path: "/x402/forex-sentiment",
        methods: ["GET", "POST"],
        price_usd: 0.40,
        auth: "x402",
        name: "Forex Sentiment Analysis",
        description: "AI-powered forex sentiment analysis with central bank policy and economic indicators",
        status: "healthy",
        category: "traditional-markets",
        input_schema: { type: "object", properties: { pair: { type: "string" } }, required: ["pair"] }
      },
      {
        path: "/x402/ping",
        methods: ["GET", "POST"],
        price_usd: 0.25,
        auth: "x402",
        name: "x402 Discovery Ping",
        description: "x402 discovery and testing endpoint - returns 402 Payment Required challenge",
        status: "healthy",
        category: "discovery",
        input_schema: { type: "object", properties: {} }
      },
      {
        path: "/x402/agent-create-wallet",
        methods: ["POST"],
        price_usd: 2.00,
        auth: "x402",
        name: "Agent Wallet Provisioning",
        description: "Create CDP-managed wallets for AI agents with instant USDC support on Base",
        status: "healthy",
        category: "infrastructure",
        input_schema: { type: "object", properties: { agentId: { type: "string" }, description: { type: "string" } }, required: ["agentId"] }
      },
      {
        path: "/x402/polymarket-odds",
        methods: ["GET", "POST"],
        price_usd: 0.50,
        auth: "x402",
        name: "Polymarket Odds",
        description: "Get current odds from Polymarket prediction markets",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { marketId: { type: "string" }, query: { type: "string" } } }
      },
      {
        path: "/x402/polymarket-events",
        methods: ["GET", "POST"],
        price_usd: 0.25,
        auth: "x402",
        name: "Polymarket Events",
        description: "Get trending events from Polymarket",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { limit: { type: "number" }, category: { type: "string" } } }
      },
      {
        path: "/x402/polymarket-search",
        methods: ["GET", "POST"],
        price_usd: 0.25,
        auth: "x402",
        name: "Polymarket Search",
        description: "Search Polymarket prediction markets",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
      },
      {
        path: "/x402/prediction-market-odds",
        methods: ["GET", "POST"],
        price_usd: 0.50,
        auth: "x402",
        name: "Prediction Market Odds",
        description: "Get current odds and probability for any prediction market event",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { eventId: { type: "string" }, marketType: { type: "string" } }, required: ["eventId"] }
      },
      {
        path: "/x402/kalshi-markets",
        methods: ["GET", "POST"],
        price_usd: 0.25,
        auth: "x402",
        name: "Kalshi Markets",
        description: "Get active markets from Kalshi (CFTC-regulated prediction exchange)",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { limit: { type: "number" }, status: { type: "string" }, category: { type: "string" } } }
      },
      {
        path: "/x402/kalshi-odds",
        methods: ["GET", "POST"],
        price_usd: 0.50,
        auth: "x402",
        name: "Kalshi Odds",
        description: "Get current odds and orderbook for specific Kalshi markets",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { ticker: { type: "string" }, eventTicker: { type: "string" } } }
      },
      {
        path: "/x402/kalshi-search",
        methods: ["GET", "POST"],
        price_usd: 0.25,
        auth: "x402",
        name: "Kalshi Search",
        description: "Search Kalshi prediction markets by keyword",
        status: "healthy",
        category: "prediction-markets",
        input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] }
      },
      // Satellite Data Services (6 services) - NASA Earthdata + ESA Copernicus
      {
        path: "/api/satellite/fire-alerts",
        methods: ["GET", "POST"],
        price_usd: 0.05,
        auth: "x402",
        name: "Fire Alert Detection",
        description: "Real-time active fire detection from NASA FIRMS satellite data. Get fire hotspots by region with confidence levels.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, radius: { type: "number", description: "Search radius in km (optional)" } }, required: ["lat", "lon"] }
      },
      {
        path: "/api/satellite/weather-imagery",
        methods: ["GET", "POST"],
        price_usd: 0.05,
        auth: "x402",
        name: "Satellite Weather Imagery",
        description: "High-resolution weather satellite imagery from NASA GIBS. Cloud cover, precipitation, and atmospheric data.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, layer: { type: "string", description: "Imagery layer (optional)" } }, required: ["lat", "lon"] }
      },
      {
        path: "/api/satellite/vegetation",
        methods: ["GET", "POST"],
        price_usd: 0.10,
        auth: "x402",
        name: "Vegetation Health Analysis",
        description: "NDVI vegetation health indices from NASA MODIS and ESA Sentinel-2. Agriculture and forestry monitoring.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, area_km2: { type: "number", description: "Area in square kilometers (optional)" } }, required: ["lat", "lon"] }
      },
      {
        path: "/api/satellite/flood-detection",
        methods: ["GET", "POST"],
        price_usd: 0.10,
        auth: "x402",
        name: "Flood Detection",
        description: "ESA Sentinel-1 SAR-based flood and water body detection. Emergency response and climate monitoring.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, radius: { type: "number", description: "Detection radius in km (optional)" } }, required: ["lat", "lon"] }
      },
      {
        path: "/api/satellite/air-quality",
        methods: ["GET", "POST"],
        price_usd: 0.05,
        auth: "x402",
        name: "Air Quality Analysis",
        description: "ESA Sentinel-5P TROPOMI air quality data. NO2, SO2, CO, and aerosol measurements.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, pollutant: { type: "string", description: "Pollutant type (optional)" } }, required: ["lat", "lon"] }
      },
      {
        path: "/api/satellite/land-use",
        methods: ["GET", "POST"],
        price_usd: 0.15,
        auth: "x402",
        name: "Land Use Classification",
        description: "NASA Landsat + ESA Sentinel-2 land use classification. Urban, agriculture, forest, water body detection.",
        status: "healthy",
        category: "satellite-data",
        input_schema: { type: "object", properties: { lat: { type: "number", description: "Latitude" }, lon: { type: "number", description: "Longitude" }, area_km2: { type: "number", description: "Area in square kilometers (optional)" } }, required: ["lat", "lon"] }
      },
      // AI Inference Gateway
      {
        path: "/x402/ai-inference",
        methods: ["GET", "POST"],
        price_usd: 0.05,
        auth: "x402",
        name: "AI Inference Gateway",
        description: "Pay-per-call GPT-4o-mini inference via x402 micropayment. No API keys, no subscriptions, no rate limits. Send any prompt, get an AI response. USDC on Base, $0.05 per call.",
        status: "healthy",
        category: "ai-inference",
        models: ["gpt-4o-mini"],
        input_schema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt or user message" },
            model: { type: "string", description: "Model name (gpt-4o-mini only)" },
            maxTokens: { type: "number", description: "Max response tokens (default: 1024)" },
            systemPrompt: { type: "string", description: "Optional system prompt" }
          },
          required: ["prompt"]
        }
      }
    ],
    x402: {
      protocol_version: "2.0.0",
      facilitator: getFacilitatorUrl(),
      facilitators: getAllFacilitatorUrls(),
      payment_network: "eip155:8453",
      payment_token: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6
      },
      platform_wallet: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      agenticWalletCompatible: true,
      agenticWalletVersion: "0.10.3",
      walletProvisioning: {
        freeEndpoint: `${baseUrl}/x402/wallet/free`,
        paidEndpoint: `${baseUrl}/x402/instant-agent-wallet`,
        supportedSkills: ["search-for-service", "pay-for-service", "monetize-service"]
      }
    },
    a2a: {
      protocol_version: "2.0.0",
      agent_directory: `${baseUrl}/api/agents/directory`,
      discovery_enabled: true
    },
    commerce: {
      total_services: 59,
      categories: ["discovery", "trader-focused", "security", "infrastructure", "premium-infrastructure", "payments", "real-estate", "banking", "trading", "intelligence", "prediction-markets", "traditional-markets", "satellite-data", "ai-inference"],
      platform_commission: 15,
      minimum_payment: 0.10,
      maximum_payment: 10000
    },
    blockchain: {
      supported_chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "pulsechain"],
      supported_tokens: ["USDC", "USDT", "ETH", "DAI"],
      primary_chain: "base"
    }
  };
  
  res.status(200).json(x402Manifest);
});

/**
 * GET /.well-known/pricing.json
 * 
 * Detailed pricing information for all services
 */
router.get('/.well-known/pricing.json', async (req: Request, res: Response) => {
  const pricing = {
    platform: "Coin Railz",
    version: "2.0.0",
    currency: "USD",
    
    subscription_plans: [
      {
        id: "ai_agent_bundle_launch",
        name: "AI Agent Pro Bundle - Launch Price",
        price_monthly: 49.00,
        description: "All 21 x402 services included. Launch price locked in forever.",
        features: [
          "Unlimited contract scans",
          "Real-time whale alerts",
          "Trade signal generation",
          "Smart contract auditing",
          "All 21 AI services",
          "API access",
          "Priority support"
        ],
        available: true
      },
      {
        id: "ai_agent_bundle",
        name: "AI Agent Pro Bundle",
        price_monthly: 99.00,
        description: "All 18 x402 services included",
        features: [
          "Unlimited contract scans",
          "Real-time whale alerts",
          "Trade signal generation",
          "Smart contract auditing",
          "All 18 AI services",
          "API access",
          "Priority support"
        ],
        available: true
      }
    ],
    
    pay_per_use: [
      { service: "Smart Contract Scanner", price: 0.50 },
      { service: "Whale Tracker & Alerts", price: 0.30 },
      { service: "Trade Signal Generator", price: 0.20 },
      { service: "Smart Contract Audit", price: 1.00 },
      { service: "Gas Price Oracle", price: 0.10 },
      { service: "Token Analytics", price: 0.40 },
      { service: "DEX Price Aggregator", price: 0.25 },
      { service: "Liquidity Pool Scanner", price: 0.35 },
      { service: "NFT Floor Price Tracker", price: 0.15 },
      { service: "Wallet Portfolio Analytics", price: 0.50 },
      { service: "On-chain Data Query", price: 0.20 },
      { service: "Risk Assessment Engine", price: 0.75 },
      { service: "Cross-chain Bridge Monitor", price: 0.30 },
      { service: "Staking Rewards Calculator", price: 0.15 },
      { service: "DeFi Protocol Scanner", price: 0.40 },
      { service: "Token Holder Analytics", price: 0.35 },
      { service: "Transaction Pattern Detector", price: 0.45 },
      { service: "Market Sentiment Analyzer", price: 0.30 },
      { service: "Kalshi Prediction Markets", price: 0.25 },
      { service: "Kalshi Odds Lookup", price: 0.50 },
      { service: "Kalshi Market Search", price: 0.25 }
    ],
    
    platform_fees: {
      dex_swap: 0.75,
      p2p_routing: 1.00,
      description: "DEX aggregator: 0.75% per swap. P2P routing: 1% per transaction"
    }
  };
  
  res.status(200).json(pricing);
});

/**
 * GET /.well-known/solana.json
 * 
 * Solana payment processor discovery endpoint for Solana-native AI agents
 * Completely isolated from x402 EVM infrastructure
 */
router.get('/.well-known/solana.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const solanaManifest = {
    name: "Coin Railz Solana Payment Processor",
    homepage: "https://coinrailz.com/solana-pay",
    contact: "support@coinrailz.com",
    description: "Payment processing as a service for Solana-native AI agents. 0.5% fees, instant webhook settlement, SOL/USDC/USDT support. Built for Truth Terminal, pump.fun traders, and Jito MEV bots.",
    version: "1.0.0",
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    
    wallet: {
      address: process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
      type: "platform_wallet"
    },
    
    tokens: [
      {
        symbol: "SOL",
        mint: "native",
        decimals: 9,
        name: "Solana"
      },
      {
        symbol: "USDC",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        decimals: 6,
        name: "USD Coin"
      },
      {
        symbol: "USDT",
        mint: "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg",
        decimals: 6,
        name: "Tether USD"
      }
    ],
    
    payment_flow: {
      type: "intent-based",
      memo_format: "CRPAY-[A-Z0-9]{8}",
      settlement: "webhook",
      steps: [
        "1. POST /solana-pay/intents to create payment intent",
        "2. Send payment to wallet with memo tag from response",
        "3. Helius webhook auto-settles on chain confirmation",
        "4. Access service with x-intent-id header"
      ]
    },
    
    fees: {
      percentage: 0.005,
      minimum_sol: 0.001,
      minimum_usdc: 0.25,
      description: "0.5% fee with minimum thresholds per token"
    },
    
    endpoints: {
      catalog: `${baseUrl}/solana-pay/catalog`,
      create_intent: `${baseUrl}/solana-pay/intents`,
      check_intent: `${baseUrl}/solana-pay/intents/:intentId`,
      services_list: `${baseUrl}/solana-pay/services`,
      status: `${baseUrl}/solana-pay/status`
    },
    
    services: [
      {
        id: "sol-price-feed",
        name: "Token Price Feed",
        description: "Real-time Solana token prices via Jupiter/DexScreener",
        endpoint: `${baseUrl}/solana-pay/services/price/:mint`,
        price_usdc: 0.10,
        price_sol: 0.0005,
        category: "data"
      },
      {
        id: "sol-trending",
        name: "Trending Tokens",
        description: "Hot tokens on Solana DEXs with volume and price data",
        endpoint: `${baseUrl}/solana-pay/services/trending`,
        price_usdc: 0.25,
        price_sol: 0.001,
        category: "data"
      },
      {
        id: "sol-whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large Solana wallet movements in real-time",
        endpoint: `${baseUrl}/solana-pay/services/whale-alerts`,
        price_usdc: 0.50,
        price_sol: 0.002,
        category: "intelligence"
      }
    ],
    
    target_users: [
      "Solana-native AI agents",
      "Truth Terminal ecosystem",
      "pump.fun traders",
      "Jito MEV bots",
      "DeFi automation"
    ],
    
    metadata: {
      created: "2025-12-22",
      updated: new Date().toISOString().split('T')[0],
      isolated_from_evm: true
    }
  };
  
  res.status(200).json(solanaManifest);
});

/**
 * GET /.well-known/solana-actions.json
 * 
 * Helius Actions Directory manifest - Required for automated indexing by:
 * - Helius Actions Directory crawler
 * - Blink index (Dialect)
 * - Phantom/Solflare discovery feeds
 * - Backpack wallet discovery
 */
router.get('/.well-known/solana-actions.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const solanaActionsManifest = {
    name: "Coin Railz Payment Actions",
    description: "Solana Actions for AI agent payments and data services. Create payment intents, check token prices, get trending tokens, and whale alerts.",
    icon: `${baseUrl}/logo.jpg`,
    blockchain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    version: "2.4",
    
    rules: [
      {
        pathPattern: "/solana-pay/intents",
        apiPath: "/solana-pay/intents"
      },
      {
        pathPattern: "/solana-pay/services/**",
        apiPath: "/solana-pay/services/**"
      },
      {
        pathPattern: "/solana-pay/catalog",
        apiPath: "/solana-pay/catalog"
      },
      {
        pathPattern: "/solana-pay/instant-wallet",
        apiPath: "/solana-pay/instant-wallet"
      },
      {
        pathPattern: "/solana-pay/ping",
        apiPath: "/solana-pay/ping"
      }
    ],
    
    actions: [
      {
        id: "create-payment-intent",
        name: "Create Payment Intent",
        description: "Create a Solana payment intent for service access",
        href: `${baseUrl}/solana-pay/intents`,
        method: "POST",
        parameters: {
          amount: { type: "string", required: true, description: "Payment amount" },
          tokenSymbol: { type: "string", required: true, enum: ["SOL", "USDC", "USDT"] },
          serviceName: { type: "string", required: true, description: "Service to pay for" }
        },
        recipient: platformWallet
      },
      {
        id: "token-price-feed",
        name: "Token Price Feed",
        description: "Get real-time Solana token prices via Jupiter/DexScreener",
        href: `${baseUrl}/solana-pay/services/price/{mint}`,
        method: "GET",
        parameters: {
          mint: { type: "string", required: true, description: "Token mint address" }
        },
        pricing: { amount: 0.10, currency: "USDC" }
      },
      {
        id: "trending-tokens",
        name: "Trending Tokens",
        description: "Hot tokens on Solana DEXs with volume and price data",
        href: `${baseUrl}/solana-pay/services/trending`,
        method: "GET",
        parameters: {},
        pricing: { amount: 0.25, currency: "USDC" }
      },
      {
        id: "whale-alerts",
        name: "Whale Wallet Alerts",
        description: "Track large Solana wallet movements in real-time",
        href: `${baseUrl}/solana-pay/services/whale-alerts`,
        method: "GET",
        parameters: {
          wallet: { type: "string", required: false, description: "Wallet to monitor" }
        },
        pricing: { amount: 0.50, currency: "USDC" }
      },
      {
        id: "instant-solana-wallet",
        name: "Instant Solana Agent Wallet",
        description: "Create production-ready Solana wallets for AI agents via Coinbase CDP. Sub-200ms signing, 225+ TPS, enterprise-grade security.",
        href: `${baseUrl}/solana-pay/instant-wallet`,
        method: "POST",
        parameters: {
          agentId: { type: "string", required: true, description: "Unique identifier for the AI agent" },
          name: { type: "string", required: false, description: "Human-readable wallet name" }
        },
        pricing: { amount: 1.00, currency: "USDC" },
        features: [
          "Coinbase CDP Server Wallets",
          "Sub-200ms transaction signing",
          "225+ TPS throughput",
          "AWS Nitro Enclave security",
          "Policy controls"
        ]
      },
      {
        id: "solana-ping",
        name: "Solana Discovery Ping",
        description: "Service health and availability check for registry monitoring. Returns platform status, available services, and endpoint information.",
        href: `${baseUrl}/solana-pay/ping`,
        method: "GET",
        parameters: {},
        pricing: { amount: 0.25, currency: "USDC" },
        headers: {
          "x-intent-id": { type: "string", required: true, description: "Valid paid intent ID" }
        }
      }
    ],
    
    identity: {
      wallet: platformWallet,
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    },
    
    metadata: {
      version: "1.0.0",
      created: "2025-12-23",
      updated: new Date().toISOString().split('T')[0],
      contact: "support@coinrailz.com",
      documentation: `${baseUrl}/.well-known/solana.json`,
      openrpc: `${baseUrl}/solana-openrpc.json`
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Action-Version', '1.0.0');
  res.status(200).json(solanaActionsManifest);
});

/**
 * GET /.well-known/solana-pay.json
 * 
 * Solana Pay merchant directory manifest - Required for:
 * - Solana Pay Directory (api.solanapay.com)
 * - Payment processor discovery
 * - Merchant aggregator indexing
 */
router.get('/.well-known/solana-pay.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const solanaPayManifest = {
    schema_version: "1.0.0",
    
    merchant: {
      name: "Coin Railz",
      description: "Multi-chain payment infrastructure for AI agents. Accept SOL, USDC, USDT payments with automatic webhook settlement.",
      logo: `${baseUrl}/logo.jpg`,
      website: "https://coinrailz.com",
      support_email: "support@coinrailz.com",
      category: "payment_processor"
    },
    
    payment_config: {
      recipient_wallet: platformWallet,
      network: "mainnet-beta",
      cluster: "mainnet",
      
      accepted_tokens: [
        {
          symbol: "SOL",
          mint: "native",
          decimals: 9,
          minimum: 0.001
        },
        {
          symbol: "USDC",
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          decimals: 6,
          minimum: 0.25
        },
        {
          symbol: "USDT",
          mint: "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg",
          decimals: 6,
          minimum: 0.25
        }
      ],
      
      memo_required: true,
      memo_format: "CRPAY-[A-Z0-9]{8}",
      
      webhook: {
        url: `${baseUrl}/solana-pay/webhook`,
        events: ["payment.received", "payment.confirmed", "payment.finalized"]
      }
    },
    
    fees: {
      type: "percentage",
      rate: 0.005,
      description: "0.5% processing fee with minimums per token"
    },
    
    api_endpoints: {
      create_intent: {
        method: "POST",
        url: `${baseUrl}/solana-pay/intents`,
        description: "Create a new payment intent"
      },
      check_status: {
        method: "GET",
        url: `${baseUrl}/solana-pay/intents/{intentId}`,
        description: "Check payment intent status"
      },
      catalog: {
        method: "GET",
        url: `${baseUrl}/solana-pay/catalog`,
        description: "List available paid services"
      },
      pricing: {
        method: "GET",
        url: `${baseUrl}/solana-pay/pricing`,
        description: "Get current fee tiers"
      }
    },
    
    capabilities: [
      "intent_based_payments",
      "webhook_notifications",
      "memo_matching",
      "multi_token_support",
      "automatic_settlement"
    ],
    
    integration: {
      type: "api",
      documentation: `${baseUrl}/.well-known/solana.json`,
      openrpc_spec: `${baseUrl}/solana-openrpc.json`,
      sdk_available: false
    },
    
    metadata: {
      created: "2025-12-23",
      updated: new Date().toISOString().split('T')[0],
      version: "1.0.0"
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).json(solanaPayManifest);
});

/**
 * GET /.well-known/helius.json
 * 
 * Helius webhook configuration manifest
 * Documents webhook handshake for Helius integration
 */
router.get('/.well-known/helius.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  
  const heliusManifest = {
    name: "Coin Railz Helius Integration",
    description: "Helius webhook receiver for Solana payment settlement",
    version: "1.0.0",
    
    webhook: {
      endpoint: `${baseUrl}/solana-pay/webhook`,
      auth_type: "authorization_header_echo",
      events_subscribed: [
        "TRANSFER",
        "TOKEN_TRANSFER"
      ],
      
      transaction_types: [
        "enhanced"
      ],
      
      addresses_monitored: [
        process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k"
      ]
    },
    
    settlement: {
      confirmation_level: "confirmed",
      memo_matching: true,
      memo_format: "CRPAY-[A-Z0-9]{8}"
    },
    
    status_endpoint: `${baseUrl}/solana-pay/status`,
    documentation: `${baseUrl}/.well-known/solana.json`
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(heliusManifest);
});

/**
 * GET /solana-openrpc.json
 * 
 * OpenRPC specification for Solana Pay API - serves directly without Vite processing
 */
router.get('/solana-openrpc.json', async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const platformWallet = process.env.SOLANA_PUBLIC_KEY || "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";
  
  const openrpcSpec = {
    openrpc: "1.2.6",
    info: {
      title: "Coin Railz Solana Pay API",
      description: "Payment processing API for Solana-native AI agents. Create payment intents, check status, and access paid data services using SOL, USDC, or USDT.",
      version: "1.0.0",
      contact: {
        name: "Coin Railz Support",
        email: "support@coinrailz.com",
        url: "https://coinrailz.com"
      }
    },
    servers: [
      {
        name: "Production",
        url: `${baseUrl}/solana-pay`
      }
    ],
    methods: [
      {
        name: "createPaymentIntent",
        summary: "Create a new payment intent",
        description: "Creates a payment intent that returns a memo tag. Customer sends payment with this memo to complete the transaction.",
        tags: [{name: "payments"}],
        params: [
          { name: "amount", required: true, schema: { type: "string" } },
          { name: "tokenSymbol", required: true, schema: { type: "string", enum: ["SOL", "USDC", "USDT"] } },
          { name: "serviceName", required: true, schema: { type: "string" } }
        ],
        result: {
          name: "PaymentIntent",
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              memoTag: { type: "string" },
              amount: { type: "string" },
              recipientAddress: { type: "string" },
              status: { type: "string" }
            }
          }
        }
      },
      {
        name: "getIntentStatus",
        summary: "Check payment intent status",
        tags: [{name: "payments"}],
        params: [
          { name: "intentId", required: true, schema: { type: "string" } }
        ],
        result: {
          name: "IntentStatus",
          schema: {
            type: "object",
            properties: {
              intentId: { type: "string" },
              status: { type: "string" },
              txSignature: { type: "string" }
            }
          }
        }
      },
      {
        name: "getCatalog",
        summary: "List available services",
        tags: [{name: "discovery"}],
        params: [],
        result: {
          name: "ServiceCatalog",
          schema: {
            type: "object",
            properties: {
              services: { type: "array" }
            }
          }
        }
      }
    ],
    components: {
      schemas: {
        PaymentIntent: {
          type: "object",
          properties: {
            id: { type: "string" },
            memoTag: { type: "string" },
            amount: { type: "string" },
            tokenSymbol: { type: "string" },
            status: { type: "string" }
          }
        }
      }
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openrpcSpec);
});

/**
 * GET /.well-known/agent-registration.json
 *
 * Machine-readable registration discovery document for AI agent frameworks.
 * 39+ unique IPs probed this path in 12h (returning 404). This endpoint
 * converts those framework-level probes into registration intent.
 *
 * Returns the registration schema, payment capabilities, and examples.
 * Side-effect free — no DB writes on GET.
 */
router.get('/.well-known/agent-registration.json', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');

  res.status(200).json({
    specVersion: 'coinrailz-agent-registration/1.0',
    description: 'Register your AI agent with Coin Railz to access 60 x402 micropayment services across 8 chains.',

    service: {
      name: 'Coin Railz',
      tagline: 'Multi-chain payment infrastructure for the AI agent economy',
      baseUrl,
      catalogUrl: `${baseUrl}/x402/catalog`,
      agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
      documentationUrl: `${baseUrl}/.well-known/agent-instructions.json`,
      firstCallUrl: `${baseUrl}/x402/first-call`,
      environment: 'production',
    },

    registration: {
      method: 'POST',
      endpoint: `${baseUrl}/.well-known/agent-registration.json`,
      contentType: 'application/json',
      requiredFields: ['agentName', 'walletAddress'],
      optionalFields: ['agentId', 'capabilities', 'callbackUrl', 'contactEmail', 'metadata'],
      maxPayloadBytes: 16384,
      idempotencyKey: 'walletAddress',
      rateLimit: '10 registrations per IP per minute',
    },

    identitySchema: {
      agentName: {
        type: 'string',
        minLength: 2,
        maxLength: 80,
        description: 'Human-readable display name for your agent',
      },
      agentId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9._:-]{1,120}$',
        description: 'Optional stable machine identifier (e.g. my-agent:v1.2)',
      },
      walletAddress: {
        type: 'string',
        description: 'EVM (0x...) or Solana (base58) wallet that will make payments',
      },
      capabilities: {
        type: 'array',
        items: { type: 'string', maxLength: 64 },
        maxItems: 50,
        description: 'List of capabilities your agent provides (e.g. ["trading", "data-retrieval"])',
      },
      callbackUrl: {
        type: 'string',
        format: 'uri',
        pattern: '^https://',
        description: 'HTTPS URL where we can send service updates (stored only, not fetched)',
      },
      contactEmail: {
        type: 'string',
        format: 'email',
        description: 'Optional contact email for onboarding support',
      },
      metadata: {
        type: 'object',
        properties: {
          framework: { type: 'string', description: 'e.g. bun, elizaos, agentkit, custom' },
          frameworkVersion: { type: 'string' },
          description: { type: 'string', maxLength: 500 },
        },
      },
    },

    payments: {
      protocol: 'x402',
      x402Version: 2,
      supportedChains: [
        { id: 'eip155:8453', name: 'Base', token: 'USDC', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        { id: 'eip155:1', name: 'Ethereum', token: 'USDC', contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { id: 'eip155:137', name: 'Polygon', token: 'USDC', contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
        { id: 'eip155:42161', name: 'Arbitrum', token: 'USDC', contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
        { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', name: 'Solana', token: 'USDC', contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      ],
      facilitators: {
        evm: 'https://api.cdp.coinbase.com/platform/v2/x402',
        solana: 'https://x402.dexter.cash',
      },
      pricingModel: {
        type: 'per-call',
        range: '$0.05 — $10.00 per request',
        processingFee: '1.5% + $0.01',
        lowestPrice: '$0.05 (first-call golden path)',
      },
      alternativePaymentMethods: ['credits', 'api-key', 'stripe-card'],
    },

    challengeFlow: {
      description: 'Standard x402 HTTP 402 challenge-response. Send a POST with no payment header to receive the challenge, then attach X-PAYMENT with your signed tx hash and resend.',
      steps: [
        { step: 1, action: 'POST to any /x402/* endpoint without X-PAYMENT header' },
        { step: 2, action: 'Receive HTTP 402 with payment requirements in JSON body' },
        { step: 3, action: 'Broadcast USDC transfer to the specified payTo address on-chain' },
        { step: 4, action: 'Resend original POST with X-PAYMENT: <tx_hash> header' },
        { step: 5, action: 'Receive HTTP 200 with service response' },
      ],
      sdks: {
        npm: '@coinrailz/agent-payments',
        python: 'coinrailz',
        docs: `${baseUrl}/.well-known/agent-instructions.json`,
      },
    },
    cardPaymentPath: {
      description: 'EASIER ALTERNATIVE — No crypto required. One POST call with a Stripe card → receive API key → use on all 60 services instantly.',
      endpoint: `${baseUrl}/api/m2m/credits/purchase`,
      method: 'POST',
      steps: [
        { step: 1, action: 'Create a Stripe PaymentMethod via Stripe.js or the Stripe API (pm_...)' },
        { step: 2, action: `POST to ${baseUrl}/api/m2m/credits/purchase with { paymentMethodId, amountUsd, idempotencyKey }` },
        { step: 3, action: 'Receive { apiKey: "cr_live_..." } — SAVE THIS KEY, shown once only' },
        { step: 4, action: 'Use key on any /x402/* endpoint: -H "X-API-KEY: cr_live_..."' },
      ],
      tiers: [
        { amountUsd: 10, label: 'Starter', calls: '~200 service calls' },
        { amountUsd: 25, label: 'Growth',  calls: '~500 service calls' },
        { amountUsd: 100, label: 'Pro',    calls: '~2,000 service calls' },
      ],
      statusCheckEndpoint: `${baseUrl}/api/m2m/credits/purchase/:paymentIntentId`,
    },

    support: {
      contactUrl: 'https://coinrailz.com/contact',
      docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
      firstCallEndpoint: `${baseUrl}/x402/first-call`,
      catalogEndpoint: `${baseUrl}/x402/catalog`,
    },

    examples: {
      registerRequest: {
        method: 'POST',
        url: `${baseUrl}/.well-known/agent-registration.json`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          agentName: 'My AI Trading Agent',
          walletAddress: '0xYOUR_WALLET_ADDRESS',
          capabilities: ['trading', 'market-analysis'],
          metadata: { framework: 'bun', frameworkVersion: '1.3.9' },
        },
      },
      registerResponse: {
        status: 201,
        body: {
          registrationId: 'uuid',
          status: 'accepted',
          next: {
            firstCallEndpoint: `${baseUrl}/x402/first-call`,
            catalogUrl: `${baseUrl}/x402/catalog`,
            docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
            recommendedFundingToken: 'USDC',
            supportedChains: ['Base', 'Ethereum', 'Polygon', 'Arbitrum', 'Solana'],
          },
        },
      },
      challengeExample: {
        step1: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -d '{"chains":["base"]}'`,
        step2: 'Receive 402 with payment requirements',
        step3: `curl -X POST ${baseUrl}/x402/gas-price-oracle -H 'Content-Type: application/json' -H 'X-PAYMENT: 0xYOUR_TX_HASH' -d '{"chains":["base"]}'`,
      },
    },
  });
});

/**
 * POST /.well-known/agent-registration.json
 *
 * Accepts agent self-registration. Writes to discovered_agents table with
 * source='self-registration'. Idempotent on walletAddress.
 *
 * Security:
 * - Per-IP rate limit: 10 requests/60s
 * - Body capped at 16KB (enforced by express json middleware upstream)
 * - callbackUrl stored only — never server-side fetched (SSRF prevention)
 * - walletAddress format validated (EVM 0x or Solana base58)
 * - Duplicate suppression on walletAddress (409 with existing registrationId)
 */
router.post('/.well-known/agent-registration.json', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRegistrationRateLimit(ip)) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many registration attempts. Maximum 10 per minute per IP.',
      retryAfterSeconds: 60,
    });
  }

  const body = req.body || {};

  // Required field validation
  const agentName = typeof body.agentName === 'string' ? body.agentName.trim() : '';
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';

  if (!agentName || agentName.length < 2 || agentName.length > 80) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'agentName',
      message: 'agentName is required and must be 2–80 characters.',
    });
  }

  if (!walletAddress) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'walletAddress',
      message: 'walletAddress is required (EVM 0x... or Solana base58).',
    });
  }

  // Wallet format validation: EVM (0x + 40 hex chars) or Solana (base58, 32-44 chars)
  const isEvmWallet = /^0x[0-9a-fA-F]{40}$/.test(walletAddress);
  const isSolanaWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);
  if (!isEvmWallet && !isSolanaWallet) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      field: 'walletAddress',
      message: 'walletAddress must be a valid EVM address (0x...) or Solana base58 address.',
    });
  }

  // Optional fields — sanitised
  const agentId = typeof body.agentId === 'string'
    ? body.agentId.trim().substring(0, 120) : null;
  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.slice(0, 50).map((c: any) => String(c).substring(0, 64))
    : [];
  const callbackUrl = typeof body.callbackUrl === 'string'
    && body.callbackUrl.startsWith('https://')
    ? body.callbackUrl.trim().substring(0, 500) : null;
  const contactEmail = typeof body.contactEmail === 'string'
    ? body.contactEmail.trim().substring(0, 254) : null;
  const metadata = typeof body.metadata === 'object' && body.metadata !== null
    ? body.metadata : {};

  // Build a chain-aware canonical key for the discovered_agents.url unique index.
  // EVM addresses are case-insensitive (lowercase). Solana base58 is case-sensitive (preserve exact).
  const registrationUrl = isEvmWallet
    ? `self-registration:evm:${walletAddress.toLowerCase()}`
    : `self-registration:solana:${walletAddress}`;

  const baseUrl = getBaseUrl(req);

  // Shared 201 next-steps payload — included in both first registration and 409 idempotent replay
  const buildNext = (regId: string, regStatus: string) => ({
    registrationId: regId,
    status: regStatus,
    firstCallEndpoint: `${baseUrl}/x402/first-call`,
    catalogUrl: `${baseUrl}/x402/catalog`,
    docsUrl: `${baseUrl}/.well-known/agent-instructions.json`,
    agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
    recommendedFundingToken: 'USDC',
    recommendedChain: isEvmWallet ? 'Base (eip155:8453)' : 'Solana (mainnet-beta)',
    minimumFirstPayment: '$0.05 USDC',
    // Explicit 2-step challenge flow — do NOT skip step 1
    challengeFlow: {
      step1: {
        description: 'Send POST without X-PAYMENT to receive the 402 challenge (required — this gives you the exact payTo address and amount)',
        curl: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -d '{}'`,
        expectedResponse: 'HTTP 402 with JSON body containing payTo, amount, chain, and facilitatorUrl',
      },
      step2: {
        description: 'Broadcast USDC transfer on-chain, then resend with X-PAYMENT header',
        curl: `curl -X POST ${baseUrl}/x402/first-call -H 'Content-Type: application/json' -H 'X-PAYMENT: <your_tx_hash>' -d '{}'`,
        expectedResponse: 'HTTP 200 with onboarding receipt and next-service templates',
      },
    },
    // EASIER ALTERNATIVE: card payment → instant API key (no crypto required)
    cardPaymentPath: {
      description: 'No crypto needed. Purchase credits with a card and get an API key in one call. Works on all 60 services immediately.',
      endpoint: `${baseUrl}/api/m2m/credits/purchase`,
      method: 'POST',
      tiers: [
        { amountUsd: 10, label: 'Starter', calls: '~200 service calls' },
        { amountUsd: 25, label: 'Growth',  calls: '~500 service calls' },
        { amountUsd: 100, label: 'Pro',    calls: '~2,000 service calls' },
      ],
      requiredFields: ['paymentMethodId', 'amountUsd', 'idempotencyKey'],
      exampleRequest: {
        paymentMethodId: 'pm_...',
        amountUsd: 10,
        idempotencyKey: 'your-unique-uuid-v4',
        email: 'agent@yourdomain.com',
      },
      onSuccess: 'Returns { apiKey, keyPrefix, creditsAdded, newBalance } — save the apiKey immediately',
      apiKeyUsage: 'Pass as X-API-KEY header on any /x402/* request. Credits deducted per call.',
      statusCheckEndpoint: `${baseUrl}/api/m2m/credits/purchase/:paymentIntentId`,
    },
  });

  const buildLinks = () => ({
    agentCard: `${baseUrl}/.well-known/agent-card.json`,
    instructions: `${baseUrl}/.well-known/agent-instructions.json`,
    catalog: `${baseUrl}/x402/catalog`,
    support: 'https://coinrailz.com/contact',
  });

  try {
    // Atomic insert-first idempotency: attempt insert and catch unique constraint violation
    // instead of SELECT-then-INSERT (which has a race condition under concurrency).
    const [inserted] = await db
      .insert(discoveredAgents)
      .values({
        url: registrationUrl,
        source: 'self-registration',
        wallet: walletAddress,
        status: 'new',
        capabilities: capabilities.length > 0 ? capabilities : null,
        metadata: {
          agentName,
          agentId: agentId || undefined,
          callbackUrl: callbackUrl || undefined,
          contactEmail: contactEmail || undefined,
          framework: metadata.framework || undefined,
          frameworkVersion: metadata.frameworkVersion || undefined,
          description: typeof metadata.description === 'string'
            ? metadata.description.substring(0, 500) : undefined,
          registeredVia: '/.well-known/agent-registration.json',
          registeredAt: new Date().toISOString(),
          registrantIp: ip,
          userAgent: (req.headers['user-agent'] || '').substring(0, 200),
        },
      })
      .onConflictDoNothing()
      .returning({ id: discoveredAgents.id });

    if (!inserted) {
      // Unique constraint fired — fetch the existing record and return 409
      const [existing] = await db
        .select({ id: discoveredAgents.id, status: discoveredAgents.status })
        .from(discoveredAgents)
        .where(eq(discoveredAgents.url, registrationUrl))
        .limit(1);

      const existingId = existing ? String(existing.id) : 'unknown';
      const existingStatus = existing?.status || 'new';

      return res.status(409).json({
        error: 'ALREADY_REGISTERED',
        message: 'This wallet address is already registered. Your existing registration is still active.',
        next: buildNext(existingId, existingStatus),
        links: buildLinks(),
      });
    }

    console.log(`✅ Agent self-registration: ${agentName} | wallet: ${walletAddress.substring(0, 10)}... | chain: ${isEvmWallet ? 'evm' : 'solana'} | ip: ${ip} | id: ${inserted.id}`);

    return res.status(201).json({
      message: `Welcome, ${agentName}. Your agent is registered. Follow the challengeFlow below to make your first payment.`,
      next: buildNext(String(inserted.id), 'new'),
      links: buildLinks(),
    });
  } catch (err: any) {
    console.error('❌ Agent registration error:', err?.message || err);
    return res.status(500).json({
      error: 'REGISTRATION_FAILED',
      message: 'Registration could not be saved. Please try again.',
    });
  }
});

/**
 * Canonical redirect: /.well-known/x402 (without .json) -> /.well-known/x402.json
 * Some distributed actors monitor this path without the extension.
 * Permanent 301 so crawlers and cached clients update their bookmarks.
 */
router.get('/.well-known/x402', (req: Request, res: Response) => {
  res.redirect(301, '/.well-known/x402.json');
});

router.head('/.well-known/x402', (req: Request, res: Response) => {
  res.redirect(301, '/.well-known/x402.json');
});

/**
 * Catch-all: unknown /.well-known/* paths return 404
 * Prevents PHP exploit probes and unknown paths from falling through
 * to the Vite frontend, which would return 200 with index.html.
 * All legitimate well-known paths are explicitly defined above.
 */
router.all('/.well-known/*', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({
    error: 'Not Found',
    message: `${req.path} is not a recognised discovery document on this platform.`,
    knownPaths: [
      '/.well-known/agent.json',
      '/.well-known/agent-card.json',
      '/.well-known/agent-instructions.json',
      '/.well-known/agent-registration.json',
      '/.well-known/x402.json',
      '/.well-known/service-manifest.json',
      '/.well-known/payment-methods.json',
      '/.well-known/pricing.json',
      '/.well-known/solana.json',
      '/.well-known/solana-actions.json',
      '/.well-known/solana-pay.json',
      '/.well-known/helius.json',
    ],
  });
});

export default router;
