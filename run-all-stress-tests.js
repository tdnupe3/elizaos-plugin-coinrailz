
const fetch = require('node-fetch');

class ComprehensiveStressTestRunner {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.results = {};
  }

  async makeRequest(method, endpoint, body = null) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const data = await response.json();
      
      return {
        status: response.status,
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        status: 500,
        success: false,
        error: error.message
      };
    }
  }

  async runIsolatedStressTests() {
    console.log('\n🧪 RUNNING ISOLATED STRESS TESTS');
    console.log('=' .repeat(50));
    
    // Get available scenarios
    const scenariosResponse = await this.makeRequest('GET', '/api/stress-test/scenarios');
    if (!scenariosResponse.success) {
      console.log('❌ Failed to get stress test scenarios');
      return;
    }
    
    const scenarios = scenariosResponse.data.scenarios;
    console.log(`📋 Found ${scenarios.length} stress test scenarios`);
    
    // Run each scenario
    for (const scenario of scenarios) {
      const scenarioName = scenario.name.toLowerCase().replace(/\s+/g, '-');
      console.log(`\n🚀 Starting: ${scenario.name}`);
      console.log(`   - ${scenario.concurrentUsers} users`);
      console.log(`   - ${scenario.transactionsPerSecond} TPS`);
      console.log(`   - ${scenario.testDuration}s duration`);
      
      const testResponse = await this.makeRequest('POST', `/api/stress-test/run/${scenarioName}`);
      
      if (testResponse.success) {
        console.log(`✅ ${scenario.name}: Started successfully`);
        this.results[scenario.name] = { status: 'started', ...testResponse.data };
        
        // Wait for test to complete
        await this.waitForTestCompletion(scenario.testDuration + 10);
      } else {
        console.log(`❌ ${scenario.name}: Failed to start`);
        this.results[scenario.name] = { status: 'failed', error: testResponse.error };
      }
    }
  }
  
  async waitForTestCompletion(seconds) {
    console.log(`   ⏳ Waiting ${seconds}s for test completion...`);
    
    for (let i = 0; i < seconds; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await this.makeRequest('GET', '/api/stress-test/status');
      if (statusResponse.success && !statusResponse.data.running) {
        console.log(`   ✅ Test completed`);
        return;
      }
      
      process.stdout.write('.');
    }
    console.log('');
  }

  async runComprehensiveLoadTest() {
    console.log('\n📈 RUNNING COMPREHENSIVE LOAD TEST');
    console.log('=' .repeat(50));
    
    const loadTestResponse = await this.makeRequest('POST', '/api/load-test/comprehensive');
    
    if (loadTestResponse.success) {
      console.log('✅ Comprehensive load test completed');
      console.log(`📊 Overall result: ${loadTestResponse.data.loadTest.overall}`);
      console.log(`🎯 Score: ${loadTestResponse.data.loadTest.score || 'N/A'}`);
      
      this.results.comprehensiveLoadTest = loadTestResponse.data;
    } else {
      console.log('❌ Comprehensive load test failed');
      console.log(`   Error: ${loadTestResponse.error || 'Unknown error'}`);
      this.results.comprehensiveLoadTest = { status: 'failed', error: loadTestResponse.error };
    }
  }

  async runBusinessLogicValidation() {
    console.log('\n💰 RUNNING BUSINESS LOGIC VALIDATION');
    console.log('=' .repeat(50));
    
    const businessLogicResponse = await this.makeRequest('GET', '/api/validate/business-logic');
    
    if (businessLogicResponse.success) {
      const businessLogic = businessLogicResponse.data.businessLogic;
      console.log(`✅ Business logic validation: ${businessLogic.valid ? 'PASSED' : 'FAILED'}`);
      console.log(`📈 Average margin: ${businessLogic.averageMargin}%`);
      console.log(`💵 Break-even: ${businessLogic.breakEven.transactionsPerDay} transactions/day`);
      
      // Show scenario results
      console.log('\n📋 Profitability scenarios:');
      businessLogic.scenarios.forEach(scenario => {
        const status = scenario.profitable ? '✅' : '❌';
        console.log(`   ${status} ${scenario.scenario}: ${scenario.margin}% margin`);
      });
      
      this.results.businessLogicValidation = businessLogicResponse.data;
    } else {
      console.log('❌ Business logic validation failed');
      this.results.businessLogicValidation = { status: 'failed', error: businessLogicResponse.error };
    }
  }

  async runProductionReadinessCheck() {
    console.log('\n🚀 RUNNING PRODUCTION READINESS CHECK');
    console.log('=' .repeat(50));
    
    const readinessResponse = await this.makeRequest('GET', '/api/production/readiness');
    
    if (readinessResponse.success) {
      const readiness = readinessResponse.data.readiness;
      console.log(`✅ Production readiness: ${readiness.overall.toUpperCase()}`);
      
      if (readiness.checks) {
        console.log('\n📋 Readiness checks:');
        Object.entries(readiness.checks).forEach(([check, result]) => {
          const status = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
          console.log(`   ${status} ${check}: ${result.message || result.status}`);
        });
      }
      
      this.results.productionReadiness = readinessResponse.data;
    } else {
      console.log('❌ Production readiness check failed');
      this.results.productionReadiness = { status: 'failed', error: readinessResponse.error };
    }
  }

  async runHealthChecks() {
    console.log('\n🏥 RUNNING HEALTH CHECKS');
    console.log('=' .repeat(50));
    
    const healthChecks = [
      '/api/health',
      '/api/health/services', 
      '/api/health/payments',
      '/api/health/database'
    ];
    
    for (const endpoint of healthChecks) {
      const healthResponse = await this.makeRequest('GET', endpoint);
      const checkName = endpoint.split('/').pop() || 'general';
      
      if (healthResponse.success) {
        console.log(`✅ ${checkName}: Healthy`);
      } else {
        console.log(`❌ ${checkName}: Unhealthy (${healthResponse.status})`);
      }
      
      this.results[`health_${checkName}`] = healthResponse;
    }
  }

  async runMetricsCollection() {
    console.log('\n📊 COLLECTING PERFORMANCE METRICS');
    console.log('=' .repeat(50));
    
    const metricsResponse = await this.makeRequest('GET', '/api/metrics');
    
    if (metricsResponse.success) {
      const metrics = metricsResponse.data.metrics;
      console.log('✅ Performance metrics collected');
      console.log(`   📈 Uptime: ${Math.round(metrics.uptime / 60)} minutes`);
      console.log(`   🧠 Memory: ${metrics.memory ? 'Available' : 'Not available'}`);
      console.log(`   ⚡ Cache: ${metrics.cache ? 'Active' : 'Not available'}`);
      
      this.results.performanceMetrics = metricsResponse.data;
    } else {
      console.log('❌ Failed to collect performance metrics');
      this.results.performanceMetrics = { status: 'failed', error: metricsResponse.error };
    }
  }

  printFinalSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 FINAL TEST SUMMARY');
    console.log('=' .repeat(60));
    
    let totalTests = 0;
    let passedTests = 0;
    
    Object.entries(this.results).forEach(([testName, result]) => {
      totalTests++;
      const status = result.status === 'failed' ? '❌' : 
                    result.success === false ? '❌' : '✅';
      
      if (status === '✅') passedTests++;
      
      console.log(`${status} ${testName}`);
    });
    
    console.log('\n📈 OVERALL RESULTS:');
    console.log(`   Tests Run: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    const overallStatus = (passedTests / totalTests) >= 0.8 ? 'READY' : 'NEEDS_WORK';
    console.log(`\n🚀 DEPLOYMENT STATUS: ${overallStatus}`);
    
    if (overallStatus === 'READY') {
      console.log('✅ Platform appears ready for production deployment');
    } else {
      console.log('⚠️  Platform needs additional work before deployment');
    }
  }

  async runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE STRESS TEST SUITE');
    console.log('=' .repeat(60));
    console.log(`🕐 Start time: ${new Date().toISOString()}`);
    
    try {
      // Run all test categories
      await this.runHealthChecks();
      await this.runMetricsCollection();
      await this.runBusinessLogicValidation();
      await this.runProductionReadinessCheck();
      await this.runComprehensiveLoadTest();
      await this.runIsolatedStressTests();
      
      // Print final summary
      this.printFinalSummary();
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
    }
    
    console.log(`\n🕐 End time: ${new Date().toISOString()}`);
  }
}

// Run the test suite
async function main() {
  const testRunner = new ComprehensiveStressTestRunner();
  await testRunner.runAllTests();
}

main().catch(console.error);
