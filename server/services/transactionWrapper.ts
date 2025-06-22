/**
 * Universal Transaction Wrapper - Prevents Fund Loss
 * Ensures ALL financial operations are atomic (all-or-nothing)
 * Based on business logic audit requirements
 */

import { pool } from '../db';
import type { PoolClient } from 'pg';

interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class TransactionWrapper {
  /**
   * Wraps any financial operation in a database transaction
   * Ensures atomic completion - either all operations succeed or all are rolled back
   */
  static async executeFinancialOperation<T>(
    operation: (client: PoolClient) => Promise<T>,
    operationName: string = 'Financial Operation'
  ): Promise<TransactionResult<T>> {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Execute the operation
      const result = await operation(client);
      
      // Commit if successful
      await client.query('COMMIT');
      
      console.log(`✅ ${operationName} completed successfully`);
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      // Rollback on any error
      await client.query('ROLLBACK');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ${operationName} failed, rolled back:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
      
    } finally {
      // Always release the client
      client.release();
    }
  }

  /**
   * P2P Transfer with atomic protection
   * Ensures sender debit and receiver credit happen together or not at all
   */
  static async executeP2PTransfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    feeAmount: number
  ): Promise<TransactionResult<{ transferId: string }>> {
    return this.executeFinancialOperation(async (client) => {
      // Convert to cents for precision
      const amountCents = Math.round(amount * 100);
      const feeCents = Math.round(feeAmount * 100);
      const totalDebitCents = amountCents + feeCents;
      
      // Check sender balance
      const balanceResult = await client.query(
        'SELECT balance_cents FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [fromUserId]
      );
      
      if (!balanceResult.rows[0] || balanceResult.rows[0].balance_cents < totalDebitCents) {
        throw new Error('Insufficient balance for transfer');
      }
      
      // Debit sender (amount + fee)
      await client.query(
        'UPDATE user_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2',
        [totalDebitCents, fromUserId]
      );
      
      // Credit receiver (amount only)
      await client.query(`
        INSERT INTO user_balances (user_id, balance_cents) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        UPDATE SET balance_cents = user_balances.balance_cents + $2
      `, [toUserId, amountCents]);
      
      // Credit platform fee account
      await client.query(`
        INSERT INTO user_balances (user_id, balance_cents) 
        VALUES ('platform_fees', $1)
        ON CONFLICT (user_id) 
        UPDATE SET balance_cents = user_balances.balance_cents + $1
      `, [feeCents]);
      
      // Record transaction
      const transferResult = await client.query(`
        INSERT INTO transactions (from_user_id, to_user_id, amount_cents, fee_cents, status, created_at)
        VALUES ($1, $2, $3, $4, 'completed', NOW())
        RETURNING id
      `, [fromUserId, toUserId, amountCents, feeCents]);
      
      return {
        transferId: transferResult.rows[0].id
      };
    }, `P2P Transfer: ${fromUserId} → ${toUserId} ($${amount})`);
  }

  /**
   * Commission Payout with atomic protection
   * Ensures platform debit and agent credit happen together
   */
  static async executeCommissionPayout(
    agentId: string,
    amount: number,
    transactionId: string
  ): Promise<TransactionResult<{ payoutId: string }>> {
    return this.executeFinancialOperation(async (client) => {
      const amountCents = Math.round(amount * 100);
      
      // Check platform commission balance
      const platformBalance = await client.query(
        'SELECT balance_cents FROM user_balances WHERE user_id = $1 FOR UPDATE',
        ['platform_commissions']
      );
      
      if (!platformBalance.rows[0] || platformBalance.rows[0].balance_cents < amountCents) {
        throw new Error('Insufficient platform commission balance');
      }
      
      // Debit platform commission account
      await client.query(
        'UPDATE user_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2',
        [amountCents, 'platform_commissions']
      );
      
      // Credit agent
      await client.query(`
        INSERT INTO user_balances (user_id, balance_cents) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        UPDATE SET balance_cents = user_balances.balance_cents + $2
      `, [agentId, amountCents]);
      
      // Record commission payout
      const payoutResult = await client.query(`
        INSERT INTO commission_payouts (agent_id, amount_cents, transaction_id, status, created_at)
        VALUES ($1, $2, $3, 'completed', NOW())
        RETURNING id
      `, [agentId, amountCents, transactionId]);
      
      return {
        payoutId: payoutResult.rows[0].id
      };
    }, `Commission Payout: ${agentId} ($${amount})`);
  }

  /**
   * Currency Exchange with atomic protection
   * Ensures debit and credit happen at the locked exchange rate
   */
  static async executeCurrencyExchange(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number
  ): Promise<TransactionResult<{ exchangeId: string }>> {
    return this.executeFinancialOperation(async (client) => {
      const fromAmountCents = Math.round(fromAmount * 100);
      const toAmountCents = Math.round(toAmount * 100);
      
      // Check user balance in source currency
      const balanceResult = await client.query(
        'SELECT balance_cents FROM user_currency_balances WHERE user_id = $1 AND currency = $2 FOR UPDATE',
        [userId, fromCurrency]
      );
      
      if (!balanceResult.rows[0] || balanceResult.rows[0].balance_cents < fromAmountCents) {
        throw new Error(`Insufficient ${fromCurrency} balance for exchange`);
      }
      
      // Debit source currency
      await client.query(
        'UPDATE user_currency_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2 AND currency = $3',
        [fromAmountCents, userId, fromCurrency]
      );
      
      // Credit destination currency
      await client.query(`
        INSERT INTO user_currency_balances (user_id, currency, balance_cents) 
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, currency) 
        UPDATE SET balance_cents = user_currency_balances.balance_cents + $3
      `, [userId, toCurrency, toAmountCents]);
      
      // Record exchange transaction
      const exchangeResult = await client.query(`
        INSERT INTO currency_exchanges (user_id, from_currency, to_currency, from_amount_cents, to_amount_cents, exchange_rate, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `, [userId, fromCurrency, toCurrency, fromAmountCents, toAmountCents, exchangeRate]);
      
      return {
        exchangeId: exchangeResult.rows[0].id
      };
    }, `Currency Exchange: ${userId} ${fromCurrency} → ${toCurrency}`);
  }
}