/**
 * Discovery Routes
 * Autonomous discovery endpoints for web crawlers and AI agents
 * + Agent Discovery Scheduler endpoints for finding x402 agents
 */

import express, { Request, Response } from 'express';
import { autonomousDiscoveryService } from '../services/autonomousDiscoveryService';
import { indexerNotificationService } from '../services/indexerNotificationService';
import { createOfficialBazaarRouter, initializeOfficialBazaarIntegration } from '../discovery/officialBazaarIntegration';
import {
  executeDiscoveryRun,
  getDiscoveryStats,
  startDiscoveryScheduler,
  stopDiscoveryScheduler,
  runDiscoveryNow,
  getAgentsForOutreach,
  getReachableAgents as getOnChainReachableAgents,
  runAutomatedOutreach,
  getOutreachStats,
  getAgentsReadyForOutreach,
  getOutreachRecommendations,
} from '../services/discoveryScheduler';
import { agentDiscoveryService } from '../services/agentDiscoveryService';
import { db } from '../db';
import { discoveryRuns, discoveredAgents, agentOutreachMessages } from '@shared/schema';
import { eq, desc, sql, isNotNull, and, ne } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /sitemap.xml
 * XML sitemap for web crawlers
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const hostname = req.hostname || req.get('host') || undefined;
    const sitemap = await autonomousDiscoveryService.generateAgentSitemap(hostname);
    
    res.setHeader('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
});

/**
 * GET /robots.txt
 * Robots.txt for crawler instructions
 */
router.get('/robots.txt', (req, res) => {
  try {
    const hostname = req.hostname || req.get('host') || undefined;
    const robotsTxt = autonomousDiscoveryService.generateRobotsTxt(hostname);
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(robotsTxt);
  } catch (error) {
    console.error('robots.txt generation failed:', error);
    res.status(500).send('User-agent: *\nDisallow:');
  }
});

/**
 * POST /api/discovery/ping
 * Manually trigger search engine pings
 */
router.post('/api/discovery/ping', async (req, res) => {
  try {
    const hostname = req.hostname || req.get('host') || undefined;
    const result = await autonomousDiscoveryService.pingSearchEngines(hostname);
    
    res.json(result);
  } catch (error) {
    console.error('Search engine ping failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ping search engines',
    });
  }
});

/**
 * POST /api/discovery/notify-indexers
 * Notify AI agent indexers (x402scan, Coinbase Bazaar) that we're back online
 * Query params: force=true to retry even if already notified
 */
router.post('/api/discovery/notify-indexers', async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await indexerNotificationService.notifyAllIndexers(force);
    
    res.json({
      success: result.allSucceeded,
      message: result.allSucceeded ? 'All indexers notified successfully' : 'Some indexers failed',
      ...result
    });
  } catch (error) {
    console.error('Indexer notification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to notify indexers',
    });
  }
});

/**
 * GET /api/discovery/self-check
 * Verify our own discovery endpoints are accessible
 */
router.get('/api/discovery/self-check', async (req, res) => {
  try {
    const results = await indexerNotificationService.pingSpecificEndpoints();
    
    res.json({
      success: results.every(r => r.success),
      endpoints: results
    });
  } catch (error) {
    console.error('Self-check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run self-check',
    });
  }
});

/**
 * POST /api/discovery/campaign
 * Execute full autonomous discovery campaign
 */
router.post('/api/discovery/campaign', async (req, res) => {
  try {
    const hostname = req.hostname || req.get('host') || undefined;
    const result = await autonomousDiscoveryService.executeDiscoveryCampaign(hostname);
    
    res.json({
      success: result.success,
      message: 'Discovery campaign executed',
      details: result,
    });
  } catch (error) {
    console.error('Discovery campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute discovery campaign',
    });
  }
});

/**
 * GET /.well-known/openapi.json
 * OpenAPI schema for AI agents and Gemini integration
 */
