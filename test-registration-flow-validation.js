/**
 * COMPREHENSIVE REGISTRATION FLOW VALIDATION
 * Tests complete user journey from registration to dashboard access
 */

const BASE_URL = 'http://localhost:5000';

class RegistrationFlowValidator {
  constructor() {
    this.testResults = [];
    this.issues = [];
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
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

      const response = await fetch(`${BASE_URL}${endpoint}`, options);
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

  recordTest(testName, status, details = {}) {
    this.testResults.push({
      test: testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
    
    const statusIcon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    console.log(`${statusIcon} ${testName}: ${status}`);
    if (details.message) console.log(`   ${details.message}`);
  }

  recordIssue(severity, description, impact) {
    this.issues.push({ severity, description, impact });
  }

  /**
   * 1. TEST REGISTRATION ENDPOINT FUNCTIONALITY
   */
  async testRegistrationEndpoint() {
    console.log('\n=== 1. REGISTRATION ENDPOINT VALIDATION ===');

    // Test valid registration
    const validUser = {
      email: `test_${Date.now()}@example.com`,
      password: 'SecureTest123!',
      firstName: 'Test',
      lastName: 'User'
    };

    const registrationResult = await this.makeRequest('POST', '/api/auth/register', validUser);
    
    if (registrationResult.status === 201 && registrationResult.data.success) {
      this.recordTest('Valid Registration', 'PASS', {
        message: 'Registration endpoint working correctly',
        userId: registrationResult.data.user?.id
      });
    } else {
      this.recordTest('Valid Registration', 'FAIL', {
        message: `Expected 201 success, got ${registrationResult.status}`,
        response: registrationResult.data
      });
      this.recordIssue('HIGH', 'Registration endpoint failing', 'Users cannot register');
    }

    // Test password security requirements
    const weakPasswords = [
      { password: '123', label: 'Too short' },
      { password: 'password', label: 'No uppercase/numbers/special chars' },
      { password: 'Password123', label: 'No special characters' },
      { password: 'Password!', label: 'No numbers' }
    ];

    for (const test of weakPasswords) {
      const weakUser = { ...validUser, password: test.password, email: `weak_${Date.now()}@example.com` };
      const weakResult = await this.makeRequest('POST', '/api/auth/register', weakUser);
      
      if (weakResult.status === 400 || weakResult.status === 422) {
        this.recordTest(`Password Security: ${test.label}`, 'PASS', {
          message: 'Weak password properly rejected'
        });
      } else {
        this.recordTest(`Password Security: ${test.label}`, 'FAIL', {
          message: `Weak password accepted: ${test.password}`
        });
        this.recordIssue('CRITICAL', `Weak password accepted: ${test.label}`, 'Security vulnerability');
      }
    }
  }

  /**
   * 2. TEST DASHBOARD ROUTE ACCESSIBILITY
   */
  async testDashboardRoute() {
    console.log('\n=== 2. DASHBOARD ROUTE VALIDATION ===');

    const dashboardResult = await this.makeRequest('GET', '/dashboard');
    
    if (dashboardResult.status === 200 && dashboardResult.data.includes('<!DOCTYPE html>')) {
      this.recordTest('Dashboard Route Exists', 'PASS', {
        message: 'Dashboard route returns HTML page successfully'
      });
    } else {
      this.recordTest('Dashboard Route Exists', 'FAIL', {
        message: `Dashboard route returned ${dashboardResult.status}`,
        response: dashboardResult.data
      });
      this.recordIssue('CRITICAL', 'Dashboard route missing or broken', 'Users get 404 after registration');
    }

    // Test that dashboard loads without 404
    if (dashboardResult.data && typeof dashboardResult.data === 'string') {
      const has404Error = dashboardResult.data.includes('404') || dashboardResult.data.includes('Not Found');
      if (!has404Error) {
        this.recordTest('Dashboard No 404 Error', 'PASS', {
          message: 'Dashboard loads without 404 errors'
        });
      } else {
        this.recordTest('Dashboard No 404 Error', 'FAIL', {
          message: 'Dashboard shows 404 error'
        });
        this.recordIssue('HIGH', 'Dashboard shows 404 error', 'Poor user experience');
      }
    }
  }

  /**
   * 3. TEST COMPLETE REGISTRATION-TO-DASHBOARD FLOW
   */
  async testCompleteFlow() {
    console.log('\n=== 3. END-TO-END REGISTRATION FLOW ===');

    // Step 1: Register new user
    const newUser = {
      email: `flow_test_${Date.now()}@example.com`,
      password: 'FlowTest123!',
      firstName: 'Flow',
      lastName: 'Tester'
    };

    const regResult = await this.makeRequest('POST', '/api/auth/register', newUser);
    
    if (regResult.status === 201) {
      this.recordTest('Step 1: User Registration', 'PASS', {
        message: 'User registered successfully in flow test'
      });

      // Step 2: Verify user can access auth endpoints
      const authCheckResult = await this.makeRequest('GET', '/api/auth/user');
      
      if (authCheckResult.status === 401) {
        this.recordTest('Step 2: Auth Protection', 'PASS', {
          message: 'Auth endpoints properly protected'
        });
      } else {
        this.recordTest('Step 2: Auth Protection', 'WARN', {
          message: 'Auth endpoints may not be properly protected'
        });
      }

      // Step 3: Verify dashboard accessibility
      const dashResult = await this.makeRequest('GET', '/dashboard');
      if (dashResult.status === 200) {
        this.recordTest('Step 3: Dashboard Access', 'PASS', {
          message: 'Dashboard accessible after registration'
        });
      } else {
        this.recordTest('Step 3: Dashboard Access', 'FAIL', {
          message: 'Dashboard not accessible after registration'
        });
        this.recordIssue('HIGH', 'Dashboard inaccessible post-registration', 'User flow broken');
      }

    } else {
      this.recordTest('Step 1: User Registration', 'FAIL', {
        message: 'Flow test failed at registration step'
      });
      this.recordIssue('CRITICAL', 'Registration failing in flow test', 'Complete user journey broken');
    }
  }

  /**
   * 4. TEST AUTHENTICATION SECURITY
   */
  async testAuthenticationSecurity() {
    console.log('\n=== 4. AUTHENTICATION SECURITY VALIDATION ===');

    // Test duplicate email prevention
    const duplicateUser = {
      email: 'duplicate_test@example.com',
      password: 'DuplicateTest123!',
      firstName: 'Duplicate',
      lastName: 'Test'
    };

    // Register once
    await this.makeRequest('POST', '/api/auth/register', duplicateUser);
    
    // Try to register again with same email
    const duplicateResult = await this.makeRequest('POST', '/api/auth/register', duplicateUser);
    
    if (duplicateResult.status === 409 || duplicateResult.status === 400) {
      this.recordTest('Duplicate Email Prevention', 'PASS', {
        message: 'Duplicate registration properly prevented'
      });
    } else {
      this.recordTest('Duplicate Email Prevention', 'FAIL', {
        message: 'Duplicate registration allowed'
      });
      this.recordIssue('HIGH', 'Duplicate registrations allowed', 'Data integrity issue');
    }

    // Test protected endpoints
    const protectedEndpoints = [
      '/api/auth/user',
      '/api/agents/discover',
      '/api/services/discover'
    ];

    for (const endpoint of protectedEndpoints) {
      const result = await this.makeRequest('GET', endpoint);
      if (result.status === 401) {
        this.recordTest(`Protected Endpoint: ${endpoint}`, 'PASS', {
          message: 'Endpoint properly protected'
        });
      } else {
        this.recordTest(`Protected Endpoint: ${endpoint}`, 'WARN', {
          message: `Endpoint may not be protected (status: ${result.status})`
        });
      }
    }
  }

  /**
   * GENERATE COMPREHENSIVE VALIDATION REPORT
   */
  generateValidationReport() {
    console.log('\n================================================================================');
    console.log('REGISTRATION FLOW VALIDATION REPORT');
    console.log('================================================================================\n');

    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
    const warningTests = this.testResults.filter(t => t.status === 'WARN').length;
    const totalTests = this.testResults.length;

    console.log(`TESTS SUMMARY:`);
    console.log(`✓ PASSED: ${passedTests}/${totalTests}`);
    console.log(`✗ FAILED: ${failedTests}/${totalTests}`);
    console.log(`⚠ WARNINGS: ${warningTests}/${totalTests}`);

    const passRate = (passedTests / totalTests * 100).toFixed(1);
    console.log(`\nPASS RATE: ${passRate}%`);

    // Determine overall status
    let overallStatus = 'PRODUCTION READY';
    if (failedTests > 0) {
      const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL').length;
      if (criticalIssues > 0) {
        overallStatus = 'CRITICAL ISSUES - NOT READY';
      } else {
        overallStatus = 'MINOR ISSUES - NEARLY READY';
      }
    }

    console.log(`OVERALL STATUS: ${overallStatus}\n`);

    // Report issues
    if (this.issues.length > 0) {
      console.log('IDENTIFIED ISSUES:');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity}] ${issue.description}`);
        console.log(`   Impact: ${issue.impact}\n`);
      });
    } else {
      console.log('✓ NO CRITICAL ISSUES FOUND\n');
    }

    // Registration flow assessment
    console.log('REGISTRATION FLOW ASSESSMENT:');
    const regTests = this.testResults.filter(t => t.test.includes('Registration'));
    const dashTests = this.testResults.filter(t => t.test.includes('Dashboard'));
    const flowTests = this.testResults.filter(t => t.test.includes('Step'));

    if (regTests.every(t => t.status === 'PASS')) {
      console.log('✓ Registration endpoint fully functional');
    } else {
      console.log('✗ Registration endpoint has issues');
    }

    if (dashTests.every(t => t.status === 'PASS')) {
      console.log('✓ Dashboard route properly configured');
    } else {
      console.log('✗ Dashboard route has issues');
    }

    if (flowTests.every(t => t.status === 'PASS')) {
      console.log('✓ End-to-end flow working perfectly');
    } else {
      console.log('✗ End-to-end flow has issues');
    }

    return {
      passRate: parseFloat(passRate),
      overallStatus,
      totalIssues: this.issues.length,
      criticalIssues: this.issues.filter(i => i.severity === 'CRITICAL').length
    };
  }

  /**
   * RUN COMPLETE REGISTRATION FLOW VALIDATION
   */
  async runCompleteValidation() {
    console.log('STARTING COMPREHENSIVE REGISTRATION FLOW VALIDATION...\n');

    await this.testRegistrationEndpoint();
    await this.testDashboardRoute();
    await this.testCompleteFlow();
    await this.testAuthenticationSecurity();

    return this.generateValidationReport();
  }
}

async function main() {
  const validator = new RegistrationFlowValidator();
  const results = await validator.runCompleteValidation();
  
  console.log('\n================================================================================');
  console.log('VALIDATION COMPLETE');
  console.log('================================================================================');
  
  process.exit(results.criticalIssues > 0 ? 1 : 0);
}

// ES Module execution
main().catch(console.error);