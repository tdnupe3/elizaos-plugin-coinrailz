import { db } from '../db';
import { 
  unifiedCreditsAccounts, 
  unifiedCreditsTransactions, 
  unifiedCreditsLinks,
  users,
  iotAccounts 
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { Pool } from '@neondatabase/serverless';

const getPool = () => new Pool({ connectionString: process.env.DATABASE_URL });

export type OwnerType = 'user' | 'iot_account';
export type TransactionType = 'deposit' | 'spend' | 'transfer_in' | 'transfer_out' | 'migration' | 'refund';
export type TransactionSource = 'mcp' | 'iot' | 'stripe' | 'paypal' | 'x402' | 'migration' | 'admin';

interface GetOrCreateAccountResult {
  accountId: string;
  balance: number;
  isNew: boolean;
}

interface TransactionResult {
  transactionId: string;
  newBalance: number;
  success: boolean;
}

interface MigrationResult {
  success: boolean;
  unifiedAccountId: string;
  migratedBalance: number;
  legacyMcpBalance?: number;
  legacyIotBalance?: number;
  message: string;
}

export class UnifiedCreditsService {
  async getOrCreateAccount(ownerType: OwnerType, ownerId: string): Promise<GetOrCreateAccountResult> {
    const existing = await db.select()
      .from(unifiedCreditsAccounts)
      .where(and(
        eq(unifiedCreditsAccounts.ownerType, ownerType),
        eq(unifiedCreditsAccounts.ownerId, ownerId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return {
        accountId: existing[0].id,
        balance: parseFloat(existing[0].balance),
        isNew: false,
      };
    }

    const accountId = `ucred_${nanoid(12)}`;
    await db.insert(unifiedCreditsAccounts).values({
      id: accountId,
      ownerType,
      ownerId,
      balance: '0',
      totalDeposited: '0',
      totalSpent: '0',
      status: 'active',
    });

    return {
      accountId,
      balance: 0,
      isNew: true,
    };
  }

  async getBalance(ownerType: OwnerType, ownerId: string): Promise<number> {
    const account = await db.select()
      .from(unifiedCreditsAccounts)
      .where(and(
        eq(unifiedCreditsAccounts.ownerType, ownerType),
        eq(unifiedCreditsAccounts.ownerId, ownerId)
      ))
      .limit(1);

    if (!account.length) {
      return 0;
    }

    return parseFloat(account[0].balance);
  }

  async getBalanceByAccountId(accountId: string): Promise<number> {
    const account = await db.select()
      .from(unifiedCreditsAccounts)
      .where(eq(unifiedCreditsAccounts.id, accountId))
      .limit(1);

    if (!account.length) {
      return 0;
    }

    return parseFloat(account[0].balance);
  }

  async getAccountDetails(ownerType: OwnerType, ownerId: string): Promise<{
    exists: boolean;
    accountId?: string;
    balance: number;
    totalDeposited: number;
    totalSpent: number;
    createdAt?: Date;
    updatedAt?: Date;
  }> {
    const account = await db.select()
      .from(unifiedCreditsAccounts)
      .where(and(
        eq(unifiedCreditsAccounts.ownerType, ownerType),
        eq(unifiedCreditsAccounts.ownerId, ownerId)
      ))
      .limit(1);

    if (!account.length) {
      return {
        exists: false,
        balance: 0,
        totalDeposited: 0,
        totalSpent: 0,
      };
    }

    return {
      exists: true,
      accountId: account[0].id,
      balance: parseFloat(account[0].balance),
      totalDeposited: parseFloat(account[0].totalDeposited || '0'),
      totalSpent: parseFloat(account[0].totalSpent || '0'),
      createdAt: account[0].createdAt,
      updatedAt: account[0].updatedAt,
    };
  }

  async findExistingDispute(originalTransactionId: string): Promise<boolean> {
    const existing = await db.select()
      .from(unifiedCreditsTransactions)
      .where(and(
        eq(unifiedCreditsTransactions.referenceType, 'dispute_refund'),
        eq(unifiedCreditsTransactions.referenceId, originalTransactionId)
      ))
      .limit(1);

    return existing.length > 0;
  }

  async addCredits(
    ownerType: OwnerType,
    ownerId: string,
    amount: number,
    source: TransactionSource,
    options: {
      referenceType?: string;
      referenceId?: string;
      description?: string;
      idempotencyKey?: string;
    } = {}
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (options.idempotencyKey) {
      const existing = await db.select()
        .from(unifiedCreditsTransactions)
        .where(eq(unifiedCreditsTransactions.idempotencyKey, options.idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        return {
          transactionId: existing[0].id,
          newBalance: parseFloat(existing[0].balanceAfter),
          success: true,
        };
      }
    }

    const { accountId } = await this.getOrCreateAccount(ownerType, ownerId);

    const [updated] = await db.update(unifiedCreditsAccounts)
      .set({
        balance: sql`${unifiedCreditsAccounts.balance} + ${amount}`,
        totalDeposited: sql`${unifiedCreditsAccounts.totalDeposited} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(unifiedCreditsAccounts.id, accountId))
      .returning();

    const transactionId = `ucred_txn_${nanoid(12)}`;
    await db.insert(unifiedCreditsTransactions).values({
      id: transactionId,
      accountId,
      type: 'deposit',
      amount: amount.toString(),
      balanceAfter: updated.balance,
      source,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      description: options.description,
      idempotencyKey: options.idempotencyKey,
    });

    return {
      transactionId,
      newBalance: parseFloat(updated.balance),
      success: true,
    };
  }

  async deductCredits(
    ownerType: OwnerType,
    ownerId: string,
    amount: number,
    source: TransactionSource,
    options: {
      referenceType?: string;
      referenceId?: string;
      description?: string;
      idempotencyKey?: string;
    } = {}
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (options.idempotencyKey) {
      const existing = await db.select()
        .from(unifiedCreditsTransactions)
        .where(eq(unifiedCreditsTransactions.idempotencyKey, options.idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        return {
          transactionId: existing[0].id,
          newBalance: parseFloat(existing[0].balanceAfter),
          success: true,
        };
      }
    }

    const currentBalance = await this.getBalance(ownerType, ownerId);
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
    }

    const { accountId } = await this.getOrCreateAccount(ownerType, ownerId);

    const [updated] = await db.update(unifiedCreditsAccounts)
      .set({
        balance: sql`${unifiedCreditsAccounts.balance} - ${amount}`,
        totalSpent: sql`${unifiedCreditsAccounts.totalSpent} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(unifiedCreditsAccounts.id, accountId),
        sql`${unifiedCreditsAccounts.balance} >= ${amount}`
      ))
      .returning();

    if (!updated) {
      throw new Error('Insufficient balance (race condition)');
    }

    const transactionId = `ucred_txn_${nanoid(12)}`;
    await db.insert(unifiedCreditsTransactions).values({
      id: transactionId,
      accountId,
      type: 'spend',
      amount: (-amount).toString(),
      balanceAfter: updated.balance,
      source,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      description: options.description,
      idempotencyKey: options.idempotencyKey,
    });

    return {
      transactionId,
      newBalance: parseFloat(updated.balance),
      success: true,
    };
  }

  async migrateToUnified(
    userId: string,
    iotAccountId: string
  ): Promise<MigrationResult> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    const [iotAccount] = await db.select()
      .from(iotAccounts)
      .where(eq(iotAccounts.id, iotAccountId))
      .limit(1);

    if (!iotAccount) {
      throw new Error('IoT account not found');
    }

    if (iotAccount.ownerId && iotAccount.ownerId !== userId) {
      throw new Error('IoT account belongs to a different user');
    }

    const existingLink = await db.select()
      .from(unifiedCreditsLinks)
      .where(and(
        eq(unifiedCreditsLinks.userId, userId),
        eq(unifiedCreditsLinks.iotAccountId, iotAccountId),
        eq(unifiedCreditsLinks.status, 'active')
      ))
      .limit(1);

    if (existingLink.length > 0) {
      const balance = await this.getBalanceByAccountId(existingLink[0].unifiedAccountId);
      return {
        success: true,
        unifiedAccountId: existingLink[0].unifiedAccountId,
        migratedBalance: balance,
        message: 'Already migrated to unified credits',
      };
    }

    const { accountId: unifiedAccountId, isNew } = await this.getOrCreateAccount('user', userId);

    const mcpBalance = user.creditsBalance ? parseFloat(user.creditsBalance) : 0;
    const iotBalance = iotAccount.creditsBalance ? parseFloat(iotAccount.creditsBalance) : 0;
    const totalMigrated = mcpBalance + iotBalance;

    if (totalMigrated > 0) {
      await this.addCredits('user', userId, totalMigrated, 'migration', {
        referenceType: 'migration',
        referenceId: `${userId}:${iotAccountId}`,
        description: `Migration from MCP ($${mcpBalance.toFixed(2)}) + IoT ($${iotBalance.toFixed(2)})`,
        idempotencyKey: `migrate_${userId}_${iotAccountId}`,
      });
      
      // Zero out legacy balances to prevent double-spend
      if (mcpBalance > 0) {
        await db.update(users)
          .set({ creditsBalance: '0' })
          .where(eq(users.id, userId));
      }
      if (iotBalance > 0) {
        await db.update(iotAccounts)
          .set({ creditsBalance: '0' })
          .where(eq(iotAccounts.id, iotAccountId));
      }
    }

    const linkId = `ucred_link_${nanoid(12)}`;
    await db.insert(unifiedCreditsLinks).values({
      id: linkId,
      unifiedAccountId,
      userId,
      iotAccountId,
      linkType: 'primary',
      status: 'active',
    });

    if (!iotAccount.ownerId) {
      await db.update(iotAccounts)
        .set({ ownerId: userId })
        .where(eq(iotAccounts.id, iotAccountId));
    }

    const finalBalance = await this.getBalanceByAccountId(unifiedAccountId);

    return {
      success: true,
      unifiedAccountId,
      migratedBalance: finalBalance,
      legacyMcpBalance: mcpBalance,
      legacyIotBalance: iotBalance,
      message: `Successfully migrated $${totalMigrated.toFixed(2)} to unified credits pool`,
    };
  }

  async getTransactionHistory(
    ownerType: OwnerType,
    ownerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: any[]; total: number }> {
    const { accountId } = await this.getOrCreateAccount(ownerType, ownerId);

    const transactions = await db.select()
      .from(unifiedCreditsTransactions)
      .where(eq(unifiedCreditsTransactions.accountId, accountId))
      .orderBy(sql`${unifiedCreditsTransactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(unifiedCreditsTransactions)
      .where(eq(unifiedCreditsTransactions.accountId, accountId));

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceAfter: parseFloat(t.balanceAfter),
        source: t.source,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        description: t.description,
        createdAt: t.createdAt,
      })),
      total: Number(count),
    };
  }

  async getLinkedAccounts(userId: string): Promise<{ 
    unifiedAccountId: string | null; 
    linkedIotAccounts: string[];
  }> {
    const links = await db.select()
      .from(unifiedCreditsLinks)
      .where(and(
        eq(unifiedCreditsLinks.userId, userId),
        eq(unifiedCreditsLinks.status, 'active')
      ));

    if (!links.length) {
      return {
        unifiedAccountId: null,
        linkedIotAccounts: [],
      };
    }

    return {
      unifiedAccountId: links[0].unifiedAccountId,
      linkedIotAccounts: links.filter(l => l.iotAccountId).map(l => l.iotAccountId!),
    };
  }

  async hasUnifiedCredits(ownerType: OwnerType, ownerId: string): Promise<boolean> {
    const account = await db.select()
      .from(unifiedCreditsAccounts)
      .where(and(
        eq(unifiedCreditsAccounts.ownerType, ownerType),
        eq(unifiedCreditsAccounts.ownerId, ownerId)
      ))
      .limit(1);

    return account.length > 0;
  }
}

export const unifiedCreditsService = new UnifiedCreditsService();