router.get('/.well-known/openapi.json', (req, res) => {
  try {
    const openApiSchema = {
      "openapi": "3.0.0",
      "info": {
        "title": "Coin Railz x402 Microservices API",
        "description": "Production-ready x402 HTTP 402 micropayment services for AI agents. Query blockchain data, security analysis, trading signals, DeFi intelligence via HTTP 402 protocol with Base USDC.",
        "version": "1.0.0",
        "contact": {
          "name": "Coin Railz Support",
          "url": "https://coinrailz.com",
          "email": "support@coinrailz.com"
        },
        "x-pricing": "$0.10 - $5.00 per request",
        "x-payment-protocol": "x402",
        "x-payment-networks": ["eip155:8453", "eip155:1", "eip155:137", "eip155:42161", "eip155:10"]
      },
      "servers": [
        {
          "url": "https://coinrailz.com",
          "description": "Production server"
        }
      ],
      "security": [
        {
          "x402Payment": []
        }
      ],
      "components": {
        "securitySchemes": {
          "x402Payment": {
            "type": "apiKey",
            "in": "header",
            "name": "X-PAYMENT",
            "description": "x402 payment protocol: Send USDC payment on Base, include txHash in X-PAYMENT header"
          }
        },
        "schemas": {
          "PaymentRequired": {
            "type": "object",
            "properties": {
              "error": { "type": "string", "example": "Payment required" },
              "price_usd": { "type": "number", "example": 0.50 },
              "payment_address": { "type": "string", "example": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91" },
              "network": { "type": "string", "example": "eip155:8453" },
              "currency": { "type": "string", "example": "USDC" }
            }
          }
        }
      },
      "paths": {
        "/x402/multi-chain-balance": {
          "post": {
            "summary": "Get wallet balances across multiple EVM chains",
            "description": "Query wallet balances for 7+ EVM chains in a single API call. Returns native and token balances.",
            "operationId": "getMultiChainBalance",
            "tags": ["Analytics"],
            "security": [{"x402Payment": []}],
            "x-price-usd": 0.50,
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "walletAddress": { "type": "string", "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
                      "chains": { "type": "array", "items": { "type": "string" }, "example": ["ethereum", "base", "polygon"] },
                      "includeTokens": { "type": "boolean", "example": true }
                    },
                    "required": ["walletAddress"]
                  }
                }
              }
            },
            "responses": {
              "402": {
                "description": "Payment Required - Send USDC payment on Base to proceed",
                "content": {
                  "application/json": {
                    "schema": { "$ref": "#/components/schemas/PaymentRequired" }
                  }
                }
              },
              "200": {
                "description": "Wallet balances across requested chains",
                "content": {
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "properties": {
                        "balances": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "chain": { "type": "string" },
                              "nativeBalance": { "type": "string" },
                              "tokens": { "type": "array" }
                            }
                          }
                        }
                      }
                    },
                    "example": {
                      "balances": [
                        {
                          "chain": "ethereum",
                          "nativeBalance": "1.52",
                          "tokens": [
                            { "symbol": "USDC", "balance": "1000.00", "valueUSD": 1000 }
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        "/x402/gas-price-oracle": {
          "post": {
            "summary": "Real-time gas prices across multiple chains",
            "description": "Get current gas prices (slow/standard/fast) with USD cost estimates for all major EVM chains.",
            "operationId": "getGasPrices",
            "tags": ["Utilities"],
            "security": [{"x402Payment": []}],
            "x-price-usd": 0.10,
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "chains": { "type": "array", "items": { "type": "string" }, "example": ["ethereum", "polygon"] }
                    }
                  }
                }
              }
            },
            "responses": {
              "402": {
                "description": "Payment Required",
                "content": {
                  "application/json": {
                    "schema": { "$ref": "#/components/schemas/PaymentRequired" }
                  }
                }
              },
              "200": {
                "description": "Gas price data",
                "content": {
                  "application/json": {
                    "example": {
                      "gasPrices": [
                        {
                          "chain": "ethereum",
                          "slow": 25,
                          "standard": 30,
                          "fast": 40,
                          "usdCost": { "slow": 1.25, "standard": 1.50, "fast": 2.00 }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        "/x402/token-price": {
          "post": {
            "summary": "Live token prices with 24h data",
            "description": "Get real-time token prices from CoinGecko/DEX Screener with 24h price change, volume, and market cap.",
            "operationId": "getTokenPrice",
            "tags": ["Trading"],
            "security": [{"x402Payment": []}],
            "x-price-usd": 0.25,
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "tokenAddress": { "type": "string", "example": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
                      "chain": { "type": "string", "example": "ethereum" }
                    },
                    "required": ["tokenAddress", "chain"]
                  }
                }
              }
            },
            "responses": {
              "402": {
                "description": "Payment Required",
                "content": {
                  "application/json": {
                    "schema": { "$ref": "#/components/schemas/PaymentRequired" }
                  }
                }
              },
              "200": {
                "description": "Token price data",
                "content": {
                  "application/json": {
                    "example": {
                      "price": 0.999,
                      "priceChange24h": 0.05,
                      "volume24h": 5000000,
                      "marketCap": 25000000000,
                      "source": "coingecko"
                    }
                  }
                }
              }
            }
          }
        },
        "/x402/wallet-risk": {
          "post": {
            "summary": "Wallet risk assessment for security",
            "description": "Analyze wallet for suspicious activity, scam exposure, and security risks with actionable recommendations.",
            "operationId": "getWalletRisk",
            "tags": ["Security"],
            "security": [{"x402Payment": []}],
            "x-price-usd": 0.75,
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "walletAddress": { "type": "string", "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
                      "chain": { "type": "string", "example": "ethereum" }
                    },
                    "required": ["walletAddress", "chain"]
                  }
                }
              }
            },
            "responses": {
              "402": {
                "description": "Payment Required",
                "content": {
                  "application/json": {
                    "schema": { "$ref": "#/components/schemas/PaymentRequired" }
                  }
                }
              },
              "200": {
                "description": "Risk assessment",
                "content": {
                  "application/json": {
                    "example": {
                      "riskScore": 25,
                      "flags": ["high_value_transactions", "new_address"],
                      "scamExposure": false,
                      "recommendations": ["Enable 2FA", "Use hardware wallet"]
                    }
                  }
                }
              }
            }
          }
        },
        "/x402/trade-signals": {
          "post": {
            "summary": "AI-powered trading signals",
            "description": "Generate trading signals (buy/sell/hold) based on technical analysis and on-chain data with confidence scores.",
            "operationId": "getTradeSignals",
            "tags": ["Trading"],
            "security": [{"x402Payment": []}],
            "x-price-usd": 0.20,
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "tokenAddress": { "type": "string", "example": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
                      "chain": { "type": "string", "example": "ethereum" },
                      "timeframe": { "type": "string", "example": "1d" }
                    },
                    "required": ["tokenAddress", "chain"]
                  }
                }
              }
            },
            "responses": {
              "402": {
                "description": "Payment Required",
                "content": {
                  "application/json": {
                    "schema": { "$ref": "#/components/schemas/PaymentRequired" }
                  }
                }
              },
              "200": {
                "description": "Trading signal",
                "content": {
                  "application/json": {
                    "example": {
                      "signal": "buy",
                      "confidence": 0.78,
                      "indicators": { "rsi": 35, "macd": "bullish", "volume": "increasing" },
                      "reasoning": "RSI oversold, MACD crossover, volume spike detected"
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSchema);
  } catch (error) {
    console.error('OpenAPI schema generation failed:', error);
    res.status(500).json({ error: 'Failed to generate OpenAPI schema' });
  }
});

// ============================================================================
// AGENT DISCOVERY SCHEDULER ROUTES
// ============================================================================

/**
 * GET /api/discovery/scheduler/stats
 * Get discovery statistics
 */
router.get('/api/discovery/scheduler/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getDiscoveryStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting discovery stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery stats',
    });
  }
});

