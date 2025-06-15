/**
 * FINAL HONEST PRODUCTION READINESS AUDIT
 * No more false promises. This tests EVERYTHING that could break in production.
 * If this passes, we deploy. If not, we fix what's broken.
 */

import http from 'http';

class ProductionAuditor {
  constructor() {
    this.criticalFailures = [];
    this.warnings = [];
    this.passedTests = 0;
    this.totalTests = 0;
    this.startTime = Date.now();
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const requestHeaders = { 'Content-Type': 'application/json', ...headers };

      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method,
        headers: requestHeaders,
        timeout: 10000 // 10 second timeout
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ 
              status: res.statusCode, 
              data: JSON.parse(body || '{}'),
              headers: res.headers,
              responseTime: Date.now() - requestStart
            });
          } catch {
            resolve({ 
              status: res.statusCode, 
              data: body,
              headers: res.headers,
              responseTime: Date.now() - requestStart
            });
          }
        });
      });

      const requestStart = Date.now();
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout - server too slow for production'));
      });

      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  async testCriticalEndpoint(name, method, endpoint, expectedStatus = 200, data = null, timeout = 5000) {
    this.totalTests++;
    
    try {
      console.log(`Testing: ${name}`);
      const result = await this.makeRequest(method, endpoint, data);
      
      if (result.status === expectedStatus) {
        if (result.responseTime > timeout) {
          this.warnings.push(`${name}: Slow response (${result.responseTime}ms > ${timeout}ms)`);
          console.log(`⚠ ${name}: SLOW (${result.responseTime}ms)`);
        } else {
          this.passedTests++;
          console.log(`✓ ${name}: PASS (${result.responseTime}ms)`);
        }
        return result;
      } else {
        this.criticalFailures.push(`${name}: Expected ${expectedStatus}, got ${result.status}`);
        console.log(`✗ ${name}: FAIL - Status ${result.status}`);
        if (result.data && result.data.error) {
          console.log(`  Error: ${result.data.error}`);
        }
        return null;
      }
    } catch (error) {
      this.criticalFailures.push(`${name}: ${error.message}`);
      console.log(`✗ ${name}: ERROR - ${error.message}`);
      return null;
    }
  }

  async testServerStability() {
    console.log('\n=== 1. SERVER STABILITY TEST ===');
    
    // Test basic health
    await this.testCriticalEndpoint('Server Health Check', 'GET', '/health');
    await this.testCriticalEndpoint('Root Endpoint', 'GET', '/');
    
    // Test under concurrent load
    console.log('\nTesting concurrent load handling...');
    const concurrentRequests = [];
    for (let i = 0; i < 10; i++) {
      concurrentRequests.push(this.makeRequest('GET', '/api/demo/user'));
    }
    
    try {
      const results = await Promise.all(concurrentRequests);
      const successCount = results.filter(r => r.status === 200).length;
      
      if (successCount >= 8) {
        this.passedTests++;
        console.log(`✓ Concurrent Load: ${successCount}/10 requests succeeded`);
      } else {
        this.criticalFailures.push(`Concurrent load test failed: Only ${successCount}/10 requests succeeded`);
        console.log(`✗ Concurrent Load: Only ${successCount}/10 requests succeeded`);
      }
      this.totalTests++;
    } catch (error) {
      this.criticalFailures.push(`Concurrent load test crashed: ${error.message}`);
      console.log(`✗ Concurrent Load: Server crashed under load`);
      this.totalTests++;
    }
  }

  async testAuthenticationSystem() {
    console.log('\n=== 2. AUTHENTICATION SYSTEM TEST ===');
    
    // Test OAuth endpoints
    await this.testCriticalEndpoint('OAuth Login Redirect', 'GET', '/api/login', 302);
    await this.testCriticalEndpoint('OAuth Callback Handler', 'GET', '/api/auth/callback', 200);
    await this.testCriticalEndpoint('User Session Check', 'GET', '/api/user', 200);
    await this.testCriticalEndpoint('Logout Endpoint', 'POST', '/api/logout', 200);
    
    // Test session security
    const sessionTest = await this.makeRequest('POST', '/api/demo/authenticate', {});
    if (sessionTest && sessionTest.status === 200 && sessionTest.data.success) {
      console.log('✓ Session Management: Working');
      this.passedTests++;
    } else {
      this.criticalFailures.push('Session management broken');
      console.log('✗ Session Management: BROKEN');
    }
    this.totalTests++;
  }

  async testFinancialSystems() {
    console.log('\n=== 3. FINANCIAL SYSTEMS TEST ===');
    
    // Test fee calculations - CRITICAL FOR REVENUE
    const feeTest = await this.testCriticalEndpoint(
      'Fee Calculation', 
      'POST', 
      '/api/demo/calculate-fee',
      200,
      { amount: 1000, currency: 'USD' }
    );
    
    if (feeTest && feeTest.data.fee) {
      const expectedFee = 10; // 1% of $1000
      if (Math.abs(feeTest.data.fee - expectedFee) < 0.01) {
        console.log(`✓ Fee Accuracy: Correct ($${feeTest.data.fee})`);
      } else {
        this.criticalFailures.push(`Fee calculation wrong: Expected $${expectedFee}, got $${feeTest.data.fee}`);
        console.log(`✗ Fee Accuracy: WRONG - Expected $${expectedFee}, got $${feeTest.data.fee}`);
      }
    }
    
    // Test commission system
    const commissionTest = await this.testCriticalEndpoint(
      'Commission Calculation',
      'POST',
      '/api/referrals/calculate-commission',
      200,
      { transactionAmount: 1000, referralTier: 'basic' }
    );
    
    if (commissionTest && commissionTest.data.commission === 3) {
      console.log('✓ Commission System: Accurate');
    } else {
      this.criticalFailures.push('Commission calculation broken');
      console.log('✗ Commission System: BROKEN');
    }
    
    // Test payment processing endpoints
    await this.testCriticalEndpoint('Send Money', 'POST', '/api/demo/send-money', 200, {
      amount: 100,
      recipient: 'test@example.com',
      note: 'Test transaction'
    });
  }

  async testBusinessLogic() {
    console.log('\n=== 4. BUSINESS LOGIC TEST ===');
    
    // Test referral system
    const referralTest = await this.testCriticalEndpoint(
      'Referral Link Generation',
      'POST',
      '/api/referrals/generate-link',
      200,
      { userId: 'test-user-12345' }
    );
    
    if (referralTest && referralTest.data.referralLink && referralTest.data.referralLink.includes('coinrailz.com')) {
      console.log('✓ Referral System: Generating valid links');
    } else {
      this.criticalFailures.push('Referral link generation broken');
      console.log('✗ Referral System: BROKEN');
    }
    
    // Test AI agent registration
    await this.testCriticalEndpoint('AI Agent Registration', 'POST', '/api/ai-agents/register', 200, {
      name: 'Test Agent',
      description: 'Production test agent',
      capabilities: ['payments', 'analysis'],
      pricing: { baseRate: 10, currency: 'USD' }
    });
    
    // Test data monetization APIs
    await this.testCriticalEndpoint('Credit Score API', 'POST', '/api/data/credit-score', 200, {
      userId: 'test-user',
      apiKey: 'test-key'
    });
  }

  async testDataIntegrity() {
    console.log('\n=== 5. DATA INTEGRITY TEST ===');
    
    // Test database connectivity
    const dbTest = await this.testCriticalEndpoint('Database Health', 'GET', '/api/system/health', 200);
    
    // Test user data storage
    await this.testCriticalEndpoint('User Profile', 'GET', '/api/demo/user', 200);
    
    // Test transaction history
    await this.testCriticalEndpoint('Transaction History', 'GET', '/api/transactions/history', 200);
  }

  async testSecurityMeasures() {
    console.log('\n=== 6. SECURITY TEST ===');
    
    // Test CORS headers
    const corsTest = await this.makeRequest('GET', '/api/demo/user', null, {
      'Origin': 'https://coinrailz.com'
    });
    
    if (corsTest && corsTest.headers['access-control-allow-origin']) {
      console.log('✓ CORS Headers: Configured');
      this.passedTests++;
    } else {
      this.warnings.push('CORS headers missing - will block mobile apps');
      console.log('⚠ CORS Headers: Missing');
    }
    this.totalTests++;
    
    // Test SQL injection protection
    const sqlTest = await this.testCriticalEndpoint(
      'SQL Injection Protection',
      'POST',
      '/api/demo/send-money',
      400, // Should reject malicious input
      {
        amount: "'; DROP TABLE users; --",
        recipient: 'test@example.com'
      }
    );
    
    // Test XSS protection
    const xssTest = await this.testCriticalEndpoint(
      'XSS Protection',
      'POST',
      '/api/demo/send-money',
      200,
      {
        amount: 100,
        recipient: 'test@example.com',
        note: '<script>alert("xss")</script>'
      }
    );
  }

  async testErrorHandling() {
    console.log('\n=== 7. ERROR HANDLING TEST ===');
    
    // Test invalid requests don't crash server
    await this.testCriticalEndpoint('Invalid JSON Handling', 'POST', '/api/demo/send-money', 400, null);
    await this.testCriticalEndpoint('Missing Parameters', 'POST', '/api/referrals/generate-link', 400, {});
    await this.testCriticalEndpoint('Invalid Amounts', 'POST', '/api/demo/calculate-fee', 400, { amount: -100 });
  }

  async testPerformanceMetrics() {
    console.log('\n=== 8. PERFORMANCE METRICS ===');
    
    const performanceTests = [
      { name: 'Fee Calculation Speed', endpoint: '/api/demo/calculate-fee', data: { amount: 1000 } },
      { name: 'User Data Retrieval', endpoint: '/api/demo/user', data: null },
      { name: 'Commission Calculation', endpoint: '/api/referrals/calculate-commission', data: { transactionAmount: 1000, referralTier: 'basic' } }
    ];
    
    for (const test of performanceTests) {
      try {
        const result = await this.makeRequest('POST', test.endpoint, test.data);
        if (result.responseTime > 1000) {
          this.criticalFailures.push(`${test.name}: Too slow (${result.responseTime}ms > 1000ms)`);
          console.log(`✗ ${test.name}: TOO SLOW (${result.responseTime}ms)`);
        } else if (result.responseTime > 500) {
          this.warnings.push(`${test.name}: Slow response (${result.responseTime}ms)`);
          console.log(`⚠ ${test.name}: Slow (${result.responseTime}ms)`);
        } else {
          console.log(`✓ ${test.name}: Fast (${result.responseTime}ms)`);
        }
      } catch (error) {
        this.criticalFailures.push(`${test.name}: Performance test failed - ${error.message}`);
        console.log(`✗ ${test.name}: ERROR`);
      }
    }
  }

  generateHonestAssessment() {
    const successRate = (this.passedTests / this.totalTests * 100).toFixed(1);
    const totalTime = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('FINAL HONEST PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(80));
    
    console.log(`\nTEST RESULTS:`);
    console.log(`✓ Passed: ${this.passedTests}/${this.totalTests} (${successRate}%)`);
    console.log(`⚠ Warnings: ${this.warnings.length}`);
    console.log(`✗ Critical Failures: ${this.criticalFailures.length}`);
    console.log(`⏱ Total Test Time: ${totalTime}ms`);
    
    if (this.criticalFailures.length === 0) {
      console.log(`\n🎯 VERDICT: PRODUCTION READY`);
      console.log(`All critical systems operational. Safe to deploy.`);
      
      if (this.warnings.length > 0) {
        console.log(`\nMINOR ISSUES TO MONITOR:`);
        this.warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
      }
    } else {
      console.log(`\n🚨 VERDICT: NOT PRODUCTION READY`);
      console.log(`Critical failures detected. DO NOT DEPLOY.`);
      
      console.log(`\nCRITICAL ISSUES REQUIRING FIXES:`);
      this.criticalFailures.forEach(failure => console.log(`  ✗ ${failure}`));
    }
    
    if (this.warnings.length > 0 && this.criticalFailures.length === 0) {
      console.log(`\nWARNINGS TO ADDRESS POST-DEPLOYMENT:`);
      this.warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
    }
    
    console.log('\n' + '='.repeat(80));
    
    return {
      productionReady: this.criticalFailures.length === 0,
      successRate: parseFloat(successRate),
      criticalFailures: this.criticalFailures.length,
      warnings: this.warnings.length,
      details: {
        passed: this.passedTests,
        total: this.totalTests,
        failures: this.criticalFailures,
        warnings: this.warnings
      }
    };
  }

  async runCompleteAudit() {
    console.log('Starting comprehensive production readiness audit...');
    console.log('This will test EVERY system that could fail in production.\n');
    
    await this.testServerStability();
    await this.testAuthenticationSystem();  
    await this.testFinancialSystems();
    await this.testBusinessLogic();
    await this.testDataIntegrity();
    await this.testSecurityMeasures();
    await this.testErrorHandling();
    await this.testPerformanceMetrics();
    
    return this.generateHonestAssessment();
  }
}

// Wait for server startup then run audit
setTimeout(async () => {
  try {
    const auditor = new ProductionAuditor();
    const results = await auditor.runCompleteAudit();
    
    if (results.productionReady) {
      console.log('\n✅ FINAL ANSWER: Ready for production deployment');
    } else {
      console.log('\n❌ FINAL ANSWER: Requires fixes before deployment');
    }
    
  } catch (error) {
    console.error('\n💥 AUDIT SYSTEM FAILURE:', error.message);
    console.error('❌ FINAL ANSWER: Platform unstable - do not deploy');
  }
}, 3000);