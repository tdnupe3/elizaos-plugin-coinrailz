import type { Plugin } from '@elizaos/core';
import { payForServiceAction } from './actions/payForService';
import { serviceRegistryProvider } from './providers/serviceRegistry';

export const coinrailzPlugin: Plugin = {
  name: 'coinrailz',
  description: 'Coin Railz x402 micropayment services on Base mainnet - 66 production-ready APIs for AI agents',
  actions: [payForServiceAction],
  evaluators: [],
  providers: [serviceRegistryProvider],
  services: []
};

export default coinrailzPlugin;

// Re-export types for external use
export * from './types';
export { X402Client } from './utils/x402Client';
