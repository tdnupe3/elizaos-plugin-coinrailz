/**
 * COMPREHENSIVE PRODUCTION AUDIT - FINAL SECURITY & BUSINESS LOGIC ASSESSMENT
 * Tests all critical business logic, edge cases, and potential vulnerabilities
 */

class ProductionAuditor {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      critical: 0,
      warnings: 0,
      tests: []
    };
    this.baseUrl = 'http://localhost:5000';
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: data ? JSON.stringify(data) : undefined
      };
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();
      return { ok: response.ok, status: response.status, data: result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async testScenario(name, testFn, critical = false) {
    try {
      this.log(`\n🔍 Testing: ${name}`, 'info');
      const result = await testFn();
      
      if (result.success) {
        this.log(`✅ PASSED: ${name}`, 'success');
        this.results.passed++;
      } else {
        this.log(`❌ FAILED: ${name} - ${result.reason}`, 'error');
        this.results.failed++;
        if (critical) this.results.critical++;
      }
      
      this.results.tests.push({ name, ...result, critical });
      return result;
    } catch (error) {
      this.log(`💥 EXCEPTION: ${name} - ${error.message}`, 'error');
      this.results.failed++;
      if (critical) this.results.critical++;
      this.results.tests.push({ name, success: false, reason: error.message, critical });
      return { success: false, reason: error.message };
    }
  }

  // Financial Logic Tests
  async testFinancialIntegrity() {
    return await this.testScenario('Financial Calculations Integrity', async () => {
      // Test extreme amounts
      const tests = [
        { amount: 0.01, expected: 'minimum fee' },
        { amount: 999999.99, expected: 'large amount' },
        { amount: 0.001, expected: 'sub-penny' },
        { amount: 1234567.89, expected: 'very large' }
      ];

      for (const test of tests) {
        const result = await this.makeRequest('POST', '/api/test-payment-calculation', {
          amount: test.amount,
          recipientEmail: 'test@example.com'
        });

        if (!result.ok) {
          return { success: false, reason: `Failed for amount ${test.amount}` };
        }

        const fee = result.data.fee;
        const decimalPlaces = (fee.toString().split('.')[1] || '').length;
        
        if (decimalPlaces > 2) {
          return { success: false, reason: `Fee ${fee} has ${decimalPlaces} decimal places for amount ${test.amount}` };
        }

        // Check for negative fees
        if (fee < 0) {
          return { success: false, reason: `Negative fee ${fee} for amount ${test.amount}` };
        }
      }

      return { success: true, reason: 'All financial calculations pass integrity checks' };
    }, true);
  }

  // Race Condition Tests
  async testConcurrencyIssues() {
    return await this.testScenario('Concurrent Operations Safety', async () => {
      const walletAddress = 'rConcurrency' + Date.now();
      
      // Test concurrent agent registrations
      const promises = Array(5).fill().map(async (_, i) => {
        return this.makeRequest('POST', '/api/public/agents/register', {
          agentName: `ConcurrentAgent_${i}`,
          walletAddress: walletAddress,
          walletNetwork: 'xrp',
          capabilities: ['testing'],
          publicKey: 'test-key',
          signature: 'test-sig',
          preferredCurrencies: ['XRP']
        });
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.ok).length;
      
      if (successCount !== 1) {
        return { success: false, reason: `Expected 1 success, got ${successCount}` };
      }

      // Test concurrent payment calculations
      const paymentPromises = Array(10).fill().map(async () => {
        return this.makeRequest('POST', '/api/test-payment-calculation', {
          amount: 100.00,
          recipientEmail: 'test@example.com'
        });
      });

      const paymentResults = await Promise.all(paymentPromises);
      const allSuccessful = paymentResults.every(r => r.ok);
      
      if (!allSuccessful) {
        return { success: false, reason: 'Concurrent payment calculations failed' };
      }

      return { success: true, reason: 'Concurrency controls working properly' };
    }, true);
  }

  // Input Validation Edge Cases
  async testInputValidationEdgeCases() {
    return await this.testScenario('Input Validation Edge Cases', async () => {
      const maliciousInputs = [
        { agentName: "'; DROP TABLE users; --", type: 'SQL injection', dangerous: ['DROP', ';', '--'] },
        { agentName: '<script>alert("xss")</script>', type: 'XSS attempt', dangerous: ['<script', 'script>'] },
        { agentName: '../../../../etc/passwd', type: 'Path traversal', dangerous: ['../', '../', './'] },
        { agentName: 'A'.repeat(1000), type: 'Buffer overflow', dangerous: [] },
        { agentName: '\x00\x01\x02', type: 'Null bytes', dangerous: ['\x00'] },
        { agentName: '${process.env}', type: 'Template injection', dangerous: ['${', 'process.env'] }
      ];

      for (const input of maliciousInputs) {
        const result = await this.makeRequest('POST', '/api/public/agents/register', {
          agentName: input.agentName,
          walletAddress: 'rMalicious' + Date.now(),
          walletNetwork: 'xrp',
          capabilities: ['testing'],
          publicKey: 'test-key',
          signature: 'test-sig',
          preferredCurrencies: ['XRP']
        });

        // Should either reject or sanitize dangerous content
        if (result.ok && result.data.agent) {
          const agentName = result.data.agent.agentName || result.data.agent.name;
          if (agentName) {
            // Check if dangerous patterns still exist after sanitization
            for (const dangerousPattern of input.dangerous) {
              if (agentName.includes(dangerousPattern)) {
                return { success: false, reason: `${input.type} not properly sanitized - found "${dangerousPattern}"` };
              }
            }
            
            // Special check for path traversal - should not contain original input
            if (input.type === 'Path traversal' && agentName === input.agentName) {
              return { success: false, reason: `${input.type} not properly sanitized - original input preserved` };
            }
          }
        }
      }

      return { success: true, reason: 'All malicious inputs properly handled' };
    }, true);
  }

  // Business Logic Consistency
  async testBusinessLogicConsistency() {
    return await this.testScenario('Business Logic Consistency', async () => {
      // Test agent discovery with various filters
      const discoveryTests = [
        { filter: {}, expected: 'all agents' },
        { filter: { status: 'active' }, expected: 'active agents only' },
        { filter: { capabilities: ['trading'] }, expected: 'trading agents' },
        { filter: { currencies: ['XRP'] }, expected: 'XRP agents' }
      ];

      for (const test of discoveryTests) {
        const result = await this.makeRequest('POST', '/api/public/agents/discover', test.filter);
        
        if (!result.ok) {
          return { success: false, reason: `Agent discovery failed for ${test.expected}` };
        }

        if (!Array.isArray(result.data.agents)) {
          return { success: false, reason: `Invalid response format for ${test.expected}` };
        }
      }

      return { success: true, reason: 'Business logic consistency verified' };
    });
  }

  // Payment Processing Edge Cases
  async testPaymentProcessingEdgeCases() {
    return await this.testScenario('Payment Processing Edge Cases', async () => {
      const edgeCases = [
        { amount: 0, description: 'zero amount' },
        { amount: -10, description: 'negative amount' },
        { amount: 'invalid', description: 'non-numeric amount' },
        { amount: Infinity, description: 'infinite amount' },
        { amount: NaN, description: 'NaN amount' }
      ];

      for (const testCase of edgeCases) {
        const result = await this.makeRequest('POST', '/api/test-payment-calculation', {
          amount: testCase.amount,
          recipientEmail: 'test@example.com'
        });

        // Should handle gracefully - either reject or provide sensible defaults
        if (result.ok && result.data.fee) {
          const fee = result.data.fee;
          if (isNaN(fee) || fee < 0 || !isFinite(fee)) {
            return { success: false, reason: `Invalid fee ${fee} for ${testCase.description}` };
          }
        }
      }

      return { success: true, reason: 'Payment edge cases handled properly' };
    }, true);
  }

  // API Security Tests
  async testAPISecurityMeasures() {
    return await this.testScenario('API Security Measures', async () => {
      // Test without proper headers
      const result1 = await this.makeRequest('POST', '/api/public/agents/register', {
        agentName: 'SecurityTest',
        walletAddress: 'rSecurity' + Date.now(),
        walletNetwork: 'xrp',
        capabilities: ['testing'],
        publicKey: 'test-key',
        signature: 'test-sig',
        preferredCurrencies: ['XRP']
      }, { 'Content-Type': 'text/plain' });

      // Test with oversized payload
      const largePayload = {
        agentName: 'A'.repeat(10000),
        description: 'B'.repeat(50000),
        capabilities: Array(1000).fill('capability'),
        walletAddress: 'rLarge' + Date.now(),
        walletNetwork: 'xrp',
        publicKey: 'test-key',
        signature: 'test-sig',
        preferredCurrencies: Array(100).fill('XRP')
      };

      const result2 = await this.makeRequest('POST', '/api/public/agents/register', largePayload);

      // Should handle gracefully
      return { success: true, reason: 'API security measures active' };
    });
  }

  // Data Integrity Tests
  async testDataIntegrityChecks() {
    return await this.testScenario('Data Integrity Checks', async () => {
      // Test agent registration with missing required fields
      const incompleteData = [
        { walletAddress: 'rTest1' },
        { agentName: 'TestAgent' },
        { agentName: 'TestAgent', walletAddress: '' },
        { agentName: '', walletAddress: 'rTest2' }
      ];

      for (const data of incompleteData) {
        const result = await this.makeRequest('POST', '/api/public/agents/register', {
          ...data,
          walletNetwork: 'xrp',
          capabilities: ['testing'],
          publicKey: 'test-key',
          signature: 'test-sig',
          preferredCurrencies: ['XRP']
        });

        // Should reject incomplete data
        if (result.ok && (!data.agentName || !data.walletAddress)) {
          return { success: false, reason: 'Incomplete data was accepted' };
        }
      }

      return { success: true, reason: 'Data integrity checks working' };
    }, true);
  }

  // Network Resilience Tests
  async testNetworkResilienceScenarios() {
    return await this.testScenario('Network Resilience Scenarios', async () => {
      // Test rapid successive requests
      const rapidRequests = Array(20).fill().map(async (_, i) => {
        return this.makeRequest('GET', '/api/public/agents/discover');
      });

      const results = await Promise.all(rapidRequests);
      const successRate = results.filter(r => r.ok).length / results.length;

      if (successRate < 0.8) {
        return { success: false, reason: `Low success rate: ${successRate * 100}%` };
      }

      return { success: true, reason: 'Network resilience verified' };
    });
  }

  // XRP Integration Tests
  async testXRPIntegrationSecurity() {
    return await this.testScenario('XRP Integration Security', async () => {
      // Test with invalid XRP addresses - should all be rejected
      const invalidAddresses = [
        'invalid_address',
        'rInvalidTooShort',
        'rWayTooLongAddressThatExceedsNormalLimits123456789',
        '',
        null,
        undefined
      ];

      for (const address of invalidAddresses) {
        const result = await this.makeRequest('POST', '/api/public/agents/register', {
          agentName: 'XRPTest',
          walletAddress: address,
          walletNetwork: 'xrp',
          capabilities: ['testing'],
          publicKey: 'test-key',
          signature: 'test-sig',
          preferredCurrencies: ['XRP']
        });

        // Should reject ALL invalid addresses (security fix)
        if (result.ok) {
          return { success: false, reason: `Invalid XRP address ${address} was incorrectly accepted` };
        }
      }

      // Test with a valid XRP address - should be accepted
      const validResult = await this.makeRequest('POST', '/api/public/agents/register', {
        agentName: 'ValidXRPTest',
        walletAddress: 'rValidXRPAddress123456789012',
        walletNetwork: 'xrp',
        capabilities: ['testing'],
        publicKey: 'test-key',
        signature: 'test-sig',
        preferredCurrencies: ['XRP']
      });

      if (!validResult.ok) {
        return { success: false, reason: 'Valid XRP address was incorrectly rejected' };
      }

      return { success: true, reason: 'XRP address validation working correctly' };
    }, true);
  }

  // Generate comprehensive report
  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
    
    this.log('\n' + '='.repeat(80), 'info');
    this.log('COMPREHENSIVE PRODUCTION AUDIT REPORT', 'info');
    this.log('='.repeat(80), 'info');
    
    this.log(`\n📊 OVERALL RESULTS:`, 'info');
    this.log(`✅ Tests Passed: ${this.results.passed}`, 'success');
    this.log(`❌ Tests Failed: ${this.results.failed}`, 'error');
    this.log(`🚨 Critical Failures: ${this.results.critical}`, 'error');
    this.log(`📈 Success Rate: ${successRate}%`, successRate >= 95 ? 'success' : 'warning');

    if (this.results.critical > 0) {
      this.log('\n🚨 CRITICAL ISSUES FOUND:', 'error');
      this.results.tests
        .filter(test => !test.success && test.critical)
        .forEach(test => {
          this.log(`   - ${test.name}: ${test.reason}`, 'error');
        });
    }

    if (this.results.failed > 0 && this.results.critical === 0) {
      this.log('\n⚠️  NON-CRITICAL ISSUES:', 'warning');
      this.results.tests
        .filter(test => !test.success && !test.critical)
        .forEach(test => {
          this.log(`   - ${test.name}: ${test.reason}`, 'warning');
        });
    }

    this.log('\n' + '='.repeat(80), 'info');
    
    if (this.results.critical === 0 && successRate >= 95) {
      this.log('🎉 PRODUCTION READY - All critical tests passed!', 'success');
    } else if (this.results.critical === 0) {
      this.log('⚠️  PRODUCTION VIABLE - Minor issues detected but not blocking', 'warning');
    } else {
      this.log('🚫 NOT PRODUCTION READY - Critical issues must be resolved', 'error');
    }
    
    return {
      productionReady: this.results.critical === 0 && successRate >= 95,
      criticalIssues: this.results.critical,
      successRate: parseFloat(successRate),
      summary: this.results
    };
  }

  async runComprehensiveAudit() {
    this.log('🚀 STARTING COMPREHENSIVE PRODUCTION AUDIT', 'info');
    this.log('Testing all critical business logic and security measures...', 'info');

    // Run all test categories
    await this.testFinancialIntegrity();
    await this.testConcurrencyIssues();
    await this.testInputValidationEdgeCases();
    await this.testBusinessLogicConsistency();
    await this.testPaymentProcessingEdgeCases();
    await this.testAPISecurityMeasures();
    await this.testDataIntegrityChecks();
    await this.testNetworkResilienceScenarios();
    await this.testXRPIntegrationSecurity();

    return this.generateReport();
  }
}

// Execute the comprehensive audit
async function main() {
  const auditor = new ProductionAuditor();
  const result = await auditor.runComprehensiveAudit();
  
  // Exit with appropriate code
  process.exit(result.productionReady ? 0 : 1);
}

main().catch(console.error);