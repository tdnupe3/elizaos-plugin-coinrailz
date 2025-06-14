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
  agentType?: string;
  description?: string;
  capabilities: string[];
  walletAddress: string;
  walletNetwork: string;
  endpoint?: string;
  apiEndpoint?: string;
  publicKey: string;
  ownerId?: string | null;
  status?: string;
  signature: string;
  preferredCurrencies: string[];
  geolocation?: string;
  timezone?: string;
  metadata?: any;
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
  
  // Agent Registration with Enhanced Security
  async registerAgent(request: AgentRegistrationRequest): Promise<GlobalAIAgent> {
    // Step 1: Basic validation (easy for legitimate agents)
    if (!request.agentName || request.agentName.length < 3) {
      throw new Error("Agent name must be at least 3 characters");
    }

    if (!request.capabilities || request.capabilities.length === 0) {
      throw new Error("At least one capability must be specified");
    }

    // Step 2: Verify wallet address format (prevents typos and basic fraud)
    if (!this.isValidWalletAddress(request.walletAddress, request.walletNetwork)) {
      throw new Error("Invalid wallet address format for specified network");
    }

    // Step 3: Check for duplicate registrations (prevents multi-registration attacks)
    const existingAgent = await db
      .select()
      .from(globalAIAgents)
      .where(eq(globalAIAgents.primaryWalletAddress, request.walletAddress))
      .limit(1);

    if (existingAgent.length > 0) {
      throw new Error("Agent with this wallet address already registered");
    }

    // Step 4: Basic signature verification (optional but recommended)
    if (request.signature && request.publicKey) {
      const isValidSignature = this.verifySignature(
        request.publicKey, 
        request.signature, 
        request.agentName + request.walletAddress
      );
      
      if (!isValidSignature) {
        throw new Error("Invalid digital signature");
      }
    }

    // Step 5: Content filtering for malicious names/descriptions
    if (this.containsSuspiciousContent(request.agentName) || 
        (request.description && this.containsSuspiciousContent(request.description))) {
      throw new Error("Agent name or description contains inappropriate content");
    }

    // Step 6: Rate limiting check per IP/wallet (prevents spam registration)
    const recentRegistrations = await this.getRecentRegistrations(request.walletAddress);
    if (recentRegistrations > 3) {
      throw new Error("Too many registration attempts. Please try again later.");
    }

    const agentId = nanoid();
    const agentData: InsertGlobalAIAgent = {
      id: agentId,
      agentName: request.agentName,
      description: request.description,
      capabilities: request.capabilities,
      primaryWalletAddress: request.walletAddress,
      walletNetwork: request.walletNetwork,
      apiEndpoint: request.apiEndpoint,
      publicKey: request.publicKey,
      signature: request.signature,
      preferredCurrencies: request.preferredCurrencies,
      geolocation: request.geolocation,
      timezone: request.timezone,
      status: "pending_verification", // Start with pending status for new agents
      reputation: "0.0",
      transactionCount: 0,
      totalVolume: "0",
      trustScore: 0.0, // Start with neutral trust score
      verificationLevel: "basic", // Basic verification initially
      suspiciousActivityFlags: 0,
      lastVerificationCheck: new Date()
    };

    const [newAgent] = await db
      .insert(globalAIAgents)
      .values(agentData)
      .returning();

    // Step 7: Auto-activate for low-risk agents, manual review for others
    if (this.isLowRiskAgent(request)) {
      await this.activateAgent(agentId);
    } else {
      // Flag for manual review but allow basic operations
      await this.flagForReview(agentId, "new_agent_review");
    }

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

    // Simple direct query approach
    const agents = await db.select().from(globalAIAgents)
      .where(conditions.length > 0 ? and(...conditions) : eq(globalAIAgents.status, "active"))
      .orderBy(desc(globalAIAgents.lastActive))
      .limit(filter.limit || 50)
      .offset(filter.offset || 0);

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
  async updateAgentActivity(agentId: string, status?: string, metadata?: any): Promise<void> {
    const updateData: any = { lastActive: new Date() };
    
    if (status) {
      updateData.status = status;
    }
    if (metadata) {
      updateData.metadata = metadata;
    }
    
    await db
      .update(globalAIAgents)
      .set(updateData)
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

  // Security helper methods
  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /hack/i, /scam/i, /fraud/i, /steal/i, /phish/i,
      /malware/i, /virus/i, /exploit/i, /attack/i,
      /illegal/i, /laundr/i, /terror/i, /drug/i,
      /<script/i, /javascript:/i, /vbscript:/i,
      /onload=/i, /onerror=/i, /onclick=/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  private async getRecentRegistrations(walletAddress: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const [result] = await db
      .select({ count: count() })
      .from(globalAIAgents)
      .where(
        and(
          eq(globalAIAgents.primaryWalletAddress, walletAddress),
          gte(globalAIAgents.registeredAt, oneHourAgo)
        )
      );
    
    return result.count;
  }

  private isLowRiskAgent(request: AgentRegistrationRequest): boolean {
    // Auto-approve agents with these characteristics
    const trustedNetworks = ['ethereum', 'polygon', 'solana'];
    const standardCapabilities = ['trading', 'analysis', 'monitoring', 'reporting'];
    
    // Check if using trusted network
    if (!trustedNetworks.includes(request.walletNetwork.toLowerCase())) {
      return false;
    }

    // Check if capabilities are standard/safe
    const hasOnlyStandardCapabilities = request.capabilities.every(cap => 
      standardCapabilities.some(std => cap.toLowerCase().includes(std))
    );

    // Check wallet address format more strictly for auto-approval
    const hasValidFormat = this.isValidWalletAddress(request.walletAddress, request.walletNetwork);

    return hasOnlyStandardCapabilities && hasValidFormat && 
           request.agentName.length >= 5 && request.agentName.length <= 50;
  }

  private async activateAgent(agentId: string): Promise<void> {
    await db
      .update(globalAIAgents)
      .set({ 
        status: "active",
        verificationLevel: "verified",
        lastVerificationCheck: new Date()
      })
      .where(eq(globalAIAgents.id, agentId));
  }

  private async flagForReview(agentId: string, reason: string): Promise<void> {
    await db
      .update(globalAIAgents)
      .set({ 
        status: "pending_review",
        metadata: sql`COALESCE(${globalAIAgents.metadata}, '{}')::jsonb || ${{ reviewReason: reason, flaggedAt: new Date().toISOString() }}::jsonb`
      })
      .where(eq(globalAIAgents.id, agentId));
  }

  // Enhanced monitoring methods
  async monitorAgentBehavior(agentId: string, activity: any): Promise<void> {
    const agent = await this.getAgentById(agentId);
    if (!agent) return;

    let suspiciousFlags = 0;

    // Check for suspicious patterns
    if (activity.type === 'transaction' && activity.amount > 10000) {
      suspiciousFlags += 1;
    }

    if (activity.frequency && activity.frequency > 100) { // More than 100 actions per hour
      suspiciousFlags += 2;
    }

    // Update agent's suspicious activity counter
    if (suspiciousFlags > 0) {
      await db
        .update(globalAIAgents)
        .set({
          suspiciousActivityFlags: sql`${globalAIAgents.suspiciousActivityFlags} + ${suspiciousFlags}`
        })
        .where(eq(globalAIAgents.id, agentId));

      // Auto-suspend if too many flags
      if (agent.suspiciousActivityFlags + suspiciousFlags >= 10) {
        await this.suspendAgent(agentId, "automated_suspension_high_risk");
      }
    }
  }

  private async suspendAgent(agentId: string, reason: string): Promise<void> {
    await db
      .update(globalAIAgents)
      .set({
        status: "suspended",
        metadata: sql`COALESCE(${globalAIAgents.metadata}, '{}')::jsonb || ${{ suspensionReason: reason, suspendedAt: new Date().toISOString() }}::jsonb`
      })
      .where(eq(globalAIAgents.id, agentId));
  }
}

export const globalAgentNetwork = new GlobalAgentNetworkService();