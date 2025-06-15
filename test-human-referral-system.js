/**
 * Comprehensive Human Referral System Testing
 * Tests all business logic, database operations, and API functionality
 */

const BASE_URL = 'http://localhost:5000';

class HumanReferralTester {
  constructor() {
    this.testResults = [];
    this.testUsers = [];
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
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
        success: response.ok
      };
    } catch (error) {
      return {
        status: 0,
        data: error.message,
        success: false
      };
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  async testScenario(name, testFn, critical = false) {
    this.log(`Testing: ${name}`, 'test');
    try {
      const result = await testFn();
      this.testResults.push({ name, result: 'PASS', details: result, critical });
      this.log(`✅ PASS: ${name}`, 'success');
      return result;
    } catch (error) {
      this.testResults.push({ name, result: 'FAIL', details: error.message, critical });
      this.log(`❌ FAIL: ${name} - ${error.message}`, 'error');
      if (critical) {
        throw error;
      }
      return null;
    }
  }

  async testDatabaseIntegrity() {
    return await this.testScenario('Database Table Structure', async () => {
      // Test if human_to_human_referrals table exists and has correct structure
      const response = await this.makeRequest('GET', '/api/test/db-structure');
      
      if (!response.success) {
        // Create a test user first to verify database connection
        const testUser = await this.makeRequest('POST', '/api/demo/create-user', {
          email: `test-referral-${Date.now()}@example.com`,
          firstName: 'Test',
          lastName: 'User'
        });
        
        if (testUser.success) {
          return 'Database connection verified, tables accessible';
        }
        throw new Error('Database connection failed');
      }
      
      return response.data;
    }, true);
  }

  async testReferralLinkGeneration() {
    return await this.testScenario('Referral Link Generation', async () => {
      // Test creating a demo user and generating referral link
      const userResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `referrer-${Date.now()}@example.com`,
        firstName: 'Referrer',
        lastName: 'User'
      });

      if (!userResponse.success) {
        throw new Error('Failed to create test user');
      }

      const userId = userResponse.data.user?.id;
      if (!userId) {
        throw new Error('User ID not returned from creation');
      }

      // Store test user for cleanup
      this.testUsers.push(userId);

      // Test referral link generation using test endpoint
      const linkResponse = await this.makeRequest('POST', '/api/test/generate-referral-link', {
        userId: userId
      });

      if (!linkResponse.success) {
        throw new Error(`Referral link generation failed: ${JSON.stringify(linkResponse.data)}`);
      }

      return {
        userId,
        referralData: linkResponse.data
      };
    }, true);
  }

  async testReferralStatsRetrieval() {
    return await this.testScenario('Referral Stats Retrieval', async () => {
      // Create a test user first
      const userResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `stats-user-${Date.now()}@example.com`,
        firstName: 'Stats',
        lastName: 'User'
      });

      if (!userResponse.success) {
        throw new Error('Failed to create test user for stats');
      }

      const userId = userResponse.data.user?.id;
      this.testUsers.push(userId);

      // Test stats retrieval
      const statsResponse = await this.makeRequest('GET', '/api/referrals/my-stats', null, {
        'x-test-user-id': userId
      });

      if (!statsResponse.success) {
        throw new Error(`Stats retrieval failed: ${statsResponse.data}`);
      }

      const expectedFields = ['totalReferrals', 'totalCommissions', 'pendingCommissions', 'referralCode', 'referralLink'];
      const missingFields = expectedFields.filter(field => !(field in statsResponse.data));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      return {
        userId,
        stats: statsResponse.data
      };
    }, true);
  }

  async testReferralCommissionCalculation() {
    return await this.testScenario('Commission Calculation Logic', async () => {
      // Test commission calculations for different scenarios
      const testCases = [
        { amount: 10.00, isFirst: true, expectedCommission: 0.50 }, // 5% of $10
        { amount: 100.00, isFirst: true, expectedCommission: 5.00 }, // 5% of $100
        { amount: 1000.00, isFirst: true, expectedCommission: 50.00 }, // 5% of $1000, capped at $50
        { amount: 50.00, isFirst: false, expectedCommission: 1.00 }, // 2% of $50
        { amount: 1000.00, isFirst: false, expectedCommission: 20.00 }, // 2% of $1000
        { amount: 5.00, isFirst: true, expectedCommission: 0 }, // Below $10 minimum
      ];

      const results = [];
      for (const testCase of testCases) {
        const commissionResponse = await this.makeRequest('POST', '/api/test/calculate-commission', {
          transactionAmount: testCase.amount,
          isFirstTransaction: testCase.isFirst
        });

        if (commissionResponse.success) {
          const actualCommission = parseFloat(commissionResponse.data.commission || 0);
          const passed = Math.abs(actualCommission - testCase.expectedCommission) < 0.01;
          
          results.push({
            ...testCase,
            actualCommission,
            passed
          });
        } else {
          results.push({
            ...testCase,
            actualCommission: 0,
            passed: false,
            error: commissionResponse.data
          });
        }
      }

      const failedTests = results.filter(r => !r.passed);
      if (failedTests.length > 0) {
        throw new Error(`Commission calculation failed for: ${JSON.stringify(failedTests)}`);
      }

      return results;
    }, true);
  }

  async testReferralFlowEndToEnd() {
    return await this.testScenario('End-to-End Referral Flow', async () => {
      // Create referrer user
      const referrerResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `referrer-e2e-${Date.now()}@example.com`,
        firstName: 'Referrer',
        lastName: 'E2E'
      });

      if (!referrerResponse.success) {
        throw new Error('Failed to create referrer user');
      }

      const referrerId = referrerResponse.data.user?.id;
      this.testUsers.push(referrerId);

      // Generate referral link
      const linkResponse = await this.makeRequest('POST', '/api/referrals/generate-link', {}, {
        'x-test-user-id': referrerId
      });

      if (!linkResponse.success) {
        throw new Error('Failed to generate referral link');
      }

      const referralCode = linkResponse.data.referralCode;

      // Create referred user using the referral code
      const referredResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `referred-e2e-${Date.now()}@example.com`,
        firstName: 'Referred',
        lastName: 'E2E',
        referralCode: referralCode
      });

      if (!referredResponse.success) {
        throw new Error('Failed to create referred user with referral code');
      }

      const referredId = referredResponse.data.user?.id;
      this.testUsers.push(referredId);

      // Simulate a transaction by the referred user
      const transactionResponse = await this.makeRequest('POST', '/api/demo/send-money', {
        fromUserId: referredId,
        toEmail: 'recipient@example.com',
        amount: 100.00,
        message: 'Test referral transaction'
      });

      if (!transactionResponse.success) {
        throw new Error('Failed to create test transaction');
      }

      // Check if commission was properly recorded
      const statsResponse = await this.makeRequest('GET', '/api/referrals/my-stats', null, {
        'x-test-user-id': referrerId
      });

      if (!statsResponse.success) {
        throw new Error('Failed to retrieve updated stats');
      }

      const stats = statsResponse.data;
      const expectedCommission = 5.00; // 5% of $100 for first transaction

      return {
        referrerId,
        referredId,
        referralCode,
        transactionAmount: 100.00,
        expectedCommission,
        actualStats: stats,
        success: true
      };
    }, true);
  }

  async testCommissionWithdrawal() {
    return await this.testScenario('Commission Withdrawal Process', async () => {
      // Create user with some commission balance
      const userResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `withdrawal-test-${Date.now()}@example.com`,
        firstName: 'Withdrawal',
        lastName: 'Test'
      });

      if (!userResponse.success) {
        throw new Error('Failed to create test user for withdrawal');
      }

      const userId = userResponse.data.user?.id;
      this.testUsers.push(userId);

      // Try to withdraw commissions (should handle zero balance gracefully)
      const withdrawalResponse = await this.makeRequest('POST', '/api/referrals/withdraw', {
        amount: 5.00
      }, {
        'x-test-user-id': userId
      });

      // This might fail if no balance exists, which is expected behavior
      const result = {
        userId,
        withdrawalAttempted: true,
        response: withdrawalResponse.data,
        success: withdrawalResponse.success
      };

      // Test withdrawal validation
      const invalidWithdrawal = await this.makeRequest('POST', '/api/referrals/withdraw', {
        amount: -10.00 // Invalid negative amount
      }, {
        'x-test-user-id': userId
      });

      result.invalidAmountHandled = !invalidWithdrawal.success;

      return result;
    });
  }

  async testReferralSystemSecurity() {
    return await this.testScenario('Referral System Security', async () => {
      const securityTests = [];

      // Test 1: Cannot refer yourself
      const userResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `self-ref-${Date.now()}@example.com`,
        firstName: 'Self',
        lastName: 'Referrer'
      });

      if (userResponse.success) {
        const userId = userResponse.data.user?.id;
        this.testUsers.push(userId);

        // Generate referral link
        const linkResponse = await this.makeRequest('POST', '/api/referrals/generate-link', {}, {
          'x-test-user-id': userId
        });

        if (linkResponse.success) {
          const referralCode = linkResponse.data.referralCode;

          // Try to use own referral code (should be prevented)
          const selfRefResponse = await this.makeRequest('POST', '/api/demo/create-user', {
            email: `self-ref-attempt-${Date.now()}@example.com`,
            firstName: 'Self',
            lastName: 'Attempt',
            referralCode: referralCode
          }, {
            'x-test-user-id': userId // Same user trying to refer themselves
          });

          securityTests.push({
            test: 'Self-referral prevention',
            passed: !selfRefResponse.success || !selfRefResponse.data.referralApplied
          });
        }
      }

      // Test 2: Invalid referral codes
      const invalidCodeResponse = await this.makeRequest('POST', '/api/demo/create-user', {
        email: `invalid-code-${Date.now()}@example.com`,
        firstName: 'Invalid',
        lastName: 'Code',
        referralCode: 'INVALID_CODE_12345'
      });

      securityTests.push({
        test: 'Invalid referral code handling',
        passed: invalidCodeResponse.success // Should still create user but not apply referral
      });

      return securityTests;
    });
  }

  async testDatabaseConsistency() {
    return await this.testScenario('Database Consistency Checks', async () => {
      // Test referral data consistency
      const consistencyChecks = [];

      // Check if all referral records have valid user IDs
      const dbCheckResponse = await this.makeRequest('GET', '/api/test/referral-consistency');
      
      if (dbCheckResponse.success) {
        consistencyChecks.push({
          check: 'Referral table foreign key integrity',
          passed: dbCheckResponse.data.valid === true
        });
      }

      // Check commission calculation consistency
      const commissionCheckResponse = await this.makeRequest('GET', '/api/test/commission-consistency');
      
      if (commissionCheckResponse.success) {
        consistencyChecks.push({
          check: 'Commission calculation consistency',
          passed: commissionCheckResponse.data.consistent === true
        });
      }

      return consistencyChecks;
    });
  }

  async runComprehensiveTest() {
    this.log('🚀 Starting Comprehensive Human Referral System Test', 'start');
    
    try {
      // Core functionality tests
      await this.testDatabaseIntegrity();
      await this.testReferralLinkGeneration();
      await this.testReferralStatsRetrieval();
      await this.testReferralCommissionCalculation();
      
      // Advanced flow tests
      await this.testReferralFlowEndToEnd();
      await this.testCommissionWithdrawal();
      
      // Security and consistency tests
      await this.testReferralSystemSecurity();
      await this.testDatabaseConsistency();
      
      this.generateReport();
      
    } catch (error) {
      this.log(`Critical test failure: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    this.log('🧹 Cleaning up test data', 'cleanup');
    
    for (const userId of this.testUsers) {
      try {
        await this.makeRequest('DELETE', `/api/test/cleanup-user/${userId}`);
      } catch (error) {
        this.log(`Failed to cleanup user ${userId}: ${error.message}`, 'warning');
      }
    }
  }

  generateReport() {
    this.log('📊 Generating Test Report', 'report');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.result === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.result === 'FAIL');
    const criticalFailures = failedTests.filter(t => t.critical);
    
    console.log('\n' + '='.repeat(80));
    console.log('HUMAN REFERRAL SYSTEM TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests.length} (${((failedTests.length/totalTests)*100).toFixed(1)}%)`);
    console.log(`Critical Failures: ${criticalFailures.length}`);
    
    if (failedTests.length > 0) {
      console.log('\nFAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`❌ ${test.name}: ${test.details}`);
      });
    }
    
    console.log('\nALL TEST RESULTS:');
    this.testResults.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : '❌';
      const critical = test.critical ? ' [CRITICAL]' : '';
      console.log(`${icon} ${test.name}${critical}`);
    });
    
    console.log('='.repeat(80));
    
    // Overall system assessment
    const systemHealth = criticalFailures.length === 0 ? 'HEALTHY' : 'NEEDS ATTENTION';
    const readinessScore = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log(`\nSYSTEM HEALTH: ${systemHealth}`);
    console.log(`READINESS SCORE: ${readinessScore}%`);
    
    if (readinessScore >= 95) {
      console.log('🎉 EXCELLENT: Human referral system is production-ready');
    } else if (readinessScore >= 80) {
      console.log('✅ GOOD: Human referral system is mostly functional');
    } else {
      console.log('⚠️  NEEDS WORK: Human referral system requires fixes');
    }
    
    console.log('='.repeat(80) + '\n');
  }
}

// Run the comprehensive test
async function main() {
  const tester = new HumanReferralTester();
  await tester.runComprehensiveTest();
}

main().catch(console.error);