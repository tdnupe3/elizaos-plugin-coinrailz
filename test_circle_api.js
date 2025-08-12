const fetch = require('node-fetch');

async function testCircleAPI() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  console.log('=== CIRCLE API DIAGNOSTIC TEST ===');
  console.log('API Key Format:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET');
  console.log('Entity Secret:', entitySecret ? 'SET' : 'NOT SET');
  console.log('');

  // Test different Circle API endpoints
  const testEndpoints = [
    'https://api.circle.com/v1/configuration',
    'https://api.circle.com/v1/wallets',
    'https://api.sandbox.circle.com/v1/configuration',
    'https://api.sandbox.circle.com/v1/wallets'
  ];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.text();
      
      console.log(`  Status: ${response.status}`);
      console.log(`  Success: ${response.ok}`);
      
      if (!response.ok) {
        console.log(`  Error: ${data.slice(0, 300)}`);
      } else {
        console.log(`  Response: Valid JSON received`);
      }
      console.log('');
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      console.log('');
    }
  }
}

testCircleAPI().catch(console.error);
