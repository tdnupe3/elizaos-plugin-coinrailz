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
 */
export function createProviderRouter(provider: ProviderType): Router {
  const router = Router();

  // ChatGPT requirement: Exact /.well-known/agent-card.json path
  router.get('/.well-known/agent-card.json', (req, res) => {
    // Override provider parameter for this specific provider
    (req.params as any).provider = provider;
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