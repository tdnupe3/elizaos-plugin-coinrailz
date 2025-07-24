import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const rawApiKey = process.env.CIRCLE_API_KEY || '';
const formattedApiKey = rawApiKey.startsWith('LIVE_API_KEY:') ? rawApiKey : `LIVE_API_KEY:${rawApiKey}`;

console.log('Debug Circle SDK initialization...');
console.log('API Key present:', !!formattedApiKey);
console.log('Entity Secret present:', !!process.env.CIRCLE_ENTITY_SECRET);

try {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: formattedApiKey,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
  });
  
  console.log('✅ Client created successfully');
  console.log('Client type:', typeof client);
  console.log('Client methods:', Object.getOwnPropertyNames(client).filter(name => typeof client[name] === 'function'));
  
  // Test a simple call
  try {
    const health = await client.getPublicKey();
    console.log('✅ Public key retrieved successfully');
  } catch (error) {
    console.log('❌ Public key error:', error.message);
    console.log('Error stack:', error.stack);
  }
  
} catch (error) {
  console.log('❌ Client creation failed:', error.message);
  console.log('Error details:', error);
}