/**
 * GET /api/discovery/scheduler/runs
 * Get discovery run history
 */
router.get('/api/discovery/scheduler/runs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    
    const runs = await db
      .select({
        id: discoveryRuns.id,
        runType: discoveryRuns.runType,
        status: discoveryRuns.status,
        startedAt: discoveryRuns.startedAt,
        completedAt: discoveryRuns.completedAt,
        totalRaw: discoveryRuns.totalRaw,
        totalUnique: discoveryRuns.totalUnique,
        newAgents: discoveryRuns.newAgents,
        updatedAgents: discoveryRuns.updatedAgents,
        bySource: discoveryRuns.bySource,
        durationMs: discoveryRuns.durationMs,
      })
      .from(discoveryRuns)
      .orderBy(desc(discoveryRuns.startedAt))
      .limit(limit);
    
    res.json({
      success: true,
      data: runs,
    });
  } catch (error) {
    console.error('Error getting discovery runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery runs',
    });
  }
});

/**
 * GET /api/discovery/scheduler/runs/:id
 * Get specific discovery run details
 */
router.get('/api/discovery/scheduler/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = parseInt(req.params.id);
    
    const [run] = await db
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, runId))
      .limit(1);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Discovery run not found',
      });
    }
    
    res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    console.error('Error getting discovery run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery run',
    });
  }
});

