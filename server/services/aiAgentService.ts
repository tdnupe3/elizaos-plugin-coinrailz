
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

export interface AgentMessage {
  id: string;
  agentId: string;
  content: string;
  type: 'user_message' | 'agent_response' | 'agent_to_agent' | 'system_alert';
  timestamp: string;
  targetAgentId?: string;
  userId?: string;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  action: string;
  description: string;
  timestamp: string;
  status: 'success' | 'failed' | 'in_progress';
  metadata?: any;
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

  async sendMessageToAgent(agentId: string, message: string, userId: string): Promise<any> {
    try {
      // Store user message
      const userMessage: AgentMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        content: message,
        type: 'user_message',
        timestamp: new Date().toISOString(),
        userId
      };

      // Generate AI agent response based on agent type and message
      const agent = await this.getAgent(agentId);
      const agentResponse = await this.generateAgentResponse(agent, message);

      const responseMessage: AgentMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        content: agentResponse,
        type: 'agent_response',
        timestamp: new Date().toISOString()
      };

      // Log activity
      await this.logAgentActivity(agentId, 'message_received', `Received message from user: "${message.substring(0, 50)}..."`, 'success');

      // Store messages (you'll need to implement actual storage)
      await loggingService.log('INFO', 'AI Agent message exchange', {
        agentId,
        userMessage: message,
        agentResponse
      });

      return {
        userMessage,
        agentResponse: responseMessage
      };
    } catch (error) {
      await loggingService.log('ERROR', 'AI Agent message failed', { error: error.message, agentId });
      throw error;
    }
  }

  private async generateAgentResponse(agent: AIAgent | null, message: string): Promise<string> {
    if (!agent) return "I'm sorry, I cannot process your request at this time.";

    const responses = {
      personal_assistant: [
        "I'll help you with that right away! Let me check your account details.",
        "I understand your request. I can assist with account management, transfers, and transaction monitoring.",
        "I'm here to help with your financial needs. What specific task would you like me to handle?",
        "I can help you manage your portfolio, process transfers, or provide account insights."
      ],
      trading_bot: [
        "Analyzing market conditions for optimal trading opportunities...",
        "Based on current market data, I recommend reviewing your portfolio allocation.",
        "I'm monitoring price movements and will execute trades based on your predefined strategies.",
        "Market analysis complete. I've identified several potential trading opportunities."
      ],
      compliance_monitor: [
        "All transactions are being monitored for regulatory compliance.",
        "I've reviewed your recent activities and everything appears compliant.",
        "Compliance check in progress. I'll alert you of any issues requiring attention.",
        "Your account is in good standing with all regulatory requirements."
      ],
      treasury_manager: [
        "Optimizing your cash flow and liquidity management strategies.",
        "I'm monitoring your treasury operations and fund allocations.",
        "Current treasury status is optimal. All funds are properly allocated.",
        "I can help with liquidity planning and fund optimization strategies."
      ]
    };

    const agentResponses = responses[agent.type] || responses.personal_assistant;
    const randomResponse = agentResponses[Math.floor(Math.random() * agentResponses.length)];

    // Add message-specific responses
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('balance') || lowerMessage.includes('money')) {
      return "I can help you check your current balance and recent transactions. Your portfolio is being monitored continuously.";
    }
    if (lowerMessage.includes('transfer') || lowerMessage.includes('send')) {
      return "I can assist with transfers. Please provide the recipient details and amount, and I'll handle the compliance checks.";
    }
    if (lowerMessage.includes('trade') || lowerMessage.includes('buy') || lowerMessage.includes('sell')) {
      return "I'm analyzing the market for your trading request. I'll execute when conditions are optimal according to your risk parameters.";
    }

    return randomResponse;
  }

  async getAgentMessages(agentId: string): Promise<AgentMessage[]> {
    // Mock conversation data - replace with actual database
    return [
      {
        id: 'msg_1',
        agentId,
        content: 'Hello! How can I assist you today?',
        type: 'agent_response',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg_2',
        agentId,
        content: 'Can you check my portfolio balance?',
        type: 'user_message',
        timestamp: new Date(Date.now() - 3000000).toISOString()
      },
      {
        id: 'msg_3',
        agentId,
        content: 'Your current portfolio value is $12,450.32 with a 2.3% gain today. Would you like a detailed breakdown?',
        type: 'agent_response',
        timestamp: new Date(Date.now() - 2400000).toISOString()
      }
    ];
  }

  async getUserAgentActivities(userId: string): Promise<AgentActivity[]> {
    // Mock activity data - replace with actual database
    const userAgents = await this.getUserAgents(userId);
    const activities: AgentActivity[] = [];

    userAgents.forEach(agent => {
      activities.push(
        {
          id: `activity_${Date.now()}_1`,
          agentId: agent.id,
          action: 'Portfolio Analysis',
          description: 'Completed daily portfolio analysis and risk assessment',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          status: 'success'
        },
        {
          id: `activity_${Date.now()}_2`,
          agentId: agent.id,
          action: 'Market Monitoring',
          description: 'Monitoring crypto market conditions for trading opportunities',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: 'in_progress'
        },
        {
          id: `activity_${Date.now()}_3`,
          agentId: agent.id,
          action: 'Compliance Check',
          description: 'Verified all recent transactions meet regulatory requirements',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: 'success'
        }
      );
    });

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async activateAgent(agentId: string): Promise<void> {
    // Mock activation - replace with actual database update
    await this.logAgentActivity(agentId, 'agent_activated', 'Agent has been activated and is ready for tasks', 'success');
    await loggingService.log('INFO', 'AI Agent activated', { agentId });
  }

  private async logAgentActivity(agentId: string, action: string, description: string, status: AgentActivity['status']): Promise<void> {
    const activity: AgentActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      action,
      description,
      timestamp: new Date().toISOString(),
      status
    };

    // Store activity (implement actual storage)
    await loggingService.log('INFO', 'AI Agent activity logged', activity);
  }
}

export const aiAgentService = new AIAgentService();
