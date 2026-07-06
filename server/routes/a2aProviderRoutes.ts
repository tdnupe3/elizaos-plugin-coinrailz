/**
 * 🎫 INDIVIDUAL PROVIDER ROUTES - ChatGPT /.well-known/agent-card.json requirement
 * 
 * Each provider needs its own router that exposes /.well-known/agent-card.json
 * at the exact path ChatGPT specified for proper A2A discovery
 */

import { Router } from 'express';
import { A2ABridgeAdapter } from '../adapters/a2aBridgeAdapter.js';
import { ProviderType } from '../services/a2aAPIWrapperService.js';

const bridgeAdapter = new A2ABridgeAdapter();

/**
 * 🏭 Create provider-specific router with /.well-known/agent-card.json
 * Enables ChatGPT, Google AI, and other providers to discover Coin Railz services
 */
export function createProviderRouter(provider: ProviderType): Router {
  const router = Router();

  // ChatGPT requirement: Exact /.well-known/agent-card.json path
  router.get('/.well-known/agent-card.json', (req, res) => {
    // Get baseUrl from request
    let baseUrl = process.env.PUBLIC_BASE_URL;
    if (!baseUrl) {
      const host = req.get('host');
      if (host) {
        // Only use http for localhost/127.0.0.1, otherwise ALWAYS use https
        // (req.protocol is often 'http' in production behind reverse proxy)
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          baseUrl = `http://${host}`;
        } else {
          // For all other domains (production), use HTTPS
          // Check X-Forwarded-Proto header first (standard proxy header)
          const forwardedProto = req.get('x-forwarded-proto');
          const protocol = forwardedProto || 'https';
          baseUrl = `${protocol}://${host}`;
        }
      }
    }
    if (!baseUrl) {
      baseUrl = process.env.REPLIT_DEPLOYMENT === '1' 
        ? 'https://coinrailz.com' 
        : 'http://localhost:5000';
    }
    
    // Override provider parameter for this specific provider
    (req.params as any).provider = provider;
    
    // Return enriched agent card with Coin Railz integration details
    const enrichedCard = {
      name: `Coin Railz x402 API (via ${provider})`,
      description: `Access Coin Railz x402 micropayment services through ${provider}. 66 curated APIs for crypto/trading intelligence, satellite & IoT data, and prediction markets.`,
      version: "2.0.0",
      provider_bridge: provider,
      
      integration: {
        platform: "Coin Railz",
        payment_protocol: "x402",
        url: baseUrl,
        documentation: `${baseUrl}/developers`,
        openapi_schema: `${baseUrl}/.well-known/openapi.json`
      },
      
      capabilities: [
        "multi-chain-balance", "gas-price-oracle", "token-price", "wallet-risk",
        "trade-signals", "token-sentiment", "trending-tokens", "whale-alerts",
        "dex-liquidity", "transaction-builder", "token-metadata", "approval-manager",
        "batch-quote", "portfolio-tracker", "instant-agent-wallet", "verified-agent-identity",
        "seamless-chain-bridge"
      ],
      
      pricing: {
        model: "per_request_x402",
        range: "$0.10 - $5.00 per request",
        currency: "USDC on Base",
        no_registration: true,
        no_setup_fees: true
      },
      
      payment: {
        method: "x402_http_402",
        token: "USDC",
        chain: "Base (8453)",
        wallet: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
        finality_seconds: 12
      },
      
      quickstart: `${baseUrl}/developers#quickstart`,
      full_docs: `${baseUrl}/developers`,
      marketplace: `${baseUrl}/marketplace`
    };
    
    bridgeAdapter.handleAgentCard(req, res);
  });

  // Provider-specific message sending
  router.post('/message/send', (req, res) => {
    (req.params as any).provider = provider;
    bridgeAdapter.handleMessageSend(req, res);
  });

  // Provider-specific health check
  router.get('/health', (req, res) => {
    (req.params as any).provider = provider;
    bridgeAdapter.handleHealthCheck(req, res);
  });

  return router;
}

/**
 * 🌐 Create all provider routers for mounting
 */
export function createAllProviderRouters(): Record<ProviderType, Router> {
  const providers: ProviderType[] = ['openai', 'anthropic', 'cohere', 'dexscreener', 'ibm', 'slack'];
  
  const routers: Record<string, Router> = {};
  
  providers.forEach(provider => {
    routers[provider] = createProviderRouter(provider);
  });

  return routers as Record<ProviderType, Router>;
}