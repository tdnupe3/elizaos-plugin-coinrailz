/**
 * Discovery Routes
 * Autonomous discovery endpoints for web crawlers and AI agents
 */

import express from 'express';
import { autonomousDiscoveryService } from '../services/autonomousDiscoveryService';

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
        "x-payment-networks": ["base", "ethereum", "polygon", "arbitrum", "optimism"]
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
              "network": { "type": "string", "example": "base" },
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

export default router;
