import { db } from "../db.js";
import { creditsAccounts, creditTransactions, apiKeys, users, apiUsageTracking } from "@shared/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

function logApiUsageAsync(params: {
  clientId: string;
  apiEndpoint: string;
  requestMethod: string;
  responseTime?: number;
  pricePaid: number;
  ipAddress?: string;
  userAgent?: string;
}): void {
  Promise.resolve().then(async () => {
    try {
      await db.insert(apiUsageTracking).values({
        clientId: params.clientId,
        apiEndpoint: params.apiEndpoint,
        requestMethod: params.requestMethod,
        responseTime: params.responseTime || null,
        pricePaid: params.pricePaid.toFixed(2),
        billingStatus: 'completed',
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        processedAt: new Date(),
      });
      console.log(`📊 API usage logged: ${params.clientId} → ${params.apiEndpoint} ($${params.pricePaid})`);
    } catch (error: any) {
      console.error(`⚠️ API usage logging failed (non-blocking): ${error.message}`);
    }
  });
}

export type TransactionType = "purchase" | "debit" | "refund" | "adjustment" | "bonus";
export type PaymentMethod = "stripe" | "usdc" | "usdt";

export interface CreditsPurchaseParams {
  userId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreditsDebitParams {
  userId: string;
  amount: number;
  serviceName: string;
  description?: string;
  metadata?: Record<string, any>;
  requestContext?: {
    ipAddress?: string;
    userAgent?: string;
    method?: string;
    responseTime?: number;
  };
}

export class CreditsService {
  private static instance: CreditsService;

  public static getInstance(): CreditsService {
    if (!CreditsService.instance) {
      CreditsService.instance = new CreditsService();
    }
    return CreditsService.instance;
  }

  async getOrCreateAccount(userId: string) {
    let account = await db.query.creditsAccounts.findFirst({
      where: eq(creditsAccounts.userId, userId)
    });

    if (!account) {
      const [newAccount] = await db.insert(creditsAccounts).values({
        userId,
        balance: "0.00"
      }).returning();
      account = newAccount;
    }

    return account;
  }

  async getBalance(userId: string): Promise<number> {
    const account = await this.getOrCreateAccount(userId);
    return parseFloat(account.balance);
  }

