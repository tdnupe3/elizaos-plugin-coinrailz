import { storage } from '../storage';
import { loggingService } from './loggingService';
import { complianceService } from './complianceService';
import { TransactionMonitor } from '../utils/transactionMonitor';
import { FeeCalculator } from '../utils/feeCalculator';
import { db } from '../db';
import { featureQuarantine } from '../middleware/featureQuarantine';

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
    autonomous?: boolean;
    autoApproved?: boolean;
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
    return this.registerAgent(agentData);
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
      const feeCalculation = FeeCalculator.calculateAIAgentFee(parseFloat(amount), currency);

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
        error: error instanceof Error ? error.message : String(error),
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

      await storage.updateUserBalance(fromAgent.ownerId, fromBalance - totalCost, transaction.currency);

      // Credit to destination owner
      const toUser = await storage.getUser(toAgent.ownerId);
      if (!toUser) throw new Error('Destination user not found');

      const toBalance = parseFloat(toUser.usdBalance || "0");
      await storage.updateUserBalance(toAgent.ownerId, toBalance + amount, transaction.currency);

      // Create transaction records
      await storage.createTransaction({
        fromUserId: fromAgent.ownerId,
        toUserId: toAgent.ownerId,
        toEmail: toUser.email,
        amount: transaction.amount,
        message: `AI Agent Transaction: ${transaction.purpose}`,
        currency: transaction.currency,
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

  // Database-backed agent operations - no more in-memory registry
  private agentTransactions: AIAgentTransaction[] = [];
  private agentMessages: Map<string, AgentMessage[]> = new Map();

  async registerAgent(agentData: Omit<AIAgent, 'id' | 'createdAt'>): Promise<AIAgent> {
    return await featureQuarantine.executeWithQuarantine('ai-agents', async () => {
    try {
      const agent: AIAgent = {
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...agentData,
        createdAt: new Date().toISOString()
      };

      // Store agent in database instead of memory
      await storage.createGlobalAIAgent({
        id: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        capabilities: agent.permissions,
        primaryWalletAddress: agent.walletAddress || `temp_${agent.id}`,
        walletNetwork: 'base',
        publicKey: `pk_${agent.id}`,
        signature: `sig_${agent.id}`,
        status: agent.isActive ? 'active' : 'inactive',
        reputation: '5.0',
        totalTransactions: 0,
        totalVolume: '0.00',
        membershipTier: 'basic',
        isActive: agent.isActive,
        hasCompletedFirstTransaction: false,
        annualRevenue: '0.00',
        referralCount: 0,
        referralRewards: '0.00',
        isHumanRegistered: true,
        contactEmail: `${agent.id}@agents.coinrailz.com`,
        averageRating: 0,
        totalRatings: 0,
        preferredCurrencies: ['USDC', 'ETH', 'XRP', 'BNB', 'USDT']
      });

      // Initialize message history
      this.agentMessages.set(agent.id, []);

      await loggingService.log('INFO', 'AI Agent registered in database', { 
        agentId: agent.id, 
        type: agent.type,
        canTransact: agent.permissions.includes('transfer_funds')
      });

      return agent;
    } catch (error) {
      console.error('Agent registration failed:', error);
      throw error;
    }
    });
  }

  async discoverAgents(searchCriteria?: {
    type?: AIAgent['type'];
    hasPermission?: string;
    excludeOwner?: string;
  }): Promise<AIAgent[]> {
    // Use database agents instead of in-memory registry
    const dbAgents = await storage.getGlobalAIAgents();
    
    let agents = dbAgents.map(dbAgent => ({
      id: dbAgent.id,
      name: dbAgent.agentName,
      type: (dbAgent.agentType as AIAgent['type']) || 'treasury_manager',
      ownerId: dbAgent.ownerId || 'system',
      walletAddress: dbAgent.primaryWalletAddress,
      permissions: Array.isArray(dbAgent.capabilities) ? dbAgent.capabilities : [dbAgent.capabilities || 'transfer_funds'],
      isActive: dbAgent.isActive,
      createdAt: dbAgent.createdAt || new Date().toISOString()
    }));

    if (searchCriteria) {
      if (searchCriteria.type) {
        agents = agents.filter(agent => agent.type === searchCriteria.type);
      }
      if (searchCriteria.hasPermission) {
        agents = agents.filter(agent => agent.permissions.includes(searchCriteria.hasPermission));
      }
      if (searchCriteria.excludeOwner) {
        agents = agents.filter(agent => agent.ownerId !== searchCriteria.excludeOwner);
      }
    }

    return agents.filter(agent => agent.isActive);
  }

  async initiateAgentToAgentTransfer(
    sourceAgentId: string, 
    targetAgentId: string, 
    amount: number, 
    purpose: string,
    autoApprove: boolean = false
  ): Promise<AIAgentTransaction> {
    const sourceAgent = await this.getAgent(sourceAgentId);
    const targetAgent = await this.getAgent(targetAgentId);

    if (!sourceAgent || !targetAgent) {
      throw new Error('One or both agents not found in registry');
    }

    if (!sourceAgent.permissions.includes('transfer_funds')) {
      throw new Error('Source agent lacks transfer permissions');
    }

    // Risk assessment for autonomous transactions
    const riskScore = await this.assessAITransactionRisk(sourceAgentId, targetAgentId, amount);

    const transaction: AIAgentTransaction = {
      id: `ai_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId: sourceAgentId,
      toAgentId: targetAgentId,
      amount: amount.toString(),
      currency: 'USD',
      purpose,
      status: 'pending',
      metadata: {
        requestedAt: new Date().toISOString(),
        riskScore,
        complianceFlags: [],
        autonomous: true,
        autoApproved: autoApprove
      }
    };

    // Enhanced compliance check
    const complianceResult = await complianceService.checkAITransaction(transaction);

    if (!complianceResult.approved) {
      transaction.status = 'failed';
      transaction.metadata.complianceFlags = complianceResult.flags;
      this.agentTransactions.push(transaction);

      await loggingService.log('WARN', 'Agent-to-agent transaction failed compliance', { 
        transactionId: transaction.id,
        flags: complianceResult.flags 
      });
      return transaction;
    }

    // Process if auto-approved or low risk
    if (autoApprove || riskScore < 0.3) {
      try {
        const feeCalculation = FeeCalculator.calculateAIAgentFee(amount, transaction.currency);
        await this.processAITransaction(transaction, feeCalculation.fee);

        // Notify both agents
        await this.notifyAgent(sourceAgentId, `Transfer of $${amount} to ${targetAgent.name} completed successfully.`);
        await this.notifyAgent(targetAgentId, `Received $${amount} from ${sourceAgent.name} for: ${purpose}`);

      } catch (error) {
        transaction.status = 'failed';
        await loggingService.log('ERROR', 'Agent-to-agent transaction processing failed', {
          error: error instanceof Error ? error.message : String(error),
          transactionId: transaction.id
        });
      }
    }

    this.agentTransactions.push(transaction);

    await loggingService.log('INFO', 'Agent-to-agent transaction initiated', {
      transactionId: transaction.id,
      fromAgent: sourceAgentId,
      toAgent: targetAgentId,
      amount,
      autonomous: true
    });

    return transaction;
  }

  async requestAgentTransaction(requestingAgentId: string, targetAgentId: string, amount: number, purpose: string): Promise<any> {
    // FIXED: Use database agents instead of in-memory registry  
    const requestingAgent = await this.getAgent(requestingAgentId);
    const targetAgent = await this.getAgent(targetAgentId);

    if (!requestingAgent || !targetAgent) {
      throw new Error('Agent not found');
    }

    const requestMessage = `Transaction request from ${requestingAgent.name}: $${amount} for ${purpose}. Do you approve?`;

    // Send request to target agent
    await this.sendAgentToAgentMessage(requestingAgentId, targetAgentId, requestMessage);

    // Simulate agent decision making (in real implementation, this would be more sophisticated)
    const approvalDecision = await this.simulateAgentDecision(targetAgent, amount, purpose);

    if (approvalDecision.approved) {
      const transaction = await this.initiateAgentToAgentTransfer(
        requestingAgentId, 
        targetAgentId, 
        amount, 
        purpose, 
        true
      );

      await this.sendAgentToAgentMessage(
        targetAgentId, 
        requestingAgentId, 
        `Transaction approved and processed. Reference: ${transaction.id}`
      );

      return { approved: true, transaction };
    } else {
      await this.sendAgentToAgentMessage(
        targetAgentId, 
        requestingAgentId, 
        `Transaction declined: ${approvalDecision.reason}`
      );

      return { approved: false, reason: approvalDecision.reason };
    }
  }

  private async simulateAgentDecision(agent: AIAgent, amount: number, purpose: string): Promise<{ approved: boolean; reason?: string }> {
    // Simulate intelligent agent decision making
    // In a real implementation, this would use ML models or rule engines

    if (amount > 1000 && agent.type === 'compliance_monitor') {
      return { approved: false, reason: 'Amount exceeds compliance threshold' };
    }

    if (agent.type === 'treasury_manager' && amount > 5000) {
      return { approved: false, reason: 'Requires manual treasury approval' };
    }

    if (purpose.toLowerCase().includes('unauthorized') || purpose.toLowerCase().includes('test')) {
      return { approved: false, reason: 'Purpose flagged as potentially suspicious' };
    }

    // Default approval for legitimate requests
    return { approved: true };
  }

  async sendAgentToAgentMessage(fromAgentId: string, toAgentId: string, message: string): Promise<any> {
    // FIXED: Use database agents instead of in-memory registry
    const fromAgent = await this.getAgent(fromAgentId);
    const toAgent = await this.getAgent(toAgentId);

    if (!fromAgent || !toAgent) {
      // If fromAgent doesn't exist, create platform fundraising agent on-the-fly
      if (fromAgentId === 'platform_emergency_fundraiser') {
        console.log('📧 Creating platform emergency fundraiser agent...');
        // Continue with messaging even if fromAgent is platform system
      } else {
        throw new Error(`Agent not found: ${fromAgentId} or ${toAgentId}`);
      }
    }

    const agentMessage: AgentMessage = {
      id: `agent_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: fromAgentId,
      content: message,
      type: 'agent_to_agent',
      timestamp: new Date().toISOString(),
      targetAgentId: toAgentId
    };

    // Store message in both agents' histories
    const fromMessages = this.agentMessages.get(fromAgentId) || [];
    const toMessages = this.agentMessages.get(toAgentId) || [];

    fromMessages.push(agentMessage);
    toMessages.push({ ...agentMessage, agentId: toAgentId });

    this.agentMessages.set(fromAgentId, fromMessages);
    this.agentMessages.set(toAgentId, toMessages);

    await loggingService.log('INFO', 'Agent-to-agent message sent', {
      fromAgent: fromAgentId,
      toAgent: toAgentId,
      messageId: agentMessage.id
    });

    // Return message data for tracking
    return agentMessage;
  }

  private async notifyAgent(agentId: string, message: string): Promise<void> {
    const notification: AgentMessage = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      content: message,
      type: 'system_alert',
      timestamp: new Date().toISOString()
    };

    const messages = this.agentMessages.get(agentId) || [];
    messages.push(notification);
    this.agentMessages.set(agentId, messages);
  }

  private async getAgent(agentId: string): Promise<AIAgent | null> {
    // Get agent from database instead of in-memory registry
    try {
      const dbAgent = await storage.getGlobalAIAgent(agentId);
      if (!dbAgent) return null;
      
      return {
        id: dbAgent.id,
        name: dbAgent.agentName,
        type: (dbAgent.agentType as AIAgent['type']) || 'treasury_manager',
        ownerId: dbAgent.ownerId || 'system',
        walletAddress: dbAgent.primaryWalletAddress,
        permissions: Array.isArray(dbAgent.capabilities) ? dbAgent.capabilities : [dbAgent.capabilities || 'transfer_funds'],
        isActive: dbAgent.isActive,
        createdAt: dbAgent.createdAt || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting agent from database:', error);
      return null;
    }
  }

  private async getRecentAgentTransactions(agentId: string, hours: number): Promise<AIAgentTransaction[]> {
    // Mock implementation - replace with actual database query
    return [];
  }

  async getUserAgents(userId: string): Promise<AIAgent[]> {
    const agents = await this.discoverAgents();
    return agents.filter(agent => agent.ownerId === userId);
  }

  async getAllNetworkAgents(): Promise<AIAgent[]> {
    return this.discoverAgents();
  }

  async findAgentsForTransaction(amount: number, purpose: string, excludeOwner?: string): Promise<AIAgent[]> {
    return this.discoverAgents({
      hasPermission: 'transfer_funds',
      excludeOwner
    }).then(agents => 
      agents.filter(agent => {
        // Filter based on agent capabilities and transaction requirements
        if (agent.type === 'treasury_manager' && amount > 1000) return true;
        if (agent.type === 'trading_bot' && purpose.toLowerCase().includes('trading')) return true;
        if (agent.type === 'personal_assistant') return true;
        return false;
      })
    );
  }

  async getAgentTransactionHistory(agentId: string, limit: number = 10): Promise<AIAgentTransaction[]> {
    return this.agentTransactions
      .filter(tx => tx.fromAgentId === agentId || tx.toAgentId === agentId)
      .sort((a, b) => new Date(b.metadata.requestedAt).getTime() - new Date(a.metadata.requestedAt).getTime())
      .slice(0, limit);
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
      await loggingService.log('ERROR', 'AI Agent message failed', {
        error: error instanceof Error ? error.message : String(error),
        agentId
      });
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
    const messages = this.agentMessages.get(agentId) || [];
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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