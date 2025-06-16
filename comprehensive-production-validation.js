/**
 * Comprehensive Production Validation Test
 * Tests all critical systems with real authentication and data validation
 */

import fetch from 'node-fetch';

// Global cookie storage for session persistence
const cookies = new Map();

async function makeRequest(method, endpoint, data = null, useAuth = false) {
  const cookieHeader = Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader && { 'Cookie': cookieHeader })
    }
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`http://localhost:5000${endpoint}`, options);
  
  // Extract and store cookies from response
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const cookieParts = setCookieHeader.split(';')[0].split('=');
    if (cookieParts.length === 2) {
      cookies.set(cookieParts[0], cookieParts[1]);
    }
  }

  const responseData = await response.text();
  
  try {
    return {
      status: response.status,
      data: JSON.parse(responseData),
      success: response.ok
    };
  } catch {
    return {
      status: response.status,
      data: responseData,
      success: response.ok
    };
  }
}

async function authenticateUser() {
  console.log('🔐 Authenticating test user...');
  
  const loginResult = await makeRequest('POST', '/api/auth/login', {
    email: 'test@coinrailz.com',
    password: 'password123'
  });

  if (loginResult.success && loginResult.data.success) {
    console.log('✓ Authentication successful');
    return loginResult.data.user;
  } else {
    throw new Error('Authentication failed: ' + JSON.stringify(loginResult.data));
  }
}

