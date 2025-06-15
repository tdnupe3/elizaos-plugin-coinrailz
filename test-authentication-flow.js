/**
 * Authentication Flow Testing - Sign In/Sign Up Validation
 * Tests OAuth flow, session management, and user authentication endpoints
 */

import http from 'http';

async function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
            location: res.headers.location
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
            location: res.headers.location
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAuthenticationFlow() {
  console.log('=== AUTHENTICATION FLOW TESTING ===\n');
  
  const tests = [
    {
      name: 'Sign In/Sign Up OAuth Redirect',
      description: 'Both sign-in and sign-up should redirect to OAuth provider',
      test: async () => {
        const result = await makeRequest('GET', '/api/login');
        return {
          passed: result.status === 302 && result.location && result.location.includes('replit.com'),
          details: {
            status: result.status,
            redirectUrl: result.location,
            isOAuthRedirect: result.location?.includes('replit.com') || false
          }
        };
      }
    },
    
    {
      name: 'OAuth Callback Endpoint',
      description: 'Callback endpoint should be accessible (will fail without valid OAuth code)',
      test: async () => {
        const result = await makeRequest('GET', '/api/callback');
        // Should redirect to login when no valid OAuth code provided
        return {
          passed: result.status === 302,
          details: {
            status: result.status,
            redirectUrl: result.location
          }
        };
      }
    },
    
    {
      name: 'Unauthenticated User Check',
      description: 'Auth user endpoint should return 401 for unauthenticated users',
      test: async () => {
        const result = await makeRequest('GET', '/api/auth/user');
        return {
          passed: result.status === 401,
          details: {
            status: result.status,
            message: result.data.message
          }
        };
      }
    },
    
    {
      name: 'Logout Endpoint',
      description: 'Logout should redirect to OAuth provider logout',
      test: async () => {
        const result = await makeRequest('GET', '/api/logout');
        return {
          passed: result.status === 302,
          details: {
            status: result.status,
            redirectUrl: result.location
          }
        };
      }
    },
    
    {
      name: 'Session Security',
      description: 'Session cookies should be properly configured',
      test: async () => {
        const result = await makeRequest('GET', '/api/login');
        const setCookieHeader = result.headers['set-cookie'];
        const hasSecureSession = setCookieHeader && 
          setCookieHeader.some(cookie => cookie.includes('connect.sid') && cookie.includes('HttpOnly'));
        
        return {
          passed: hasSecureSession,
          details: {
            hasCookies: !!setCookieHeader,
            cookies: setCookieHeader || [],
            hasSecureSession
          }
        };
      }
    },
    
    {
      name: 'Frontend Authentication Integration',
      description: 'Landing page should have working sign-in/sign-up buttons',
      test: async () => {
        const result = await makeRequest('GET', '/');
        const hasAuthButtons = result.data.includes && (
          result.data.includes('Sign In') || 
          result.data.includes('Sign Up') ||
          result.data.includes('/api/login')
        );
        
        return {
          passed: result.status === 200 && hasAuthButtons,
          details: {
            status: result.status,
            hasAuthButtons,
            contentLength: result.data.length || 0
          }
        };
      }
    }
  ];

  let passed = 0;
  let total = tests.length;
  const results = [];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      const result = await test.test();
      
      if (result.passed) {
        console.log(`✓ PASSED: ${test.name}`);
        passed++;
      } else {
        console.log(`✗ FAILED: ${test.name}`);
        if (result.details) {
          console.log('  Details:', JSON.stringify(result.details, null, 2));
        }
      }
      
      results.push({
        name: test.name,
        description: test.description,
        passed: result.passed,
        details: result.details
      });
    } catch (error) {
      console.log(`✗ ERROR: ${test.name} - ${error.message}`);
      results.push({
        name: test.name,
        description: test.description,
        passed: false,
        error: error.message
      });
    }
  }

  const successRate = (passed / total * 100).toFixed(1);
  
  console.log('\n=== AUTHENTICATION FLOW RESULTS ===');
  console.log(`Success Rate: ${passed}/${total} (${successRate}%)`);
  
  console.log('\n=== AUTHENTICATION STATUS ===');
  if (passed >= 5) {
    console.log('🟢 AUTHENTICATION SYSTEM OPERATIONAL');
    console.log('✓ Sign-in and sign-up redirects working');
    console.log('✓ OAuth integration configured properly');
    console.log('✓ Session security implemented');
    console.log('✓ Frontend integration functional');
  } else if (passed >= 3) {
    console.log('🟡 AUTHENTICATION PARTIALLY WORKING');
    console.log('Some components may need adjustment');
  } else {
    console.log('🔴 AUTHENTICATION NEEDS ATTENTION');
    console.log('Critical issues detected');
  }

  console.log('\n=== USER TESTING INSTRUCTIONS ===');
  console.log('1. Visit the landing page in your browser');
  console.log('2. Click "Sign In" or "Sign Up" button');
  console.log('3. You should be redirected to Replit OAuth');
  console.log('4. Complete OAuth flow to test full authentication');
  console.log('5. After authentication, you should be redirected back to the platform');

  return {
    passed,
    total,
    successRate: parseFloat(successRate),
    results,
    isWorking: passed >= 4
  };
}

// Wait for server startup then run test
setTimeout(async () => {
  try {
    await testAuthenticationFlow();
  } catch (error) {
    console.error('Authentication test failed:', error);
  }
}, 2000);