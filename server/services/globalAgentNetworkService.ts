import { db } from "../db";
import { 
  globalAIAgents, 
  agentTransactions, 
  agentCommunications, 
  agentContracts, 
  networkStats,
  type GlobalAIAgent,
  type InsertGlobalAIAgent,
  type AgentTransaction,
  type InsertAgentTransaction,
  type AgentCommunication,
  type InsertAgentCommunication,
  type AgentContract,
  type InsertAgentContract,
  type NetworkStats
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { FeeCalculator, type AIAgentFeeCalculation } from "../utils/feeCalculator";
import { nanoid } from "nanoid";
import crypto from "crypto";

export interface AgentRegistrationRequest {
  agentName: string;
  description?: string;
  capabilities: string[];
  walletAddress: string;
  walletNetwork: string;
  apiEndpoint?: string;
  publicKey: string;
  signature: string;
  preferredCurrencies: string[];
  geolocation?: string;
  timezone?: string;
}

export interface AgentDiscoveryFilter {
  capabilities?: string[];
  currencies?: string[];
  geolocation?: string;
  minReputation?: number;
  maxReputation?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionRequest {
  initiatorAgentId: string;
  recipientAgentId?: string;
  transactionType: string;
  amount: string;
  currency: string;
  description?: string;
  metadata?: any;
}

export interface NetworkStatistics {
  activeAgents: number;
  totalTransactions: number;
  transactionVolume: string;
  platformFees: string;
  recentTransactions: AgentTransaction[];
  topAgents: GlobalAIAgent[];
  networkHealth: number;
  supportedCurrencies: string[];
  averageTransactionSize: string;
}

export class GlobalAgentNetworkService {
  
  // Agent Registration
  async registerAgent(request: AgentRegistrationRequest): Promise<GlobalAIAgent> {
    // Verify digital signature
    const isValidSignature = this.verifySignature(
      request.publicKey, 
      request.signature, 
      request.agentName + request.walletAddress
    );
    
    if (!isValidSignature) {
      throw new Error("Invalid digital signature");
    }

    // Verify wallet address format
    if (!this.isValidWalletAddress(request.walletAddress, request.walletNetwork)) {
      throw new Error("Invalid wallet address format");
    }

    // Check if agent already exists
    const existingAgent = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.walletAddress, request.walletAddress))
      .limit(1);

    if (existingAgent.length > 0) {
      throw new Error("Agent with this wallet address already registered");
    }

    const agentId = nanoid();
    const agentData: InsertGlobalAIAgent = {
      id: agentId,
      agentName: request.agentName,
      description: request.description,
      capabilities: request.capabilities,
      walletAddress: request.walletAddress,
      walletNetwork: request.walletNetwork,
      apiEndpoint: request.apiEndpoint,
      publicKey: request.publicKey,
      signature: request.signature,
      preferredCurrencies: request.preferredCurrencies,
      geolocation: request.geolocation,
      timezone: request.timezone,
      status: "active",
      reputation: "0.0",
      transactionCount: 0,
      totalVolume: "0"
    };

    const [newAgent] = await db
      .insert(globalAIAgents)
      .values(agentData)
      .returning();

    // Update network statistics
    await this.updateNetworkStats();

    return newAgent;
  }

  // Agent Discovery
  async discoverAgents(filter: AgentDiscoveryFilter = {}): Promise<GlobalAIAgent[]> {
    const conditions = [];
    
    if (filter.status) {
      conditions.push(eq(globalAIAgents.status, filter.status));
    } else {
      conditions.push(eq(globalAIAgents.status, "active"));
    }

    if (filter.geolocation) {
      conditions.push(eq(globalAIAgents.geolocation, filter.geolocation));
    }

    let queryBuilder = db.select().from(globalAIAgents);

    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }

    queryBuilder = queryBuilder.orderBy(desc(globalAIAgents.lastActive));

    if (filter.limit) {
      queryBuilder = queryBuilder.limit(filter.limit);
    }

    if (filter.offset) {
      queryBuilder = queryBuilder.offset(filter.offset);
    }

    const agents = await queryBuilder;

    // Filter by capabilities and currencies if specified
    let filteredAgents = agents;

    if (filter.capabilities && filter.capabilities.length > 0) {
      filteredAgents = filteredAgents.filter(agent => 
        filter.capabilities!.some(capability => 
          (agent.capabilities as string[]).includes(capability)
        )
      );
    }

    if (filter.currencies && filter.currencies.length > 0) {
      filteredAgents = filteredAgents.filter(agent => 
        filter.currencies!.some(currency => 
          (agent.preferredCurrencies as string[]).includes(currency)
        )
      );
    }

    return filteredAgents;
  }

  // Transaction Processing
  async processTransaction(request: TransactionRequest): Promise<AgentTransaction> {
    // Validate initiator agent
    const initiatorAgent = await this.getAgentById(request.initiatorAgentId);
    if (!initiatorAgent) {
      throw new Error("Initiator agent not found");
    }

    // Validate recipient agent if specified
    let recipientAgent: GlobalAIAgent | null = null;
    if (request.recipientAgentId) {
      recipientAgent = await this.getAgentById(request.recipientAgentId);
      if (!recipientAgent) {
        throw new Error("Recipient agent not found");
      }
    }

    // Calculate fees
    const amount = parseFloat(request.amount);
    const feeCalculation = FeeCalculator.calculateAIAgentFee(amount, request.currency);

    const transactionId = nanoid();
    const transactionData: InsertAgentTransaction = {
      transactionId,
      initiatorAgentId: request.initiatorAgentId,
      recipientAgentId: request.recipientAgentId,
      transactionType: request.transactionType,
      amount: request.amount,
      currency: request.currency,
      status: "pending",
      platformFee: feeCalculation.platformFee.toString(),
      gasFee: feeCalculation.gasFee.toString(),
      agentCommission: feeCalculation.agentCommission.toString(),
      networkFee: feeCalculation.networkFee.toString(),
      totalFees: feeCalculation.totalFee.toString(),
      description: request.description,
      metadata: request.metadata
    };

    const [transaction] = await db
      .insert(agentTransactions)
      .values(transactionData)
      .returning();

    // Update agent statistics
    await this.updateAgentStats(request.initiatorAgentId, amount);
    if (request.recipientAgentId) {
      await this.updateAgentStats(request.recipientAgentId, amount);
    }

    // Update network statistics
    await this.updateNetworkStats();

    return transaction;
  }

  // Agent Communication
  async sendMessage(fromAgentId: string, toAgentId: string, content: string, messageType: string = "direct", metadata?: any): Promise<AgentCommunication> {
    const messageData: InsertAgentCommunication = {
      fromAgentId,
      toAgentId,
      messageType,
      content,
      encrypted: false,
      metadata
    };

    const [message] = await db
      .insert(agentCommunications)
      .values(messageData)
      .returning();

    return message;
  }

  // Get Agent Messages
  async getAgentMessages(agentId: string, limit: number = 50): Promise<AgentCommunication[]> {
    return await db
      .select()
      .from(agentCommunications)
      .where(
        sql`${agentCommunications.fromAgentId} = ${agentId} OR ${agentCommunications.toAgentId} = ${agentId}`
      )
      .orderBy(desc(agentCommunications.createdAt))
      .limit(limit);
  }

  // Network Statistics
  async getNetworkStatistics(): Promise<NetworkStatistics> {
    // Get basic counts
    const [agentCount] = await db
      .select({ count: count() })
      .from(globalAIAgents)
      .where(eq(globalAIAgents.status, "active"));

    const [transactionCount] = await db
      .select({ count: count() })
      .from(agentTransactions);

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(agentTransactions)
      .orderBy(desc(agentTransactions.createdAt))
      .limit(10);

    // Get top agents by reputation
    const topAgents = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.status, "active"))
      .orderBy(desc(globalAIAgents.reputation))
      .limit(5);

    // Calculate total volume
    const volumeResult = await db
      .select({
        totalVolume: sql`COALESCE(SUM(CAST(${agentTransactions.amount} AS DECIMAL)), 0)`
      })
      .from(agentTransactions)
      .where(eq(agentTransactions.status, "completed"));

    // Calculate total platform fees
    const feesResult = await db
      .select({
        totalFees: sql`COALESCE(SUM(CAST(${agentTransactions.platformFee} AS DECIMAL)), 0)`
      })
      .from(agentTransactions)
      .where(eq(agentTransactions.status, "completed"));

    return {
      activeAgents: agentCount.count,
      totalTransactions: transactionCount.count,
      transactionVolume: volumeResult[0]?.totalVolume?.toString() || "0",
      platformFees: feesResult[0]?.totalFees?.toString() || "0",
      recentTransactions,
      topAgents,
      networkHealth: this.calculateNetworkHealth(agentCount.count, transactionCount.count),
      supportedCurrencies: ["USD", "ETH", "SOL", "BTC", "USDC", "USDT"],
      averageTransactionSize: "0"
    };
  }

  // Get Agent by ID
  async getAgentById(agentId: string): Promise<GlobalAIAgent | null> {
    const [agent] = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.id, agentId))
      .limit(1);

    return agent || null;
  }

  // Get Agent Transactions
  async getAgentTransactions(agentId: string, limit: number = 50): Promise<AgentTransaction[]> {
    return await db
      .select()
      .from(agentTransactions)
      .where(
        sql`${agentTransactions.initiatorAgentId} = ${agentId} OR ${agentTransactions.recipientAgentId} = ${agentId}`
      )
      .orderBy(desc(agentTransactions.createdAt))
      .limit(limit);
  }

  // Update Agent Activity
  async updateAgentActivity(agentId: string): Promise<void> {
    await db
      .update(globalAIAgents)
      .set({ lastActive: new Date() })
      .where(eq(globalAIAgents.id, agentId));
  }

  // Private helper methods
  private verifySignature(publicKey: string, signature: string, message: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private isValidWalletAddress(address: string, network: string): boolean {
    switch (network.toLowerCase()) {
      case 'ethereum':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case 'bitcoin':
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[a-z0-9]{39,59}$/.test(address);
      default:
        return true; // Allow unknown networks for flexibility
    }
  }

  private async updateAgentStats(agentId: string, transactionAmount: number): Promise<void> {
    await db
      .update(globalAIAgents)
      .set({
        transactionCount: sql`${globalAIAgents.transactionCount} + 1`,
        totalVolume: sql`CAST(${globalAIAgents.totalVolume} AS DECIMAL) + ${transactionAmount}`,
        lastActive: new Date()
      })
      .where(eq(globalAIAgents.id, agentId));
  }

  private async updateNetworkStats(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // This would typically update daily statistics
    // Implementation depends on specific requirements
  }

  private calculateNetworkHealth(activeAgents: number, totalTransactions: number): number {
    // Simple health calculation based on activity
    const agentScore = Math.min(activeAgents / 100, 1.0); // Normalize to 100 agents
    const transactionScore = Math.min(totalTransactions / 1000, 1.0); // Normalize to 1000 transactions
    return (agentScore + transactionScore) / 2;
  }
}

export const globalAgentNetwork = new GlobalAgentNetworkService();