async function runComprehensiveValidation() {
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  function recordResult(testName, success, details = {}) {
    results.totalTests++;
    if (success) {
      results.passed++;
      console.log(`✓ ${testName}`);
    } else {
      results.failed++;
      console.log(`✗ ${testName}: ${details.error || 'Unknown error'}`);
    }
    results.details.push({ testName, success, ...details });
  }

  try {
    console.log('🚀 Starting Comprehensive Production Validation\n');

    // Test 1: Authentication System
    let authenticatedUser;
    try {
      authenticatedUser = await authenticateUser();
      recordResult('User Authentication', true, { userId: authenticatedUser.id });
    } catch (error) {
      recordResult('User Authentication', false, { error: error.message });
      return results; // Can't continue without auth
    }

    // Test 2: User Session Validation
    try {
      const userCheck = await makeRequest('GET', '/api/auth/user');
      const sessionValid = userCheck.success && userCheck.data.success && userCheck.data.user;
      recordResult('Session Validation', sessionValid, { 
        userId: sessionValid ? userCheck.data.user.id : null 
      });
    } catch (error) {
      recordResult('Session Validation', false, { error: error.message });
    }

    // Test 3: Payment System - Stripe Integration
    try {
      const paymentResult = await makeRequest('POST', '/api/create-payment-intent', {
        amount: 100,
        recipientEmail: 'recipient@example.com'
      });
      
      const paymentSuccess = paymentResult.success && 
                            paymentResult.data?.clientSecret && 
                            paymentResult.data?.amount === 100;
      
      recordResult('Stripe Payment Integration', paymentSuccess, {
        hasClientSecret: !!paymentResult.data?.clientSecret,
        amount: paymentResult.data?.amount,
        fee: paymentResult.data?.fee
      });
    } catch (error) {
      recordResult('Stripe Payment Integration', false, { error: error.message });
    }

    // Test 4: AI Agent Payment System
    try {
      const agentPaymentResult = await makeRequest('POST', '/api/agents/create-payment-intent', {
        agentId: 'test-agent',
        serviceType: 'consultation',
        amount: 50
      });
      
      const agentPaymentSuccess = agentPaymentResult.success && 
                                 agentPaymentResult.data.clientSecret;
      
      recordResult('AI Agent Payment System', agentPaymentSuccess, {
        hasClientSecret: !!agentPaymentResult.data.clientSecret
      });
    } catch (error) {
      recordResult('AI Agent Payment System', false, { error: error.message });
    }

    // Test 5: Database Connectivity
    try {
      const dbTest = await makeRequest('GET', '/health');
      recordResult('Database Health Check', dbTest.success, {
        status: dbTest.data.status
      });
    } catch (error) {
      recordResult('Database Health Check', false, { error: error.message });
    }

    // Test 6: XRP Wallet Integration
    try {
      const xrpTest = await makeRequest('GET', '/api/xrp/wallet-info');
      const xrpSuccess = xrpTest.success && xrpTest.data.address;
      recordResult('XRP Wallet Integration', xrpSuccess, {
        address: xrpTest.data?.address,
        balance: xrpTest.data?.balance
      });
    } catch (error) {
      recordResult('XRP Wallet Integration', false, { error: error.message });
    }

    // Test 7: Fee Calculation System
    try {
      const feeTest = await makeRequest('POST', '/api/calculate-fees', {
        amount: 1000,
        currency: 'USD',
        type: 'send_money'
      });
      
      const feeSuccess = feeTest.success && 
                        typeof feeTest.data.fee === 'number' && 
                        feeTest.data.fee > 0;
      
      recordResult('Fee Calculation System', feeSuccess, {
        calculatedFee: feeTest.data?.fee,
        percentage: feeTest.data?.percentage
      });
    } catch (error) {
      recordResult('Fee Calculation System', false, { error: error.message });
    }

    // Test 8: DEX Aggregator Service
    try {
      const dexTest = await makeRequest('GET', '/api/dex/quote?from=ETH&to=USDC&amount=1');
      const dexSuccess = dexTest.success && dexTest.data.quote;
      recordResult('DEX Aggregator Service', dexSuccess, {
        hasQuote: !!dexTest.data?.quote
      });
    } catch (error) {
      recordResult('DEX Aggregator Service', false, { error: error.message });
    }

    // Test 9: AI Agent Registration
    try {
      const agentRegTest = await makeRequest('POST', '/api/ai-agents/register', {
        name: 'Test Agent Production',
        description: 'Production validation test agent',
        capabilities: ['consultation', 'data_analysis'],
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletNetwork: 'ethereum'
      });
      
      recordResult('AI Agent Registration', agentRegTest.success, {
        agentId: agentRegTest.data?.agentId
      });
    } catch (error) {
      recordResult('AI Agent Registration', false, { error: error.message });
    }

    // Test 10: Revenue Tracking System
    try {
      const revenueTest = await makeRequest('GET', '/api/revenue/summary');
      const revenueSuccess = revenueTest.success && 
                            revenueTest.data?.revenue?.platform?.totalTransactions >= 0;
      
      recordResult('Revenue Tracking System', revenueSuccess, {
        totalRevenue: revenueTest.data?.revenue?.platform?.totalVolume
      });
    } catch (error) {
      recordResult('Revenue Tracking System', false, { error: error.message });
    }

  } catch (error) {
    console.error('Critical validation error:', error);
  }

  // Generate comprehensive report
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE PRODUCTION VALIDATION REPORT');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passed} (${((results.passed / results.totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed / results.totalTests) * 100).toFixed(1)}%)`);
  
  const productionReadiness = (results.passed / results.totalTests) * 100;
  console.log(`\nProduction Readiness: ${productionReadiness.toFixed(1)}%`);
  
  if (productionReadiness >= 90) {
    console.log('🟢 STATUS: PRODUCTION READY');
  } else if (productionReadiness >= 75) {
    console.log('🟡 STATUS: NEARLY PRODUCTION READY - Minor fixes needed');
  } else {
    console.log('🔴 STATUS: NOT PRODUCTION READY - Critical issues remain');
  }

  console.log('\nDetailed Results:');
  results.details.forEach(result => {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${result.testName}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.userId) {
      console.log(`  User ID: ${result.userId}`);
    }
    if (result.hasClientSecret !== undefined) {
      console.log(`  Has Client Secret: ${result.hasClientSecret}`);
    }
    if (result.amount !== undefined) {
      console.log(`  Amount: $${result.amount}`);
    }
    if (result.fee !== undefined) {
      console.log(`  Fee: $${result.fee}`);
    }
  });

  return results;
}

// Run the validation
runComprehensiveValidation()
  .then(results => {
    const readinessLevel = (results.passed / results.totalTests) * 100;
    process.exit(readinessLevel >= 90 ? 0 : 1);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });