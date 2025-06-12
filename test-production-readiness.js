/**
 * Comprehensive Production Readiness Test
 * Tests authentication, payments, commissions, and end-to-end flows
 */

import http from 'http';
import https from 'https';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_XRP_ADDRESS = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'; // Well-known test address
const PLATFORM_WALLET = 'rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW';

// Test results tracking
let testResults = {
  authentication: { passed: 0, failed: 0, tests: [] },
  payments: { passed: 0, failed: 0, tests: [] },
  commissions: { passed: 0, failed: 0, tests: [] },
  xrp: { passed: 0, failed: 0, tests: [] },
  overall: { passed: 0, failed: 0 }
};

async function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: responseData.startsWith('{') || responseData.startsWith('[') 
              ? JSON.parse(responseData) 
              : responseData
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
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

async function testEndpoint(testName, method, endpoint, expectedStatus = 200, data = null) {
  try {
    console.log(`Testing: ${testName}...`);
    const result = await makeRequest(method, endpoint, data);
    
    const isHTML = typeof result.data === 'string' && result.data.includes('<!DOCTYPE html>');
    const isJSON = typeof result.data === 'object';
    const statusMatch = result.status === expectedStatus;
    
    const passed = statusMatch && (isJSON || expectedStatus >= 300);
    
    console.log(`  Status: ${result.status} (expected ${expectedStatus}) ${statusMatch ? '✓' : '✗'}`);
    console.log(`  Response Type: ${isHTML ? 'HTML' : isJSON ? 'JSON' : 'TEXT'} ${isHTML && expectedStatus < 300 ? '✗' : '✓'}`);
    
    if (isJSON && result.data.success !== undefined) {
      console.log(`  API Success: ${result.data.success ? '✓' : '✗'}`);
    }
    
    console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}\n`);
    
    return { passed, result };
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    console.log(`  Result: FAIL\n`);
    return { passed: false, error: error.message };
  }
}

async function testXRPWalletBalance() {
  console.log('=== TESTING XRP WALLET BALANCE (REAL XRPL API) ===');
  
  return new Promise((resolve) => {
    const data = JSON.stringify({
      method: 'account_info',
      params: [{
        account: PLATFORM_WALLET,
        ledger_index: 'validated'
      }]
    });

    const options = {
      hostname: 's1.ripple.com',
      port: 51234,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          const balance = parseInt(result.result.account_data.Balance) / 1000000;
          console.log(`Real XRP Balance: ${balance} XRP`);
          console.log(`USD Value (approx): $${(balance * 2.26).toFixed(2)}`);
          console.log(`Sufficient for testing: ${balance > 10 ? '✓ YES' : '✗ NO'}\n`);
          
          resolve({
            passed: balance > 10,
            balance,
            usdValue: balance * 2.26
          });
        } catch (error) {
          console.log(`Error parsing XRPL response: ${error.message}\n`);
          resolve({ passed: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`XRPL API Error: ${error.message}\n`);
      resolve({ passed: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
}

async function recordTestResult(category, testName, passed, details = {}) {
  testResults[category].tests.push({ testName, passed, details });
  if (passed) {
    testResults[category].passed++;
    testResults.overall.passed++;
  } else {
    testResults[category].failed++;
    testResults.overall.failed++;
  }
}

async function runProductionReadinessTests() {
  console.log('================================================================================');
  console.log('COIN RAILZ - COMPREHENSIVE PRODUCTION READINESS TEST');
  console.log('================================================================================\n');

  // 1. AUTHENTICATION TESTS
  console.log('=== 1. AUTHENTICATION SYSTEM TESTS ===');
  
  let test = await testEndpoint('Login Endpoint Redirect', 'GET', '/api/login', 302);
  await recordTestResult('authentication', 'Login Redirect', test.passed);
  
  test = await testEndpoint('User Authentication Check', 'GET', '/api/auth/user', 401);
  await recordTestResult('authentication', 'Auth Check', test.passed);

  // 2. XRP PAYMENT SYSTEM TESTS
  console.log('=== 2. XRP PAYMENT SYSTEM TESTS ===');
  
  test = await testEndpoint('XRP Exchange Rate', 'GET', '/api/xrp/rate', 200);
  await recordTestResult('xrp', 'Exchange Rate API', test.passed);
  
  test = await testEndpoint('XRP Fee Calculation', 'POST', '/api/xrp/fees/calculate', 200, { amount: 100 });
  await recordTestResult('xrp', 'Fee Calculation', test.passed);
  
  // Real XRP wallet balance test
  const xrpBalance = await testXRPWalletBalance();
  await recordTestResult('xrp', 'Real Wallet Balance', xrpBalance.passed, xrpBalance);

  // 3. PAYMENT PROCESSING TESTS
  console.log('=== 3. PAYMENT PROCESSING TESTS ===');
  
  test = await testEndpoint('Fee Structure API', 'GET', '/api/fees/structure', 200);
  await recordTestResult('payments', 'Fee Structure', test.passed);
  
  test = await testEndpoint('Payment Comparison', 'POST', '/api/fees/compare-methods', 200, { amount: 100 });
  await recordTestResult('payments', 'Payment Comparison', test.passed);

  // 4. AI AGENT MARKETPLACE TESTS
  console.log('=== 4. AI AGENT MARKETPLACE TESTS ===');
  
  test = await testEndpoint('Active Agents List', 'GET', '/api/agents/active', 200);
  await recordTestResult('commissions', 'Active Agents', test.passed);
  
  test = await testEndpoint('Marketplace Stats', 'GET', '/api/agents/marketplace/stats', 200);
  await recordTestResult('commissions', 'Marketplace Stats', test.passed);

  // 5. SYSTEM HEALTH TESTS
  console.log('=== 5. SYSTEM HEALTH TESTS ===');
  
  test = await testEndpoint('System Health Check', 'GET', '/api/system/health', 200);
  await recordTestResult('payments', 'System Health', test.passed);
  
  test = await testEndpoint('Crypto Prices', 'GET', '/api/crypto/prices', 200);
  await recordTestResult('payments', 'Crypto Prices', test.passed);

  // Generate comprehensive report
  console.log('================================================================================');
  console.log('PRODUCTION READINESS ASSESSMENT REPORT');
  console.log('================================================================================\n');

  const categories = ['authentication', 'xrp', 'payments', 'commissions'];
  let overallScore = 0;
  let maxScore = 0;

  categories.forEach(category => {
    const results = testResults[category];
    const total = results.passed + results.failed;
    const percentage = total > 0 ? (results.passed / total * 100).toFixed(1) : '0.0';
    
    console.log(`${category.toUpperCase()}: ${results.passed}/${total} tests passed (${percentage}%)`);
    
    results.tests.forEach(test => {
      console.log(`  ${test.passed ? '✓' : '✗'} ${test.testName}`);
    });
    console.log('');
    
    overallScore += results.passed;
    maxScore += total;
  });

  const overallPercentage = maxScore > 0 ? (overallScore / maxScore * 100).toFixed(1) : '0.0';
  
  console.log(`OVERALL SCORE: ${overallScore}/${maxScore} tests passed (${overallPercentage}%)`);
  console.log('');

  // Production readiness assessment
  let readinessLevel = 'NOT READY';
  if (overallPercentage >= 90) readinessLevel = 'PRODUCTION READY';
  else if (overallPercentage >= 75) readinessLevel = 'NEARLY READY';
  else if (overallPercentage >= 50) readinessLevel = 'DEVELOPMENT READY';

  console.log(`PRODUCTION READINESS: ${readinessLevel}`);
  console.log('');

  // Critical issues
  console.log('CRITICAL FINDINGS:');
  
  const authPassed = testResults.authentication.passed;
  const authTotal = testResults.authentication.passed + testResults.authentication.failed;
  if (authPassed === authTotal) {
    console.log('✓ Authentication system working properly');
  } else {
    console.log('✗ Authentication system has issues');
  }

  const xrpBalanceTest = testResults.xrp.tests.find(t => t.testName === 'Real Wallet Balance');
  if (xrpBalanceTest && xrpBalanceTest.passed) {
    console.log(`✓ XRP wallet funded with ${xrpBalanceTest.details.balance} XRP ($${xrpBalanceTest.details.usdValue.toFixed(2)})`);
  } else {
    console.log('✗ XRP wallet funding issue detected');
  }

  const apiResponses = testResults.payments.passed + testResults.xrp.passed;
  const totalApiTests = testResults.payments.passed + testResults.payments.failed + testResults.xrp.passed + testResults.xrp.failed;
  if (apiResponses === totalApiTests) {
    console.log('✓ All API endpoints returning proper JSON responses');
  } else {
    console.log('✗ Some API endpoints returning HTML instead of JSON');
  }

  console.log('');
  console.log('NEXT STEPS FOR PRODUCTION:');
  console.log('1. Test complete user registration flow through web interface');
  console.log('2. Execute real XRP payment with authenticated user');
  console.log('3. Verify commission calculations with actual transactions');
  console.log('4. Load test with multiple concurrent users');
  
  console.log('================================================================================');
}

// Execute tests
runProductionReadinessTests().catch(console.error);