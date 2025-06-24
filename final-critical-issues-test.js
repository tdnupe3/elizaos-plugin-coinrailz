/**
 * Final Critical Issues Resolution Test
 * Tests all three blocking issues to verify complete fixes
 */

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

async function testCriticalIssues() {
  console.log('=== TESTING ALL THREE CRITICAL ISSUES ===\n');
  
  let allPassed = true;
  const results = {};
  
  // ISSUE 1: Demo API Endpoints returning proper JSON
  console.log('1. Testing Demo API Endpoints...');
  try {
    const userResponse = await makeRequest('GET', '/api/demo/user');
    const balancesResponse = await makeRequest('GET', '/api/demo/balances');
    const transactionsResponse = await makeRequest('GET', '/api/demo/transactions');
    const pricesResponse = await makeRequest('GET', '/api/demo/crypto-prices');
    
    const demoEndpointsWorking = 
      userResponse.status === 200 && 
      balancesResponse.status === 200 && 
      transactionsResponse.status === 200 && 
      pricesResponse.status === 200 &&
      !userResponse.data.isHTML &&
      !balancesResponse.data.isHTML &&
      !transactionsResponse.data.isHTML &&
      !pricesResponse.data.isHTML;
    
    if (demoEndpointsWorking) {
      console.log('✓ Demo API endpoints working correctly');
      results.demoEndpoints = 'PASSED';
    } else {
      console.log('❌ Demo API endpoints failed');
      results.demoEndpoints = 'FAILED';
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ Demo API endpoints error:', error.message);
    results.demoEndpoints = 'FAILED';
    allPassed = false;
  }
  
  // ISSUE 2: AI Agent Registration working
  console.log('\n2. Testing AI Agent Registration...');
  try {
    const registrationData = {
      agentName: 'Advanced Trading Bot',
      description: 'High-performance cryptocurrency trading agent',
      capabilities: ['trading', 'market_analysis', 'risk_assessment'],
      walletAddress: 'test_wallet_advanced_123'
    };
    
    const registrationResponse = await makeRequest('POST', '/api/ai-agents/register', registrationData);
    
    if (registrationResponse.status === 201 && registrationResponse.data.success) {
      console.log('✓ AI Agent registration working correctly');
      console.log(`  Agent ID: ${registrationResponse.data.agentId}`);
      results.agentRegistration = 'PASSED';
    } else {
      console.log('❌ AI Agent registration failed');
      console.log(`  Status: ${registrationResponse.status}`);
      console.log(`  Response:`, registrationResponse.data);
      results.agentRegistration = 'FAILED';
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ AI Agent registration error:', error.message);
    results.agentRegistration = 'FAILED';
    allPassed = false;
  }
  
  // ISSUE 3: AI Marketplace Status returning JSON (not HTML)
  console.log('\n3. Testing AI Marketplace Status Endpoint...');
  try {
    const marketplaceResponse = await makeRequest('GET', '/api/ai-marketplace/full-status');
    
    if (marketplaceResponse.status === 200 && 
        marketplaceResponse.data.success && 
        !marketplaceResponse.data.isHTML &&
        marketplaceResponse.data.totalAgents !== undefined) {
      console.log('✓ AI Marketplace status working correctly');
      console.log(`  Total Agents: ${marketplaceResponse.data.totalAgents}`);
      console.log(`  Active Agents: ${marketplaceResponse.data.activeAgents}`);
      results.marketplaceStatus = 'PASSED';
    } else {
      console.log('❌ AI Marketplace status failed');
      console.log(`  Status: ${marketplaceResponse.status}`);
      console.log(`  Is HTML: ${marketplaceResponse.data.isHTML}`);
      results.marketplaceStatus = 'FAILED';
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ AI Marketplace status error:', error.message);
    results.marketplaceStatus = 'FAILED';
    allPassed = false;
  }
  
  // ADDITIONAL: Authentication System Test
  console.log('\n4. Testing Authentication System...');
  try {
    const signupData = {
      email: `test_${Date.now()}@coinrailz.com`,
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User'
    };
    
    const authResponse = await makeRequest('POST', '/api/auth/signup', signupData);
    
    if (authResponse.status === 201 && authResponse.data.success) {
      console.log('✓ Authentication system working correctly');
      results.authentication = 'PASSED';
    } else if (authResponse.status === 409) {
      console.log('✓ Authentication system working (user already exists)');
      results.authentication = 'PASSED';
    } else {
      console.log('❌ Authentication system failed');
      console.log(`  Status: ${authResponse.status}`);
      results.authentication = 'FAILED';
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ Authentication system error:', error.message);
    results.authentication = 'FAILED';
    allPassed = false;
  }
  
  // Final Results
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Demo API Endpoints: ${results.demoEndpoints}`);
  console.log(`AI Agent Registration: ${results.agentRegistration}`);
  console.log(`AI Marketplace Status: ${results.marketplaceStatus}`);
  console.log(`Authentication System: ${results.authentication}`);
  
  if (allPassed) {
    console.log('\n🎉 ALL CRITICAL ISSUES RESOLVED! Platform is fully operational.');
    return true;
  } else {
    console.log('\n⚠️  Some issues remain. See failed tests above.');
    return false;
  }
}

// Import fetch for Node.js (ES module syntax)
import fetch from 'node-fetch';

testCriticalIssues().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});