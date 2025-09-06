/**
 * USDC Balance Sync Utility
 * Manually sync all Circle wallet balances with database
 */

import { CircleService } from '../services/circleService.js';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

export async function syncAllUsdcBalances() {
  console.log('🔄 Starting USDC balance sync for all users...');
  
  try {
    // Get all users with Circle wallets
    const usersWithWallets = await db
      .select()
      .from(users)
      .where(sql`circle_wallet_id IS NOT NULL AND circle_wallet_address IS NOT NULL`);
    
    console.log(`Found ${usersWithWallets.length} users with Circle wallets`);
    
    const results = [];
    
    for (const user of usersWithWallets) {
      console.log(`\n👤 Checking user: ${user.email}`);
      console.log(`   Circle Wallet ID: ${user.circleWalletId}`);
      console.log(`   Circle Address: ${user.circleWalletAddress}`);
      console.log(`   Database USDC Balance: ${user.usdcBalance || '0.00000000'}`);
      
      try {
        // Get live balance from Circle API
        const circleService = new CircleService();
        const balances = await circleService.getWalletBalance(user.circleWalletId!);
        const liveUsdcBalance = balances.find((b: any) => b.tokenId === 'USDC')?.amount || '0.00000000';
        
        console.log(`   Live USDC Balance: ${liveUsdcBalance}`);
        
        // Check for balance discrepancy
        const dbBalance = parseFloat(user.usdcBalance || '0.00000000');
        const liveBalance = parseFloat(liveUsdcBalance);
        
        if (Math.abs(liveBalance - dbBalance) > 0.000001) {
          console.log(`🔄 Balance mismatch detected! Updating database...`);
          
          // Update database with live balance
          await db
            .update(users)
            .set({ 
              usdcBalance: liveUsdcBalance,
              lastBalanceUpdate: new Date()
            })
            .where(eq(users.id, user.id));
          
          console.log(`✅ Updated ${user.email} balance: ${dbBalance} → ${liveBalance}`);
          
          results.push({
            userId: user.id,
            email: user.email,
            walletAddress: user.circleWalletAddress,
            oldBalance: dbBalance.toString(),
            newBalance: liveUsdcBalance,
            updated: true,
            foundTargetTransaction: false,
            targetTransactionDetails: null
          });
        } else {
          console.log(`✅ Balance matches - no update needed`);
          results.push({
            userId: user.id,
            email: user.email,
            walletAddress: user.circleWalletAddress,
            oldBalance: dbBalance.toString(),
            newBalance: liveUsdcBalance,
            updated: false,
            foundTargetTransaction: false,
            targetTransactionDetails: null
          });
        }
        
        // Also check recent transactions for this wallet
        const transactions = await circleService.listTransactions(user.circleWalletId!);
        if (transactions.length > 0) {
          console.log(`   Recent transactions (${transactions.length}):`);
          transactions.forEach((tx: any, i: number) => {
            console.log(`     ${i+1}. ${tx.transactionType} ${tx.amount} ${tx.tokenId} - ${tx.state}`);
            if (tx.txHash) {
              console.log(`        TX Hash: ${tx.txHash.substring(0, 20)}...`);
            }
          });
          
          // Check for the specific $50 USDC transaction
          const matchingTx = transactions.find((tx: any) => 
            tx.txHash === '0xa6abae32b136871795e3760357c91584892e6f344660c3c843bba24d70938d1f'
          );
          
          if (matchingTx) {
            console.log(`🎯 FOUND THE $50 USDC TRANSACTION!`);
            console.log(`   Amount: ${matchingTx.amount} ${matchingTx.tokenId}`);
            console.log(`   Status: ${matchingTx.state}`);
            console.log(`   Type: ${matchingTx.transactionType}`);
            console.log(`   Date: ${matchingTx.createDate}`);
            
            results[results.length - 1].foundTargetTransaction = true;
            results[results.length - 1].targetTransactionDetails = matchingTx;
          }
        }
        
      } catch (error: any) {
        console.error(`❌ Error syncing balance for ${user.email}:`, error.message);
        results.push({
          userId: user.id,
          email: user.email,
          walletAddress: user.circleWalletAddress,
          error: error.message,
          updated: false,
          foundTargetTransaction: false,
          targetTransactionDetails: null
        });
      }
    }
    
    console.log('\n📊 Sync Results Summary:');
    const updated = results.filter(r => r.updated);
    const errors = results.filter(r => r.error);
    const foundTarget = results.find(r => r.foundTargetTransaction);
    
    console.log(`   Total wallets checked: ${results.length}`);
    console.log(`   Balances updated: ${updated.length}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Target $50 transaction found: ${foundTarget ? 'YES' : 'NO'}`);
    
    if (foundTarget) {
      console.log(`\n🎯 TARGET TRANSACTION FOUND IN WALLET:`);
      console.log(`   User: ${foundTarget.email}`);
      console.log(`   Address: ${foundTarget.walletAddress}`);
      console.log(`   New Balance: ${foundTarget.newBalance} USDC`);
    }
    
    return {
      success: true,
      totalChecked: results.length,
      updated: updated.length,
      errors: errors.length,
      foundTargetTransaction: !!foundTarget,
      targetTransactionWallet: foundTarget,
      results: results
    };
    
  } catch (error: any) {
    console.error('❌ Balance sync failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run sync and log results
syncAllUsdcBalances().then(result => {
  console.log('\n🏁 USDC Balance Sync Complete');
  console.log('Result:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('Sync failed:', error);
});