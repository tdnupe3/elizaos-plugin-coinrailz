import type { Plugin } from '@elizaos/core';
import { payForServiceAction } from './actions/payForService';
import { serviceRegistryProvider } from './providers/serviceRegistry';

export const coinrailzPlugin: Plugin = {
  name: 'coinrailz',
  description: 'Coin Railz x402 micropayment services on Base mainnet — 65 production APIs for AI agents: trading, satellite, IoT, AI inference, prediction markets, and more',
  actions: [payForServiceAction],
  evaluators: [],
  providers: [serviceRegistryProvider],
  services: []
};

export default coinrailzPlugin;

export * from './types';
export { X402Client } from './utils/x402Client';