  async addCredits(params: CreditsPurchaseParams): Promise<{ success: boolean; newBalance: number; transactionId: number }> {
    // NON-TRANSACTIONAL version for neon-http driver compatibility
    
    // Step 1: Get or create account
    let account = await db.query.creditsAccounts.findFirst({
      where: eq(creditsAccounts.userId, params.userId)
    });

    if (!account) {
      const [newAccount] = await db.insert(creditsAccounts).values({
        userId: params.userId,
        balance: "0.00"
      }).returning();
      account = newAccount;
    }

    const balanceBefore = parseFloat(account.balance);
    const balanceAfter = balanceBefore + params.amount;

    // Step 2: Update balance
    await db.update(creditsAccounts)
      .set({ 
        balance: balanceAfter.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(creditsAccounts.id, account.id));

    // Step 3: Log transaction
    const [transaction] = await db.insert(creditTransactions).values({
      accountId: account.id,
      userId: params.userId,
      type: "purchase",
      amount: params.amount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      referenceId: params.referenceId,
      paymentMethod: params.paymentMethod,
      description: params.description || `Added ${params.amount} credits via ${params.paymentMethod}`,
      metadata: params.metadata
    }).returning();

    console.log(`✅ Credits added: User ${params.userId} +$${params.amount} (${params.paymentMethod})`);

    return {
      success: true,
      newBalance: balanceAfter,
      transactionId: transaction.id
    };
  }

  async deductCredits(params: CreditsDebitParams): Promise<{ success: boolean; newBalance: number; transactionId: number }> {
    // NON-TRANSACTIONAL version for neon-http driver compatibility
    // Uses ATOMIC SQL update with balance check in WHERE clause for concurrency safety
    
    // Step 1: Get account
    const account = await db.query.creditsAccounts.findFirst({
      where: eq(creditsAccounts.userId, params.userId)
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const balanceBefore = parseFloat(account.balance);

    if (balanceBefore < params.amount) {
      throw new Error(`Insufficient credits. Required: $${params.amount}, Available: $${balanceBefore}`);
    }

    // Step 2: ATOMIC update - uses SQL expression with balance check in WHERE clause
    // This prevents race conditions: only succeeds if balance >= amount at execution time
    // Balance is NUMERIC(12,2) so result must also be numeric
    const updateResult = await db.update(creditsAccounts)
      .set({ 
        balance: sql`${creditsAccounts.balance} - ${params.amount}`,
        updatedAt: new Date()
      })
      .where(and(
        eq(creditsAccounts.id, account.id),
        sql`${creditsAccounts.balance} >= ${params.amount}`
      ))
      .returning();

    if (updateResult.length === 0) {
      throw new Error(`Insufficient credits (concurrent update). Required: $${params.amount}`);
    }

    const balanceAfter = parseFloat(updateResult[0].balance);

    // Step 3: Log transaction
    const [transaction] = await db.insert(creditTransactions).values({
      accountId: account.id,
      userId: params.userId,
      type: "debit",
      amount: `-${params.amount.toFixed(2)}`,
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      serviceName: params.serviceName,
      description: params.description || `${params.serviceName} service call`,
      metadata: params.metadata
    }).returning();

    console.log(`💳 Credits deducted: User ${params.userId} -$${params.amount} (${params.serviceName})`);

    const result = {
      success: true,
      newBalance: balanceAfter,
      transactionId: transaction.id
    };

    // Fire-and-forget API usage logging (fully detached via setImmediate, non-blocking)
    if (result.success) {
      logApiUsageAsync({
        clientId: params.userId,
        apiEndpoint: params.serviceName,
        requestMethod: params.requestContext?.method || 'POST',
        responseTime: params.requestContext?.responseTime,
        pricePaid: params.amount,
        ipAddress: params.requestContext?.ipAddress,
        userAgent: params.requestContext?.userAgent,
      });
    }

    return result;
  }

  async getTransactionHistory(userId: string, limit: number = 50) {
    return await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.userId, userId),
      orderBy: [desc(creditTransactions.createdAt)],
      limit
    });
  }

  async generateApiKey(userId: string, name?: string): Promise<{ apiKey: string; keyPrefix: string; keyId: string }> {
    const rawKey = `cr_live_${randomBytes(32).toString("hex")}`;
    const hashedKey = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 12);

    // For GPT users (gpt_...), ensure user exists before creating API key
    if (userId.startsWith('gpt_')) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!existingUser) {
        console.log(`🤖 Creating GPT user: ${userId}`);
        await db.insert(users).values({
          id: userId,
          email: `${userId}@gpt-user.coinrailz.com`,
          username: `gpt_user_${Date.now()}`,
        }).onConflictDoNothing();
      }
    }

    const [key] = await db.insert(apiKeys).values({
      userId,
      keyPrefix,
      hashedKey,
      name: name || "API Key",
      status: "active"
    }).returning();

    console.log(`🔑 API key generated: User ${userId} - ${keyPrefix}...`);

    return {
      apiKey: rawKey,
      keyPrefix,
      keyId: key.id
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; keyId?: string }> {
    if (!apiKey || !apiKey.startsWith("cr_live_")) {
      return { valid: false };
    }

    const allKeys = await db.query.apiKeys.findMany({
      where: and(
        eq(apiKeys.status, "active")
      )
    });

    for (const key of allKeys) {
      const isValid = await bcrypt.compare(apiKey, key.hashedKey);
      if (isValid) {
        await db.update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id));

        return {
          valid: true,
          userId: key.userId,
          keyId: key.id
        };
      }
    }

    return { valid: false };
  }

  async listApiKeys(userId: string) {
    return await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, userId),
      orderBy: [desc(apiKeys.createdAt)]
    });
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await db.update(apiKeys)
      .set({ 
        status: "revoked",
        revokedAt: new Date()
      })
      .where(and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      ))
      .returning();

    if (result.length > 0) {
      console.log(`🔒 API key revoked: ${keyId}`);
      return true;
    }
    return false;
  }
}

export const creditsService = CreditsService.getInstance();
