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
        }
      },
      "servers": [
        {
          "url": "https://coinrailz.com",
          "description": "Production server"
        }
      ],
      "paths": {
        "/x402/multi-chain-balance": {
          "post": {
            "summary": "Get wallet balances across multiple chains",
            "operationId": "getMultiChainBalance",
            "tags": ["Data"],
            "responses": {
              "402": { "description": "Payment Required - HTTP 402 response with payment details" },
              "200": { "description": "Success - Balance data returned after payment" }
            }
          }
        },
        "/x402/gas-price-oracle": {
          "post": {
            "summary": "Real-time gas prices for all major chains",
            "operationId": "getGasPrices",
            "tags": ["Data"],
            "responses": {
              "402": { "description": "Payment Required" },
              "200": { "description": "Gas price data" }
            }
          }
        },
        "/x402/token-price": {
          "post": {
            "summary": "Live token prices with market data",
            "operationId": "getTokenPrice",
            "tags": ["Data"],
            "responses": {
              "402": { "description": "Payment Required" },
              "200": { "description": "Token price data" }
            }
          }
        },
        "/x402/wallet-risk": {
          "post": {
            "summary": "AML/fraud risk assessment for wallet",
            "operationId": "getWalletRisk",
            "tags": ["Security"],
            "responses": {
              "402": { "description": "Payment Required" },
              "200": { "description": "Risk assessment data" }
            }
          }
        },
        "/x402/trade-signals": {
          "post": {
            "summary": "AI-powered trading signals with confidence scores",
            "operationId": "getTradeSignals",
            "tags": ["Trading"],
            "responses": {
              "402": { "description": "Payment Required" },
              "200": { "description": "Trading signal" }
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
