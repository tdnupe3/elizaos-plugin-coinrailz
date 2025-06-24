/**
 * Test Demo Page Access
 */
import fetch from 'node-fetch';

async function testDemoPageAccess() {
  console.log('=== DEMO PAGE ACCESS TEST ===\n');
  
  const tests = [
    {
      name: 'Demo Page Frontend',
      url: 'http://localhost:5000/demo',
      expectHtml: true
    },
    {
      name: 'Demo User Data',
      url: 'http://localhost:5000/api/demo/user',
      expectJson: true
    },
    {
      name: 'Demo Balances',
      url: 'http://localhost:5000/api/demo/balances',
      expectJson: true
    },
    {
      name: 'Demo Transactions',
      url: 'http://localhost:5000/api/demo/transactions',
      expectJson: true
    },
    {
      name: 'Demo Crypto Prices',
      url: 'http://localhost:5000/api/demo/crypto-prices',
      expectJson: true
    }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      const response = await fetch(test.url);
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const isJson = contentType.includes('application/json');
      
      let success = false;
      if (test.expectHtml && isHtml && response.ok) {
        success = true;
      } else if (test.expectJson && isJson && response.ok) {
        success = true;
      }
      
      console.log(`${success ? '✓' : '❌'} ${test.name} - ${success ? 'Working' : 'Failed'}`);
      console.log(`  Status: ${response.status}, Content-Type: ${contentType}`);
      
      if (success) passed++;
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error.message}`);
    }
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Passed: ${passed}/${total} (${Math.round((passed/total)*100)}%)`);
  
  if (passed === total) {
    console.log('Demo page and all API endpoints working correctly.');
    return true;
  } else {
    console.log('Some demo components need fixes.');
    return false;
  }
}

testDemoPageAccess().then(success => {
  process.exit(success ? 0 : 1);
});