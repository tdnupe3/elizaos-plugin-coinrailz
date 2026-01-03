/**
 * MCP (Model Context Protocol) Payment Tool Example
 * Create payment tools for Claude, GPT, and other LLMs
 * 
 * This shows how to expose Coin Railz payments as MCP tools
 * that can be used by AI assistants.
 * 
 * Compatible with Anthropic MCP and OpenAI function calling.
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

// MCP Tool Definition Schema
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  handler: (params: any) => Promise<any>;
}

// Initialize payment client
const apiKey = process.env.COINRAILZ_API_KEY;
if (!apiKey) {
  console.error('ERROR: COINRAILZ_API_KEY environment variable is not set');
  console.error('Get your API key at: https://coinrailz.com/api-keys');
  process.exit(1);
}

const client = new CoinRailzSolana({ apiKey });

/**
 * MCP Tool: send_solana_payment
 * Send USDC payments on Solana network
 */
export const sendPaymentTool: MCPTool = {
  name: 'send_solana_payment',
  description: 'Send a USDC payment to a Solana wallet address. Fee: 1.5% + $0.01. Minimum: $0.05.',
  inputSchema: {
    type: 'object',
    properties: {
      recipient: {
        type: 'string',
        description: 'Solana wallet address (32-44 character Base58 string)'
      },
      amount: {
        type: 'number',
        description: 'Amount to send in USDC (minimum: 0.05)'
      },
      memo: {
        type: 'string',
        description: 'Optional memo/note for the transaction'
      }
    },
    required: ['recipient', 'amount']
  },
  handler: async (params) => {
    const result = await client.send({
      to: params.recipient,
      amount: params.amount,
      currency: 'USDC',
      memo: params.memo
    });

    if ('success' in result && result.success === true) {
      return {
        success: true,
        transactionId: result.transactionId,
        signature: result.signature,
        amountSent: result.amount.net,
        fee: result.amount.fee,
        explorerUrl: result.explorerUrl
      };
    }

    // Handle ApiError case
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      error: error.error || 'UNKNOWN_ERROR',
      message: error.message || 'Payment failed'
    };
  }
};

/**
 * MCP Tool: check_solana_balance
 * Check the SOL balance of a wallet
 */
export const checkBalanceTool: MCPTool = {
  name: 'check_solana_balance',
  description: 'Check the SOL balance of a Solana wallet address',
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Solana wallet address to check'
      }
    },
    required: ['address']
  },
  handler: async (params) => {
    const result = await client.getBalance(params.address);

    if ('success' in result && result.success === true) {
      return {
        success: true,
        address: result.address,
        balanceSOL: result.balance.sol,
        balanceLamports: result.balance.lamports
      };
    }

    // Handle ApiError case
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      error: error.error || 'UNKNOWN_ERROR',
      message: error.message || 'Balance check failed'
    };
  }
};

/**
 * MCP Tool: create_solana_wallet
 * Create a new Solana wallet
 */
export const createWalletTool: MCPTool = {
  name: 'create_solana_wallet',
  description: 'Create a new Solana wallet for receiving payments',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async () => {
    const result = await client.createWallet();

    if ('success' in result && result.success === true) {
      return {
        success: true,
        address: result.wallet.address,
        publicKey: result.wallet.publicKey,
        network: result.wallet.network,
        message: 'Wallet created successfully. Private key stored securely.'
      };
    }

    // Handle ApiError case
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      error: error.error || 'UNKNOWN_ERROR',
      message: error.message || 'Wallet creation failed'
    };
  }
};

/**
 * MCP Tool: get_transaction_status
 * Check the status of a Solana transaction
 */
export const getTransactionTool: MCPTool = {
  name: 'get_transaction_status',
  description: 'Check the status of a Solana transaction by signature',
  inputSchema: {
    type: 'object',
    properties: {
      signature: {
        type: 'string',
        description: 'Transaction signature (88 character Base58 string)'
      }
    },
    required: ['signature']
  },
  handler: async (params) => {
    const result = await client.getTransaction(params.signature);

    if ('success' in result && result.success === true) {
      return {
        success: true,
        signature: result.signature,
        status: result.status,
        explorerUrl: result.explorerUrl
      };
    }

    // Handle ApiError case
    const error = result as { success: false; error: string; message: string };
    return {
      success: false,
      error: error.error || 'UNKNOWN_ERROR',
      message: error.message || 'Transaction lookup failed'
    };
  }
};

// Export all tools
export const coinRailzMCPTools = [
  sendPaymentTool,
  checkBalanceTool,
  createWalletTool,
  getTransactionTool
];

// Generate OpenAI function definitions
export function getOpenAIFunctions() {
  return coinRailzMCPTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }));
}

// Generate MCP tool definitions for Claude
export function getMCPToolDefinitions() {
  return coinRailzMCPTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

// Handle tool calls
export async function handleToolCall(name: string, params: any) {
  const tool = coinRailzMCPTools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(params);
}

// Example usage
async function main() {
  console.log('Available MCP Tools:', coinRailzMCPTools.map(t => t.name));
  console.log('\nOpenAI Functions:', JSON.stringify(getOpenAIFunctions(), null, 2));
  
  // Test a tool call
  console.log('\nTesting balance check...');
  const result = await handleToolCall('check_solana_balance', {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  });
  console.log('Result:', result);
}

main().catch(console.error);
