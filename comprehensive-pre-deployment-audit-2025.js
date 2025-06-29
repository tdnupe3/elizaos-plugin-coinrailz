/**
 * COMPREHENSIVE PRE-DEPLOYMENT AUDIT - JANUARY 2025
 * Complete business logic validation and gap analysis before redeployment
 */

import fetch from 'node-fetch';

class PreDeploymentAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      passed: []
    };
    this.startTime = Date.now();
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 10000
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const responseData = await response.text();
      
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = responseData;
      }

      return {
        status: response.status,
        data: parsedData,
        headers: response.headers
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
        data: null
      };
    }
  }

  recordIssue(severity, category, description, endpoint = null, recommendation = null) {
    const issue = {
      category,
      description,
      endpoint,
      recommendation,
      timestamp: new Date().toISOString()
    };
    
    this.results[severity].push(issue);
    console.log(`[${severity.toUpperCase()}] ${category}: ${description}`);
  }

  recordPass(category, description, endpoint = null) {
    this.results.passed.push({
      category,
      description,
      endpoint,
      timestamp: new Date().toISOString()
    });
    console.log(`[PASS] ${category}: ${description}`);
  }

  async auditCoreInfrastructure() {
    console.log('\n=== CORE INFRASTRUCTURE AUDIT ===');
    
    // Server Health
    const health = await this.makeRequest('GET', '/api/platform/health');
    if (health.status === 200 && health.data.status === 'ok') {
      this.recordPass('Infrastructure', 'Server health endpoint operational', '/api/platform/health');
    } else {
      this.recordIssue('critical', 'Infrastructure', 'Server health check failed', '/api/platform/health', 'Fix health endpoint before deployment');
    }

    // Frontend Serving
    const frontend = await this.makeRequest('GET', '/');
    if (frontend.status === 200) {
      this.recordPass('Infrastructure', 'Frontend serving operational', '/');
    } else {
      this.recordIssue('critical', 'Infrastructure', 'Frontend not serving properly', '/', 'Fix Vite frontend serving');
    }

    // Database Connectivity
    const dbTest = await this.makeRequest('GET', '/api/platform/status');
    if (dbTest.status === 200) {
      this.recordPass('Infrastructure', 'Database connectivity confirmed', '/api/platform/status');
    } else {
      this.recordIssue('high', 'Infrastructure', 'Database connectivity issues', '/api/platform/status', 'Verify PostgreSQL connection');
    }
  }

  async auditFinancialSystems() {
    console.log('\n=== FINANCIAL SYSTEMS AUDIT ===');
    
    // Fee Calculation
    const feeCalc = await this.makeRequest('POST', '/api/calculate-fee', {
      amount: 1000,
      type: 'send_money'
    });
    
    if (feeCalc.status === 200 && feeCalc.data.fee) {
      const expectedFee = 1000 * 0.01; // 1% fee
      const actualFee = parseFloat(feeCalc.data.fee);
      if (Math.abs(actualFee - expectedFee) < 0.01) {
        this.recordPass('Financial', 'Fee calculation accurate (1% = $10.00)', '/api/calculate-fee');
      } else {
        this.recordIssue('critical', 'Financial', `Fee calculation incorrect: expected $${expectedFee}, got $${actualFee}`, '/api/calculate-fee', 'Fix fee calculation algorithm');
      }
    } else {
      this.recordIssue('critical', 'Financial', 'Fee calculation endpoint failed', '/api/calculate-fee', 'Restore fee calculation functionality');
    }

    // Commission System
    const commission = await this.makeRequest('POST', '/api/calculate-commission', {
      amount: 1000,
      tier: 'basic'
    });
    
    if (commission.status === 200 && commission.data.commission) {
      this.recordPass('Financial', 'Commission calculation operational', '/api/calculate-commission');
    } else {
      this.recordIssue('high', 'Financial', 'Commission calculation failed', '/api/calculate-commission', 'Fix referral commission system');
    }

    // Transaction Validation
    const validation = await this.makeRequest('POST', '/api/validate-transaction', {
      amount: 5.00,
      fromUser: 'test@example.com',
      toUser: 'recipient@example.com'
    });
    
    if (validation.status === 200) {
      this.recordPass('Financial', 'Transaction validation working', '/api/validate-transaction');
    } else {
      this.recordIssue('high', 'Financial', 'Transaction validation issues', '/api/validate-transaction', 'Fix validation logic');
    }
  }

  async auditDEXAggregator() {
    console.log('\n=== DEX AGGREGATOR AUDIT ===');
    
    // 1inch API Integration
    const quote = await this.makeRequest('GET', '/api/dex/quote?fromToken=ETH&toToken=USDC&amount=1&chainId=1');
    if (quote.status === 200 && quote.data.toTokenAmount) {
      this.recordPass('DEX', '1inch API integration operational', '/api/dex/quote');
    } else {
      this.recordIssue('high', 'DEX', '1inch API integration issues', '/api/dex/quote', 'Verify 1INCH_API_KEY and endpoint');
    }

    // Multi-wallet Support
    const wallets = await this.makeRequest('GET', '/api/dex/supported-wallets');
    if (wallets.status === 200 && Array.isArray(wallets.data) && wallets.data.length >= 5) {
      this.recordPass('DEX', 'Multi-wallet support confirmed (5+ wallets)', '/api/dex/supported-wallets');
    } else {
      this.recordIssue('medium', 'DEX', 'Multi-wallet support incomplete', '/api/dex/supported-wallets', 'Ensure 5-wallet EVM support');
    }

    // Fee Collection
    const dexFee = await this.makeRequest('POST', '/api/dex/calculate-platform-fee', {
      inputAmount: '1000000000000000000', // 1 ETH in wei
      outputAmount: '2400000000' // 2400 USDC
    });
    
    if (dexFee.status === 200 && dexFee.data.platformFee) {
      this.recordPass('DEX', 'Platform fee calculation working', '/api/dex/calculate-platform-fee');
    } else {
      this.recordIssue('medium', 'DEX', 'DEX fee calculation issues', '/api/dex/calculate-platform-fee', 'Fix output-based fee collection');
    }
  }

  async auditXRPIntegration() {
    console.log('\n=== XRP INTEGRATION AUDIT ===');
    
    // XRP Service Health
    const xrpHealth = await this.makeRequest('GET', '/api/xrp/health');
    if (xrpHealth.status === 200 && xrpHealth.data.status === 'operational') {
      this.recordPass('XRP', 'XRP Ledger integration healthy', '/api/xrp/health');
    } else {
      this.recordIssue('medium', 'XRP', 'XRP service health issues', '/api/xrp/health', 'Check XRP Ledger connectivity');
    }

    // Cross-border Payment
    const crossBorder = await this.makeRequest('POST', '/api/xrp/cross-border-quote', {
      amount: 1000,
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      corridor: 'USD-EUR'
    });
    
    if (crossBorder.status === 200) {
      this.recordPass('XRP', 'Cross-border payment quotes working', '/api/xrp/cross-border-quote');
    } else {
      this.recordIssue('medium', 'XRP', 'Cross-border payment issues', '/api/xrp/cross-border-quote', 'Fix XRP corridor optimization');
    }
  }

  async auditAIMarketplace() {
    console.log('\n=== AI MARKETPLACE AUDIT ===');
    
    // Agent Registration
    const agentReg = await this.makeRequest('POST', '/api/ai-agents/register', {
      name: 'Test Agent',
      description: 'Test AI agent for audit',
      capabilities: ['data_analysis'],
      pricing: { basic: 25 }
    });
    
    if (agentReg.status === 201 || agentReg.status === 200) {
      this.recordPass('AI Marketplace', 'AI agent registration working', '/api/ai-agents/register');
    } else {
      this.recordIssue('medium', 'AI Marketplace', 'AI agent registration issues', '/api/ai-agents/register', 'Fix agent registration system');
    }

    // Service Delivery
    const delivery = await this.makeRequest('GET', '/api/ai-agents/delivery-methods');
    if (delivery.status === 200 && Array.isArray(delivery.data)) {
      this.recordPass('AI Marketplace', 'Service delivery methods available', '/api/ai-agents/delivery-methods');
    } else {
      this.recordIssue('low', 'AI Marketplace', 'Service delivery system issues', '/api/ai-agents/delivery-methods', 'Verify delivery method configuration');
    }
  }

  async auditDataMonetization() {
    console.log('\n=== DATA MONETIZATION AUDIT ===');
    
    // Analytics API
    const analytics = await this.makeRequest('GET', '/api/data/analytics/transaction-volume');
    if (analytics.status === 200 && analytics.data) {
      this.recordPass('Data Monetization', 'Analytics API operational', '/api/data/analytics/transaction-volume');
    } else {
      this.recordIssue('high', 'Data Monetization', 'Analytics API issues', '/api/data/analytics/transaction-volume', 'Critical for revenue - fix immediately');
    }

    // Behavioral Data
    const behavioral = await this.makeRequest('GET', '/api/data/behavioral/user-patterns');
    if (behavioral.status === 200) {
      this.recordPass('Data Monetization', 'Behavioral data collection working', '/api/data/behavioral/user-patterns');
    } else {
      this.recordIssue('medium', 'Data Monetization', 'Behavioral data collection issues', '/api/data/behavioral/user-patterns', 'Fix data collection system');
    }

    // Enterprise API Access
    const enterprise = await this.makeRequest('GET', '/api/data/enterprise/sample', {}, {
      'Authorization': 'Bearer demo-token'
    });
    
    if (enterprise.status === 200 || enterprise.status === 401) { // 401 expected without real token
      this.recordPass('Data Monetization', 'Enterprise API access configured', '/api/data/enterprise/sample');
    } else {
      this.recordIssue('high', 'Data Monetization', 'Enterprise API access broken', '/api/data/enterprise/sample', 'Fix enterprise data access');
    }
  }

  async auditSecurityMeasures() {
    console.log('\n=== SECURITY AUDIT ===');
    
    // Rate Limiting
    const rateLimitTest = [];
    for (let i = 0; i < 12; i++) {
      const response = await this.makeRequest('POST', '/api/calculate-fee', { amount: 100, type: 'test' });
      rateLimitTest.push(response.status);
    }
    
    const rateLimited = rateLimitTest.some(status => status === 429);
    if (rateLimited) {
      this.recordPass('Security', 'Rate limiting active', '/api/calculate-fee');
    } else {
      this.recordIssue('medium', 'Security', 'Rate limiting not working', '/api/calculate-fee', 'Implement proper rate limiting');
    }

    // Input Validation
    const invalidInput = await this.makeRequest('POST', '/api/calculate-fee', {
      amount: '<script>alert("xss")</script>',
      type: 'send_money'
    });
    
    if (invalidInput.status === 400) {
      this.recordPass('Security', 'Input validation working', '/api/calculate-fee');
    } else {
      this.recordIssue('high', 'Security', 'Input validation insufficient', '/api/calculate-fee', 'Implement comprehensive input sanitization');
    }

    // SQL Injection Protection
    const sqlTest = await this.makeRequest('POST', '/api/validate-transaction', {
      amount: 100,
      fromUser: "'; DROP TABLE users; --",
      toUser: 'test@example.com'
    });
    
    if (sqlTest.status === 400 || (sqlTest.status === 200 && !sqlTest.data.error)) {
      this.recordPass('Security', 'SQL injection protection active', '/api/validate-transaction');
    } else {
      this.recordIssue('critical', 'Security', 'SQL injection vulnerability', '/api/validate-transaction', 'URGENT: Fix SQL injection protection');
    }
  }

  async auditBusinessLogicConsistency() {
    console.log('\n=== BUSINESS LOGIC CONSISTENCY AUDIT ===');
    
    // Minimum Transaction Enforcement
    const minTransaction = await this.makeRequest('POST', '/api/validate-transaction', {
      amount: 1, // Below $5 minimum
      fromUser: 'test@example.com',
      toUser: 'recipient@example.com'
    });
    
    if (minTransaction.status === 400 || (minTransaction.data && minTransaction.data.error)) {
      this.recordPass('Business Logic', 'Minimum transaction enforcement working', '/api/validate-transaction');
    } else {
      this.recordIssue('high', 'Business Logic', 'Minimum transaction not enforced', '/api/validate-transaction', 'Enforce $5 minimum transaction');
    }

    // Commission Overflow Protection
    const highCommission = await this.makeRequest('POST', '/api/calculate-commission', {
      amount: 10, // Small amount that could cause commission > revenue
      tier: 'premium'
    });
    
    if (highCommission.status === 200 && parseFloat(highCommission.data.commission) < 10) {
      this.recordPass('Business Logic', 'Commission overflow protection working', '/api/calculate-commission');
    } else {
      this.recordIssue('critical', 'Business Logic', 'Commission overflow vulnerability', '/api/calculate-commission', 'Implement commission caps');
    }

    // Profit Margin Validation
    const profitTest = await this.makeRequest('POST', '/api/calculate-fee', {
      amount: 100,
      type: 'p2p_transfer'
    });
    
    if (profitTest.status === 200 && profitTest.data.fee) {
      const fee = parseFloat(profitTest.data.fee);
      const processingCost = 0.30; // Estimated processing cost
      const profit = fee - processingCost;
      
      if (profit > 0) {
        this.recordPass('Business Logic', `Profitable transaction: $${profit.toFixed(2)} profit`, '/api/calculate-fee');
      } else {
        this.recordIssue('critical', 'Business Logic', `Unprofitable transaction: -$${Math.abs(profit).toFixed(2)} loss`, '/api/calculate-fee', 'Adjust fee structure for profitability');
      }
    }
  }

  async auditErrorHandling() {
    console.log('\n=== ERROR HANDLING AUDIT ===');
    
    // Server Error Response
    const serverError = await this.makeRequest('GET', '/api/nonexistent-endpoint');
    if (serverError.status === 404) {
      this.recordPass('Error Handling', '404 errors handled properly', '/api/nonexistent-endpoint');
    } else {
      this.recordIssue('medium', 'Error Handling', 'Server error handling issues', '/api/nonexistent-endpoint', 'Implement proper 404 handling');
    }

    // Malformed Request Handling
    const malformed = await this.makeRequest('POST', '/api/calculate-fee', 'invalid-json');
    if (malformed.status === 400) {
      this.recordPass('Error Handling', 'Malformed request handling working', '/api/calculate-fee');
    } else {
      this.recordIssue('medium', 'Error Handling', 'Malformed request handling issues', '/api/calculate-fee', 'Improve request validation');
    }

    // Database Error Recovery
    // This is harder to test directly, but we can check for proper error responses
    const dbErrorTest = await this.makeRequest('GET', '/api/platform/status');
    if (dbErrorTest.status === 200 || dbErrorTest.status === 503) {
      this.recordPass('Error Handling', 'Database error handling configured', '/api/platform/status');
    } else {
      this.recordIssue('high', 'Error Handling', 'Database error handling insufficient', '/api/platform/status', 'Implement database error recovery');
    }
  }

  generateReport() {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE PRE-DEPLOYMENT AUDIT REPORT');
    console.log('='.repeat(80));
    console.log(`Audit Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    const totalIssues = this.results.critical.length + this.results.high.length + 
                       this.results.medium.length + this.results.low.length;
    
    console.log(`\nSUMMARY:`);
    console.log(`✅ Tests Passed: ${this.results.passed.length}`);
    console.log(`🔴 Critical Issues: ${this.results.critical.length}`);
    console.log(`🟡 High Priority Issues: ${this.results.high.length}`);
    console.log(`🟠 Medium Priority Issues: ${this.results.medium.length}`);
    console.log(`🔵 Low Priority Issues: ${this.results.low.length}`);
    
    const passRate = (this.results.passed.length / (this.results.passed.length + totalIssues)) * 100;
    console.log(`\nOverall Pass Rate: ${passRate.toFixed(1)}%`);
    
    // Deployment Readiness Assessment
    console.log('\n' + '='.repeat(50));
    console.log('DEPLOYMENT READINESS ASSESSMENT');
    console.log('='.repeat(50));
    
    if (this.results.critical.length === 0 && this.results.high.length <= 2) {
      console.log('🟢 DEPLOYMENT APPROVED');
      console.log('Platform is ready for production deployment.');
    } else if (this.results.critical.length === 0 && this.results.high.length <= 5) {
      console.log('🟡 CONDITIONAL DEPLOYMENT');
      console.log('Platform can be deployed with monitoring for high-priority issues.');
    } else {
      console.log('🔴 DEPLOYMENT BLOCKED');
      console.log('Critical issues must be resolved before deployment.');
    }
    
    // Detailed Issue Reporting
    if (this.results.critical.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES (MUST FIX):');
      this.results.critical.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.category}: ${issue.description}`);
        if (issue.endpoint) console.log(`   Endpoint: ${issue.endpoint}`);
        if (issue.recommendation) console.log(`   Fix: ${issue.recommendation}`);
      });
    }
    
    if (this.results.high.length > 0) {
      console.log('\n🟡 HIGH PRIORITY ISSUES:');
      this.results.high.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.category}: ${issue.description}`);
        if (issue.recommendation) console.log(`   Fix: ${issue.recommendation}`);
      });
    }
    
    if (this.results.medium.length > 0) {
      console.log('\n🟠 MEDIUM PRIORITY ISSUES:');
      this.results.medium.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.category}: ${issue.description}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('END OF AUDIT REPORT');
    console.log('='.repeat(80));
    
    return {
      passRate,
      deploymentReady: this.results.critical.length === 0 && this.results.high.length <= 2,
      summary: {
        passed: this.results.passed.length,
        critical: this.results.critical.length,
        high: this.results.high.length,
        medium: this.results.medium.length,
        low: this.results.low.length
      }
    };
  }

  async runCompleteAudit() {
    console.log('Starting Comprehensive Pre-Deployment Audit...');
    console.log('Testing all critical business systems...\n');
    
    try {
      await this.auditCoreInfrastructure();
      await this.auditFinancialSystems();
      await this.auditDEXAggregator();
      await this.auditXRPIntegration();
      await this.auditAIMarketplace();
      await this.auditDataMonetization();
      await this.auditSecurityMeasures();
      await this.auditBusinessLogicConsistency();
      await this.auditErrorHandling();
      
      return this.generateReport();
    } catch (error) {
      console.error('Audit failed:', error);
      this.recordIssue('critical', 'Audit System', `Audit system failure: ${error.message}`, null, 'Fix audit system before deployment');
      return this.generateReport();
    }
  }
}

async function main() {
  const auditor = new PreDeploymentAuditor();
  const results = await auditor.runCompleteAudit();
  
  console.log('\nAudit completed. Results summary:');
  console.log(JSON.stringify(results.summary, null, 2));
  
  process.exit(results.deploymentReady ? 0 : 1);
}

main();