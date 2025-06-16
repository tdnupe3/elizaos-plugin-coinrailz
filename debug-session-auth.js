/**
 * Debug Session Authentication Issue
 */

const { CookieJar } = require('tough-cookie');
const fetch = require('node-fetch');

class SessionDebugger {
  constructor() {
    this.cookies = new Map();
  }

  async makeRequest(method, endpoint, data = null) {
    const cookieHeader = Array.from(this.cookies.entries())
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

    console.log(`Making ${method} request to ${endpoint}`);
    console.log(`Cookies: ${cookieHeader || 'none'}`);

    const response = await fetch(`http://localhost:5000${endpoint}`, options);
    
    // Extract cookies from response
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log(`Set-Cookie received: ${setCookieHeader}`);
      const cookieParts = setCookieHeader.split(';')[0].split('=');
      if (cookieParts.length === 2) {
        this.cookies.set(cookieParts[0], cookieParts[1]);
      }
    }

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data: ${JSON.stringify(responseData, null, 2)}`);
    console.log('---');

    return {
      status: response.status,
      data: responseData,
      success: response.ok
    };
  }

  async debugAuthentication() {
    console.log('🔍 Debugging Session Authentication\n');

    // Step 1: Login
    console.log('Step 1: Login');
    const loginResult = await this.makeRequest('POST', '/api/auth/login', {
      email: 'test@coinrailz.com',
      password: 'password123'
    });

    if (!loginResult.success || !loginResult.data.success) {
      console.log('❌ Login failed');
      return;
    }

    console.log('✅ Login successful');
    console.log(`Current cookies: ${Array.from(this.cookies.entries()).map(([k,v]) => `${k}=${v}`).join('; ')}\n`);

    // Step 2: Check user session
    console.log('Step 2: Check user session');
    const userResult = await this.makeRequest('GET', '/api/auth/user');
    
    if (userResult.success && userResult.data.success) {
      console.log('✅ Session validation successful');
    } else {
      console.log('❌ Session validation failed');
      console.log('This indicates the session is not persisting between requests');
    }

    // Step 3: Test authenticated endpoint
    console.log('\nStep 3: Test authenticated payment endpoint');
    const paymentResult = await this.makeRequest('POST', '/api/create-payment-intent', {
      amount: 100,
      recipientEmail: 'test@example.com'
    });

    if (paymentResult.success) {
      console.log('✅ Payment endpoint accessible');
    } else {
      console.log('❌ Payment endpoint authentication failed');
    }
  }
}

const sessionDebugger = new SessionDebugger();
sessionDebugger.debugAuthentication().catch(console.error);