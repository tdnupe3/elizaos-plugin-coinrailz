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

// Initialize and register all adapters
export function initializeDiscoveryAdapters(): void {
  console.log('🔧 Initializing and registering discovery adapters...');

  // x402 Bazaar Adapter - REAL paying agents from Coinbase official Bazaar
  const bazaarAdapter = new X402BazaarAdapter();
  agentDiscoveryService.registerAdapter('x402-bazaar', bazaarAdapter);

  // A2A Registry Adapter - Connects to A2A protocol registries
  const a2aAdapter = new A2ARegistryAdapter();
  agentDiscoveryService.registerAdapter('a2a-registry', a2aAdapter);

  // On-chain Lookups Adapter - ENS, XMTP, Farcaster/Lens protocols
  const onchainAdapter = new OnchainLookupsAdapter();
  agentDiscoveryService.registerAdapter('onchain-lookups', onchainAdapter);

  // Social Scraping Adapter - Discord/Telegram communities
  const socialAdapter = new SocialScrapingAdapter();
  agentDiscoveryService.registerAdapter('social-scraper', socialAdapter);

  // Platform Adapter - Marketplaces and AI service directories
  const platformAdapter = new PlatformAdapter();
  agentDiscoveryService.registerAdapter('platform-adapter', platformAdapter);

  console.log('✅ All discovery adapters registered successfully!');
  console.log(`📊 Total expected yield: ${
    bazaarAdapter.expectedYield +
    a2aAdapter.expectedYield + 
    onchainAdapter.expectedYield + 
    socialAdapter.expectedYield + 
    platformAdapter.expectedYield
  } agents per discovery run (including ${bazaarAdapter.expectedYield} REAL paying agents from Coinbase Bazaar)`);

  // Start the discovery scheduler
  agentDiscoveryService.startScheduler();
  console.log('⏰ Discovery scheduler started (runs hourly)');
}

// Export individual adapters for testing
export {
  X402BazaarAdapter,
  A2ARegistryAdapter,
  OnchainLookupsAdapter,
  SocialScrapingAdapter,
  PlatformAdapter
};