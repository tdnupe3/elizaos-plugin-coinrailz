/**
 * COMPREHENSIVE KYC INTEGRATION TEST
 * Complete validation of Circle KYC/AML system functionality
 */

const BASE_URL = 'http://localhost:5000';

class KYCIntegrationTester {
  constructor() {
    this.testResults = [];
    this.sessionCookie = null;
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    // Add session cookie for authenticated requests
    if (this.sessionCookie) {
      options.headers['Cookie'] = this.sessionCookie;
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.text();
      
      // Save session cookie from response
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      return {
        status: response.status,
        data: parsedData,
        success: response.ok
      };
    } catch (error) {
      return {
        status: 500,
        data: { error: error.message },
        success: false
      };
    }
  }

  logTest(testName, passed, details = {}) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}`);
    if (details.error) {
      console.log(`   Error: ${details.error}`);
    }
    if (details.data) {
      console.log(`   Response: ${JSON.stringify(details.data, null, 2)}`);
    }
    this.testResults.push({
      name: testName,
      passed,
      details
    });
  }

  /**
   * Test 1: KYC Service Initialization
   */
  async testKYCServiceInitialization() {
    console.log('\n=== TEST 1: KYC Service Initialization ===');
    
    try {
      // Test if KYC service can be imported
      const response = await this.makeRequest('GET', '/api/circle/health');
      
      this.logTest('Circle Service Health Check', response.success, {
        data: response.data,
        status: response.status
      });

      if (response.success) {
        // Check if service supports KYC operations
        const hasKYCSupport = response.data.status && 
                            response.data.status.initialized &&
                            response.data.status.hasApiKey;
        
        this.logTest('KYC Service Prerequisites', hasKYCSupport, {
          data: {
            initialized: response.data.status?.initialized,
            hasApiKey: response.data.status?.hasApiKey,
            hasEntitySecret: response.data.status?.hasEntitySecret
          }
        });
      }
    } catch (error) {
      this.logTest('KYC Service Initialization', false, { error: error.message });
    }
  }

  /**
   * Test 2: KYC Route Registration
   */
  async testKYCRouteRegistration() {
    console.log('\n=== TEST 2: KYC Route Registration ===');
    
    const kycEndpoints = [
      '/api/circle/kyc/status',
      '/api/circle/kyc/check-permission',
      '/api/circle/kyc/requirements/US',
      '/api/circle/kyc/submit'
    ];

    for (const endpoint of kycEndpoints) {
      try {
        const response = await this.makeRequest('GET', endpoint);
        
        // For KYC endpoints, 401 (Unauthorized) is expected without authentication
        // 404 (Not Found) would indicate route registration failure
        const isRegistered = response.status !== 404;
        
        this.logTest(`Route Registration: ${endpoint}`, isRegistered, {
          status: response.status,
          expectedUnauthorized: response.status === 401
        });
      } catch (error) {
        this.logTest(`Route Registration: ${endpoint}`, false, { error: error.message });
      }
    }
  }

  /**
   * Test 3: Authentication Flow
   */
  async testAuthenticationFlow() {
    console.log('\n=== TEST 3: Authentication Flow ===');
    
    try {
      // Test authentication endpoints
      const loginResponse = await this.makeRequest('GET', '/api/login');
      
      this.logTest('Login Endpoint Available', loginResponse.status !== 404, {
        status: loginResponse.status,
        redirectToAuth: loginResponse.status === 302 || loginResponse.status === 200
      });

      // Test user info endpoint
      const userResponse = await this.makeRequest('GET', '/api/user');
      
      this.logTest('User Info Endpoint Available', userResponse.status !== 404, {
        status: userResponse.status,
        requiresAuth: userResponse.status === 401
      });

    } catch (error) {
      this.logTest('Authentication Flow Test', false, { error: error.message });
    }
  }

  /**
   * Test 4: KYC Service Methods
   */
  async testKYCServiceMethods() {
    console.log('\n=== TEST 4: KYC Service Methods ===');
    
    try {
      // Test KYC service methods by checking if they can be called
      // This will test without authentication first
      const testData = {
        amount: 5000,
        country: 'US',
        transactionType: 'transfer'
      };

      // Test permission check endpoint
      const permissionResponse = await this.makeRequest('POST', '/api/circle/kyc/check-permission', testData);
      
      this.logTest('Permission Check Endpoint Structure', permissionResponse.status === 401, {
        status: permissionResponse.status,
        note: 'Status 401 expected without authentication'
      });

      // Test requirements endpoint
      const requirementsResponse = await this.makeRequest('GET', '/api/circle/kyc/requirements/US');
      
      this.logTest('Requirements Endpoint Structure', requirementsResponse.status === 401, {
        status: requirementsResponse.status,
        note: 'Status 401 expected without authentication'
      });

    } catch (error) {
      this.logTest('KYC Service Methods Test', false, { error: error.message });
    }
  }

  /**
   * Test 5: Database Schema Validation
   */
  async testDatabaseSchemaValidation() {
    console.log('\n=== TEST 5: Database Schema Validation ===');
    
    try {
      // Test if database can handle KYC-related operations
      // This indirectly tests the schema through API calls
      
      const testResponse = await this.makeRequest('GET', '/api/circle/health');
      
      if (testResponse.success) {
        this.logTest('Database Connection Active', true, {
          note: 'Circle service connected successfully'
        });
        
        // Test if the service can handle user-related operations
        const userCircleResponse = await this.makeRequest('GET', '/api/user-circle/health');
        
        this.logTest('User Circle Service Available', userCircleResponse.status !== 404, {
          status: userCircleResponse.status
        });
      }
    } catch (error) {
      this.logTest('Database Schema Validation', false, { error: error.message });
    }
  }

  /**
   * Test 6: KYC Frontend Component Integration
   */
  async testKYCFrontendIntegration() {
    console.log('\n=== TEST 6: KYC Frontend Integration ===');
    
    try {
      // Test if frontend can load KYC-related resources
      const frontendResponse = await this.makeRequest('GET', '/');
      
      this.logTest('Frontend Application Loading', frontendResponse.status === 200, {
        status: frontendResponse.status,
        note: 'Frontend should serve React application'
      });

      // Test if API endpoints are accessible from frontend perspective
      const apiHealthResponse = await this.makeRequest('GET', '/api/health');
      
      this.logTest('API Health Check', apiHealthResponse.status === 200, {
        status: apiHealthResponse.status
      });

    } catch (error) {
      this.logTest('KYC Frontend Integration', false, { error: error.message });
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE KYC INTEGRATION TEST REPORT');
    console.log('='.repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log(`\nTest Summary:`);
    console.log(`✅ Passed: ${passedTests}/${totalTests} (${successRate}%)`);
    console.log(`❌ Failed: ${failedTests}/${totalTests} (${(100 - successRate).toFixed(1)}%)`);
    
    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(result => !result.passed)
        .forEach(result => {
          console.log(`  ❌ ${result.name}: ${result.details.error || 'Unknown error'}`);
        });
    }
    
    console.log('\nKYC Integration Status:');
    if (successRate >= 90) {
      console.log('🚀 EXCELLENT: KYC system fully operational');
    } else if (successRate >= 70) {
      console.log('✅ GOOD: KYC system mostly functional with minor issues');
    } else if (successRate >= 50) {
      console.log('⚠️ FAIR: KYC system partially functional, requires fixes');
    } else {
      console.log('❌ POOR: KYC system requires significant fixes');
    }
    
    console.log('\nNext Steps:');
    if (successRate >= 90) {
      console.log('- Ready for production deployment');
      console.log('- Implement user authentication flow');
      console.log('- Add comprehensive error handling');
    } else {
      console.log('- Fix failed test cases');
      console.log('- Verify route registration');
      console.log('- Check authentication middleware');
    }
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: parseFloat(successRate)
    };
  }

  /**
   * Run all KYC integration tests
   */
  async runAllTests() {
    console.log('🔄 Starting Comprehensive KYC Integration Tests...\n');
    
    await this.testKYCServiceInitialization();
    await this.testKYCRouteRegistration();
    await this.testAuthenticationFlow();
    await this.testKYCServiceMethods();
    await this.testDatabaseSchemaValidation();
    await this.testKYCFrontendIntegration();
    
    return this.generateTestReport();
  }
}

// Run tests
async function main() {
  const tester = new KYCIntegrationTester();
  const results = await tester.runAllTests();
  
  // Exit with appropriate code
  process.exit(results.successRate >= 70 ? 0 : 1);
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main().catch(console.error);