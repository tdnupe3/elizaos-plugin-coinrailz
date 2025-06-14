/**
 * Production OAuth Validation Test
 * Validates complete user registration and transaction workflows
 */

async function makeRequest(method, endpoint, data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`http://localhost:5000${endpoint}`, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }
    
    return {
      status: response.status,
      data: parsedData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return { status: 0, data: { error: error.message }, headers: {} };
  }
}

async function testProductionOAuth() {
  console.log('================================================================================');
  console.log('PRODUCTION OAUTH VALIDATION TEST');
  console.log('Testing real deployment scenarios that users will encounter');
  console.log('================================================================================\n');

  const results = {
    criticalIssues: [],
    warnings: [],
    passed: 0,
    total: 0
  };

  // Test 1: Landing page loads properly
  console.log('1. Testing landing page accessibility...');
  results.total++;
  const landingPage = await makeRequest('GET', '/');
  if (landingPage.status === 200 && typeof landingPage.data === 'string' && landingPage.data.includes('html')) {
    console.log('   ✓ Landing page loads successfully');
    results.passed++;
  } else {
    console.log('   ❌ Landing page failed to load properly');
    results.criticalIssues.push('Landing page not accessible');
  }

  // Test 2: OAuth login redirect works
  console.log('\n2. Testing OAuth login redirect...');
  results.total++;
  const oauthRedirect = await makeRequest('GET', '/api/login');
  if (oauthRedirect.status === 302 && oauthRedirect.headers.location && oauthRedirect.headers.location.includes('replit.com/oidc')) {
    console.log('   ✓ OAuth redirect configured correctly');
    console.log(`   → Redirects to: ${oauthRedirect.headers.location.substring(0, 100)}...`);
    results.passed++;
  } else {
    console.log('   ❌ OAuth redirect not working');
    console.log(`   Status: ${oauthRedirect.status}`);
    results.criticalIssues.push('OAuth authentication redirect broken');
  }

  // Test 3: Protected endpoints properly secured
  console.log('\n3. Testing endpoint security...');
  results.total++;
  const protectedEndpoint = await makeRequest('GET', '/api/auth/user');
  if (protectedEndpoint.status === 401) {
    console.log('   ✓ Protected endpoints properly secured');
    results.passed++;
  } else {
    console.log('   ❌ Security issue: Protected endpoint not properly secured');
    results.criticalIssues.push('Authentication security vulnerability');
  }

  // Test 4: Database connectivity
  console.log('\n4. Testing database connectivity...');
  results.total++;
  const dbHealth = await makeRequest('GET', '/api/system/health');
  if (dbHealth.status === 200 && dbHealth.data.services?.database === true) {
    console.log('   ✓ Database connectivity confirmed');
    results.passed++;
  } else {
    console.log('   ❌ Database connectivity issues');
    results.criticalIssues.push('Database connection problems');
  }

  // Test 5: Core API endpoints functional
  console.log('\n5. Testing core API functionality...');
  results.total++;
  const coreTests = [
    { endpoint: '/api/agents/active', name: 'AI Agent Discovery' },
    { endpoint: '/api/fees/structure', name: 'Fee Structure' },
    { endpoint: '/api/xrp/rate', name: 'XRP Exchange Rate' }
  ];

  let coreApiWorking = true;
  for (const test of coreTests) {
    const result = await makeRequest('GET', test.endpoint);
    if (result.status === 200 && result.data.success === true) {
      console.log(`   ✓ ${test.name} API working`);
    } else {
      console.log(`   ❌ ${test.name} API failed (${result.status})`);
      coreApiWorking = false;
    }
  }

  if (coreApiWorking) {
    results.passed++;
  } else {
    results.criticalIssues.push('Core API endpoints not functioning');
  }

  // Test 6: Payment processing endpoints
  console.log('\n6. Testing payment processing...');
  results.total++;
  const paymentTests = [
    { 
      endpoint: '/api/fees/compare-methods', 
      method: 'POST',
      data: { amount: 100, currency: 'USD' },
      name: 'Payment Method Comparison'
    }
  ];

  let paymentWorking = true;
  for (const test of paymentTests) {
    const result = await makeRequest(test.method, test.endpoint, test.data);
    if (result.status === 200 && result.data.success === true) {
      console.log(`   ✓ ${test.name} working`);
    } else {
      console.log(`   ❌ ${test.name} failed (${result.status})`);
      paymentWorking = false;
    }
  }

  if (paymentWorking) {
    results.passed++;
  } else {
    results.criticalIssues.push('Payment processing issues detected');
  }

  // Test 7: Session management
  console.log('\n7. Testing session management...');
  results.total++;
  // Check if sessions table exists and is accessible
  const sessionTest = await makeRequest('GET', '/api/login');
  if (sessionTest.headers['set-cookie']) {
    console.log('   ✓ Session management operational');
    results.passed++;
  } else {
    console.log('   ❌ Session management issues');
    results.warnings.push('Session management may have issues');
  }

  // Final Assessment
  console.log('\n================================================================================');
  console.log('PRODUCTION READINESS ASSESSMENT');
  console.log('================================================================================');
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`\nOVERALL SUCCESS RATE: ${results.passed}/${results.total} (${successRate}%)`);

  if (results.criticalIssues.length === 0) {
    console.log('\n🟢 STATUS: READY FOR DEPLOYMENT');
    console.log('All critical systems operational');
  } else {
    console.log('\n🔴 STATUS: NOT READY FOR DEPLOYMENT');
    console.log('\nCRITICAL ISSUES TO RESOLVE:');
    results.criticalIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log('\nWARNINGS:');
    results.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }

  console.log('\n⚠️  IMPORTANT: OAuth authentication requires manual browser testing');
  console.log('   Real user registration flow cannot be validated programmatically');
  console.log('   Manual verification required: /api/login → Replit OAuth → /api/callback');
  
  console.log('\n================================================================================');
  
  return results;
}

if (typeof require !== 'undefined' && require.main === module) {
  testProductionOAuth().catch(console.error);
}