import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

async function testCircleSDK() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  console.log('=== CIRCLE SDK TEST ===');
  console.log('API Key:', apiKey ? apiKey.substring(0, 25) + '...' : 'NOT SET');
  console.log('Entity Secret:', entitySecret ? 'SET' : 'NOT SET');
  console.log('');

  try {
    console.log('Initializing Circle SDK client...');
    const circleClient = initiateDeveloperControlledWalletsClient({
      apiKey: apiKey,
      entitySecret: entitySecret
    });
    
    console.log('✅ Circle SDK client created successfully');
    console.log('');
    
    console.log('Testing listWallets()...');
    const wallets = await circleClient.listWallets();
    
    console.log('✅ SDK call successful!');
    console.log('Response data:', JSON.stringify(wallets, null, 2));
    
  } catch (error) {
    console.error('❌ Circle SDK Error:', error.message);
    console.error('Error details:', error);
  }
}

testCircleSDK().catch(console.error);