/**
 * POST /api/discovery/scheduler/run
 * Trigger immediate discovery run (both script-based AND adapter-based)
 * 
 * Query params:
 *   adaptersOnly=true  — Skip the master script, only run adapter-based discovery (Bazaar, A2A, on-chain)
 *   scriptOnly=true    — Only run the legacy master-agent-discovery script (GitHub, A2A probe)
 *   (default)          — Run both sequentially: script first, then adapters
 */
router.post('/api/discovery/scheduler/run', async (req: Request, res: Response) => {
  try {
    const adaptersOnly = req.query.adaptersOnly === 'true';
    const scriptOnly = req.query.scriptOnly === 'true';
    
    console.log('🚀 Manual discovery run triggered via API');
    console.log(`   Mode: ${adaptersOnly ? 'adapters-only' : scriptOnly ? 'script-only' : 'full (script + adapters)'}`);

    const results: {
      scriptRunId?: number;
      adapterResults?: { totalFound: number; newAgents: number; duration: number; summary: string };
      errors: string[];
    } = { errors: [] };

    if (!adaptersOnly) {
      const runId = await runDiscoveryNow();
      if (runId === -1) {
        results.errors.push('Script discovery already running');
      } else {
        results.scriptRunId = runId;
      }
    }

    if (!scriptOnly) {
      try {
        if (!agentDiscoveryService.hasAdapters()) {
          console.log('🔧 Adapters not yet initialized (DEV_LITE_MODE) — initializing now...');
          await agentDiscoveryService.ensureAdaptersInitialized();
        }
        console.log('🔌 Running adapter-based discovery (Bazaar, A2A registry, on-chain, ElizaOS)...');
        const adapterResult = await agentDiscoveryService.runDiscovery({
          priority: 'thorough',
          skipLock: true,
        });
        results.adapterResults = {
          totalFound: adapterResult.totalFound,
          newAgents: adapterResult.newAgents,
          duration: adapterResult.duration,
          summary: adapterResult.summary,
        };
        console.log(`✅ Adapter discovery complete: ${adapterResult.newAgents} new agents found`);
      } catch (adapterError: any) {
        console.error('⚠️ Adapter discovery failed (non-fatal):', adapterError.message);
        results.errors.push(`Adapter discovery: ${adapterError.message}`);
      }
    }

    const hasAnyResult = results.scriptRunId || results.adapterResults;
    if (!hasAnyResult) {
      return res.status(409).json({
        success: false,
        error: 'All discovery methods failed or already running',
        details: results.errors,
      });
    }
    
    res.json({
      success: true,
      message: 'Discovery run completed',
      data: results,
    });
  } catch (error) {
    console.error('Error starting discovery run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start discovery run',
    });
  }
});

/**
 * GET /api/discovery/agents
 * Get discovered agents list
 */
