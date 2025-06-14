/**
 * COMPREHENSIVE BUSINESS LOGIC AUDIT 2025
 * Production Readiness Assessment with Edge Case Testing
 */

import fs from 'fs';

class BusinessLogicAuditor {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      criticalIssues: [],
      businessRisks: [],
      productionBlockers: [],
      recommendations: []
    };
    this.baseUrl = 'http://localhost:5000';
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const fetch = (await import('node-fetch')).default;
      const options = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(data && { body: JSON.stringify(data) })
      };
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const responseData = await response.text();
      
      return {
        status: response.status,
        data: responseData ? JSON.parse(responseData) : null,
        ok: response.ok
      };
    } catch (error) {
      return { status: 0, data: null, error: error.message, ok: false };
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async testBusinessLogic(name, testFn, critical = false) {
    try {
      this.log(`Testing: ${name}`, 'info');
      const result = await testFn();
      
      if (result.success) {
        this.results.passed++;
        this.log(`✅ PASS: ${name}`, 'success');
        return result;
      } else {
        this.results.failed++;
        this.log(`❌ FAIL: ${name} - ${result.reason}`, 'error');
        
        if (critical) {
          this.results.productionBlockers.push({
            test: name,
            issue: result.reason,
            impact: 'HIGH',
            recommendation: result.recommendation || 'Fix before production'
          });
        } else {
          this.results.businessRisks.push({
            test: name,
            issue: result.reason,
            impact: 'MEDIUM'
          });
        }
        return result;
      }
    } catch (error) {
      this.results.failed++;
      this.log(`💥 ERROR: ${name} - ${error.message}`, 'error');
      
      if (critical) {
        this.results.productionBlockers.push({
          test: name,
          issue: error.message,
          impact: 'CRITICAL',
          recommendation: 'Immediate fix required'
        });
      }
      return { success: false, reason: error.message };
    }
  }

  // CRITICAL BUSINESS LOGIC TESTS
  
  async testAgentRegistrationBusinessLogic() {
    return this.testBusinessLogic('Agent Registration Business Logic', async () => {
      // Test 1: Valid agent registration
      const validAgent = await this.makeRequest('POST', '/api/public/agents/register', {
        agentName: 'TestAgent_' + Date.now(),
        walletAddress: 'rTest' + Date.now(),
        walletNetwork: 'xrp',
        capabilities: ['testing'],
        publicKey: 'test-key',
        signature: 'test-sig',
        preferredCurrencies: ['XRP']
      });

      if (!validAgent.ok) {
        return { success: false, reason: 'Valid agent registration failed' };
      }

      // Test 2: Duplicate wallet address prevention
      const duplicateAgent = await this.makeRequest('POST', '/api/public/agents/register', {
        agentName: 'DuplicateTest',
        walletAddress: validAgent.data.agent.primaryWalletAddress,
        walletNetwork: 'xrp',
        capabilities: ['testing'],
        publicKey: 'test-key',
        signature: 'test-sig',
        preferredCurrencies: ['XRP']
      });

      if (duplicateAgent.ok) {
        return { success: false, reason: 'Duplicate wallet address not prevented' };
      }

      // Test 3: Agent discovery returns registered agents
      const discovery = await this.makeRequest('GET', '/api/public/agents/discover');
      if (!discovery.ok || !discovery.data.agents.length) {
        return { success: false, reason: 'Agent discovery not working' };
      }

      return { success: true };
    }, true);
  }

  async testPaymentProcessingBusinessLogic() {
    return this.testBusinessLogic('Payment Processing Business Logic', async () => {
      // Test 1: Valid payment calculation
      const calculation = await this.makeRequest('POST', '/api/test-payment-calculation', {
        amount: 100,
        recipientEmail: 'test@example.com'
      });

      if (!calculation.ok || calculation.data.fee <= 0) {
        return { success: false, reason: 'Payment calculation logic failed' };
      }

      // Test 2: Stripe payment intent creation
      const paymentIntent = await this.makeRequest('POST', '/api/create-payment-intent', {
        amount: 100,
        recipientEmail: 'test@example.com'
      });

      if (!paymentIntent.ok || !paymentIntent.data.clientSecret) {
        return { success: false, reason: 'Stripe payment intent creation failed' };
      }

      // Test 3: AI agent payment intent
      const agentPayment = await this.makeRequest('POST', '/api/agents/create-payment-intent', {
        agentId: 'test-agent',
        serviceType: 'consultation',
        amount: 50
      });

      if (!agentPayment.ok || !agentPayment.data.clientSecret) {
        return { success: false, reason: 'AI agent payment creation failed' };
      }

      return { success: true };
    }, true);
  }

  async testFeeCalculationAccuracy() {
    return this.testBusinessLogic('Fee Calculation Accuracy', async () => {
      const testCases = [
        { amount: 100, expectedMinFee: 1, maxFee: 2 },
        { amount: 1000, expectedMinFee: 10, maxFee: 20 },
        { amount: 10000, expectedMinFee: 100, maxFee: 200 }
      ];

      for (const testCase of testCases) {
        const calc = await this.makeRequest('POST', '/api/test-payment-calculation', {
          amount: testCase.amount,
          recipientEmail: 'test@example.com'
        });

        if (!calc.ok) {
          return { success: false, reason: `Fee calculation failed for amount ${testCase.amount}` };
        }

        if (calc.data.fee < testCase.expectedMinFee || calc.data.fee > testCase.maxFee) {
          return { 
            success: false, 
            reason: `Fee outside expected range for ${testCase.amount}: got ${calc.data.fee}, expected ${testCase.expectedMinFee}-${testCase.maxFee}` 
          };
        }
      }

      return { success: true };
    }, true);
  }

  // EDGE CASE TESTING

  async testInputValidationEdgeCases() {
    return this.testBusinessLogic('Input Validation Edge Cases', async () => {
      const edgeCases = [
        // Negative amounts
        { amount: -100, recipientEmail: 'test@example.com', shouldFail: true },
        // Zero amounts  
        { amount: 0, recipientEmail: 'test@example.com', shouldFail: true },
        // Extremely large amounts
        { amount: 999999999999, recipientEmail: 'test@example.com', shouldFail: true },
        // Invalid email formats
        { amount: 100, recipientEmail: 'invalid-email', shouldFail: true },
        // Missing required fields
        { amount: null, recipientEmail: 'test@example.com', shouldFail: true },
        { amount: 100, recipientEmail: null, shouldFail: true }
      ];

      for (const testCase of edgeCases) {
        const result = await this.makeRequest('POST', '/api/test-payment-calculation', testCase);
        
        if (testCase.shouldFail && result.ok) {
          return { 
            success: false, 
            reason: `Validation should have failed for: ${JSON.stringify(testCase)}` 
          };
        }
        
        if (!testCase.shouldFail && !result.ok) {
          return { 
            success: false, 
            reason: `Valid input rejected: ${JSON.stringify(testCase)}` 
          };
        }
      }

      return { success: true };
    }, true);
  }

  async testConcurrencyAndRaceConditions() {
    return this.testBusinessLogic('Concurrency and Race Conditions', async () => {
      // Test concurrent agent registrations with same wallet
      const walletAddress = 'rConcurrentTest' + Date.now();
      
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

      // Only one should succeed due to unique wallet constraint
      if (successCount !== 1) {
        return { 
          success: false, 
          reason: `Race condition detected: ${successCount} concurrent registrations succeeded, should be 1` 
        };
      }

      return { success: true };
    }, false);
  }

  // SECURITY VULNERABILITY TESTING

  async testSQLInjectionVulnerabilities() {
    return this.testBusinessLogic('SQL Injection Vulnerabilities', async () => {
      const injectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; INSERT INTO users VALUES ('hacker', 'password'); --"
      ];

      for (const payload of injectionPayloads) {
        const result = await this.makeRequest('POST', '/api/public/agents/register', {
          agentName: payload,
          walletAddress: 'rSQLTest' + Date.now(),
          walletNetwork: 'xrp',
          capabilities: ['testing'],
          publicKey: payload,
          signature: payload,
          preferredCurrencies: ['XRP']
        });

        // Should either reject malicious input or sanitize it
        if (result.ok && result.data.agent && 
            (result.data.agent.agentName.includes('DROP') || 
             result.data.agent.publicKey.includes('INSERT'))) {
          return { 
            success: false, 
            reason: `SQL injection vulnerability detected with payload: ${payload}` 
          };
        }
      }

      return { success: true };
    }, true);
  }

  async testFinancialCalculationIntegrity() {
    return this.testBusinessLogic('Financial Calculation Integrity', async () => {
      // Test precision with floating point numbers
      const precisionTests = [
        { amount: 99.99, expectedFee: 0.9999 },
        { amount: 0.01, expectedMinFee: 0.32 }, // Minimum fee should apply
        { amount: 123.456789, expectedRounded: true }
      ];

      for (const test of precisionTests) {
        const calc = await this.makeRequest('POST', '/api/test-payment-calculation', {
          amount: test.amount,
          recipientEmail: 'test@example.com'
        });

        if (!calc.ok) {
          return { success: false, reason: `Precision test failed for ${test.amount}` };
        }

        // Check for proper rounding (no more than 2 decimal places)
        const feeStr = calc.data.fee.toString();
        const decimalPlaces = feeStr.includes('.') ? feeStr.split('.')[1].length : 0;
        
        if (decimalPlaces > 2) {
          return { 
            success: false, 
            reason: `Fee precision error: ${calc.data.fee} has ${decimalPlaces} decimal places` 
          };
        }
      }

      return { success: true };
    }, true);
  }

  // BUSINESS CONTINUITY TESTING

  async testSystemResilienceUnderLoad() {
    return this.testBusinessLogic('System Resilience Under Load', async () => {
      // Rapid-fire requests to test rate limiting and stability
      const promises = Array(20).fill().map(async (_, i) => {
        return this.makeRequest('GET', '/api/public/agents/discover');
      });

      const results = await Promise.all(promises);
      const failureCount = results.filter(r => !r.ok).length;

      // Some rate limiting is expected, but system should remain stable
      if (failureCount > 15) {
        return { 
          success: false, 
          reason: `System instability under load: ${failureCount}/20 requests failed` 
        };
      }

      return { success: true };
    }, false);
  }

  async testDataConsistencyAndIntegrity() {
    return this.testBusinessLogic('Data Consistency and Integrity', async () => {
      // Register an agent and verify data consistency across endpoints
      const agentName = 'ConsistencyTest_' + Date.now();
      const registration = await this.makeRequest('POST', '/api/public/agents/register', {
        agentName: agentName,
        walletAddress: 'rConsistent' + Date.now(),
        walletNetwork: 'xrp',
        capabilities: ['consistency-testing'],
        publicKey: 'consistency-key',
        signature: 'consistency-sig',
        preferredCurrencies: ['XRP', 'USDT']
      });

      if (!registration.ok) {
        return { success: false, reason: 'Agent registration failed for consistency test' };
      }

      // Verify agent appears in discovery
      const discovery = await this.makeRequest('GET', '/api/public/agents/discover');
      const foundAgent = discovery.data.agents.find(a => a.agentName === agentName);

      if (!foundAgent) {
        return { success: false, reason: 'Registered agent not found in discovery' };
      }

      // Verify data integrity
      if (foundAgent.capabilities.length !== 1 || 
          foundAgent.preferredCurrencies.length !== 2) {
        return { 
          success: false, 
          reason: 'Data integrity issue: capabilities or currencies mismatch' 
        };
      }

      return { success: true };
    }, true);
  }

  // ERROR HANDLING AND RECOVERY

  async testErrorHandlingRobustness() {
    return this.testBusinessLogic('Error Handling Robustness', async () => {
      // Test malformed JSON
      const malformedResult = await this.makeRequest('POST', '/api/test-payment-calculation', null);
      if (malformedResult.status === 0) {
        return { success: false, reason: 'Server crashed on malformed request' };
      }

      // Test non-existent endpoints
      const notFoundResult = await this.makeRequest('GET', '/api/nonexistent-endpoint');
      if (notFoundResult.status !== 404) {
        return { success: false, reason: 'Improper 404 handling' };
      }

      // Test invalid content type
      const invalidContentResult = await this.makeRequest('POST', '/api/test-payment-calculation', 
        { amount: 100, recipientEmail: 'test@example.com' }, 
        { 'Content-Type': 'text/plain' }
      );
      
      // Should handle gracefully
      if (invalidContentResult.status === 0) {
        return { success: false, reason: 'Server crashed on invalid content type' };
      }

      return { success: true };
    }, true);
  }

  async generateAuditReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.passed + this.results.failed,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: `${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`
      },
      productionReadiness: {
        criticalIssues: this.results.productionBlockers.length,
        recommendation: this.results.productionBlockers.length === 0 ? 'READY FOR PRODUCTION' : 'REQUIRES FIXES BEFORE PRODUCTION'
      },
      findings: {
        productionBlockers: this.results.productionBlockers,
        businessRisks: this.results.businessRisks,
        recommendations: this.results.recommendations
      }
    };

    const reportPath = 'COMPREHENSIVE_BUSINESS_AUDIT_REPORT_2025.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`\n📊 AUDIT COMPLETE`, 'info');
    this.log(`Tests Passed: ${this.results.passed}`, 'success');
    this.log(`Tests Failed: ${this.results.failed}`, 'error');
    this.log(`Production Blockers: ${this.results.productionBlockers.length}`, 'error');
    this.log(`Business Risks: ${this.results.businessRisks.length}`, 'warning');
    this.log(`Report saved to: ${reportPath}`, 'info');

    return report;
  }

  async runComprehensiveAudit() {
    this.log('🔍 STARTING COMPREHENSIVE BUSINESS LOGIC AUDIT', 'info');
    
    // Critical business logic tests
    await this.testAgentRegistrationBusinessLogic();
    await this.testPaymentProcessingBusinessLogic();
    await this.testFeeCalculationAccuracy();
    
    // Edge case testing
    await this.testInputValidationEdgeCases();
    await this.testConcurrencyAndRaceConditions();
    
    // Security testing
    await this.testSQLInjectionVulnerabilities();
    await this.testFinancialCalculationIntegrity();
    
    // Business continuity
    await this.testSystemResilienceUnderLoad();
    await this.testDataConsistencyAndIntegrity();
    
    // Error handling
    await this.testErrorHandlingRobustness();
    
    return await this.generateAuditReport();
  }
}

// Execute audit
(async () => {
  const auditor = new BusinessLogicAuditor();
  await auditor.runComprehensiveAudit();
})().catch(console.error);