/**
 * PRODUCTION INFRASTRUCTURE MONITORING SYSTEM
 * Comprehensive validation of all critical platform systems for coinrailz.com deployment
 */

class ProductionInfrastructureMonitor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.criticalEndpoints = [
      { name: 'Health Check', method: 'GET', path: '/api/health', expectedStatus: 200 },
      { name: 'User Registration', method: 'POST', path: '/api/auth/register', 
        data: { email: `test-${Date.now()}@test.com`, firstName: 'Test', lastName: 'User' }, expectedStatus: 201 },
      { name: 'Fee Calculation', method: 'POST', path: '/api/send-money-fee', 
        data: { amount: 1000 }, expectedStatus: 200 },
      { name: 'Agent Registration', method: 'POST', path: '/api/ai-agents/register',
        data: { name: 'Test Agent', capabilities: ['trading'], email: 'agent@test.com' }, expectedStatus: 201 },
      { name: 'XRP Wallet Info', method: 'GET', path: '/api/xrp/wallet-info', expectedStatus: 200 },
      { name: 'DEX Quote', method: 'GET', path: '/api/dex/quote', expectedStatus: 200 },
      { name: 'Payment Intent', method: 'POST', path: '/api/ai-agent-payment-intent',
        data: { amount: 25 }, expectedStatus: 200 }
    ];
  }

  async makeRequest(method, endpoint, data = null, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      clearTimeout(timeoutId);

      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        status: response.status,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async testEndpoint(test) {
    const startTime = Date.now();
    try {
      console.log(`Testing ${test.name}...`);
      const result = await this.makeRequest(test.method, test.path, test.data);
      const duration = Date.now() - startTime;

      const success = result.status === test.expectedStatus;
      
      if (success) {
        this.results.passed++;
        console.log(`✅ ${test.name}: ${result.status} (${duration}ms)`);
      } else {
        this.results.failed++;
        console.log(`❌ ${test.name}: Expected ${test.expectedStatus}, got ${result.status} (${duration}ms)`);
        console.log('Response:', typeof result.data === 'string' ? result.data.substring(0, 200) : result.data);
      }

      this.results.tests.push({
        name: test.name,
        method: test.method,
        path: test.path,
        expectedStatus: test.expectedStatus,
        actualStatus: result.status,
        success,
        duration,
        data: result.data
      });

      return success;
    } catch (error) {
      this.results.failed++;
      console.log(`❌ ${test.name}: ${error.message}`);
      this.results.tests.push({
        name: test.name,
        method: test.method,
        path: test.path,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async testDatabaseConnectivity() {
    console.log('\n🔍 Testing Database Connectivity...');
    try {
      // Test user registration which requires database
      const testEmail = `db-test-${Date.now()}@test.com`;
      const result = await this.makeRequest('POST', '/api/auth/register', {
        email: testEmail,
        firstName: 'DB',
        lastName: 'Test'
      });

      if (result.status === 201) {
        console.log('✅ Database connectivity: Working');
        return true;
      } else {
        console.log('❌ Database connectivity: Failed');
        return false;
      }
    } catch (error) {
      console.log(`❌ Database connectivity: ${error.message}`);
      return false;
    }
  }

  async testFrontendServing() {
    console.log('\n🌐 Testing Frontend Serving...');
    try {
      const result = await this.makeRequest('GET', '/');
      
      if (result.status === 200 && typeof result.data === 'string' && 
          result.data.includes('Coin Railz')) {
        console.log('✅ Frontend serving: Working');
        return true;
      } else {
        console.log('❌ Frontend serving: Failed');
        return false;
      }
    } catch (error) {
      console.log(`❌ Frontend serving: ${error.message}`);
      return false;
    }
  }

  async runComprehensiveMonitoring() {
    console.log('🚀 Starting Production Infrastructure Monitoring...\n');
    
    // Test basic infrastructure
    const frontendWorking = await this.testFrontendServing();
    const databaseWorking = await this.testDatabaseConnectivity();

    console.log('\n📡 Testing Critical API Endpoints...');
    
    // Test all critical endpoints
    for (const test of this.criticalEndpoints) {
      await this.testEndpoint(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate final report
    this.generateProductionReport(frontendWorking, databaseWorking);
  }

  generateProductionReport(frontendWorking, databaseWorking) {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 PRODUCTION INFRASTRUCTURE MONITORING REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n🏗️  INFRASTRUCTURE STATUS:`);
    console.log(`   Frontend Serving: ${frontendWorking ? '✅ Working' : '❌ Failed'}`);
    console.log(`   Database: ${databaseWorking ? '✅ Connected' : '❌ Failed'}`);
    
    console.log(`\n📈 API ENDPOINT RESULTS:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Success Rate: ${successRate}%`);

    console.log(`\n🔍 DETAILED RESULTS:`);
    this.results.tests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      const duration = test.duration ? `${test.duration}ms` : 'timeout';
      console.log(`   ${status} ${test.name}: ${test.actualStatus || 'error'} (${duration})`);
    });

    console.log(`\n💯 PRODUCTION READINESS ASSESSMENT:`);
    const infrastructureScore = (frontendWorking ? 50 : 0) + (databaseWorking ? 50 : 0);
    const apiScore = parseFloat(successRate);
    const overallScore = (infrastructureScore + apiScore) / 2;
    
    console.log(`   Infrastructure: ${infrastructureScore}%`);
    console.log(`   API Endpoints: ${apiScore}%`);
    console.log(`   Overall Score: ${overallScore.toFixed(1)}%`);

    if (overallScore >= 90) {
      console.log(`\n🎯 STATUS: PRODUCTION READY FOR COINRAILZ.COM`);
      console.log(`   All critical systems operational`);
      console.log(`   Ready for live deployment`);
    } else if (overallScore >= 75) {
      console.log(`\n⚠️  STATUS: MOSTLY READY - MINOR ISSUES`);
      console.log(`   Core functionality working`);
      console.log(`   Some non-critical features may need attention`);
    } else {
      console.log(`\n🚨 STATUS: NEEDS FIXES BEFORE DEPLOYMENT`);
      console.log(`   Critical issues need resolution`);
    }

    console.log('\n' + '='.repeat(80));
    
    return {
      overallScore,
      infrastructureScore,
      apiScore,
      frontendWorking,
      databaseWorking,
      tests: this.results.tests
    };
  }
}

// Run the monitoring
async function main() {
  const monitor = new ProductionInfrastructureMonitor();
  await monitor.runComprehensiveMonitoring();
}

main().catch(console.error);