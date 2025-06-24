/**
 * FINAL RESOLUTION TEST - Comprehensive Critical Issues Validation
 * Tests all three critical issues to confirm complete resolution
 */

import fetch from 'node-fetch';

async function makeRequest(method, endpoint, data = null) {
  const url = `http://localhost:5000${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.text();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
    } catch (e) {
      parsedResult = { rawResponse: result, isHTML: result.includes('<html') };
    }
    
    return {
      status: response.status,
      data: parsedResult,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

async function testFinalResolution() {
  console.log('=== FINAL RESOLUTION TEST - ALL CRITICAL ISSUES ===\n');
  
  let totalTests = 0;
  let passedTests = 0;
  const results = {};
  
  // ISSUE 1: Demo API Endpoints must return JSON (not HTML)
  console.log('1. Testing Demo API Endpoints (JSON Response Validation)...');
  totalTests++;
  try {
    const endpoints = [
      '/api/demo/user',
      '/api/demo/balances', 
      '/api/demo/transactions',
      '/api/demo/crypto-prices'
    ];
    
    let allEndpointsWorking = true;
    for (const endpoint of endpoints) {
      const response = await makeRequest('GET', endpoint);
      if (response.status !== 200 || response.data.isHTML) {
        allEndpointsWorking = false;
        console.log(`  ❌ ${endpoint} failed`);
        break;
      }
    }
    
    if (allEndpointsWorking) {
      console.log('✓ Demo API Endpoints: ALL WORKING (JSON responses)');
      passedTests++;
      results.demoAPI = 'PASSED';
    } else {
      console.log('❌ Demo API Endpoints: FAILED');
      results.demoAPI = 'FAILED';
    }
  } catch (error) {
    console.log('❌ Demo API Endpoints error:', error.message);
    results.demoAPI = 'FAILED';
  }
  
  // ISSUE 2: AI Agent Registration must accept agentName field
  console.log('\n2. Testing AI Agent Registration (Field Validation)...');
  totalTests++;
  try {
    const registrationData = {
      agentName: 'Advanced Trading Bot Pro',
      description: 'High-performance cryptocurrency trading agent with AI capabilities',
      capabilities: ['trading', 'market_analysis', 'risk_assessment', 'portfolio_optimization'],
      walletAddress: 'rAdvancedTradingBot123456789XRP'
    };
    
    const response = await makeRequest('POST', '/api/ai-agents/register', registrationData);
    
    if (response.status === 201 && response.data.success && response.data.agentId) {
      console.log('✓ AI Agent Registration: WORKING');
      console.log(`  Agent ID: ${response.data.agentId}`);
      console.log(`  Agent Name: ${response.data.agentName}`);
      passedTests++;
      results.agentRegistration = 'PASSED';
    } else {
      console.log('❌ AI Agent Registration: FAILED');
      console.log(`  Status: ${response.status}`);
      console.log(`  Response:`, response.data);
      results.agentRegistration = 'FAILED';
    }
  } catch (error) {
    console.log('❌ AI Agent Registration error:', error.message);
    results.agentRegistration = 'FAILED';
  }
  
  // ISSUE 3: AI Marketplace Status must return JSON with proper headers
  console.log('\n3. Testing AI Marketplace Status (JSON Headers)...');
  totalTests++;
  try {
    const response = await makeRequest('GET', '/api/ai-marketplace/full-status');
    
    if (response.status === 200 && 
        response.data.success && 
        !response.data.isHTML &&
        response.data.totalAgents !== undefined &&
        response.data.activeAgents !== undefined) {
      console.log('✓ AI Marketplace Status: WORKING (JSON response)');
      console.log(`  Total Agents: ${response.data.totalAgents}`);
      console.log(`  Active Agents: ${response.data.activeAgents}`);
      console.log(`  Categories: ${response.data.categories?.length || 0} categories`);
      passedTests++;
      results.marketplaceStatus = 'PASSED';
    } else {
      console.log('❌ AI Marketplace Status: FAILED');
      console.log(`  Status: ${response.status}`);
      console.log(`  Is HTML: ${response.data.isHTML}`);
      console.log(`  Success: ${response.data.success}`);
      results.marketplaceStatus = 'FAILED';
    }
  } catch (error) {
    console.log('❌ AI Marketplace Status error:', error.message);
    results.marketplaceStatus = 'FAILED';
  }
  
  // BONUS: Authentication System validation
  console.log('\n4. Testing Authentication System (Bonus Verification)...');
  totalTests++;
  try {
    const authData = {
      email: `test_final_${Date.now()}@coinrailz.com`,
      password: 'secure_password_123',
      firstName: 'Final',
      lastName: 'Test'
    };
    
    const response = await makeRequest('POST', '/api/auth/signup', authData);
    
    if (response.status === 201 && response.data.success) {
      console.log('✓ Authentication System: WORKING');
      passedTests++;
      results.authentication = 'PASSED';
    } else if (response.status === 409) {
      console.log('✓ Authentication System: WORKING (duplicate handled)');
      passedTests++;
      results.authentication = 'PASSED';
    } else {
      console.log('❌ Authentication System: FAILED');
      results.authentication = 'FAILED';
    }
  } catch (error) {
    console.log('❌ Authentication System error:', error.message);
    results.authentication = 'FAILED';
  }
  
  // FINAL ASSESSMENT
  console.log('\n=== FINAL RESOLUTION ASSESSMENT ===');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
  console.log('\nDetailed Results:');
  console.log(`  Demo API Endpoints: ${results.demoAPI}`);
  console.log(`  AI Agent Registration: ${results.agentRegistration}`);
  console.log(`  AI Marketplace Status: ${results.marketplaceStatus}`);
  console.log(`  Authentication System: ${results.authentication}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL CRITICAL ISSUES RESOLVED!');
    console.log('Platform is fully operational and ready for production deployment.');
    return true;
  } else {
    console.log('\n⚠️ Some issues remain. Platform needs additional fixes.');
    return false;
  }
}

testFinalResolution().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Final test execution failed:', error);
  process.exit(1);
});