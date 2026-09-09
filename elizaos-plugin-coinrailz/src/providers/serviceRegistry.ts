import type { Provider, IAgentRuntime, Memory, State } from '../types/elizaos';
import { COIN_RAILZ_SERVICES } from '../types';

export const serviceRegistryProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    // Return information about available Coin Railz services
    const serviceList = COIN_RAILZ_SERVICES.map(service => {
      return `- ${service.name} (${service.id}): ${service.description} - $${service.price} USDC`;
    }).join('\n');

    return `Available Coin Railz Services:\n\n${serviceList}\n\nPlatform: Base Mainnet\nPayment Method: USDC via x402 protocol\nRevenue Share: 85% to agent builder, 15% platform fee`;
  }
};
