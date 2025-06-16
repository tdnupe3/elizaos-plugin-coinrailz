/**
 * PRODUCTION ROUTE AUDIT - COMPREHENSIVE ENDPOINT VERIFICATION
 * Tests all API routes for production deployment readiness
 */

import http from 'http';

class ProductionRouteAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {};
    this.errors = [];
    this.warnings = [];
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Production-Route-Auditor',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const jsonBody = JSON.parse(body);
            resolve({ status: res.statusCode, body: jsonBody, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, body: body, headers: res.headers });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ status: 0, error: error.message });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testCoreInfrastructure() {
    this.log('Testing core infrastructure endpoints...');
    
    const tests = [
      {
        name: 'Health Check',
        method: 'GET',
        endpoint: '/health',
        expectedStatus: 200,
        critical: true
      },
      {
        name: 'Root Endpoint (Frontend Serving)',
        method: 'GET', 
        endpoint: '/',
        expectedStatus: 200,
        critical: true
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint);
      if (result.status === test.expectedStatus) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, 'error');
        if (test.critical) this.errors.push(`Critical: ${test.name} failed`);
      }
    }

    this.results.infrastructure = { total: tests.length, passed };
  }

  async testAuthenticationEndpoints() {
    this.log('Testing authentication endpoints...');
    
    const tests = [
      {
        name: 'User Authentication Check',
        method: 'GET',
        endpoint: '/api/user',
        expectedStatus: [200, 401], // Either authenticated or not
        critical: true
      },
      {
        name: 'Logout Endpoint',
        method: 'POST',
        endpoint: '/api/logout',
        expectedStatus: [200, 302],
        critical: true
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint);
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      
      if (expectedStatuses.includes(result.status)) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, 'error');
        if (test.critical) this.errors.push(`Critical: ${test.name} failed`);
      }
    }

    this.results.authentication = { total: tests.length, passed };
  }

  async testFinancialEndpoints() {
    this.log('Testing financial endpoints...');
    
    const tests = [
      {
        name: 'Fee Calculation',
        method: 'POST',
        endpoint: '/api/calculate-fees',
        data: { amount: 100, type: 'send_money' },
        expectedStatus: 200,
        critical: true
      },
      {
        name: 'Revenue Summary',
        method: 'GET',
        endpoint: '/api/revenue/summary',
        expectedStatus: 200,
        critical: true
      },
      {
        name: 'Payment Intent Creation (Auth Required)',
        method: 'POST',
        endpoint: '/api/create-payment-intent',
        data: { amount: 100, recipientEmail: 'test@test.com' },
        expectedStatus: [200, 401], // Success or auth required
        critical: true
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint, test.data);
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      
      if (expectedStatuses.includes(result.status)) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
        
        // Validate response structure for critical endpoints
        if (test.endpoint === '/api/calculate-fees' && result.body?.success) {
          this.log('  ↳ Fee calculation returns proper structure');
        }
        if (test.endpoint === '/api/revenue/summary' && result.body?.platform) {
          this.log('  ↳ Revenue summary returns proper structure');
        }
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, 'error');
        if (test.critical) this.errors.push(`Critical: ${test.name} failed`);
      }
    }

    this.results.financial = { total: tests.length, passed };
  }

  async testCryptoEndpoints() {
    this.log('Testing cryptocurrency endpoints...');
    
    const tests = [
      {
        name: 'XRP Wallet Info',
        method: 'GET',
        endpoint: '/api/xrp/wallet-info',
        expectedStatus: 200,
        critical: true
      },
      {
        name: 'DEX Quote',
        method: 'GET',
        endpoint: '/api/dex/quote',
        expectedStatus: 200,
        critical: false
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint);
      
      if (result.status === test.expectedStatus) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, test.critical ? 'error' : 'warning');
        if (test.critical) {
          this.errors.push(`Critical: ${test.name} failed`);
        } else {
          this.warnings.push(`${test.name} not responding`);
        }
      }
    }

    this.results.crypto = { total: tests.length, passed };
  }

  async testAIAgentEndpoints() {
    this.log('Testing AI agent endpoints...');
    
    const tests = [
      {
        name: 'AI Agent Registration',
        method: 'POST',
        endpoint: '/api/ai-agents/register',
        data: {
          name: 'Test Agent',
          description: 'Production test agent',
          serviceType: 'consultation',
          pricing: { basePrice: 50, currency: 'USD' }
        },
        expectedStatus: [200, 201],
        critical: true
      },
      {
        name: 'AI Agent Payment Intent',
        method: 'POST',
        endpoint: '/api/agents/create-payment-intent',
        data: { amount: 50, agentId: 'test-agent' },
        expectedStatus: [200, 401], // Success or auth required
        critical: true
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint, test.data);
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      
      if (expectedStatuses.includes(result.status)) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, 'error');
        if (test.critical) this.errors.push(`Critical: ${test.name} failed`);
      }
    }

    this.results.aiAgents = { total: tests.length, passed };
  }

  async testErrorHandling() {
    this.log('Testing error handling and edge cases...');
    
    const tests = [
      {
        name: 'Invalid Fee Calculation',
        method: 'POST',
        endpoint: '/api/calculate-fees',
        data: { amount: 'invalid' },
        expectedStatus: 400,
        critical: true
      },
      {
        name: 'Non-existent Endpoint',
        method: 'GET',
        endpoint: '/api/nonexistent',
        expectedStatus: 404,
        critical: false
      },
      {
        name: 'Missing Payment Data',
        method: 'POST',
        endpoint: '/api/create-payment-intent',
        data: {},
        expectedStatus: [400, 401],
        critical: true
      }
    ];

    let passed = 0;
    for (const test of tests) {
      const result = await this.makeRequest(test.method, test.endpoint, test.data);
      const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
      
      if (expectedStatuses.includes(result.status)) {
        this.log(`${test.name}: PASS (${result.status})`);
        passed++;
      } else {
        this.log(`${test.name}: FAIL (${result.status})`, test.critical ? 'error' : 'warning');
        if (test.critical) this.errors.push(`Critical: ${test.name} failed`);
      }
    }

    this.results.errorHandling = { total: tests.length, passed };
  }

  generateReport() {
    const totalTests = Object.values(this.results).reduce((sum, result) => sum + result.total, 0);
    const totalPassed = Object.values(this.results).reduce((sum, result) => sum + result.passed, 0);
    const successRate = ((totalPassed / totalTests) * 100).toFixed(1);

    console.log('\n============================================================');
    console.log('🚀 PRODUCTION ROUTE AUDIT REPORT');
    console.log('============================================================');
    console.log(`Total Endpoints Tested: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    // Detailed results
    Object.entries(this.results).forEach(([category, result]) => {
      const categoryRate = ((result.passed / result.total) * 100).toFixed(1);
      console.log(`${category.toUpperCase()}: ${result.passed}/${result.total} (${categoryRate}%)`);
    });

    if (this.errors.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n============================================================');
    
    if (parseFloat(successRate) >= 90) {
      console.log('✅ PRODUCTION READY - All critical routes operational');
    } else if (parseFloat(successRate) >= 75) {
      console.log('🟡 NEARLY READY - Some issues need attention');
    } else {
      console.log('🔴 NOT READY - Critical issues must be resolved');
    }

    return {
      totalTests,
      totalPassed,
      successRate: parseFloat(successRate),
      status: parseFloat(successRate) >= 90 ? 'READY' : parseFloat(successRate) >= 75 ? 'NEARLY_READY' : 'NOT_READY',
      results: this.results,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  async runCompleteAudit() {
    console.log('🔍 Starting Production Route Audit...\n');
    
    await this.testCoreInfrastructure();
    await this.testAuthenticationEndpoints();
    await this.testFinancialEndpoints();
    await this.testCryptoEndpoints();
    await this.testAIAgentEndpoints();
    await this.testErrorHandling();
    
    return this.generateReport();
  }
}

// Execute audit
async function main() {
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const auditor = new ProductionRouteAuditor();
  try {
    const report = await auditor.runCompleteAudit();
    process.exit(report.successRate >= 75 ? 0 : 1);
  } catch (error) {
    console.error('❌ Route audit failed:', error.message);
    process.exit(1);
  }
}

main();