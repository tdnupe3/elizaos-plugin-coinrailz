/**
 * ElizaOS Payment Plugin Example
 * Integrate Coin Railz payments into an ElizaOS agent
 * 
 * This shows how to create a payment action for ElizaOS agents.
 * Compatible with ai16z/ElizaOS framework.
 * 
 * Install: npm install @coinrailz/agent-payments-solana @ai16z/eliza
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

// ElizaOS action interface (simplified)
interface ElizaAction {
  name: string;
  description: string;
  examples: string[][];
  handler: (runtime: any, message: any, state: any) => Promise<any>;
}

// Create the Coin Railz payment client
// Note: In production, validate API key exists before creating client
const paymentClient = new CoinRailzSolana({
  apiKey: process.env.COINRAILZ_API_KEY || (() => {
    console.warn('WARNING: COINRAILZ_API_KEY not set. Payment actions will fail.');
    return 'missing-key';
  })()
});

/**
 * ElizaOS Action: Send Payment
 * Allows the agent to send USDC payments on Solana
 */
export const sendPaymentAction: ElizaAction = {
  name: 'SEND_PAYMENT',
  description: 'Send a USDC payment to a Solana wallet address',
  examples: [
    ['user', 'Send $5 to wallet 9WzDXwBb...'],
    ['user', 'Pay 10 USDC to this address'],
    ['user', 'Transfer 2.50 to the merchant wallet']
  ],
  handler: async (runtime, message, state) => {
    // Extract payment details from message
    // In production, use NLP to extract amount and recipient
    const amount = parseFloat(message.content.match(/\$?([\d.]+)/)?.[1] || '0');
    const recipient = message.content.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1];

    if (!amount || !recipient) {
      return {
        success: false,
        message: 'Could not parse payment amount or recipient address'
      };
    }

    console.log(`[ElizaOS] Sending $${amount} USDC to ${recipient}`);

    const result = await paymentClient.send({
      to: recipient,
      amount,
      currency: 'USDC',
      memo: `ElizaOS agent payment`,
      metadata: {
        agentId: runtime.agentId,
        conversationId: message.conversationId
      }
    });

    if ('success' in result && result.success === true) {
      return {
        success: true,
        message: `Payment sent! Transaction: ${result.transactionId}`,
        data: {
          transactionId: result.transactionId,
          signature: result.signature,
          amount: result.amount,
          explorerUrl: result.explorerUrl
        }
      };
    }

    // Handle ApiError
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      message: `Payment failed: ${error.message || error.error}`
    };
  }
};

/**
 * ElizaOS Action: Check Balance
 * Query the balance of a Solana wallet
 */
export const checkBalanceAction: ElizaAction = {
  name: 'CHECK_BALANCE',
  description: 'Check the SOL balance of a Solana wallet',
  examples: [
    ['user', 'What is the balance of my wallet?'],
    ['user', 'Check balance for 9WzDXwBb...'],
    ['user', 'How much SOL do I have?']
  ],
  handler: async (runtime, message, state) => {
    // Get wallet address from state or message
    const address = state.walletAddress || 
      message.content.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1];

    if (!address) {
      return {
        success: false,
        message: 'No wallet address provided'
      };
    }

    const result = await paymentClient.getBalance(address);

    if ('success' in result && result.success === true) {
      return {
        success: true,
        message: `Balance: ${result.balance.sol} SOL`,
        data: result.balance
      };
    }

    // Handle ApiError
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      message: `Could not fetch balance: ${error.message || error.error}`
    };
  }
};

/**
 * ElizaOS Action: Create Wallet
 * Create a new Solana wallet for the agent
 */
export const createWalletAction: ElizaAction = {
  name: 'CREATE_WALLET',
  description: 'Create a new Solana wallet for receiving payments',
  examples: [
    ['user', 'Create a new wallet for me'],
    ['user', 'I need a Solana wallet'],
    ['user', 'Generate a receiving address']
  ],
  handler: async (runtime, message, state) => {
    const result = await paymentClient.createWallet();

    if ('success' in result && result.success === true) {
      // In production, securely store the private key
      // DO NOT expose private key to users
      return {
        success: true,
        message: `Wallet created! Address: ${result.wallet.address}`,
        data: {
          address: result.wallet.address,
          publicKey: result.wallet.publicKey
          // privateKey is NOT returned to the user
        }
      };
    }

    // Handle ApiError
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      message: `Could not create wallet: ${error.message || error.error}`
    };
  }
};

// Export all actions for ElizaOS registration
export const coinRailzActions = [
  sendPaymentAction,
  checkBalanceAction,
  createWalletAction
];

// Example: Register with ElizaOS runtime
// import { elizaRuntime } from '@ai16z/eliza';
// coinRailzActions.forEach(action => elizaRuntime.registerAction(action));

console.log('Coin Railz ElizaOS plugin loaded with actions:', 
  coinRailzActions.map(a => a.name).join(', '));
