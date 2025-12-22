/**
 * WELL-KNOWN ENDPOINTS - x402 Protocol Discovery
 * 
 * These endpoints enable autonomous discovery by AI agents and x402 indexers
 * Required for Coinbase x402 indexing and organic traffic
 */

import { Router, Request, Response } from 'express';
import { SERVICE_PRICING_USD } from '@shared/pricing';
import { getFacilitatorUrl } from '../utils/facilitatorHelper';

const router = Router();

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
    description: "Production-grade blockchain infrastructure for AI agents. 41 x402 micropayment services across 7 chains + Real Estate + Banking + Trading + Market Intelligence + Traditional Markets: property valuation, credit risk, trading signals, security audits, wallet analytics, gas optimization, DeFi intelligence, stock sentiment, and forex analysis.",
    version: "0.4.0",
    agentId: "coinrailz-x402-infrastructure",
    
    // A2A v0.3 service endpoint
    serviceUrl: `${baseUrl}/x402`,
    
    // A2A v0.3 capabilities object (required for Google A2A compliance)
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    
    // Skills array with semantic descriptions for AI matching
    skills: [
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
    description: "Multi-chain x402 micropayment infrastructure for AI agents. 41 pay-per-call API services for crypto analytics, trading signals, security audits, real estate, banking, market intelligence, prediction markets, and traditional markets. Pay with USDC on Base chain - prices from $0.10 to $10.00 per request.",
    url: baseUrl,
    version: "3.0.0",
    
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true
    },
    
    skills: [
      // Trading Intelligence Services ($0.10-$0.75)
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        description: "Real-time gas price predictions across multiple chains. $0.10 per request.",
        tags: ["utilities", "gas", "ethereum", "multi-chain", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "token-metadata",
        name: "Token Metadata",
        description: "Comprehensive token information including name, symbol, decimals, and contract details. $0.10 per request.",
        tags: ["tokens", "metadata", "crypto", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      },
      {
        id: "dex-liquidity",
        name: "DEX Liquidity Scanner",
        description: "Analyze liquidity pools, depths, and trading conditions across DEXs. $0.20 per request.",
        tags: ["defi", "liquidity", "dex", "trading", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
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
        outputModes: ["application/json"]
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
        outputModes: ["application/json"]
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
        id: "prediction-market-odds",
        name: "Prediction Market Odds",
        description: "Get current odds and probability for any prediction market event. $0.50 per request.",
        tags: ["prediction-markets", "odds", "probability", "x402"],
        inputModes: ["application/json"],
        outputModes: ["application/json"]
      }
    ],
    
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    
    provider: {
      organization: "Kellogg Holdings LLC",
      url: baseUrl
    },
    
    documentationUrl: `${baseUrl}/developers`,
    author: "Kellogg Holdings LLC",
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
      "ai-agents",
      "real-estate",
      "banking",
      "market-intelligence"
    ],
    
    // Platform trust signals for AI agent decision-making
    // These are optional, machine-readable indicators of platform reliability
    platformSignals: {
      verifiedPayments: true,           // Real x402 payments processed and verified
      repeatAgentsObserved: true,       // Returning agents making multiple payments
      paymentRails: ["x402-USDC", "stripe"],  // Available payment methods
      totalServicesAvailable: 41,       // Current service count in catalog
      networkSupported: "eip155:8453",   // Primary blockchain network (CAIP-2 format)
      paymentAsset: "USDC"              // Primary payment token
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
    total_services: 21,
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
      network: "solana:mainnet",
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
    description: "AI agent marketplace with x402 autonomous payment endpoints, A2A 2.0 discovery, and multi-chain support across 7 EVM networks.",
    version: "x402-2.0",
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
        description: "Basic smart contract security scan with safety score and vulnerability checks",
        status: "healthy",
        category: "security",
        input_schema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "Smart contract address" },
            chain: { type: "string", description: "Blockchain network" }
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
      }
    ],
    x402: {
      protocol_version: "2.0.0",
      facilitator: getFacilitatorUrl(),
      payment_network: "eip155:8453",
      payment_token: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6
      },
      platform_wallet: process.env.PLATFORM_WALLET_ADDRESS || "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
    },
    a2a: {
      protocol_version: "2.0.0",
      agent_directory: `${baseUrl}/api/agents/directory`,
      discovery_enabled: true
    },
    commerce: {
      total_services: 41,
      categories: ["discovery", "trader-focused", "security", "infrastructure", "premium-infrastructure", "payments", "real-estate", "banking", "trading", "intelligence", "prediction-markets", "traditional-markets"],
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
      { service: "Market Sentiment Analyzer", price: 0.30 }
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
    network: "solana:mainnet",
    
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

export default router;
