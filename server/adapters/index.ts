/**
 * ADAPTER REGISTRY
 * 
 * Registers and initializes all discovery adapters with the main service
 */

import { agentDiscoveryService } from '../services/agentDiscoveryService';
import { A2ARegistryAdapter } from './a2aRegistryAdapter';
import { OnchainLookupsAdapter } from './onchainLookupsAdapter';
import { SocialScrapingAdapter } from './socialScrapingAdapter';
import { PlatformAdapter } from './platformAdapter';
import { X402BazaarAdapter } from './x402BazaarAdapter';
import { ElizaOSRegistryAdapter } from './elizaOSRegistryAdapter';

// Initialize and register all adapters
export function initializeDiscoveryAdapters(): void {
  console.log('🔧 Initializing and registering discovery adapters...');

  // x402 Bazaar Adapter - REAL paying agents from Coinbase official Bazaar
  const bazaarAdapter = new X402BazaarAdapter();
  agentDiscoveryService.registerAdapter('x402-bazaar', bazaarAdapter);

  // A2A Registry Adapter - Connects to A2A protocol registries
  const a2aAdapter = new A2ARegistryAdapter();
  agentDiscoveryService.registerAdapter('a2a-registry', a2aAdapter);

  // On-chain Lookups Adapter - ENS, Farcaster/Lens protocols
  const onchainAdapter = new OnchainLookupsAdapter();
  agentDiscoveryService.registerAdapter('onchain-lookups', onchainAdapter);

  // ElizaOS Registry Adapter - Discovers ElizaOS plugins from official registry
  const elizaAdapter = new ElizaOSRegistryAdapter();
  agentDiscoveryService.registerAdapter('elizaos-registry', elizaAdapter);

  // DISABLED: Social Scraping Adapter - Discord 403, Reddit 401, rate limit waits, 0 new agents
  // const socialAdapter = new SocialScrapingAdapter();
  // agentDiscoveryService.registerAdapter('social-scraper', socialAdapter);
  console.log('⏸️ social-scraper adapter DISABLED (Discord/Reddit APIs failing, 0 yield)');

  // DISABLED: Platform Adapter - JSON parse errors, 404s, DNS failures, 0 new agents  
  // const platformAdapter = new PlatformAdapter();
  // agentDiscoveryService.registerAdapter('platform-adapter', platformAdapter);
  console.log('⏸️ platform-adapter DISABLED (external APIs failing, 0 yield)');

  console.log('✅ Discovery adapters loaded and registered');
  console.log(`📊 Active adapters: x402-bazaar, a2a-registry, onchain-lookups, elizaos-registry`);
  console.log(`📊 Expected yield: ${
    bazaarAdapter.expectedYield +
    a2aAdapter.expectedYield + 
    onchainAdapter.expectedYield +
    elizaAdapter.expectedYield
  } agents per run (including ${bazaarAdapter.expectedYield} REAL paying agents from Coinbase Bazaar, ${elizaAdapter.expectedYield} ElizaOS plugins)`);

  // NOTE: Scheduler is started from server/index.ts AFTER server is listening
  // Do NOT start here to prevent health check timeout during deployment
}

// Export individual adapters for testing
export {
  ElizaOSRegistryAdapter,
  X402BazaarAdapter,
  A2ARegistryAdapter,
  OnchainLookupsAdapter,
  SocialScrapingAdapter,
  PlatformAdapter
};