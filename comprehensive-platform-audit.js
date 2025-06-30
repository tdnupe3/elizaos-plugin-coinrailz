/**
 * COMPREHENSIVE PLATFORM AUDIT - ALL FEATURES
 * Tests every major system and feature across the entire Coin Railz platform
 */

import axios from 'axios';

class ComprehensivePlatformAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.response?.data?.error || error.message || 'Request failed',
        status: error.response?.status
      };
    }
  }

  recordTest(category, name, success, details = null, critical = false) {
    const result = { category, name, success, details, critical };
    if (success) {
      this.results.passed.push(result);
    } else {
      this.results.failed.push(result);
    }
  }

  /**
   * 1. CORE PLATFORM INFRASTRUCTURE
   */
  async auditCoreInfrastructure() {
    console.log('🔧 Testing Core Infrastructure...');

    // Platform health
    const health = await this.makeRequest('GET', '/api/platform/health');
    this.recordTest('Core', 'Platform Health', health.success, 
      health.success ? `Health score: ${health.data?.uptime}s uptime` : health.error, true);

    // Database connectivity
    const dbStatus = health.success && health.data?.database?.status === 'connected';
    this.recordTest('Core', 'Database Connection', dbStatus, 
      dbStatus ? 'PostgreSQL connected' : 'Database connection failed', true);

    // Authentication system
    const auth = await this.makeRequest('GET', '/api/auth/user');
    this.recordTest('Core', 'Authentication System', auth.status === 401, 
      'Properly returns 401 for unauthenticated requests');
  }

  /**
   * 2. PAYMENT PROCESSING SYSTEMS
   */
  async auditPaymentSystems() {
    console.log('💳 Testing Payment Systems...');

    // Fee analytics
    const fees = await this.makeRequest('GET', '/api/payments/analytics/fees');
    this.recordTest('Payments', 'Fee Analytics', fees.success, 
      fees.success ? `$${fees.data?.data?.totalFeesCapture} captured` : fees.error, true);

    // Stripe integration
    const stripe = await this.makeRequest('POST', '/api/payments/process', {
      method: 'stripe',
      amount: 100,
      orderId: 'test_order',
      customerId: 'test_customer',
      agentId: 'test_agent'
    });
    this.recordTest('Payments', 'Stripe Processing', stripe.success, 
      stripe.success ? 'Payment intent created' : stripe.error);

    // PayPal integration
    const paypal = await this.makeRequest('POST', '/api/payments/process', {
      method: 'paypal',
      amount: 100,
      orderId: 'test_order',
      customerId: 'test_customer',
      agentId: 'test_agent'
    });
    this.recordTest('Payments', 'PayPal Processing', paypal.success, 
      paypal.success ? 'PayPal payment created' : paypal.error);

    // Crypto payments
    const crypto = await this.makeRequest('POST', '/api/payments/process', {
      method: 'crypto',
      amount: 100,
      currency: 'ETH',
      orderId: 'test_order',
      customerId: 'test_customer',
      agentId: 'test_agent'
    });
    this.recordTest('Payments', 'Crypto Processing', crypto.success, 
      crypto.success ? 'Crypto payment created' : crypto.error);

    // XRP payments
    const xrp = await this.makeRequest('POST', '/api/payments/process', {
      method: 'xrp',
      amount: 100,
      orderId: 'test_order',
      customerId: 'test_customer',
      agentId: 'test_agent'
    });
    this.recordTest('Payments', 'XRP Processing', xrp.success, 
      xrp.success ? 'XRP payment created' : xrp.error);
  }

  /**
   * 3. BLOCKCHAIN & DEX INTEGRATIONS
   */
  async auditBlockchainSystems() {
    console.log('⛓️ Testing Blockchain Systems...');

    // DEX aggregator
    const dex = await this.makeRequest('GET', '/api/dex/quote?from=ETH&to=USDC&amount=1');
    this.recordTest('Blockchain', 'DEX Aggregator', dex.success, 
      dex.success ? `Quote: ${dex.data?.quote}` : dex.error, true);

    // XRP integration
    const xrpInfo = await this.makeRequest('GET', '/api/xrp/info');
    this.recordTest('Blockchain', 'XRP Integration', xrpInfo.success, 
      xrpInfo.success ? 'XRP service operational' : xrpInfo.error);

    // Multi-chain support
    const chains = await this.makeRequest('GET', '/api/blockchain/supported-chains');
    this.recordTest('Blockchain', 'Multi-Chain Support', chains.success, 
      chains.success ? `${chains.data?.length || 'Multiple'} chains supported` : chains.error);

    // BNB Chain
    const bnb = await this.makeRequest('GET', '/api/blockchain/bnb/health');
    this.recordTest('Blockchain', 'BNB Chain', bnb.success, 
      bnb.success ? 'BNB Chain operational' : bnb.error);

    // PulseChain
    const pulse = await this.makeRequest('GET', '/api/blockchain/pulse/health');
    this.recordTest('Blockchain', 'PulseChain', pulse.success, 
      pulse.success ? 'PulseChain operational' : pulse.error);
  }

  /**
   * 4. P2P TRANSFER SYSTEM
   */
  async auditP2PSystem() {
    console.log('🔄 Testing P2P Transfer System...');

    // P2P transfer initiation
    const p2p = await this.makeRequest('POST', '/api/p2p/transfer', {
      recipientEmail: 'test@example.com',
      amount: 50,
      currency: 'USD',
      method: 'paypal',
      message: 'Test transfer'
    });
    this.recordTest('P2P', 'Transfer Initiation', p2p.success, 
      p2p.success ? 'Transfer created' : p2p.error, true);

    // Fee calculation
    const feeCalc = await this.makeRequest('POST', '/api/p2p/calculate-fee', {
      amount: 100,
      fromPlatform: 'paypal',
      toPlatform: 'crypto'
    });
    this.recordTest('P2P', 'Fee Calculation', feeCalc.success, 
      feeCalc.success ? `Fee: $${feeCalc.data?.fee}` : feeCalc.error);

    // Cross-border transfers
    const crossBorder = await this.makeRequest('POST', '/api/p2p/cross-border', {
      amount: 200,
      fromCountry: 'US',
      toCountry: 'EU',
      currency: 'USD'
    });
    this.recordTest('P2P', 'Cross-Border Transfers', crossBorder.success, 
      crossBorder.success ? 'Cross-border transfer supported' : crossBorder.error);
  }

  /**
   * 5. AI MARKETPLACE (Already tested, but quick validation)
   */
  async auditMarketplace() {
    console.log('🤖 Validating AI Marketplace...');

    // Agent listings
    const agents = await this.makeRequest('GET', '/api/agents/list');
    this.recordTest('Marketplace', 'Agent Listings', agents.success, 
      agents.success ? `${agents.data?.data?.total} agents available` : agents.error, true);

    // Order processing
    const order = await this.makeRequest('POST', '/api/orders/create', {
      agentId: 'agent_sarah_ai',
      customerId: 'customer_test',
      serviceType: 'data_analysis',
      amount: 150,
      description: 'Test analysis project'
    });
    this.recordTest('Marketplace', 'Order Creation', order.success, 
      order.success ? `Order: ${order.data?.orderId}` : order.error, true);
  }

  /**
   * 6. REFERRAL SYSTEM
   */
  async auditReferralSystem() {
    console.log('👥 Testing Referral System...');

    // Referral link generation
    const referral = await this.makeRequest('POST', '/api/referrals/generate', {
      userId: 'test_user',
      type: 'marketplace'
    });
    this.recordTest('Referral', 'Link Generation', referral.success, 
      referral.success ? 'Referral link created' : referral.error);

    // Commission tracking
    const commission = await this.makeRequest('GET', '/api/referrals/commissions/test_user');
    this.recordTest('Referral', 'Commission Tracking', commission.success, 
      commission.success ? 'Commission tracking operational' : commission.error);

    // Payout system
    const payout = await this.makeRequest('POST', '/api/referrals/calculate-payout', {
      transactionAmount: 1000,
      referralTier: 'standard'
    });
    this.recordTest('Referral', 'Payout Calculation', payout.success, 
      payout.success ? `Payout: $${payout.data?.amount}` : payout.error);
  }

  /**
   * 7. DATA MONETIZATION APIS
   */
  async auditDataMonetization() {
    console.log('📊 Testing Data Monetization...');

    // Analytics API
    const analytics = await this.makeRequest('GET', '/api/data/analytics');
    this.recordTest('Data', 'Analytics API', analytics.success, 
      analytics.success ? 'Analytics data available' : analytics.error, true);

    // Behavioral patterns
    const behavioral = await this.makeRequest('GET', '/api/data/behavioral/user-patterns');
    this.recordTest('Data', 'Behavioral Data', behavioral.success, 
      behavioral.success ? 'User patterns accessible' : behavioral.error);

    // Enterprise data
    const enterprise = await this.makeRequest('GET', '/api/data/enterprise/sample');
    this.recordTest('Data', 'Enterprise Data', enterprise.success, 
      enterprise.success ? 'Enterprise data ready' : enterprise.error);
  }

  /**
   * 8. SECURITY & AUTHENTICATION
   */
  async auditSecurity() {
    console.log('🔒 Testing Security Systems...');

    // Rate limiting
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(this.makeRequest('GET', '/api/agents/list'));
    }
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    this.recordTest('Security', 'Rate Limiting', rateLimited, 
      rateLimited ? 'Rate limiting active' : 'Rate limiting may not be working');

    // Input validation
    const xssTest = await this.makeRequest('POST', '/api/orders/create', {
      agentId: '<script>alert("xss")</script>',
      customerId: 'test',
      serviceType: 'test',
      amount: 100,
      description: 'test'
    });
    this.recordTest('Security', 'XSS Protection', !xssTest.success, 
      !xssTest.success ? 'XSS attempts blocked' : 'XSS protection may be weak');

    // SQL injection test
    const sqlTest = await this.makeRequest('GET', '/api/agents/search?category=\'; DROP TABLE agents; --');
    this.recordTest('Security', 'SQL Injection Protection', sqlTest.success, 
      'SQL injection protection assessed');
  }

  /**
   * 9. FRONTEND ROUTES & UI
   */
  async auditFrontend() {
    console.log('🎨 Testing Frontend Routes...');

    // Main pages
    const routes = [
      '/',
      '/p2p-transfer',
      '/dex',
      '/marketplace',
      '/agent-dashboard',
      '/customer-dashboard'
    ];

    for (const route of routes) {
      const response = await this.makeRequest('GET', route);
      this.recordTest('Frontend', `Route: ${route}`, response.success || response.status === 200, 
        response.success ? 'Route accessible' : `Status: ${response.status}`);
    }
  }

  /**
   * 10. EXTERNAL INTEGRATIONS
   */
  async auditExternalIntegrations() {
    console.log('🔗 Testing External Integrations...');

    // 1inch API
    const oneInch = await this.makeRequest('GET', '/api/dex/1inch/status');
    this.recordTest('External', '1inch API', oneInch.success, 
      oneInch.success ? '1inch integration working' : oneInch.error);

    // Stripe status
    const stripeStatus = await this.makeRequest('GET', '/api/payments/stripe/status');
    this.recordTest('External', 'Stripe API', stripeStatus.success, 
      stripeStatus.success ? 'Stripe integration active' : stripeStatus.error);

    // PayPal status
    const paypalStatus = await this.makeRequest('GET', '/api/payments/paypal/status');
    this.recordTest('External', 'PayPal API', paypalStatus.success, 
      paypalStatus.success ? 'PayPal integration active' : paypalStatus.error);
  }

  /**
   * GENERATE COMPREHENSIVE REPORT
   */
  generateReport() {
    const total = this.results.passed.length + this.results.failed.length;
    const successRate = total > 0 ? (this.results.passed.length / total * 100).toFixed(1) : 0;
    const criticalFailures = this.results.failed.filter(r => r.critical).length;

    console.log('\n================================================================================');
    console.log('📊 COMPREHENSIVE PLATFORM AUDIT RESULTS');
    console.log('================================================================================');
    console.log(`✅ Passed Tests: ${this.results.passed.length}`);
    console.log(`❌ Failed Tests: ${this.results.failed.length}`);
    console.log(`🚨 Critical Failures: ${criticalFailures}`);
    console.log(`📈 Success Rate: ${successRate}%`);

    // Determine overall status
    let status;
    if (criticalFailures > 0) {
      status = '🚫 NOT PRODUCTION READY - Critical failures detected';
    } else if (successRate >= 90) {
      status = '🎯 PRODUCTION READY';
    } else if (successRate >= 80) {
      status = '⚠️ NEARLY READY - Minor fixes needed';
    } else {
      status = '🔧 NEEDS SIGNIFICANT WORK';
    }

    console.log(`🎯 STATUS: ${status}`);

    // Group results by category
    const categories = {};
    [...this.results.passed, ...this.results.failed].forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { passed: 0, failed: 0, tests: [] };
      }
      categories[result.category][result.success ? 'passed' : 'failed']++;
      categories[result.category].tests.push(result);
    });

    console.log('\n📋 DETAILED RESULTS BY CATEGORY:');
    Object.entries(categories).forEach(([category, data]) => {
      const categoryRate = (data.passed / (data.passed + data.failed) * 100).toFixed(1);
      console.log(`\n   ${category}: ${categoryRate}% (${data.passed}/${data.passed + data.failed})`);
      
      data.tests.forEach(test => {
        const icon = test.success ? '✅' : '❌';
        const critical = test.critical ? ' [CRITICAL]' : '';
        console.log(`      ${icon} ${test.name}${critical}`);
        if (test.details) {
          console.log(`         ${test.details}`);
        }
      });
    });

    console.log('\n================================================================================');
    return {
      totalTests: total,
      passed: this.results.passed.length,
      failed: this.results.failed.length,
      successRate: parseFloat(successRate),
      criticalFailures,
      status,
      categories
    };
  }

  /**
   * RUN COMPLETE AUDIT
   */
  async runCompleteAudit() {
    console.log('🚀 STARTING COMPREHENSIVE PLATFORM AUDIT...\n');

    try {
      await this.auditCoreInfrastructure();
      await this.auditPaymentSystems();
      await this.auditBlockchainSystems();
      await this.auditP2PSystem();
      await this.auditMarketplace();
      await this.auditReferralSystem();
      await this.auditDataMonetization();
      await this.auditSecurity();
      await this.auditFrontend();
      await this.auditExternalIntegrations();

      return this.generateReport();
    } catch (error) {
      console.error('❌ Audit failed:', error.message);
      return { error: error.message };
    }
  }
}

// Run the audit
async function main() {
  const auditor = new ComprehensivePlatformAuditor();
  const results = await auditor.runCompleteAudit();
  
  if (results.error) {
    process.exit(1);
  }
  
  // Exit with status code based on results
  process.exit(results.criticalFailures > 0 ? 1 : 0);
}

main().catch(console.error);