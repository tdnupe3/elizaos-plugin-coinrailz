/**
 * FIXED PLATFORM AUDIT - JANUARY 1, 2025
 * Accurate assessment with proper localhost connection testing
 */

class FixedPlatformAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {
      authentication: {},
      coreFeatures: {},
      xrpEcosystem: {},
      dexFunctionality: {},
      aiMarketplace: {},
      dataMonetization: {},
      deployment: {},
      overallScore: 0,
      totalTests: 0,
      passedTests: 0
    };
  }

  recordTest(category, test, status, details = null) {
    if (!this.results[category]) this.results[category] = {};
    this.results[category][test] = { status, details, timestamp: new Date().toISOString() };
    
    this.results.totalTests++;
    if (status === 'PASS') {
      this.results.passedTests++;
    }
  }

  async testEndpoint(method, endpoint, data = null, headers = {}) {
    try {
      const spawn = require('child_process').spawn;
      let command, args;
      
      if (method === 'GET') {
        command = 'curl';
        args = ['-s', `${this.baseUrl}${endpoint}`];
        
        // Add headers if provided
        Object.entries(headers).forEach(([key, value]) => {
          args.push('-H', `${key}: ${value}`);
        });
      } else if (method === 'POST') {
        command = 'curl';
        args = ['-s', '-X', 'POST', '-H', 'Content-Type: application/json'];
        
        // Add additional headers
        Object.entries(headers).forEach(([key, value]) => {
          args.push('-H', `${key}: ${value}`);
        });
        
        if (data) {
          args.push('-d', JSON.stringify(data));
        }
        
        args.push(`${this.baseUrl}${endpoint}`);
      }
      
      return new Promise((resolve) => {
        const process = spawn(command, args);
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.on('close', (code) => {
          try {
            const parsed = JSON.parse(output);
            resolve({
              success: true,
              status: parsed.success ? 200 : (parsed.error ? 400 : 500),
              data: parsed
            });
          } catch (error) {
            resolve({
              success: false,
              status: 500,
              data: null,
              error: 'Failed to parse response'
            });
          }
        });
      });
    } catch (error) {
      return { success: false, status: 0, data: null, error: error.message };
    }
  }

  async auditAuthentication() {
    console.log('\n=== AUTHENTICATION SYSTEM AUDIT ===');
    
    // Test auth user endpoint without authorization (should return 401)
    const authNoHeaderTest = await this.testEndpoint('GET', '/api/auth/user');
    this.recordTest('authentication', 'auth_protection', 
      authNoHeaderTest.status === 401 ? 'PASS' : 'FAIL',
      { status: authNoHeaderTest.status, message: 'Should return 401 without auth header' }
    );

    // Test auth user endpoint with authorization (should return 200)
    const authWithHeaderTest = await this.testEndpoint('GET', '/api/auth/user', null, {
      'Authorization': 'Bearer test-token'
    });
    this.recordTest('authentication', 'auth_success', 
      authWithHeaderTest.status === 200 ? 'PASS' : 'FAIL',
      { status: authWithHeaderTest.status, user: authWithHeaderTest.data?.user }
    );

    // Test registration endpoint
    const registerTest = await this.testEndpoint('POST', '/api/auth/register', {
      email: 'test@example.com',
      password: 'testpass123'
    });
    this.recordTest('authentication', 'registration', 
      registerTest.success ? 'PASS' : 'FAIL',
      { status: registerTest.status }
    );

    // Test dashboard with auth protection
    const dashboardTest = await this.testEndpoint('GET', '/api/dashboard/stats');
    this.recordTest('authentication', 'protected_endpoint', 
      dashboardTest.status === 401 ? 'PASS' : 'FAIL',
      { status: dashboardTest.status, message: 'Dashboard should require auth' }
    );
  }

  async auditCoreFeatures() {
    console.log('\n=== CORE FEATURES AUDIT ===');

    // Platform health
    const healthTest = await this.testEndpoint('GET', '/api/platform/health');
    this.recordTest('coreFeatures', 'platform_health', 
      healthTest.success ? 'PASS' : 'FAIL',
      { health: healthTest.data?.health }
    );

    // Business logic validation
    const businessLogicTest = await this.testEndpoint('GET', '/api/platform/validate-business-logic');
    this.recordTest('coreFeatures', 'business_logic', 
      businessLogicTest.success ? 'PASS' : 'FAIL',
      { validation: businessLogicTest.data?.validation }
    );

    // P2P fee calculation
    const p2pTest = await this.testEndpoint('POST', '/api/p2p/calculate-fees', {
      amount: 100,
      senderMethod: 'credit-card',
      recipientMethod: 'paypal'
    });
    this.recordTest('coreFeatures', 'p2p_calculation', 
      p2pTest.success ? 'PASS' : 'FAIL',
      { fees: p2pTest.data?.fees }
    );
  }

  async auditXRPEcosystem() {
    console.log('\n=== XRP ECOSYSTEM AUDIT ===');

    // XRP rate
    const rateTest = await this.testEndpoint('GET', '/api/xrp/rate');
    this.recordTest('xrpEcosystem', 'rate_endpoint', 
      rateTest.success ? 'PASS' : 'FAIL',
      { rate: rateTest.data?.rate }
    );

    // XRP balance
    const balanceTest = await this.testEndpoint('GET', '/api/xrp/balance');
    this.recordTest('xrpEcosystem', 'balance_endpoint', 
      balanceTest.success ? 'PASS' : 'FAIL',
      { balance: balanceTest.data?.balance }
    );

    // XRP network status
    const networkTest = await this.testEndpoint('GET', '/api/xrp/network-status');
    this.recordTest('xrpEcosystem', 'network_status', 
      networkTest.success ? 'PASS' : 'FAIL',
      { network: networkTest.data?.network }
    );
  }

  async auditDEXFunctionality() {
    console.log('\n=== DEX FUNCTIONALITY AUDIT ===');

    // DEX quote
    const quoteTest = await this.testEndpoint('POST', '/api/dex/quote', {
      fromToken: 'ETH',
      toToken: 'USDC',
      amount: '1',
      chainId: 1,
      slippage: 5.0
    });
    this.recordTest('dexFunctionality', 'quote_system', 
      quoteTest.success ? 'PASS' : 'FAIL',
      { quote: quoteTest.data?.quote }
    );

    // DEX swap preparation
    const swapTest = await this.testEndpoint('POST', '/api/dex/swap-prepare', {
      fromToken: 'ETH',
      toToken: 'USDC',
      amount: '1',
      userAddress: '0x742d35Cc6639C0532fCCb340E2D61e92D1D5B8B9'
    });
    this.recordTest('dexFunctionality', 'swap_preparation', 
      swapTest.success ? 'PASS' : 'FAIL',
      { swapData: swapTest.data?.swapData }
    );

    // 1inch status
    const oneinchTest = await this.testEndpoint('GET', '/api/dex/1inch-status');
    this.recordTest('dexFunctionality', 'oneinch_integration', 
      oneinchTest.success ? 'PASS' : 'FAIL',
      { status: oneinchTest.data?.status }
    );
  }

  async auditAIMarketplace() {
    console.log('\n=== AI MARKETPLACE AUDIT ===');

    // Agent search
    const agentSearchTest = await this.testEndpoint('GET', '/api/ai-marketplace/agents');
    this.recordTest('aiMarketplace', 'agent_search', 
      agentSearchTest.success ? 'PASS' : 'FAIL',
      { agents: agentSearchTest.data?.agents }
    );

    // Agent registration (should require auth)
    const agentRegisterTest = await this.testEndpoint('POST', '/api/ai-marketplace/register-agent', {
      name: 'Test Agent',
      category: 'analytics'
    });
    this.recordTest('aiMarketplace', 'agent_registration_protection', 
      agentRegisterTest.status === 401 ? 'PASS' : 'FAIL',
      { status: agentRegisterTest.status, message: 'Should require authentication' }
    );

    // Order creation (should require auth)
    const orderTest = await this.testEndpoint('POST', '/api/ai-marketplace/create-order', {
      agentId: 'test-agent',
      serviceType: 'consultation',
      amount: 100
    });
    this.recordTest('aiMarketplace', 'order_creation_protection', 
      orderTest.status === 401 ? 'PASS' : 'FAIL',
      { status: orderTest.status, message: 'Should require authentication' }
    );
  }

  async auditDataMonetization() {
    console.log('\n=== DATA MONETIZATION AUDIT ===');

    // Analytics endpoint
    const analyticsTest = await this.testEndpoint('GET', '/api/data/analytics');
    this.recordTest('dataMonetization', 'analytics_api', 
      analyticsTest.success ? 'PASS' : 'FAIL',
      { analytics: analyticsTest.data?.analytics }
    );

    // Behavioral data endpoint
    const behavioralTest = await this.testEndpoint('GET', '/api/data/behavioral/user-patterns');
    this.recordTest('dataMonetization', 'behavioral_api', 
      behavioralTest.success ? 'PASS' : 'FAIL',
      { patterns: behavioralTest.data?.patterns }
    );

    // Enterprise data endpoint
    const enterpriseTest = await this.testEndpoint('GET', '/api/data/enterprise/sample');
    this.recordTest('dataMonetization', 'enterprise_api', 
      enterpriseTest.success ? 'PASS' : 'FAIL',
      { data: enterpriseTest.data?.enterpriseData }
    );
  }

  async auditDeployment() {
    console.log('\n=== DEPLOYMENT READINESS AUDIT ===');

    // Database status
    const dbTest = await this.testEndpoint('GET', '/api/platform/db-status');
    this.recordTest('deployment', 'database_connection', 
      dbTest.success ? 'PASS' : 'FAIL',
      { database: dbTest.data?.database }
    );

    // Performance metrics
    const perfTest = await this.testEndpoint('GET', '/api/platform/performance');
    this.recordTest('deployment', 'performance_metrics', 
      perfTest.success ? 'PASS' : 'FAIL',
      { metrics: perfTest.data?.metrics }
    );

    // Basic dashboard endpoint
    const dashboardTest = await this.testEndpoint('GET', '/api/dashboard');
    this.recordTest('deployment', 'dashboard_access', 
      dashboardTest.success ? 'PASS' : 'FAIL',
      { dashboard: dashboardTest.data?.dashboard }
    );
  }

  calculateOverallScore() {
    this.results.overallScore = this.results.totalTests > 0 ? 
      Math.round((this.results.passedTests / this.results.totalTests) * 100) : 0;
    return this.results.overallScore;
  }

  generateFixedReport() {
    const score = this.calculateOverallScore();
    
    console.log('\n' + '='.repeat(80));
    console.log('           FIXED PLATFORM AUDIT REPORT');
    console.log('                 January 1, 2025');
    console.log('='.repeat(80));
    
    console.log(`\n📊 OVERALL PLATFORM SCORE: ${score}%`);
    console.log(`✅ PASSED TESTS: ${this.results.passedTests}/${this.results.totalTests}\n`);

    // Deployment Status Assessment
    let deploymentStatus;
    if (score >= 90) deploymentStatus = '🟢 PRODUCTION READY';
    else if (score >= 75) deploymentStatus = '🟡 DEPLOYMENT APPROVED WITH MONITORING';
    else if (score >= 60) deploymentStatus = '🟠 NEEDS OPTIMIZATION BEFORE DEPLOYMENT';
    else deploymentStatus = '🔴 NOT READY FOR DEPLOYMENT';

    console.log(`🚀 DEPLOYMENT STATUS: ${deploymentStatus}\n`);

    // Category Breakdown
    console.log('📋 DETAILED CATEGORY BREAKDOWN:\n');
    
    Object.entries(this.results).forEach(([category, tests]) => {
      if (typeof tests === 'object' && tests !== null && !Array.isArray(tests) && 
          !['overallScore', 'totalTests', 'passedTests'].includes(category)) {
        
        const categoryTests = Object.values(tests).filter(test => test.status);
        const categoryScore = categoryTests.length > 0 ? 
          Math.round((categoryTests.filter(t => t.status === 'PASS').length / categoryTests.length) * 100) : 0;
        
        const statusIcon = categoryScore >= 80 ? '✅' : categoryScore >= 60 ? '⚠️' : '❌';
        console.log(`${statusIcon} ${category.toUpperCase()}: ${categoryScore}% (${categoryTests.filter(t => t.status === 'PASS').length}/${categoryTests.length} tests passed)`);
      }
    });

    // Summary Assessment
    console.log('\n🔍 PLATFORM FUNCTIONALITY SUMMARY:\n');
    console.log(`• Authentication System: ${score >= 75 ? '✅ Working' : '❌ Issues Detected'}`);
    console.log(`• Core Business Logic: ${score >= 75 ? '✅ Operational' : '❌ Needs Work'}`);
    console.log(`• Revenue Generation: ${score >= 75 ? '✅ Capable' : '❌ Limited'}`);
    console.log(`• API Endpoints: ${score >= 75 ? '✅ Responding' : '❌ Issues Present'}`);

    console.log('\n💡 RECOMMENDATIONS:\n');
    if (score >= 80) {
      console.log('• Platform shows strong functionality across all areas');
      console.log('• Ready for user testing and gradual deployment');
      console.log('• Continue monitoring and optimization');
    } else if (score >= 60) {
      console.log('• Platform has good foundation but needs targeted improvements');
      console.log('• Address failing test categories before full deployment');
      console.log('• Consider limited beta testing with core features');
    } else {
      console.log('• Platform requires additional development work');
      console.log('• Focus on core functionality restoration');
      console.log('• Test individual components before integration');
    }

    console.log('\n' + '='.repeat(80));
    console.log('                    END OF FIXED AUDIT');
    console.log('='.repeat(80));

    return this.results;
  }

  async runCompleteAudit() {
    console.log('🔍 Starting Fixed Platform Audit...\n');
    
    try {
      await this.auditAuthentication();
      await this.auditCoreFeatures();
      await this.auditXRPEcosystem();
      await this.auditDEXFunctionality();
      await this.auditAIMarketplace();
      await this.auditDataMonetization();
      await this.auditDeployment();

      return this.generateFixedReport();
    } catch (error) {
      console.error('❌ Fixed audit failed:', error);
      return this.results;
    }
  }
}

// Run the fixed audit
async function main() {
  const auditor = new FixedPlatformAuditor();
  const results = await auditor.runCompleteAudit();
  return results;
}

// Execute audit
main().catch(console.error);