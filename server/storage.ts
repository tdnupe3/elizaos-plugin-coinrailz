import {
  users,
  transactions,
  cryptoHoldings,
  cryptoTransactions,
  complianceReports,
  apiIntegrationLogs,
  kycVerifications,
  type User,
  type UpsertUser,
  type Transaction,
  type InsertTransaction,
  type CryptoHolding,
  type InsertCryptoHolding,
  type CryptoTransaction,
  type InsertCryptoTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sum } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Balance operations
  updateUserBalance(userId: string, amount: string): Promise<User>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  // Balance operations
  async updateUserBalance(userId: string, amount: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        usdBalance: amount,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
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
}

export const storage = new DatabaseStorage();
