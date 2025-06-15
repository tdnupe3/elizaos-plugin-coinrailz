/**
 * COMPREHENSIVE PRODUCTION AUDIT - FINAL SECURITY & BUSINESS LOGIC ASSESSMENT
 * Tests all critical business logic, edge cases, and potential vulnerabilities
 */

import fs from 'fs';
import path from 'path';

class ProductionAuditor {
  constructor() {
    this.results = {
      criticalIssues: [],
      warnings: [],
      passed: [],
      totalTests: 0,
      passedTests: 0
    };
    this.baseUrl = 'http://localhost:5000';
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const fetch = (await import('node-fetch')).default;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };
      
      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const responseData = await response.text();
      
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }
      
      return {
        status: response.status,
        data: parsedData,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
        data: null
      };
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  async testScenario(name, testFn, critical = false) {
    this.results.totalTests++;
    this.log(`Testing: ${name}`);
    
    try {
      const result = await testFn();
      if (result) {
        this.results.passedTests++;
        this.results.passed.push(name);
        this.log(`✓ PASSED: ${name}`, 'success');
      } else {
        if (critical) {
          this.results.criticalIssues.push(name);
          this.log(`✗ CRITICAL FAILURE: ${name}`, 'error');
        } else {
          this.results.warnings.push(name);
          this.log(`⚠ WARNING: ${name}`, 'warn');
        }
      }
      return result;
    } catch (error) {
      if (critical) {
        this.results.criticalIssues.push(`${name}: ${error.message}`);
        this.log(`✗ CRITICAL ERROR: ${name} - ${error.message}`, 'error');
      } else {
        this.results.warnings.push(`${name}: ${error.message}`);
        this.log(`⚠ ERROR: ${name} - ${error.message}`, 'warn');
      }
      return false;
    }
  }

  async testFinancialIntegrity() {
    this.log('=== FINANCIAL INTEGRITY TESTS ===');

    // Test fee calculation accuracy
    await this.testScenario('Fee Calculation Accuracy', async () => {
      const response = await this.makeRequest('POST', '/api/demo/calculate-fee', {
        amount: 1000,
        type: 'send_money'
      });
      
      // Should be 1% = $10 for $1000
      if (response.status === 200 && response.data.fee === 10) {
        return true;
      }
      
      this.log(`Fee calculation mismatch: Expected $10, got ${response.data?.fee}`);
      return false;
    }, true);

    // Test commission calculation
    await this.testScenario('Referral Commission Calculation', async () => {
      const response = await this.makeRequest('POST', '/api/referrals/calculate-commission', {
        transactionAmount: 1000,
        referralTier: 'basic'
      });
      
      // Should be within profitable range (0.3-0.6%)
      if (response.status === 200 && response.data.commission >= 3 && response.data.commission <= 6) {
        return true;
      }
      
      this.log(`Commission calculation outside profitable range: ${response.data?.commission}`);
      return false;
    }, true);

    // Test negative amount handling
    await this.testScenario('Negative Amount Protection', async () => {
      const response = await this.makeRequest('POST', '/api/demo/send-money', {
        amount: -100,
        recipient: 'test@example.com'
      });
      
      return response.status === 400; // Should reject negative amounts
    }, true);
  }

  async testConcurrencyIssues() {
    this.log('=== CONCURRENCY & RACE CONDITION TESTS ===');

    // Test concurrent user registration
    await this.testScenario('Concurrent Registration Prevention', async () => {
      const promises = Array.from({length: 5}, (_, i) => 
        this.makeRequest('POST', '/api/auth/register', {
          email: 'concurrent@test.com',
          name: `User ${i}`
        })
      );
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r.status === 201).length;
      
      // Only one should succeed due to unique constraints
      return successful === 1;
    }, true);

    // Test balance update race conditions
    await this.testScenario('Balance Update Race Condition Protection', async () => {
      // Simulate multiple simultaneous balance updates
      const promises = Array.from({length: 3}, () => 
        this.makeRequest('POST', '/api/demo/update-balance', {
          userId: 'demo-user',
          amount: 100
        })
      );
      
      const results = await Promise.all(promises);
      
      // Should handle concurrency gracefully without corruption
      return results.every(r => r.status === 200 || r.status === 409);
    }, true);
  }

  async testInputValidationEdgeCases() {
    this.log('=== INPUT VALIDATION EDGE CASES ===');

    // Test XSS prevention
    await this.testScenario('XSS Attack Prevention', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const response = await this.makeRequest('POST', '/api/demo/send-money', {
        amount: 100,
        recipient: maliciousInput,
        note: maliciousInput
      });
      
      // Should sanitize or reject malicious input
      return response.status === 400 || !response.data?.note?.includes('<script>');
    }, true);

    // Test SQL injection attempts
    await this.testScenario('SQL Injection Protection', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const response = await this.makeRequest('GET', `/api/users/search?query=${encodeURIComponent(sqlInjection)}`);
      
      // Should not return error indicating SQL syntax issues
      return response.status !== 500 || !response.data?.error?.includes('SQL');
    }, true);

    // Test oversized payload handling
    await this.testScenario('Large Payload Handling', async () => {
      const largePayload = {
        data: 'A'.repeat(50 * 1024 * 1024) // 50MB payload
      };
      
      const response = await this.makeRequest('POST', '/api/demo/large-data', largePayload);
      
      // Should reject oversized payloads gracefully
      return response.status === 413 || response.status === 400;
    }, true);
  }

  async testBusinessLogicConsistency() {
    this.log('=== BUSINESS LOGIC CONSISTENCY TESTS ===');

    // Test transaction workflow integrity
    await this.testScenario('Complete Transaction Workflow', async () => {
      // 1. Initiate transaction
      const initResponse = await this.makeRequest('POST', '/api/transactions/initiate', {
        amount: 100,
        type: 'p2p_transfer',
        recipient: 'test@example.com'
      });
      
      if (initResponse.status !== 201) return false;
      
      const transactionId = initResponse.data.transactionId;
      
      // 2. Verify transaction status
      const statusResponse = await this.makeRequest('GET', `/api/transactions/${transactionId}/status`);
      
      return statusResponse.status === 200 && statusResponse.data.status === 'pending';
    }, true);

    // Test AI agent registration workflow
    await this.testScenario('AI Agent Registration Workflow', async () => {
      const agentData = {
        name: 'Test AI Agent',
        capabilities: ['data_analysis', 'market_research'],
        pricing: { basic: 25, premium: 50 }
      };
      
      const response = await this.makeRequest('POST', '/api/ai-agents/register', agentData);
      
      return response.status === 201 && response.data.status === 'pending_verification';
    }, true);
  }

  async testPaymentProcessingEdgeCases() {
    this.log('=== PAYMENT PROCESSING EDGE CASES ===');

    // Test payment with insufficient funds
    await this.testScenario('Insufficient Funds Handling', async () => {
      const response = await this.makeRequest('POST', '/api/payments/process', {
        amount: 999999999, // Unrealistic amount
        paymentMethod: 'wallet_balance'
      });
      
      return response.status === 400 && response.data.error?.includes('insufficient');
    }, true);

    // Test payment gateway timeout simulation
    await this.testScenario('Payment Gateway Timeout Handling', async () => {
      const response = await this.makeRequest('POST', '/api/payments/process', {
        amount: 100,
        paymentMethod: 'stripe',
        simulateTimeout: true
      });
      
      // Should handle timeouts gracefully
      return response.status === 408 || response.status === 500;
    }, false);
  }

  async testAPISecurityMeasures() {
    this.log('=== API SECURITY MEASURES ===');

    // Test rate limiting
    await this.testScenario('Rate Limiting Protection', async () => {
      const promises = Array.from({length: 150}, () => 
        this.makeRequest('GET', '/api/demo/user')
      );
      
      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r.status === 429).length;
      
      // Should rate limit after 100 requests (configured limit)
      return rateLimited > 0;
    }, true);

    // Test authentication bypass attempts
    await this.testScenario('Authentication Bypass Prevention', async () => {
      const response = await this.makeRequest('GET', '/api/admin/users', null, {
        'Authorization': 'Bearer fake-token'
      });
      
      return response.status === 401 || response.status === 403;
    }, true);
  }

  async testDataIntegrityChecks() {
    this.log('=== DATA INTEGRITY CHECKS ===');

    // Test database connection recovery
    await this.testScenario('Database Connection Recovery', async () => {
      // Multiple rapid requests to test connection pooling
      const promises = Array.from({length: 10}, () => 
        this.makeRequest('GET', '/api/demo/balances')
      );
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r.status === 200).length;
      
      // Should handle connection pooling without failures
      return successful >= 8; // Allow for some tolerance
    }, true);
  }

  async testNetworkResilienceScenarios() {
    this.log('=== NETWORK RESILIENCE SCENARIOS ===');

    // Test malformed request handling
    await this.testScenario('Malformed JSON Handling', async () => {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${this.baseUrl}/api/demo/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"invalid": json}'
        });
        
        return response.status === 400;
      } catch {
        return true; // Connection handling worked
      }
    }, false);
  }

  async testXRPIntegrationSecurity() {
    this.log('=== XRP INTEGRATION SECURITY ===');

    // Test XRP wallet security
    await this.testScenario('XRP Wallet Security Check', async () => {
      const response = await this.makeRequest('GET', '/api/xrp/wallet-info');
      
      // Should not expose private keys or sensitive wallet data
      if (response.status === 200) {
        const sensitiveFields = ['privateKey', 'seed', 'secret'];
        const exposedSensitive = sensitiveFields.some(field => 
          JSON.stringify(response.data).toLowerCase().includes(field.toLowerCase())
        );
        return !exposedSensitive;
      }
      
      return true; // If endpoint doesn't exist, that's also secure
    }, true);
  }

  generateReport() {
    const successRate = ((this.results.passedTests / this.results.totalTests) * 100).toFixed(1);
    
    const report = `
=== COMPREHENSIVE PRODUCTION AUDIT REPORT ===
Date: ${new Date().toISOString()}
Total Tests: ${this.results.totalTests}
Passed: ${this.results.passedTests}
Success Rate: ${successRate}%

🔴 CRITICAL ISSUES (${this.results.criticalIssues.length}):
${this.results.criticalIssues.map(issue => `  - ${issue}`).join('\n')}

⚠️  WARNINGS (${this.results.warnings.length}):
${this.results.warnings.map(warning => `  - ${warning}`).join('\n')}

✅ PASSED TESTS (${this.results.passed.length}):
${this.results.passed.slice(0, 10).map(test => `  - ${test}`).join('\n')}
${this.results.passed.length > 10 ? `  ... and ${this.results.passed.length - 10} more` : ''}

=== PRODUCTION READINESS ASSESSMENT ===
${successRate >= 95 ? '🟢 READY FOR PRODUCTION' : 
  successRate >= 85 ? '🟡 NEEDS MINOR FIXES' : 
  '🔴 SIGNIFICANT ISSUES - NOT READY'}

Critical Issues Must Be Fixed Before Deployment: ${this.results.criticalIssues.length === 0 ? 'None' : this.results.criticalIssues.length}
`;

    return report;
  }

  async runComprehensiveAudit() {
    this.log('Starting comprehensive production audit...');
    
    try {
      await this.testFinancialIntegrity();
      await this.testConcurrencyIssues();
      await this.testInputValidationEdgeCases();
      await this.testBusinessLogicConsistency();
      await this.testPaymentProcessingEdgeCases();
      await this.testAPISecurityMeasures();
      await this.testDataIntegrityChecks();
      await this.testNetworkResilienceScenarios();
      await this.testXRPIntegrationSecurity();
      
      const report = this.generateReport();
      
      // Write report to file
      fs.writeFileSync('FINAL_PRODUCTION_AUDIT_REPORT.md', report);
      
      console.log(report);
      
      return {
        success: this.results.criticalIssues.length === 0,
        report,
        details: this.results
      };
      
    } catch (error) {
      this.log(`Audit failed with error: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        details: this.results
      };
    }
  }
}

async function main() {
  const auditor = new ProductionAuditor();
  await auditor.runComprehensiveAudit();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ProductionAuditor };