async function comprehensiveCircleTest() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  console.log('=== COMPREHENSIVE CIRCLE API TEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('API Key Format:', apiKey ? apiKey.substring(0, 25) + '...' : 'NOT SET');
  console.log('Entity Secret:', entitySecret ? 'SET (' + entitySecret.length + ' chars)' : 'NOT SET');
  console.log('');

  // Test more endpoints to see what works
  const testEndpoints = [
    { url: 'https://api.circle.com/v1/configuration', method: 'GET', description: 'Configuration' },
    { url: 'https://api.circle.com/v1/wallets', method: 'GET', description: 'List Wallets' },
    { url: 'https://api.circle.com/v1/businessAccount/wallets/addresses/deposit', method: 'GET', description: 'Deposit Addresses' },
    { url: 'https://api.circle.com/v1/businessAccount/balances', method: 'GET', description: 'Account Balances' }
  ];

  for (const test of testEndpoints) {
    try {
      console.log(`\n=== ${test.description} ===`);
      console.log(`${test.method} ${test.url}`);
      
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Status: ${response.status}`);
      console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
      
      const data = await response.text();
      
      if (response.ok) {
        console.log(`✅ SUCCESS: ${data.slice(0, 200)}...`);
      } else {
        console.log(`❌ ERROR: ${data}`);
        
        // Try to parse error for specific info
        try {
          const errorObj = JSON.parse(data);
          console.log(`Error Code: ${errorObj.code}`);
          console.log(`Error Message: ${errorObj.message}`);
        } catch (e) {
          // Not JSON
        }
      }
    } catch (error) {
      console.log(`💥 NETWORK ERROR: ${error.message}`);
    }
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

comprehensiveCircleTest().catch(console.error);
