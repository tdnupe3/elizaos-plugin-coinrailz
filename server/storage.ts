import {
  users,
  transactions,
  walletBalances,
  fundingTransactions,
  cryptoHoldings,
  cryptoTransactions,
  complianceReports,
  apiIntegrationLogs,
  kycVerifications,
  referrals,
  type User,
  type UpsertUser,
  type Transaction,
  type InsertTransaction,
  type WalletBalance,
  type InsertWalletBalance,
  type FundingTransaction,
  type InsertFundingTransaction,
  type CryptoHolding,
  type InsertCryptoHolding,
  type CryptoTransaction,
  type InsertCryptoTransaction,
  type Referral,
  type InsertReferral,
  cryptoTransfers,
  type CryptoTransfer,
  type InsertCryptoTransfer,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sum, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Digital Wallet operations
  getUserWalletBalances(userId: string): Promise<WalletBalance[]>;
  getWalletBalance(userId: string, currency: string): Promise<WalletBalance | undefined>;
  createWalletBalance(wallet: InsertWalletBalance): Promise<WalletBalance>;
  updateWalletBalance(userId: string, currency: string, amount: string, operation: 'add' | 'subtract'): Promise<WalletBalance>;
  freezeWalletFunds(userId: string, currency: string, amount: string): Promise<void>;
  unfreezeWalletFunds(userId: string, currency: string, amount: string): Promise<void>;
  
  // Funding operations
  createFundingTransaction(funding: InsertFundingTransaction): Promise<FundingTransaction>;
  getUserFundingTransactions(userId: string, limit?: number): Promise<FundingTransaction[]>;
  updateFundingTransactionStatus(id: number, status: string): Promise<void>;
  
  // Enhanced transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  updateTransactionStatus(id: number, status: string): Promise<void>;
  
  // Crypto operations
  getUserCryptoHoldings(userId: string): Promise<CryptoHolding[]>;
  createCryptoHolding(holding: InsertCryptoHolding): Promise<CryptoHolding>;
  updateCryptoHolding(userId: string, coinSymbol: string, amount: string): Promise<CryptoHolding | undefined>;
  createCryptoTransaction(transaction: InsertCryptoTransaction): Promise<CryptoTransaction>;
  getUserCryptoTransactions(userId: string, limit?: number): Promise<CryptoTransaction[]>;
  
  // Compliance operations
  createComplianceReport(report: any): Promise<any>;
  createAPILog(log: any): Promise<any>;
  createKYCVerification(verification: any): Promise<any>;
  updateUserKYCStatus(userId: string, status: string): Promise<User>;
  
  // Referral operations
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  getUserReferrals(userId: string): Promise<Referral[]>;
  getPendingReferralByReferee(refereeId: string): Promise<Referral | undefined>;
  updateReferralStatus(referralId: number, status: string): Promise<void>;
  incrementUserReferralCount(userId: string): Promise<void>;
  addReferralBonus(userId: string, amount: number): Promise<void>;
  
  // Crypto transfer operations
  createCryptoTransfer(transfer: InsertCryptoTransfer): Promise<CryptoTransfer>;
  getUserCryptoTransfers(userId: string, limit?: number): Promise<CryptoTransfer[]>;
  updateCryptoTransferStatus(id: number, status: string, transactionHash?: string): Promise<void>;
  
  // AI Agent operations
  getAgent(agentId: string): Promise<any>;
  createAgent(agentData: any): Promise<any>;
  updateAgentReferralCode(agentId: string, referralCode: string): Promise<void>;
  getAgentByReferralCode(referralCode: string): Promise<any>;
  updateAgentReferredBy(agentId: string, referrerId: string): Promise<void>;
  updateAgentFirstTransactionStatus(agentId: string, status: boolean): Promise<void>;
  incrementAgentReferralCount(agentId: string): Promise<void>;
  addAgentReferralRewards(agentId: string, amount: number): Promise<void>;
  
  // AI Agent Referral operations
  createAgentReferral(referralData: any): Promise<any>;
  getAgentReferrals(agentId: string): Promise<any[]>;
  updateReferralReward(referralId: number, amount: string, currency: string, completed: boolean): Promise<void>;
  getTopReferrers(limit: number): Promise<any[]>;
  
  // AI Agent Service operations
  createServiceListing(listingData: any): Promise<any>;
  getServiceListing(listingId: number): Promise<any>;
  getServiceListings(filters?: any): Promise<any[]>;
  getAgentServiceListings(agentId: string): Promise<any[]>;
  createServiceOrder(orderData: any): Promise<any>;
  getServiceOrder(orderId: string): Promise<any>;
  getAgentServiceOrders(agentId: string): Promise<any[]>;
  updateServiceOrderStatus(orderId: number, status: string, updateData?: any): Promise<void>;
  updateServiceListingStats(listingId: number, revenue: number, rating?: number): Promise<void>;
  getTrendingServices(limit: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Digital Wallet operations
  async getUserWalletBalances(userId: string): Promise<WalletBalance[]> {
    return await db.select().from(walletBalances)
      .where(and(eq(walletBalances.userId, userId), eq(walletBalances.isActive, true)))
      .orderBy(walletBalances.currency);
  }

  async getWalletBalance(userId: string, currency: string): Promise<WalletBalance | undefined> {
    const [wallet] = await db.select().from(walletBalances)
      .where(and(
        eq(walletBalances.userId, userId),
        eq(walletBalances.currency, currency),
        eq(walletBalances.isActive, true)
      ));
    return wallet;
  }

  async createWalletBalance(wallet: InsertWalletBalance): Promise<WalletBalance> {
    const [newWallet] = await db
      .insert(walletBalances)
      .values(wallet)
      .returning();
    return newWallet;
  }

  async updateWalletBalance(userId: string, currency: string, amount: string, operation: 'add' | 'subtract'): Promise<WalletBalance> {
    const operator = operation === 'add' ? '+' : '-';
    const [wallet] = await db
      .update(walletBalances)
      .set({ 
        balance: sql`${walletBalances.balance} ${sql.raw(operator)} ${amount}`,
        availableBalance: sql`${walletBalances.availableBalance} ${sql.raw(operator)} ${amount}`,
        updatedAt: new Date()
      })
      .where(and(
        eq(walletBalances.userId, userId),
        eq(walletBalances.currency, currency)
      ))
      .returning();
    return wallet;
  }

  async freezeWalletFunds(userId: string, currency: string, amount: string): Promise<void> {
    await db
      .update(walletBalances)
      .set({ 
        availableBalance: sql`${walletBalances.availableBalance} - ${amount}`,
        frozenBalance: sql`${walletBalances.frozenBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(and(
        eq(walletBalances.userId, userId),
        eq(walletBalances.currency, currency)
      ));
  }

  async unfreezeWalletFunds(userId: string, currency: string, amount: string): Promise<void> {
    await db
      .update(walletBalances)
      .set({ 
        availableBalance: sql`${walletBalances.availableBalance} + ${amount}`,
        frozenBalance: sql`${walletBalances.frozenBalance} - ${amount}`,
        updatedAt: new Date()
      })
      .where(and(
        eq(walletBalances.userId, userId),
        eq(walletBalances.currency, currency)
      ));
  }

  // Funding operations
  async createFundingTransaction(funding: InsertFundingTransaction): Promise<FundingTransaction> {
    const [transaction] = await db
      .insert(fundingTransactions)
      .values(funding)
      .returning();
    return transaction;
  }

  async getUserFundingTransactions(userId: string, limit: number = 10): Promise<FundingTransaction[]> {
    return await db.select().from(fundingTransactions)
      .where(eq(fundingTransactions.userId, userId))
      .orderBy(desc(fundingTransactions.createdAt))
      .limit(limit);
  }

  async updateFundingTransactionStatus(id: number, status: string): Promise<void> {
    await db
      .update(fundingTransactions)
      .set({ 
        status,
        completedAt: status === 'completed' ? new Date() : undefined
      })
      .where(eq(fundingTransactions.id, id));
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getUserTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        or(
          eq(transactions.fromUserId, userId),
          eq(transactions.toUserId, userId)
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string): Promise<void> {
    await db
      .update(transactions)
      .set({ 
        status,
        completedAt: status === 'completed' ? new Date() : undefined
      })
      .where(eq(transactions.id, id));
  }

  // Crypto operations
  async getUserCryptoHoldings(userId: string): Promise<CryptoHolding[]> {
    return await db
      .select()
      .from(cryptoHoldings)
      .where(eq(cryptoHoldings.userId, userId));
  }

  async createCryptoHolding(holding: InsertCryptoHolding): Promise<CryptoHolding> {
    const [newHolding] = await db
      .insert(cryptoHoldings)
      .values(holding)
      .returning();
    return newHolding;
  }

  async updateCryptoHolding(userId: string, coinSymbol: string, amount: string): Promise<CryptoHolding | undefined> {
    const [holding] = await db
      .update(cryptoHoldings)
      .set({ 
        amount,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cryptoHoldings.userId, userId),
          eq(cryptoHoldings.coinSymbol, coinSymbol)
        )
      )
      .returning();
    return holding;
  }

  async createCryptoTransaction(transaction: InsertCryptoTransaction): Promise<CryptoTransaction> {
    const [newTransaction] = await db
      .insert(cryptoTransactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getUserCryptoTransactions(userId: string, limit: number = 10): Promise<CryptoTransaction[]> {
    return await db
      .select()
      .from(cryptoTransactions)
      .where(eq(cryptoTransactions.userId, userId))
      .orderBy(desc(cryptoTransactions.createdAt))
      .limit(limit);
  }

  // Compliance operations
  async createComplianceReport(report: any): Promise<any> {
    const [newReport] = await db
      .insert(complianceReports)
      .values(report)
      .returning();
    return newReport;
  }

  async createAPILog(log: any): Promise<any> {
    const [newLog] = await db
      .insert(apiIntegrationLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async createKYCVerification(verification: any): Promise<any> {
    const [newVerification] = await db
      .insert(kycVerifications)
      .values(verification)
      .returning();
    return newVerification;
  }

  async updateUserKYCStatus(userId: string, status: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        kycStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Referral operations
  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [newReferral] = await db
      .insert(referrals)
      .values(referral)
      .returning();
    return newReferral;
  }

  async getUserReferrals(userId: string): Promise<Referral[]> {
    return await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));
  }

  async getPendingReferralByReferee(refereeId: string): Promise<Referral | undefined> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.refereeId, refereeId), eq(referrals.status, "pending")));
    return referral;
  }

  async updateReferralStatus(referralId: number, status: string): Promise<void> {
    await db
      .update(referrals)
      .set({ 
        status, 
        completedAt: status === "completed" ? new Date() : undefined,
        paidAt: status === "paid" ? new Date() : undefined 
      })
      .where(eq(referrals.id, referralId));
  }

  async incrementUserReferralCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ totalReferrals: sql`${users.totalReferrals} + 1` })
      .where(eq(users.id, userId));
  }

  async addReferralBonus(userId: string, amount: number): Promise<void> {
    await db
      .update(users)
      .set({ 
        referralBonus: sql`${users.referralBonus} + ${amount}`,
        usdBalance: sql`${users.usdBalance} + ${amount}`
      })
      .where(eq(users.id, userId));
  }

  // AI Agent operations
  async getAgent(agentId: string): Promise<any> {
    const [agent] = await db.select().from(globalAIAgents).where(eq(globalAIAgents.id, agentId));
    return agent;
  }

  async createAgent(agentData: any): Promise<any> {
    const [agent] = await db.insert(globalAIAgents).values(agentData).returning();
    return agent;
  }

  async updateAgentReferralCode(agentId: string, referralCode: string): Promise<void> {
    await db.update(globalAIAgents)
      .set({ referralCode })
      .where(eq(globalAIAgents.id, agentId));
  }

  async getAgentByReferralCode(referralCode: string): Promise<any> {
    const [agent] = await db.select().from(globalAIAgents).where(eq(globalAIAgents.referralCode, referralCode));
    return agent;
  }

  async updateAgentReferredBy(agentId: string, referrerId: string): Promise<void> {
    await db.update(globalAIAgents)
      .set({ referredByAgent: referrerId })
      .where(eq(globalAIAgents.id, agentId));
  }

  async updateAgentFirstTransactionStatus(agentId: string, status: boolean): Promise<void> {
    await db.update(globalAIAgents)
      .set({ hasCompletedFirstTransaction: status })
      .where(eq(globalAIAgents.id, agentId));
  }

  async incrementAgentReferralCount(agentId: string): Promise<void> {
    await db.update(globalAIAgents)
      .set({ 
        referralCount: sql`${globalAIAgents.referralCount} + 1`
      })
      .where(eq(globalAIAgents.id, agentId));
  }

  async addAgentReferralRewards(agentId: string, amount: number): Promise<void> {
    await db.update(globalAIAgents)
      .set({ 
        referralRewards: sql`${globalAIAgents.referralRewards} + ${amount.toString()}`
      })
      .where(eq(globalAIAgents.id, agentId));
  }

  // AI Agent Referral operations
  async createAgentReferral(referralData: any): Promise<any> {
    const [referral] = await db.insert(agentReferrals).values(referralData).returning();
    return referral;
  }

  async getAgentReferrals(agentId: string): Promise<any[]> {
    return await db.select().from(agentReferrals).where(eq(agentReferrals.referrerAgentId, agentId));
  }

  async updateReferralReward(referralId: number, amount: string, currency: string, completed: boolean): Promise<void> {
    await db.update(agentReferrals)
      .set({ 
        rewardAmount: amount,
        rewardCurrency: currency,
        firstTransactionCompleted: completed,
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? new Date() : null
      })
      .where(eq(agentReferrals.id, referralId));
  }

  async getTopReferrers(limit: number): Promise<any[]> {
    return await db.select()
      .from(globalAIAgents)
      .orderBy(desc(globalAIAgents.referralCount))
      .limit(limit);
  }

  // AI Agent Service operations
  async createServiceListing(listingData: any): Promise<any> {
    const [listing] = await db.insert(agentServiceListings).values(listingData).returning();
    return listing;
  }

  async getServiceListing(listingId: number): Promise<any> {
    const [listing] = await db.select().from(agentServiceListings).where(eq(agentServiceListings.id, listingId));
    return listing;
  }

  async getServiceListings(filters?: any): Promise<any[]> {
    let query = db.select().from(agentServiceListings).where(eq(agentServiceListings.isActive, true));
    
    if (filters?.category) {
      query = query.where(eq(agentServiceListings.category, filters.category));
    }
    if (filters?.maxPrice) {
      query = query.where(lte(agentServiceListings.basePrice, filters.maxPrice.toString()));
    }
    if (filters?.availabilityStatus) {
      query = query.where(eq(agentServiceListings.availabilityStatus, filters.availabilityStatus));
    }
    
    return await query;
  }

  async getAgentServiceListings(agentId: string): Promise<any[]> {
    return await db.select().from(agentServiceListings).where(eq(agentServiceListings.agentId, agentId));
  }

  async createServiceOrder(orderData: any): Promise<any> {
    const [order] = await db.insert(agentServiceOrders).values(orderData).returning();
    return order;
  }

  async getServiceOrder(orderId: string): Promise<any> {
    const [order] = await db.select().from(agentServiceOrders).where(eq(agentServiceOrders.orderId, orderId));
    return order;
  }

  async getAgentServiceOrders(agentId: string): Promise<any[]> {
    return await db.select().from(agentServiceOrders)
      .where(or(
        eq(agentServiceOrders.buyerAgentId, agentId),
        eq(agentServiceOrders.sellerAgentId, agentId)
      ));
  }

  async updateServiceOrderStatus(orderId: number, status: string, updateData?: any): Promise<void> {
    const updateSet: any = { 
      orderStatus: status,
      updatedAt: new Date()
    };
    
    if (updateData) {
      Object.assign(updateSet, updateData);
    }

    await db.update(agentServiceOrders)
      .set(updateSet)
      .where(eq(agentServiceOrders.id, orderId));
  }

  async updateServiceListingStats(listingId: number, revenue: number, rating?: number): Promise<void> {
    const updateSet: any = {
      completedOrders: sql`${agentServiceListings.completedOrders} + 1`,
      totalRevenue: sql`${agentServiceListings.totalRevenue} + ${revenue.toString()}`,
      updatedAt: new Date()
    };

    if (rating) {
      updateSet.rating = rating.toString();
    }

    await db.update(agentServiceListings)
      .set(updateSet)
      .where(eq(agentServiceListings.id, listingId));
  }

  async getTrendingServices(limit: number): Promise<any[]> {
    return await db.select()
      .from(agentServiceListings)
      .where(eq(agentServiceListings.isActive, true))
      .orderBy(desc(agentServiceListings.completedOrders))
      .limit(limit);
  }

  // Crypto transfer operations
  async createCryptoTransfer(transfer: InsertCryptoTransfer): Promise<CryptoTransfer> {
    const [cryptoTransfer] = await db
      .insert(cryptoTransfers)
      .values(transfer)
      .returning();
    return cryptoTransfer;
  }

  async getUserCryptoTransfers(userId: string, limit: number = 10): Promise<CryptoTransfer[]> {
    return await db
      .select()
      .from(cryptoTransfers)
      .where(or(eq(cryptoTransfers.fromUserId, userId), eq(cryptoTransfers.toUserId, userId)))
      .orderBy(desc(cryptoTransfers.createdAt))
      .limit(limit);
  }

  async updateCryptoTransferStatus(id: number, status: string, transactionHash?: string): Promise<void> {
    await db
      .update(cryptoTransfers)
      .set({ 
        status,
        transactionHash,
        confirmedAt: status === "confirmed" ? new Date() : undefined
      })
      .where(eq(cryptoTransfers.id, id));
  }
}

export const storage = new DatabaseStorage();