router.get('/api/discovery/agents', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const status = req.query.status as string;
    const hasOnChain = req.query.hasOnChain === 'true';
    
    const agents = await db
      .select({
        id: discoveredAgents.id,
        url: discoveredAgents.url,
        canonicalUrl: discoveredAgents.canonicalUrl,
        source: discoveredAgents.source,
        status: discoveredAgents.status,
        score: discoveredAgents.score,
        xmtpAddress: discoveredAgents.xmtpAddress,
        xmtpCanMessage: discoveredAgents.xmtpCanMessage,
        lastSeenAt: discoveredAgents.lastSeenAt,
        discoveredAt: discoveredAgents.discoveredAt,
      })
      .from(discoveredAgents)
      .orderBy(desc(discoveredAgents.score))
      .limit(limit);
    
    let filteredAgents = agents;
    if (status) {
      filteredAgents = filteredAgents.filter(a => a.status === status);
    }
    if (hasOnChain) {
      filteredAgents = filteredAgents.filter(a => a.xmtpAddress);
    }
    
    res.json({
      success: true,
      data: {
        count: filteredAgents.length,
        agents: filteredAgents,
      },
    });
  } catch (error) {
    console.error('Error getting discovered agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovered agents',
    });
  }
});

/**
 * GET /api/discovery/agents/on-chain-reachable
 * Get agents with verified on-chain reachability
 */
router.get('/api/discovery/agents/on-chain-reachable', async (req: Request, res: Response) => {
  try {
    const agents = await getOnChainReachableAgents();
    res.json({
      success: true,
      data: {
        count: agents.length,
        agents,
      },
    });
  } catch (error) {
    console.error('Error getting on-chain reachable agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get on-chain reachable agents',
    });
  }
});

/**
 * GET /api/discovery/agents/for-outreach
 * Get agents ready for automated outreach
 */
router.get('/api/discovery/agents/for-outreach', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const agents = await getAgentsForOutreach(limit);
    res.json({
      success: true,
      data: {
        count: agents.length,
        agents,
      },
    });
  } catch (error) {
    console.error('Error getting agents for outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agents for outreach',
    });
  }
});

/**
 * GET /api/discovery/agents/:id
 * Get specific agent details
 */
router.get('/api/discovery/agents/:id', async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.id);
    
    const [agent] = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.id, agentId))
      .limit(1);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }
    
    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error getting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent',
    });
  }
});

/**
 * GET /api/discovery/outreach
 * Get outreach message history
 */
router.get('/api/discovery/outreach', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    
    const messages = await db
      .select()
      .from(agentOutreachMessages)
      .orderBy(desc(agentOutreachMessages.createdAt))
      .limit(limit);
    
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentOutreachMessages);
    
    const [sentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentOutreachMessages)
      .where(eq(agentOutreachMessages.status, 'sent'));
    
    const [deliveredCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentOutreachMessages)
      .where(eq(agentOutreachMessages.status, 'delivered'));
    
    res.json({
      success: true,
      data: {
        total: Number(totalCount?.count || 0),
        sent: Number(sentCount?.count || 0),
        delivered: Number(deliveredCount?.count || 0),
        messages,
      },
    });
  } catch (error) {
    console.error('Error getting outreach messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outreach messages',
    });
  }
});

/**
 * POST /api/discovery/scheduler/start
 * Start the discovery scheduler
 */
router.post('/api/discovery/scheduler/start', async (req: Request, res: Response) => {
  try {
    const intervalHours = parseInt(req.body?.intervalHours as string) || 6;
    startDiscoveryScheduler(intervalHours);
    res.json({
      success: true,
      message: `Discovery scheduler started (every ${intervalHours} hours)`,
    });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scheduler',
    });
  }
});

/**
 * POST /api/discovery/scheduler/stop
 * Stop the discovery scheduler
 */
router.post('/api/discovery/scheduler/stop', async (req: Request, res: Response) => {
  try {
    stopDiscoveryScheduler();
    res.json({
      success: true,
      message: 'Discovery scheduler stopped',
    });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduler',
    });
  }
});

// ============================================
// AUTOMATED OUTREACH ROUTES
// ============================================

/**
 * POST /api/discovery/outreach/run
 * Trigger automated outreach campaign to discovered agents
 * Uses agent outreach service for proven messaging logic
 */
router.post('/api/discovery/outreach/run', async (req: Request, res: Response) => {
  try {
    const { minQualityScore, maxAgents, onlyOnChain } = req.body || {};
    
    const result = await runAutomatedOutreach({
      minQualityScore: minQualityScore ? parseInt(minQualityScore) : undefined,
      maxAgents: maxAgents ? parseInt(maxAgents) : undefined,
      onlyReachable: onlyOnChain !== undefined ? Boolean(onlyOnChain) : undefined,
    });
    
    res.json({
      success: true,
      message: 'Outreach campaign completed',
      data: result,
    });
  } catch (error) {
    console.error('Error running outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run outreach campaign',
    });
  }
});

