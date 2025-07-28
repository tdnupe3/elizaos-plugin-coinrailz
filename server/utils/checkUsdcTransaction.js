/**
 * Utility to check USDC transaction and wallet status
 * Run this directly to debug the Circle wallet balance issue
 */

const { circleService } = require('../services/circleService.ts');
const { db } = require('../db.ts');
const { users } = require('../../shared/schema.ts');
const { eq, sql } = require('drizzle-orm');

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
    
    // Get all wallet sets - for now we'll use a mock since the method doesn't exist
    console.log('\n💼 Checking Circle Wallet Sets...');
    console.log('⚠️ listWalletSets method not implemented yet, checking individual wallets...');
    // Skip wallet sets for now and go directly to checking database users
    
    // Check database users with Circle wallets
    console.log('\n👥 Database Users with Circle Wallets:');
    const usersWithWallets = await db
      .select()
      .from(users)
      .where(sql`circle_wallet_id IS NOT NULL`);
    
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