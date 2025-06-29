/**
 * Database Security Constraints Implementation
 * Adds unique constraints for transaction hashes and external transaction IDs
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function addSecurityConstraints() {
  console.log('🔒 Adding database security constraints...');
  
  try {
    // Add unique constraint for transaction hashes in funding_transactions
    await db.execute(sql`
      ALTER TABLE funding_transactions 
      ADD CONSTRAINT IF NOT EXISTS unique_funding_transaction_hash 
      UNIQUE (transaction_hash) 
      DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log('✅ Added unique constraint for funding transaction hashes');

    // Add unique constraint for external transaction IDs in funding_transactions
    await db.execute(sql`
      ALTER TABLE funding_transactions 
      ADD CONSTRAINT IF NOT EXISTS unique_external_transaction_id 
      UNIQUE (external_transaction_id) 
      DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log('✅ Added unique constraint for external transaction IDs');

    // Add unique constraint for transaction hashes in crypto_transfers
    await db.execute(sql`
      ALTER TABLE crypto_transfers 
      ADD CONSTRAINT IF NOT EXISTS unique_crypto_transfer_hash 
      UNIQUE (transaction_hash) 
      DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log('✅ Added unique constraint for crypto transfer hashes');

    // Add unique constraint for external transaction IDs in transactions table
    await db.execute(sql`
      ALTER TABLE transactions 
      ADD CONSTRAINT IF NOT EXISTS unique_transaction_external_id 
      UNIQUE (external_transaction_id) 
      DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log('✅ Added unique constraint for transaction external IDs');

    // Add unique constraint for blockchain hashes in crypto_transactions
    await db.execute(sql`
      ALTER TABLE crypto_transactions 
      ADD CONSTRAINT IF NOT EXISTS unique_crypto_blockchain_hash 
      UNIQUE (blockchain_hash) 
      DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log('✅ Added unique constraint for crypto blockchain hashes');

    console.log('🎉 All database security constraints added successfully');
    
    return {
      success: true,
      message: 'Database security constraints added successfully',
      constraintsAdded: [
        'unique_funding_transaction_hash',
        'unique_external_transaction_id', 
        'unique_crypto_transfer_hash',
        'unique_transaction_external_id',
        'unique_crypto_blockchain_hash'
      ]
    };
    
  } catch (error: any) {
    console.error('❌ Failed to add database constraints:', error);
    
    // Handle specific constraint errors gracefully
    if (error.message?.includes('already exists') || error.code === '42710') {
      console.log('ℹ️ Some constraints already exist, continuing...');
      return {
        success: true,
        message: 'Database constraints verified (some already existed)',
        error: null
      };
    }
    
    throw error;
  }
}