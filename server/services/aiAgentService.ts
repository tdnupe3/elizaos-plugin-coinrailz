
import { storage } from '../storage';
import { loggingService } from './loggingService';
import { complianceService } from './complianceService';
import { TransactionMonitor } from '../utils/transactionMonitor';
import { FeeCalculator } from '../utils/feeCalculator';

export interface AIAgentTransaction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: string;
  currency: string;
  purpose: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    requestedAt: string;
    completedAt?: string;
    riskScore?: number;
    complianceFlags?: string[];
  };
}

export interface AIAgent {
  id: string;
  name: string;
  type: 'personal_assistant' | 'trading_bot' | 'compliance_monitor' | 'treasury_manager';
  ownerId: string;
  walletAddress?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

class AIAgentService {
  async createAgent(agentData: Omit<AIAgent, 'id' | 'createdAt'>): Promise<AIAgent> {
    const agent: AIAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...agentData,
      createdAt: new Date().toISOString()
    };

    // Store agent in database (you'll need to add this table to your schema)
    await loggingService.log('INFO', 'AI Agent created', { agentId: agent.id, type: agent.type });
    
    return agent;
  }

  async initiateAgentTransaction(
    fromAgentId: string,
    toAgentId: string,
    amount: string,
    currency: string,
    purpose: string
  ): Promise<AIAgentTransaction> {
    try {
      // Validate agents exist and are active
      const fromAgent = await this.getAgent(fromAgentId);
      const toAgent = await this.getAgent(toAgentId);

      if (!fromAgent || !toAgent) {
        throw new Error('Invalid agent IDs');
      }

      if (!fromAgent.isActive || !toAgent.isActive) {
        throw new Error('One or more agents are inactive');
      }

      // Check permissions
      if (!fromAgent.permissions.includes('transfer_funds')) {
        throw new Error('Source agent lacks transfer permissions');
      }

      // Risk assessment for AI transactions
      const riskScore = await this.assessAITransactionRisk(fromAgentId, toAgentId, parseFloat(amount));
      
      if (riskScore > 0.8) {
        throw new Error('Transaction blocked due to high risk score');
      }

      // Calculate fees for AI transactions
      const feeCalculation = FeeCalculator.calculateAIAgentFee(parseFloat(amount));

      const transaction: AIAgentTransaction = {
        id: `ai_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromAgentId,
        toAgentId,
        amount,
        currency,
        purpose,
        status: 'pending',
        metadata: {
          requestedAt: new Date().toISOString(),
          riskScore,
          complianceFlags: []
        }
      };

      // Enhanced compliance check for AI transactions
      const complianceResult = await complianceService.checkAITransaction(transaction);
      
      if (!complianceResult.approved) {
        transaction.status = 'failed';
        transaction.metadata.complianceFlags = complianceResult.flags;
        await loggingService.log('WARN', 'AI transaction failed compliance', { 
          transactionId: transaction.id,
          flags: complianceResult.flags 
        });
        return transaction;
      }

      // Process the transaction
      await this.processAITransaction(transaction, feeCalculation.fee);

      await loggingService.log('INFO', 'AI agent transaction completed', {
        transactionId: transaction.id,
        fromAgent: fromAgentId,
        toAgent: toAgentId,
        amount,
        currency
      });

      return transaction;
    } catch (error) {
      await loggingService.log('ERROR', 'AI agent transaction failed', {
        error: error.message,
        fromAgent: fromAgentId,
        toAgent: toAgentId
      });
      throw error;
    }
  }

  private async assessAITransactionRisk(fromAgentId: string, toAgentId: string, amount: number): Promise<number> {
    let riskScore = 0;

    // Base risk for amount
    if (amount > 10000) riskScore += 0.3;
    if (amount > 50000) riskScore += 0.2;

    // Check transaction frequency
    const recentTransactions = await this.getRecentAgentTransactions(fromAgentId, 24); // Last 24 hours
    if (recentTransactions.length > 10) riskScore += 0.2;

    // Cross-owner transactions are higher risk
    const fromAgent = await this.getAgent(fromAgentId);
    const toAgent = await this.getAgent(toAgentId);
    
    if (fromAgent?.ownerId !== toAgent?.ownerId) {
      riskScore += 0.1;
    }

    return Math.min(riskScore, 1.0);
  }

  private async processAITransaction(transaction: AIAgentTransaction, fee: number): Promise<void> {
    try {
      transaction.status = 'processing';

      // Get agent owner balances
      const fromAgent = await this.getAgent(transaction.fromAgentId);
      const toAgent = await this.getAgent(transaction.toAgentId);

      if (!fromAgent || !toAgent) {
        throw new Error('Agent not found during processing');
      }

      // Update balances through the storage layer
      const amount = parseFloat(transaction.amount);
      const totalCost = amount + fee;

      // Debit from source owner
      const fromUser = await storage.getUser(fromAgent.ownerId);
      if (!fromUser) throw new Error('Source user not found');

      const fromBalance = parseFloat(fromUser.usdBalance || "0");
      if (fromBalance < totalCost) {
        throw new Error('Insufficient balance for AI transaction');
      }

      await storage.updateUserBalance(fromAgent.ownerId, (fromBalance - totalCost).toFixed(2));

      // Credit to destination owner
      const toUser = await storage.getUser(toAgent.ownerId);
      if (!toUser) throw new Error('Destination user not found');

      const toBalance = parseFloat(toUser.usdBalance || "0");
      await storage.updateUserBalance(toAgent.ownerId, (toBalance + amount).toFixed(2));

      // Create transaction records
      await storage.createTransaction({
        fromUserId: fromAgent.ownerId,
        toUserId: toAgent.ownerId,
        toEmail: toUser.email,
        amount: transaction.amount,
        message: `AI Agent Transaction: ${transaction.purpose}`,
        transactionType: "ai_agent",
        status: "completed"
      });

      transaction.status = 'completed';
      transaction.metadata.completedAt = new Date().toISOString();

    } catch (error) {
      transaction.status = 'failed';
      throw error;
    }
  }

  private async getAgent(agentId: string): Promise<AIAgent | null> {
    // Mock data for now - you'll need to implement actual storage
    const mockAgents: AIAgent[] = [
      {
        id: 'agent_trading_001',
        name: 'Portfolio Manager Bot',
        type: 'trading_bot',
        ownerId: 'user_123',
        permissions: ['transfer_funds', 'read_portfolio', 'execute_trades'],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'agent_assistant_001',
        name: 'Personal Finance Assistant',
        type: 'personal_assistant',
        ownerId: 'user_456',
        permissions: ['transfer_funds', 'read_transactions'],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    return mockAgents.find(agent => agent.id === agentId) || null;
  }

  private async getRecentAgentTransactions(agentId: string, hours: number): Promise<AIAgentTransaction[]> {
    // Mock implementation - replace with actual database query
    return [];
  }

  async getUserAgents(userId: string): Promise<AIAgent[]> {
    // Mock data - replace with actual database query
    return [
      {
        id: 'agent_trading_001',
        name: 'Portfolio Manager Bot',
        type: 'trading_bot',
        ownerId: userId,
        permissions: ['transfer_funds', 'read_portfolio', 'execute_trades'],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
  }

  async getAgentTransactionHistory(agentId: string, limit: number = 10): Promise<AIAgentTransaction[]> {
    // Mock data - replace with actual database query
    return [];
  }
}

export const aiAgentService = new AIAgentService();
