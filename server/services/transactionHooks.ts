/**
 * Transaction Hook System for Automated Referral Processing
 * Automatically processes referral rewards when transactions complete
 */

import { ReferralProcessor } from './referralProcessor';
import { db } from '../db';
import { agentTransactions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class TransactionHooks {
  /**
   * Hook that fires after any agent transaction completes
   */
  static async onTransactionCompleted(transactionId: string): Promise<void> {
    try {
      // Get the completed transaction
      const [transaction] = await db
        .select()
        .from(agentTransactions)
        .where(eq(agentTransactions.transactionId, transactionId));

      if (!transaction || transaction.status !== 'completed') {
        return;
      }

      console.log(`Processing referral rewards for transaction: ${transactionId}`);

      // Process referral rewards for this transaction
      await ReferralProcessor.processTransactionReferrals(transactionId);

      console.log(`Referral processing completed for transaction: ${transactionId}`);
    } catch (error) {
      console.error(`Error in transaction completion hook for ${transactionId}:`, error);
    }
  }

  /**
   * Hook that fires when an agent makes their first transaction
   */
  static async onFirstTransactionCompleted(agentId: string): Promise<void> {
    try {
      // Mark first transaction as completed in referral system
      await db.execute(sql`
        UPDATE agent_referrals 
        SET is_first_transaction = true 
        WHERE referee_agent_id = ${agentId}
      `);

      console.log(`First transaction completed for agent: ${agentId}`);
    } catch (error) {
      console.error(`Error updating first transaction status for ${agentId}:`, error);
    }
  }

  /**
   * Process all pending transaction hooks in batch
   */
  static async processPendingHooks(): Promise<void> {
    try {
      // Get completed transactions that haven't triggered hooks
      const pendingTransactions = await db.execute(`
        SELECT transaction_id 
        FROM agent_transactions 
        WHERE status = 'completed' 
          AND created_at >= NOW() - INTERVAL '1 hour'
          AND metadata->>'hooks_processed' IS NULL
      `);

      for (const tx of pendingTransactions.rows) {
        await TransactionHooks.onTransactionCompleted(tx.transaction_id as string);
        
        // Mark hooks as processed
        await db.execute(sql`
          UPDATE agent_transactions 
          SET metadata = COALESCE(metadata, '{}') || '{"hooks_processed": true}'
          WHERE transaction_id = ${tx.transaction_id}
        `);
      }

      console.log(`Processed ${pendingTransactions.rows.length} pending transaction hooks`);
    } catch (error) {
      console.error('Error processing pending transaction hooks:', error);
    }
  }
}