/**
 * Referral System and CORS Testing
 * Tests referral link generation and CORS configuration
 */

import http from 'http';

async function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = { 'Content-Type': 'application/json', ...headers };

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint,
      method,
      headers: requestHeaders
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ 
            status: res.statusCode, 
            data: JSON.parse(body),
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testReferralAndCORSSystems() {
  console.log('=== REFERRAL SYSTEM & CORS CONFIGURATION TESTING ===\n');
  
  // Test 1: Referral Link Generation
  console.log('1. TESTING REFERRAL LINK GENERATION');
  
  const referralTests = [
    {
      name: 'Valid User Referral Link',
      data: { userId: 'user-12345' },
      expectedStatus: 200
    },
    {
      name: 'Missing User ID',
      data: {},
      expectedStatus: 400
    },
    {
      name: 'Invalid User ID',
      data: { userId: '' },
      expectedStatus: 400
    }
  ];

  let referralPassed = 0;
  
  for (const test of referralTests) {
    try {
      console.log(`\nTesting: ${test.name}`);
      
      const result = await makeRequest('POST', '/api/referrals/generate-link', test.data);
      
      if (result.status === test.expectedStatus) {
        console.log(`✓ Status correct: ${result.status}`);
        
        if (result.status === 200 && result.data.success) {
          console.log(`✓ Referral Code: ${result.data.referralCode}`);
          console.log(`✓ Referral Link: ${result.data.referralLink}`);
          console.log(`✓ Commission Rate: ${result.data.commissionRate}`);
          console.log(`✓ Expires: ${result.data.expiresAt}`);
          
          // Validate referral link format
          if (result.data.referralLink.includes('coinrailz.com/signup?ref=')) {
            console.log(`✓ Link format valid`);
          } else {
            console.log(`✗ Link format invalid`);
          }
        }
        
        referralPassed++;
      } else {
        console.log(`✗ Status incorrect: expected ${test.expectedStatus}, got ${result.status}`);
        if (result.data.error) {
          console.log(`  Error: ${result.data.error}`);
        }
      }
      
    } catch (error) {
      console.log(`✗ Test failed: ${error.message}`);
    }
  }
  
  const referralSuccessRate = (referralPassed / referralTests.length * 100).toFixed(1);
  console.log(`\nReferral System Success Rate: ${referralPassed}/${referralTests.length} (${referralSuccessRate}%)`);
  
  console.log('\n' + '='.repeat(60));
  
  // Test 2: CORS Configuration
  console.log('\n2. TESTING CORS CONFIGURATION');
  
  console.log('\nWhat are CORS headers?');
  console.log('CORS (Cross-Origin Resource Sharing) headers tell browsers which websites');
  console.log('can access your API. Without them, other websites cannot use your platform.');
  console.log('Important for: mobile apps, partner integrations, external services.\n');
  
  const corsTests = [
    {
      name: 'Preflight OPTIONS Request',
      method: 'OPTIONS',
      endpoint: '/api/demo/user',
      headers: { 'Origin': 'https://example.com' }
    },
    {
      name: 'GET Request with Origin',
      method: 'GET',
      endpoint: '/api/demo/user',
      headers: { 'Origin': 'https://coinrailz.com' }
    },
    {
      name: 'POST Request with Origin',
      method: 'POST',
      endpoint: '/api/referrals/calculate-commission',
      data: { transactionAmount: 1000, referralTier: 'basic' },
      headers: { 'Origin': 'https://app.coinrailz.com' }
    }
  ];

  let corsIssues = [];
  
  for (const test of corsTests) {
    try {
      console.log(`\nTesting: ${test.name}`);
      
      const result = await makeRequest(test.method, test.endpoint, test.data, test.headers);
      
      console.log(`Status: ${result.status}`);
      
      // Check for CORS headers
      const corsHeaders = {
        'access-control-allow-origin': result.headers['access-control-allow-origin'],
        'access-control-allow-methods': result.headers['access-control-allow-methods'],
        'access-control-allow-headers': result.headers['access-control-allow-headers'],
        'access-control-allow-credentials': result.headers['access-control-allow-credentials']
      };
      
      console.log('CORS Headers Found:');
      Object.entries(corsHeaders).forEach(([header, value]) => {
        if (value) {
          console.log(`  ✓ ${header}: ${value}`);
        } else {
          console.log(`  ✗ ${header}: missing`);
          corsIssues.push(`Missing ${header}`);
        }
      });
      
    } catch (error) {
      console.log(`✗ CORS test failed: ${error.message}`);
      corsIssues.push(`Test error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Test 3: Referral Commission Calculation
  console.log('\n3. TESTING REFERRAL COMMISSION ACCURACY');
  
  const commissionTests = [
    { amount: 1000, tier: 'basic', expectedRate: 0.3, expectedCommission: 3 },
    { amount: 5000, tier: 'basic', expectedRate: 0.3, expectedCommission: 15 },
    { amount: 10000, tier: 'premium', expectedRate: 0.5, expectedCommission: 50 }
  ];

  let commissionAccurate = 0;
  
  for (const test of commissionTests) {
    try {
      const result = await makeRequest('POST', '/api/referrals/calculate-commission', {
        transactionAmount: test.amount,
        referralTier: test.tier
      });
      
      if (result.status === 200 && result.data.success) {
        const { commission, rate } = result.data;
        
        console.log(`\n$${test.amount} ${test.tier} tier:`);
        console.log(`  Expected: ${test.expectedRate}% = $${test.expectedCommission}`);
        console.log(`  Actual: ${rate}% = $${commission}`);
        
        if (rate === test.expectedRate && commission === test.expectedCommission) {
          console.log(`  ✓ Commission calculation accurate`);
          commissionAccurate++;
        } else {
          console.log(`  ✗ Commission calculation incorrect`);
        }
      } else {
        console.log(`\n✗ Commission test failed for $${test.amount}`);
      }
      
    } catch (error) {
      console.log(`\n✗ Commission calculation error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Summary
  console.log('\n=== REFERRAL & CORS SYSTEM SUMMARY ===');
  
  if (referralSuccessRate >= 100) {
    console.log('✓ REFERRAL SYSTEM: Fully operational');
  } else if (referralSuccessRate >= 66) {
    console.log('⚠ REFERRAL SYSTEM: Mostly working, minor issues');
  } else {
    console.log('✗ REFERRAL SYSTEM: Needs fixes');
  }
  
  if (corsIssues.length === 0) {
    console.log('✓ CORS CONFIGURATION: Properly configured');
  } else if (corsIssues.length <= 2) {
    console.log('⚠ CORS CONFIGURATION: Minor configuration needed');
    console.log('  Issues:', corsIssues.join(', '));
  } else {
    console.log('✗ CORS CONFIGURATION: Requires setup');
    console.log('  Issues:', corsIssues.join(', '));
  }
  
  const commissionAccuracy = (commissionAccurate / commissionTests.length * 100).toFixed(1);
  console.log(`✓ COMMISSION ACCURACY: ${commissionAccuracy}% (${commissionAccurate}/${commissionTests.length})`);
  
  console.log('\n=== RECOMMENDATIONS ===');
  if (corsIssues.length > 0) {
    console.log('CORS Setup Needed:');
    console.log('- Add CORS middleware to allow cross-origin requests');
    console.log('- Required for mobile apps and partner integrations');
    console.log('- Add headers: Access-Control-Allow-Origin, Methods, Headers');
  }
  
  if (referralSuccessRate < 100) {
    console.log('Referral System:');
    console.log('- Fix referral link generation for all test cases');
    console.log('- Ensure proper validation and error handling');
  }
  
  return {
    referralSuccess: referralSuccessRate,
    corsIssues: corsIssues.length,
    commissionAccuracy: parseFloat(commissionAccuracy)
  };
}

// Wait for server startup then test
setTimeout(async () => {
  try {
    await testReferralAndCORSSystems();
  } catch (error) {
    console.error('Referral and CORS testing failed:', error);
  }
}, 2000);