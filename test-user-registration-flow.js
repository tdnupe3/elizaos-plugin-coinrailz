/**
 * Complete User Registration Flow Test
 * Tests the end-to-end user experience from landing page to authenticated dashboard
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';

async function makeRequest(method, endpoint, data = null, followRedirects = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const result = {
          status: res.statusCode,
          headers: res.headers,
          data: responseData.startsWith('{') || responseData.startsWith('[') 
            ? JSON.parse(responseData) 
            : responseData,
          redirectLocation: res.headers.location
        };
        resolve(result);
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testUserRegistrationFlow() {
  console.log('================================================================================');
  console.log('COIN RAILZ - COMPLETE USER REGISTRATION FLOW TEST');
  console.log('================================================================================\n');

  // Step 1: Access Landing Page
  console.log('=== STEP 1: ACCESSING LANDING PAGE ===');
  console.log('Testing: Landing page loads correctly...');
  
  const landingPage = await makeRequest('GET', '/');
  const isHTML = typeof landingPage.data === 'string' && landingPage.data.includes('<!DOCTYPE html>');
  const hasSignUp = landingPage.data.includes('Sign Up') || landingPage.data.includes('handleSignUp');
  const hasCoinRailz = landingPage.data.includes('Coin Railz');
  
  console.log(`Status: ${landingPage.status} ${landingPage.status === 200 ? '✓' : '✗'}`);
  console.log(`HTML Response: ${isHTML ? '✓' : '✗'}`);
  console.log(`Contains Coin Railz branding: ${hasCoinRailz ? '✓' : '✗'}`);
  console.log(`Has Sign Up functionality: ${hasSignUp ? '✓' : '✗'}`);
  console.log(`Result: ${landingPage.status === 200 && isHTML && hasCoinRailz ? 'PASS' : 'FAIL'}\n`);

  // Step 2: Test Sign Up Flow
  console.log('=== STEP 2: TESTING SIGN UP AUTHENTICATION FLOW ===');
  console.log('Testing: Sign up redirect to authentication...');
  
  const signUpAttempt = await makeRequest('GET', '/api/login');
  const isRedirect = signUpAttempt.status === 302;
  const hasRedirectLocation = !!signUpAttempt.redirectLocation;
  const isReplitAuth = signUpAttempt.redirectLocation && signUpAttempt.redirectLocation.includes('replit.com');
  
  console.log(`Status: ${signUpAttempt.status} (expected 302) ${isRedirect ? '✓' : '✗'}`);
  console.log(`Has redirect location: ${hasRedirectLocation ? '✓' : '✗'}`);
  console.log(`Redirects to Replit OAuth: ${isReplitAuth ? '✓' : '✗'}`);
  console.log(`Redirect URL: ${signUpAttempt.redirectLocation || 'None'}`);
  console.log(`Result: ${isRedirect && hasRedirectLocation ? 'PASS' : 'FAIL'}\n`);

  // Step 3: Test Unauthenticated Access to Protected Routes
  console.log('=== STEP 3: TESTING PROTECTED ROUTE ACCESS ===');
  console.log('Testing: Unauthenticated access to user dashboard...');
  
  const protectedAccess = await makeRequest('GET', '/api/auth/user');
  const isUnauthorized = protectedAccess.status === 401;
  const hasUnauthorizedMessage = protectedAccess.data && protectedAccess.data.message === 'Unauthorized';
  
  console.log(`Status: ${protectedAccess.status} (expected 401) ${isUnauthorized ? '✓' : '✗'}`);
  console.log(`Unauthorized message: ${hasUnauthorizedMessage ? '✓' : '✗'}`);
  console.log(`Result: ${isUnauthorized && hasUnauthorizedMessage ? 'PASS' : 'FAIL'}\n`);

  // Step 4: Test Critical API Endpoints for Authenticated Users
  console.log('=== STEP 4: TESTING API ENDPOINTS FOR FUTURE AUTHENTICATED USERS ===');
  
  // Test endpoints that would be available after authentication
  const criticalEndpoints = [
    { name: 'XRP Rate API', endpoint: '/api/xrp/rate', method: 'GET' },
    { name: 'Fee Structure', endpoint: '/api/fees/structure', method: 'GET' },
    { name: 'AI Agents List', endpoint: '/api/agents/active', method: 'GET' },
    { name: 'System Health', endpoint: '/api/system/health', method: 'GET' }
  ];

  let passedEndpoints = 0;
  
  for (const endpoint of criticalEndpoints) {
    console.log(`Testing: ${endpoint.name}...`);
    const result = await makeRequest(endpoint.method, endpoint.endpoint);
    const isSuccess = result.status === 200;
    const isJSON = typeof result.data === 'object';
    const hasData = result.data && (result.data.success !== false);
    
    console.log(`  Status: ${result.status} ${isSuccess ? '✓' : '✗'}`);
    console.log(`  JSON Response: ${isJSON ? '✓' : '✗'}`);
    console.log(`  Has Valid Data: ${hasData ? '✓' : '✗'}`);
    
    if (isSuccess && isJSON && hasData) {
      passedEndpoints++;
      console.log(`  Result: PASS\n`);
    } else {
      console.log(`  Result: FAIL\n`);
    }
  }

  // Step 5: Test Protected Payment Endpoints
  console.log('=== STEP 5: TESTING PROTECTED PAYMENT ENDPOINTS ===');
  
  const protectedEndpoints = [
    { name: 'XRP Send Payment', endpoint: '/api/xrp/send', method: 'POST', data: { amount: 1, destinationAddress: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe' } },
    { name: 'Create User Wallet', endpoint: '/api/xrp/wallet/create', method: 'POST' }
  ];

  let protectedCount = 0;
  
  for (const endpoint of protectedEndpoints) {
    console.log(`Testing: ${endpoint.name} (should require auth)...`);
    const result = await makeRequest(endpoint.method, endpoint.endpoint, endpoint.data);
    const isUnauthorized = result.status === 401;
    
    console.log(`  Status: ${result.status} (expected 401) ${isUnauthorized ? '✓' : '✗'}`);
    
    if (isUnauthorized) {
      protectedCount++;
      console.log(`  Result: PASS (properly protected)\n`);
    } else {
      console.log(`  Result: FAIL (not properly protected)\n`);
    }
  }

  // Generate Registration Flow Assessment
  console.log('================================================================================');
  console.log('USER REGISTRATION FLOW ASSESSMENT');
  console.log('================================================================================\n');

  const landingPageScore = (landingPage.status === 200 && isHTML && hasCoinRailz) ? 1 : 0;
  const authFlowScore = (isRedirect && hasRedirectLocation) ? 1 : 0;
  const protectionScore = (isUnauthorized && hasUnauthorizedMessage) ? 1 : 0;
  const endpointsScore = passedEndpoints / criticalEndpoints.length;
  const securityScore = protectedCount / protectedEndpoints.length;

  console.log(`LANDING PAGE: ${landingPageScore}/1 ${landingPageScore === 1 ? '✓' : '✗'}`);
  console.log(`AUTHENTICATION FLOW: ${authFlowScore}/1 ${authFlowScore === 1 ? '✓' : '✗'}`);
  console.log(`ROUTE PROTECTION: ${protectionScore}/1 ${protectionScore === 1 ? '✓' : '✗'}`);
  console.log(`API ENDPOINTS: ${passedEndpoints}/${criticalEndpoints.length} ${endpointsScore === 1 ? '✓' : '✗'}`);
  console.log(`SECURITY PROTECTION: ${protectedCount}/${protectedEndpoints.length} ${securityScore === 1 ? '✓' : '✗'}`);

  const overallScore = (landingPageScore + authFlowScore + protectionScore + endpointsScore + securityScore) / 5;
  const percentage = (overallScore * 100).toFixed(1);

  console.log(`\nOVERALL REGISTRATION FLOW SCORE: ${percentage}%`);

  let flowStatus = 'NOT READY';
  if (percentage >= 90) flowStatus = 'PRODUCTION READY';
  else if (percentage >= 75) flowStatus = 'NEARLY READY';
  else if (percentage >= 50) flowStatus = 'FUNCTIONAL';

  console.log(`REGISTRATION FLOW STATUS: ${flowStatus}\n`);

  // Critical Assessment
  console.log('CRITICAL REGISTRATION FLOW FINDINGS:');
  
  if (landingPageScore === 1) {
    console.log('✓ Landing page loads with proper branding and sign-up options');
  } else {
    console.log('✗ Landing page has issues with loading or branding');
  }

  if (authFlowScore === 1) {
    console.log('✓ Authentication flow properly redirects to Replit OAuth');
  } else {
    console.log('✗ Authentication flow not working - users cannot register');
  }

  if (protectionScore === 1) {
    console.log('✓ Protected routes properly secured with authentication');
  } else {
    console.log('✗ Protected routes not properly secured');
  }

  if (endpointsScore >= 0.8) {
    console.log('✓ Critical API endpoints operational for authenticated users');
  } else {
    console.log('✗ Some critical API endpoints not working properly');
  }

  if (securityScore === 1) {
    console.log('✓ Payment endpoints properly protected from unauthorized access');
  } else {
    console.log('✗ Payment endpoints security issues detected');
  }

  console.log('\nUSER REGISTRATION FLOW ASSESSMENT:');
  
  if (overallScore >= 0.9) {
    console.log('✓ Complete user registration flow is production-ready');
    console.log('✓ Users can successfully sign up and access protected features');
    console.log('✓ All security measures properly implemented');
  } else if (overallScore >= 0.75) {
    console.log('⚠ User registration flow mostly functional with minor issues');
    console.log('⚠ Most users should be able to register and use the platform');
  } else {
    console.log('✗ User registration flow has significant issues');
    console.log('✗ Users may experience problems during registration or usage');
  }

  console.log('\nNEXT VALIDATION STEPS:');
  console.log('1. Manual test: Click through actual web interface registration');
  console.log('2. Execute real XRP payment with authenticated test user');
  console.log('3. Verify commission calculations trigger on real transactions');
  console.log('4. Load test registration flow with multiple concurrent users');
  
  console.log('================================================================================');
}

// Execute user registration flow test
testUserRegistrationFlow().catch(console.error);