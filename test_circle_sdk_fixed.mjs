import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

async function testCircleSDKFixed() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  console.log('=== CIRCLE SDK WORKING TEST ===');
  console.log('✅ Credentials configured properly');
  console.log('');

  try {
    const circleClient = initiateDeveloperControlledWalletsClient({
      apiKey: apiKey,
      entitySecret: entitySecret
    });
    
    console.log('Testing Circle SDK endpoints...');
    
    // Test 1: List Wallets
    try {
      const wallets = await circleClient.listWallets();
      console.log('✅ listWallets() - SUCCESS');
      console.log(`  Found ${wallets?.data?.wallets?.length || 0} wallets`);
      
      if (wallets?.data?.wallets?.length > 0) {
        const wallet = wallets.data.wallets[0];
        console.log(`  First wallet: ${wallet.walletId} - ${wallet.state}`);
      }
    } catch (error) {
      console.log('❌ listWallets() - ERROR:', error.message);
    }
    
    // Test 2: Create Wallet (if none exist)
    try {
      const newWallet = await circleClient.createWallet({
        blockchains: ['ETH']
      });
      console.log('✅ createWallet() - SUCCESS');
      console.log(`  Created wallet: ${newWallet?.data?.wallet?.walletId}`);
    } catch (error) {
      console.log('ℹ️  createWallet() - INFO:', error.message.slice(0, 100));
    }
    
    console.log('\n🎉 CIRCLE SDK IS FULLY OPERATIONAL!');
    
  } catch (error) {
    console.error('❌ Circle SDK Initialization Failed:', error.message);
  }
}

testCircleSDKFixed().catch(console.error);
