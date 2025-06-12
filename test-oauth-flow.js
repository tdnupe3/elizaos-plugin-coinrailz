/**
 * OAuth Flow Test - Testing Real User Registration
 */

async function testOAuthFlow() {
  console.log('=== TESTING OAUTH REGISTRATION FLOW ===');
  
  try {
    // Test 1: Check if login endpoint redirects properly
    console.log('\n1. Testing login endpoint...');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'GET',
      redirect: 'manual'
    });
    
    console.log('Login status:', loginResponse.status);
    console.log('Login headers:', Object.fromEntries(loginResponse.headers));
    
    if (loginResponse.status === 302) {
      const redirectUrl = loginResponse.headers.get('location');
      console.log('✓ OAuth redirect URL:', redirectUrl);
      
      // Test if the redirect URL is valid
      if (redirectUrl && redirectUrl.includes('replit.com')) {
        console.log('✓ OAuth provider URL is valid');
      } else {
        console.log('❌ OAuth provider URL is invalid');
      }
    } else {
      console.log('❌ Login endpoint not redirecting properly');
    }
    
    // Test 2: Check auth user endpoint without authentication
    console.log('\n2. Testing auth user endpoint (should fail)...');
    const authResponse = await fetch('http://localhost:5000/api/auth/user');
    const authData = await authResponse.json();
    
    if (authResponse.status === 401) {
      console.log('✓ Protected endpoint properly secured');
    } else {
      console.log('❌ Protected endpoint not properly secured');
      console.log('Response:', authData);
    }
    
    // Test 3: Check database connection and user table
    console.log('\n3. Testing database and user storage...');
    const healthResponse = await fetch('http://localhost:5000/api/system/health');
    const healthData = await healthResponse.json();
    
    if (healthData.status === 'healthy' && healthData.services.database === 'connected') {
      console.log('✓ Database connection working');
    } else {
      console.log('❌ Database connection issues');
      console.log('Health data:', healthData);
    }
    
    // Test 4: Try to create a test user via storage (simulate OAuth completion)
    console.log('\n4. Testing user creation via direct API...');
    const testUserData = {
      id: 'test-oauth-user-' + Date.now(),
      email: 'test@coinrailz.com',
      firstName: 'Test',
      lastName: 'User'
    };
    
    const createUserResponse = await fetch('http://localhost:5000/api/test/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserData)
    });
    
    if (createUserResponse.status === 404) {
      console.log('⚠️  No test user creation endpoint (expected - this would be OAuth only)');
    } else {
      const userData = await createUserResponse.json();
      console.log('User creation response:', userData);
    }
    
  } catch (error) {
    console.error('OAuth flow test error:', error.message);
  }
  
  console.log('\n=== OAUTH FLOW DIAGNOSIS ===');
  console.log('The OAuth flow appears to be properly configured but requires:');
  console.log('1. Actual browser-based authentication (not curl)');
  console.log('2. Valid Replit OAuth completion');
  console.log('3. Proper session management after OAuth callback');
  console.log('\nTo test real user registration, a user must:');
  console.log('- Visit /api/login in a browser');
  console.log('- Complete Replit OAuth flow');
  console.log('- Get redirected back to /api/callback');
  console.log('- Have session created and user record inserted');
}

testOAuthFlow().catch(console.error);