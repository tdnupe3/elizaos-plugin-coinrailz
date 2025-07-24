/**
 * Utility to check USDC transaction and wallet status
 * Run this directly to debug the Circle wallet balance issue
 */

import { circleService } from '../services/circleService.js';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkTransactionStatus() {
  console.log('🔍 Starting USDC transaction investigation...');
  console.log('Transaction Hash: 0xa6abae32b136871795e3760357c91584892e6f344660c3c843bba24d70938d1f');
  console.log('Expected Amount: $50 USDC');
  console.log('Time: ~5 minutes ago from Coinbase');
  
  try {
    // Check Circle service health
    console.log('\n📊 Circle Service Health Check:');
    const health = circleService.getHealthStatus();
    console.log(JSON.stringify(health, null, 2));
    
    if (!health.initialized) {
      console.error('❌ Circle service not initialized. Check API keys.');
      return;
    }
    
    // Get all wallet sets
    console.log('\n💼 Checking Circle Wallet Sets...');
    const walletSets = await circleService.listWalletSets();
    console.log(`Found ${walletSets.length} wallet sets:`);
    
    for (const walletSet of walletSets) {
      console.log(`\n📁 Wallet Set: ${walletSet.name} (${walletSet.id})`);
      
      // Get wallets in this set
      const wallets = await circleService.listWallets(walletSet.id);
      console.log(`Found ${wallets.length} wallets:`);
      
      for (const wallet of wallets) {
        console.log(`\n🔑 Wallet: ${wallet.id}`);
        console.log(`  Address: ${wallet.address}`);
        console.log(`  Blockchain: ${wallet.blockchain}`);
        console.log(`  State: ${wallet.state}`);
        
        // Check balance
        try {
          const balances = await circleService.getWalletBalance(wallet.id);
          const usdcBalance = balances.find(b => b.tokenId === 'USDC')?.amount || '0.00000000';
          console.log(`  USDC Balance: ${usdcBalance}`);
          
          // Check recent transactions
          const transactions = await circleService.listTransactions(wallet.id, 10);
          console.log(`  Recent Transactions: ${transactions.length}`);
          
          if (transactions.length > 0) {
            console.log('  📋 Last 5 transactions:');
            transactions.slice(0, 5).forEach((tx, i) => {
              console.log(`    ${i+1}. ${tx.transactionType} ${tx.amount} ${tx.tokenId} - ${tx.state}`);
              if (tx.txHash) {
                console.log(`       TX Hash: ${tx.txHash}`);
              }
            });
          }
          
          // Check if this wallet received the specific transaction
          const matchingTx = transactions.find(tx => 
            tx.txHash === '0xa6abae32b136871795e3760357c91584892e6f344660c3c843bba24d70938d1f'
          );
          
          if (matchingTx) {
            console.log('🎯 FOUND MATCHING TRANSACTION!');
            console.log(`   Amount: ${matchingTx.amount} ${matchingTx.tokenId}`);
            console.log(`   Status: ${matchingTx.state}`);
            console.log(`   Type: ${matchingTx.transactionType}`);
            console.log(`   Date: ${matchingTx.createDate}`);
          }
          
        } catch (error) {
          console.error(`❌ Error checking wallet ${wallet.id}:`, error.message);
        }
      }
    }
    
    // Check database users with Circle wallets
    console.log('\n👥 Database Users with Circle Wallets:');
    const usersWithWallets = await db
      .select()
      .from(users)
      .where('circle_wallet_id IS NOT NULL');
    
    console.log(`Found ${usersWithWallets.length} users with Circle wallets:`);
    
    for (const user of usersWithWallets) {
      console.log(`\n👤 User: ${user.firstName || 'N/A'} ${user.lastName || 'N/A'} (${user.id})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Circle Wallet ID: ${user.circleWalletId}`);
      console.log(`   Circle Address: ${user.circleWalletAddress}`);
      console.log(`   Stored USDC Balance: ${user.usdcBalance || '0.00000000'}`);
      
      // Sync balance for this user
      if (user.circleWalletId) {
        try {
          const balances = await circleService.getWalletBalance(user.circleWalletId);
          const liveBalance = balances.find(b => b.tokenId === 'USDC')?.amount || '0.00000000';
          console.log(`   Live USDC Balance: ${liveBalance}`);
          
          if (parseFloat(liveBalance) !== parseFloat(user.usdcBalance || '0.00000000')) {
            console.log('🔄 Balance mismatch detected - updating database...');
            await db.update(users)
              .set({ usdcBalance: liveBalance })
              .where(eq(users.id, user.id));
            console.log('✅ Database updated with live balance');
          }
        } catch (error) {
          console.error(`❌ Error syncing balance for user ${user.id}:`, error.message);
        }
      }
    }
    
    console.log('\n🏁 Investigation Complete!');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Export for use in other modules
export { checkTransactionStatus };

// Run directly if called as script
checkTransactionStatus().catch(console.error);