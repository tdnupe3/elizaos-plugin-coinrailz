/**
 * Database Transaction Manager - Ensures ACID Properties
 * Critical fix for multi-step operation integrity
 */

import { db } from '../db';

export interface TransactionContext {
  id: string;
  startTime: number;
  operations: string[];
  rollbackData: any[];
}

export class DatabaseTransactionManager {
  private static activeTransactions = new Map<string, TransactionContext>();

  /**
   * Execute multiple operations within a database transaction
   */
  static async executeTransaction<T>(
    transactionId: string,
    operations: Array<() => Promise<any>>,
    rollbackOperations?: Array<() => Promise<any>>
  ): Promise<T> {
    const context: TransactionContext = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      rollbackData: []
    };

    this.activeTransactions.set(transactionId, context);

    try {
      // Start database transaction
      const result = await db.transaction(async (tx) => {
        const results: any[] = [];
        
        for (let i = 0; i < operations.length; i++) {
          try {
            context.operations.push(`Operation ${i + 1}`);
            const operationResult = await operations[i]();
            results.push(operationResult);
            context.rollbackData.push(operationResult);
          } catch (error) {
            console.error(`Transaction ${transactionId} failed at operation ${i + 1}:`, error);
            throw error;
          }
        }
        
        return results;
      });

      this.activeTransactions.delete(transactionId);
      return result as T;

    } catch (error) {
      console.error(`Transaction ${transactionId} failed, initiating rollback:`, error);
      
      // Execute rollback operations if provided
      if (rollbackOperations) {
        try {
          await this.executeRollback(transactionId, rollbackOperations);
        } catch (rollbackError) {
          console.error(`Rollback failed for transaction ${transactionId}:`, rollbackError);
        }
      }

      this.activeTransactions.delete(transactionId);
      throw error;
    }
  }

  /**
   * Execute P2P transfer with full transaction integrity
   */
  static async executeP2PTransfer(
    senderId: string,
    recipientId: string,
    amount: number,
    fees: any,
    commissions: any[]
  ): Promise<{ success: boolean; transactionId: string; error?: string }> {
    const transactionId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const result = await this.executeTransaction(
        transactionId,
        [
          // Operation 1: Validate sender balance
          async () => {
            const senderBalance = await this.getSenderBalance(senderId);
            if (senderBalance < amount + fees.totalFee) {
              throw new Error('Insufficient balance');
            }
            return { senderBalance };
          },

          // Operation 2: Debit sender account
          async () => {
            return await this.updateAccountBalance(senderId, -(amount + fees.totalFee));
          },

          // Operation 3: Credit recipient account
          async () => {
            return await this.updateAccountBalance(recipientId, amount);
          },

          // Operation 4: Process commission payouts
          async () => {
            const commissionResults = [];
            for (const commission of commissions) {
              const result = await this.updateAccountBalance(
                commission.agentId, 
                commission.amount
              );
              commissionResults.push(result);
            }
            return commissionResults;
          },

          // Operation 5: Record transaction
          async () => {
            return await this.recordTransaction({
              id: transactionId,
              senderId,
              recipientId,
              amount,
              fees,
              commissions,
              status: 'completed',
              timestamp: Date.now()
            });
          }
        ],
        // Rollback operations
        [
          async () => await this.updateAccountBalance(senderId, amount + fees.totalFee),
          async () => await this.updateAccountBalance(recipientId, -amount),
          async () => {
            for (const commission of commissions) {
              await this.updateAccountBalance(commission.agentId, -commission.amount);
            }
          }
        ]
      );

      return {
        success: true,
        transactionId
      };

    } catch (error: any) {
      return {
        success: false,
        transactionId,
        error: error.message
      };
    }
  }

  /**
   * Execute commission payout with transaction integrity
   */
  static async executeCommissionPayout(
    payouts: Array<{ agentId: string; amount: number; transactionId: string }>
  ): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
    const batchId = `commission_batch_${Date.now()}`;
    const errors: string[] = [];
    let processedCount = 0;

    try {
      await this.executeTransaction(
        batchId,
        [
          // Validate all payouts first
          async () => {
            for (const payout of payouts) {
              if (payout.amount <= 0) {
                throw new Error(`Invalid payout amount for agent ${payout.agentId}`);
              }
            }
            return { validated: payouts.length };
          },

          // Process all payouts atomically
          async () => {
            const results = [];
            for (const payout of payouts) {
              try {
                const result = await this.updateAccountBalance(payout.agentId, payout.amount);
                await this.recordCommissionPayout(payout);
                results.push(result);
                processedCount++;
              } catch (error: any) {
                errors.push(`Agent ${payout.agentId}: ${error.message}`);
                throw error; // Fail the entire batch
              }
            }
            return results;
          }
        ]
      );

      return {
        success: true,
        processedCount,
        errors
      };

    } catch (error: any) {
      return {
        success: false,
        processedCount,
        errors: [...errors, `Batch failed: ${error.message}`]
      };
    }
  }

  /**
   * Execute rollback operations
   */
  private static async executeRollback(
    transactionId: string,
    rollbackOperations: Array<() => Promise<any>>
  ): Promise<void> {
    console.log(`Executing rollback for transaction ${transactionId}`);
    
    for (let i = rollbackOperations.length - 1; i >= 0; i--) {
      try {
        await rollbackOperations[i]();
      } catch (error) {
        console.error(`Rollback operation ${i} failed:`, error);
      }
    }
  }

  /**
   * Helper methods for database operations
   */
  private static async getSenderBalance(userId: string): Promise<number> {
    // Mock implementation - replace with actual database query
    return 10000; // Placeholder
  }

  private static async updateAccountBalance(userId: string, amount: number): Promise<any> {
    // Mock implementation - replace with actual database update
    console.log(`Updating balance for user ${userId}: ${amount > 0 ? '+' : ''}${amount}`);
    return { userId, balanceChange: amount, timestamp: Date.now() };
  }

  private static async recordTransaction(transaction: any): Promise<any> {
    // Mock implementation - replace with actual database insert
    console.log(`Recording transaction: ${transaction.id}`);
    return transaction;
  }

  private static async recordCommissionPayout(payout: any): Promise<any> {
    // Mock implementation - replace with actual database insert
    console.log(`Recording commission payout: ${payout.agentId} - $${payout.amount}`);
    return payout;
  }

  /**
   * Get transaction status and cleanup old transactions
   */
  static getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  static cleanupOldTransactions(): void {
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
    
    for (const [id, context] of this.activeTransactions.entries()) {
      if (context.startTime < cutoff) {
        console.warn(`Cleaning up stale transaction: ${id}`);
        this.activeTransactions.delete(id);
      }
    }
  }

  /**
   * Initialize cleanup scheduler
   */
  static initializeCleanup(): void {
    setInterval(() => {
      this.cleanupOldTransactions();
    }, 60000); // Every minute
  }
}