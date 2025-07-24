import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const rawApiKey = process.env.CIRCLE_API_KEY || '';
const formattedApiKey = rawApiKey.startsWith('LIVE_API_KEY:') ? rawApiKey : `LIVE_API_KEY:${rawApiKey}`;

console.log('Testing Circle wallet creation directly...');

try {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: formattedApiKey,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
  });
  
  console.log('✅ Client created successfully');
  
  // Create wallet for recipient
  const walletResponse = await client.createWallets({
    blockchains: ['ETH'],
    count: 1,
    walletSetId: 'ac7b9e33-1e5e-4a42-9b26-a77c18c29b35',
    metadata: [{ refId: 'stell.mary@yahoo.com' }]
  });
  
  console.log('✅ Wallet created:', JSON.stringify(walletResponse, null, 2));
  
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('Stack:', error.stack);
}