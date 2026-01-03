/**
 * AI Agent Integration Example
 * Complete payment processing for autonomous AI agents
 * 
 * This example shows how to integrate Coin Railz payments into:
 * - ElizaOS agents
 * - Coinbase AgentKit bots
 * - MCP (Model Context Protocol) tools
 * - Custom AI agents
 * 
 * Run with: npx ts-node examples/ai-agent-integration.ts
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

// Simulated AI agent context
interface AgentContext {
  agentId: string;
  agentName: string;
  wallet?: string;
}

class AIAgentPaymentHandler {
  private client: CoinRailzSolana;
  private context: AgentContext;

  constructor(apiKey: string, context: AgentContext) {
    this.client = new CoinRailzSolana({ apiKey });
    this.context = context;
  }

  /**
   * Handle a payment request from the AI agent
   * Called when agent decides to make a purchase or payment
   */
  async processPayment(recipient: string, amount: number, reason: string) {
    console.log(`[${this.context.agentName}] Processing payment...`);
    console.log(`  Recipient: ${recipient}`);
    console.log(`  Amount: $${amount} USDC`);
    console.log(`  Reason: ${reason}`);

    const result = await this.client.send({
      to: recipient,
      amount,
      currency: 'USDC',
      memo: reason,
      metadata: {
        agentId: this.context.agentId,
        agentName: this.context.agentName,
        timestamp: new Date().toISOString()
      }
    });

    if (result.success) {
      console.log(`[${this.context.agentName}] Payment successful!`);
      console.log(`  Transaction: ${result.transactionId}`);
      console.log(`  Net amount: $${result.amount.net} (after ${result.amount.fee} fee)`);
      return {
        success: true,
        transactionId: result.transactionId,
        explorerUrl: result.explorerUrl
      };
    } else {
      console.error(`[${this.context.agentName}] Payment failed:`, result.message);
      return {
        success: false,
        error: result.message
      };
    }
  }

  /**
   * Setup wallet for the agent if it doesn't have one
   */
  async ensureWallet(): Promise<string> {
    if (this.context.wallet) {
      console.log(`[${this.context.agentName}] Using existing wallet: ${this.context.wallet}`);
      return this.context.wallet;
    }

    console.log(`[${this.context.agentName}] Creating new wallet...`);
    const wallet = await this.client.createWallet();

    if (wallet.success) {
      this.context.wallet = wallet.wallet.address;
      console.log(`[${this.context.agentName}] Wallet created: ${wallet.wallet.address}`);
      
      // In production, securely store wallet.privateKey
      return wallet.wallet.address;
    } else {
      throw new Error(`Failed to create wallet: ${wallet.message}`);
    }
  }

  /**
   * Check if the agent has sufficient balance
   */
  async checkBalance(requiredAmount: number): Promise<boolean> {
    if (!this.context.wallet) {
      return false;
    }

    const balance = await this.client.getBalance(this.context.wallet);
    
    if (balance.success) {
      // USDC has 6 decimals, but for SOL balance check:
      const hasEnough = balance.balance.sol >= requiredAmount;
      console.log(`[${this.context.agentName}] Balance: ${balance.balance.sol} SOL (need ${requiredAmount})`);
      return hasEnough;
    }
    
    return false;
  }

  /**
   * Track a transaction status
   */
  async waitForConfirmation(signature: string, maxWait = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const tx = await this.client.getTransaction(signature);
      
      if (tx.success && tx.status === 'confirmed') {
        console.log(`[${this.context.agentName}] Transaction confirmed!`);
        return true;
      }
      
      if (tx.success && tx.status === 'failed') {
        console.error(`[${this.context.agentName}] Transaction failed`);
        return false;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.warn(`[${this.context.agentName}] Confirmation timeout`);
    return false;
  }
}

// Example usage
async function main() {
  // Verify API key is set
  const apiKey = process.env.COINRAILZ_API_KEY;
  if (!apiKey) {
    console.error('ERROR: COINRAILZ_API_KEY environment variable is not set');
    console.error('Get your API key at: https://coinrailz.com/api-keys');
    console.error('Then run: export COINRAILZ_API_KEY=your-key-here');
    process.exit(1);
  }

  // Initialize the payment handler for an AI agent
  const handler = new AIAgentPaymentHandler(
    apiKey,
    {
      agentId: 'agent-001',
      agentName: 'ResearchBot'
    }
  );

  // Ensure the agent has a wallet
  await handler.ensureWallet();

  // Process a payment (e.g., purchasing data from another agent)
  const result = await handler.processPayment(
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    0.50,
    'Purchase: Market analysis data from DataProviderAgent'
  );

  console.log('\nFinal result:', result);
}

main().catch(console.error);