/**
 * GET /api/discovery/outreach/stats
 * Get outreach campaign statistics
 */
router.get('/api/discovery/outreach/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getOutreachStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting outreach stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outreach stats',
    });
  }
});

/**
 * GET /api/discovery/outreach/ready
 * Get agents ready for outreach (have on-chain address, quality score >= 60, not yet contacted)
 */
router.get('/api/discovery/outreach/ready', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const minQualityScore = parseInt(req.query.minQualityScore as string) || 60;
    const onlyOnChainReachable = req.query.onlyOnChainReachable === 'true';
    
    const agents = await getAgentsReadyForOutreach({
      limit,
      minQualityScore,
      onlyReachable: onlyOnChainReachable,
    });
    
    res.json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (error) {
    console.error('Error getting agents ready for outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agents ready for outreach',
    });
  }
});

/**
 * GET /api/discovery/outreach/recommendations
 * Get outreach recommendations (high-quality on-chain reachable agents)
 */
router.get('/api/discovery/outreach/recommendations', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const agents = await getOutreachRecommendations(limit);
    
    res.json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (error) {
    console.error('Error getting outreach recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outreach recommendations',
    });
  }
});

/**
 * GET /api/discovery/wallets
 * Get discovered agents grouped by domain with wallet addresses for on-chain outreach
 * 
 * Query params:
 *   source   — Filter by source (e.g., 'x402-bazaar', 'elizaos-registry')
 *   limit    — Max results (default 100)
 *   minEndpoints — Minimum endpoints per domain (default 1)
 */
router.get('/api/discovery/wallets', async (req: Request, res: Response) => {
  try {
    const source = req.query.source as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const minEndpoints = parseInt(req.query.minEndpoints as string) || 1;

    const conditions = [
      isNotNull(discoveredAgents.wallet),
      ne(discoveredAgents.wallet, ''),
    ];

    if (source) {
      conditions.push(eq(discoveredAgents.source, source));
    }

    const walletAgents = await db
      .select({
        domain: sql<string>`SUBSTRING(${discoveredAgents.url} FROM 'https?://([^/]+)')`,
        wallet: discoveredAgents.wallet,
        source: discoveredAgents.source,
        endpoints: sql<number>`COUNT(*)`,
        lastSeen: sql<string>`MAX(${discoveredAgents.discoveredAt})`,
        sampleUrls: sql<string[]>`ARRAY_AGG(${discoveredAgents.url} ORDER BY ${discoveredAgents.discoveredAt} DESC)`,
      })
      .from(discoveredAgents)
      .where(and(...conditions))
      .groupBy(
        sql`SUBSTRING(${discoveredAgents.url} FROM 'https?://([^/]+)')`,
        discoveredAgents.wallet,
        discoveredAgents.source,
      )
      .having(sql`COUNT(*) >= ${minEndpoints}`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    const formatted = walletAgents.map(row => ({
      domain: row.domain,
      wallet: row.wallet,
      source: row.source,
      endpointCount: Number(row.endpoints),
      lastSeen: row.lastSeen,
      sampleEndpoints: (row.sampleUrls || []).slice(0, 5),
    }));

    const uniqueWallets = new Set(formatted.map(r => r.wallet));
    const uniqueDomains = new Set(formatted.map(r => r.domain));

    res.json({
      success: true,
      summary: {
        totalEntries: formatted.length,
        uniqueWallets: uniqueWallets.size,
        uniqueDomains: uniqueDomains.size,
      },
      data: formatted,
    });
  } catch (error) {
    console.error('Error getting wallet outreach data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet outreach data',
    });
  }
});

// Mount Official Bazaar SDK Integration router
const bazaarRouter = createOfficialBazaarRouter();
router.use('/api', bazaarRouter);

// Initialize Bazaar integration on startup
initializeOfficialBazaarIntegration().catch(err => {
  console.error('Failed to initialize Official Bazaar integration:', err);
});

export default router;
