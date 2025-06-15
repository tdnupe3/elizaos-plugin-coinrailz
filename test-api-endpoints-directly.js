/**
 * Direct API Endpoint Testing - Internal Server Validation
 * Tests endpoints directly through the server without external requests
 */

import http from 'http';

function makeDirectRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: parsedBody,
            headers: res.headers
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: body,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testCriticalEndpoints() {
  console.log('=== TESTING CRITICAL API ENDPOINTS ===\n');
  
  const tests = [
    {
      name: 'Fee Calculation',
      options: { method: 'POST', path: '/api/demo/calculate-fee' },
      data: { amount: 1000, type: 'send_money' },
      validate: (result) => result.status === 200 && result.data.fee === 10
    },
    {
      name: 'Commission Calculation', 
      options: { method: 'POST', path: '/api/referrals/calculate-commission' },
      data: { transactionAmount: 1000, referralTier: 'basic' },
      validate: (result) => result.status === 200 && result.data.commission >= 3 && result.data.commission <= 6
    },
    {
      name: 'Negative Amount Protection',
      options: { method: 'POST', path: '/api/demo/send-money' },
      data: { amount: -100, recipient: 'test@example.com' },
      validate: (result) => result.status === 400
    },
    {
      name: 'Demo User Endpoint',
      options: { method: 'GET', path: '/api/demo/user' },
      validate: (result) => result.status === 200 && result.data.id === 'demo-user'
    },
    {
      name: 'Demo Balances',
      options: { method: 'GET', path: '/api/demo/balances' },
      validate: (result) => result.status === 200 && typeof result.data.usd === 'number'
    },
    {
      name: 'XRP Wallet Security',
      options: { method: 'GET', path: '/api/xrp/wallet-info' },
      validate: (result) => result.status === 200 && !JSON.stringify(result.data).toLowerCase().includes('private')
    },
    {
      name: 'Authentication Check',
      options: { method: 'GET', path: '/api/admin/users', headers: { 'Authorization': 'Bearer fake-token' } },
      validate: (result) => result.status === 401
    },
    {
      name: 'Health Check',
      options: { method: 'GET', path: '/health' },
      validate: (result) => result.status === 200 && result.data.status === 'ok'
    }
  ];

  let passed = 0;
  let total = tests.length;
  const failures = [];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      const result = await makeDirectRequest(test.options, test.data);
      
      if (test.validate(result)) {
        console.log(`✓ PASSED: ${test.name}`);
        passed++;
      } else {
        console.log(`✗ FAILED: ${test.name} - Status: ${result.status}, Data:`, result.data);
        failures.push({ name: test.name, result });
      }
    } catch (error) {
      console.log(`✗ ERROR: ${test.name} - ${error.message}`);
      failures.push({ name: test.name, error: error.message });
    }
  }

  console.log('\n=== TEST RESULTS ===');
  console.log(`Passed: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
  
  if (failures.length > 0) {
    console.log('\nFAILED TESTS:');
    failures.forEach(failure => {
      console.log(`- ${failure.name}: ${failure.error || 'Validation failed'}`);
    });
  }

  return {
    passed,
    total,
    successRate: (passed/total*100).toFixed(1),
    failures,
    isReady: passed >= total * 0.9 // 90% pass rate required
  };
}

async function main() {
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = await testCriticalEndpoints();
  
  console.log('\n=== PRODUCTION READINESS ASSESSMENT ===');
  if (results.isReady) {
    console.log('🟢 PLATFORM READY FOR PRODUCTION');
    console.log('All critical endpoints are functional and secure.');
  } else {
    console.log('🔴 PLATFORM NEEDS FIXES');
    console.log('Critical issues must be resolved before deployment.');
  }
  
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testCriticalEndpoints };