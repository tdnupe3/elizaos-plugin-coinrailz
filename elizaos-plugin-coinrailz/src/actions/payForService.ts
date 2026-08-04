import type { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { X402Client } from '../utils/x402Client';
import { COIN_RAILZ_SERVICES } from '../types';

export const payForServiceAction: Action = {
  name: 'COINRAILZ_PAY_SERVICE',
  similes: [
    'PAY_FOR_SERVICE',
    'USE_COINRAILZ',
    'CALL_PAID_API',
    'MICROPAYMENT'
  ],
  description: 'Pay for and call a Coin Railz micropayment service using x402 protocol on Base',
  examples: [
    [
      {
        user: '{{user1}}',
        content: {
          text: 'Check the multi-chain balance for wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
        }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll check that wallet balance across multiple chains using Coin Railz.',
          action: 'COINRAILZ_PAY_SERVICE',
          content: {
            serviceId: 'multi-chain-balance',
            payload: {
              address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
            }
          }
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'What are the current gas prices on Ethereum and Base?'
        }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Let me get the latest gas prices for you.',
          action: 'COINRAILZ_PAY_SERVICE',
          content: {
            serviceId: 'gas-price-oracle',
            payload: {
              chains: ['ethereum', 'base']
            }
          }
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: {
          text: 'Get the price of USDC token'
        }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll fetch the current USDC price.',
          action: 'COINRAILZ_PAY_SERVICE',
          content: {
            serviceId: 'token-price',
            payload: {
              tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              chain: 'ethereum'
            }
          }
        }
      }
    ]
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const content = message.content as any;
    
    // Check if service ID is provided and valid
    if (!content?.serviceId) {
      return false;
    }

    const service = COIN_RAILZ_SERVICES.find(s => s.id === content.serviceId);
    return !!service;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<boolean> => {
    try {
      const content = message.content as any;
      const { serviceId, payload } = content;

      const client = new X402Client();

      // x402 v2 uses off-chain EIP-712 signing — there is no pre-submitted tx hash.
      // wrapFetchWithPayment (inside callService) handles the full sign-and-submit cycle.
      const result = await client.callService({
        serviceId,
        payload,
        amount: ''
      });

      if (result.success) {
        await runtime.messageManager.createMemory({
          userId: message.userId,
          agentId: message.agentId,
          roomId: message.roomId,
          content: {
            text: `Service ${serviceId} called successfully`,
            data: result.serviceResponse,
            action: 'COINRAILZ_RESPONSE'
          }
        });
        return true;
      } else if (result.error === 'PAYMENT_REQUIRED') {
        // Store payment requirement in memory
        await runtime.messageManager.createMemory({
          userId: message.userId,
          agentId: message.agentId,
          roomId: message.roomId,
          content: {
            text: `Payment required for ${serviceId}. Please send USDC to complete the transaction.`,
            data: result.serviceResponse,
            action: 'PAYMENT_REQUIRED'
          }
        });
        return false;
      } else {
        console.error('Service call failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error in payForService handler:', error);
      return false;
    }
  }
};
