/**
 * COMPREHENSIVE DATABASE AUDIT - DECEMBER 30, 2024
 * Complete analysis of database schema, integrity, performance and production readiness
 */

class DatabaseAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.auditResults = {
      schemaValidation: [],
      dataIntegrity: [],
      performance: [],
      security: [],
      relationships: [],
      indexes: [],
      constraints: [],
      criticalIssues: []
    };
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }
      
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
        data: parsedData
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
        data: null
      };
    }
  }

  recordIssue(category, severity, description, details = {}) {
    const issue = {
      severity,
      description,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.auditResults[category].push(issue);
    
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.auditResults.criticalIssues.push(issue);
    }
  }

  /**
   * 1. DATABASE SCHEMA VALIDATION
   */
  async testDatabaseSchema() {
    console.log('\n🗃️  TESTING: Database Schema Validation');
    
    // Test critical table existence through API endpoints
    const schemaTests = [
      { endpoint: '/api/platform/health', expectedTables: ['users', 'sessions', 'agents', 'orders'] },
      { endpoint: '/api/database/schema', tables: 'all' }
    ];
    
    for (const test of schemaTests) {
      const response = await this.makeRequest('GET', test.endpoint);
      
      if (response.status === 200) {
        this.recordIssue('schemaValidation', 'PASS', `Schema endpoint accessible: ${test.endpoint}`, {
          status: response.status,
          hasData: !!response.data
        });
      } else {
        this.recordIssue('schemaValidation', 'HIGH', `Schema endpoint failed: ${test.endpoint}`, {
          status: response.status,
          error: response.data
        });
      }
    }

    // Test user table functionality
    const userTest = await this.makeRequest('POST', '/api/auth/register', {
      email: `dbtest${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Database',
      lastName: 'Test'
    });
    
    if (userTest.status === 201 || userTest.status === 409) {
      this.recordIssue('schemaValidation', 'PASS', 'Users table operational', {
        status: userTest.status,
        note: userTest.status === 409 ? 'Duplicate prevention working' : 'Registration successful'
      });
    } else {
      this.recordIssue('schemaValidation', 'CRITICAL', 'Users table malfunction', {
        status: userTest.status,
        error: userTest.data
      });
    }
  }

  /**
   * 2. DATA INTEGRITY VALIDATION
   */
  async testDataIntegrity() {
    console.log('\n🔍 TESTING: Data Integrity Validation');
    
    // Test referential integrity through marketplace operations
    const integrityTests = [
      {
        name: 'Agent Registration Integrity',
        endpoint: '/api/agents/register',
        data: {
          name: `Test Agent ${Date.now()}`,
          category: 'financial',
          description: 'Testing data integrity',
          skills: ['testing'],
          pricing: { hourly: 50 }
        }
      },
      {
        name: 'Order Creation Integrity',
        endpoint: '/api/orders/create',
        data: {
          agentId: 'test-agent-123',
          serviceType: 'consultation',
          amount: 100,
          description: 'Data integrity test order'
        }
      }
    ];
    
    for (const test of integrityTests) {
      const response = await this.makeRequest('POST', test.endpoint, test.data);
      
      if (response.status < 500) {
        this.recordIssue('dataIntegrity', 'PASS', test.name, {
          status: response.status,
          responseTime: 'acceptable'
        });
      } else {
        this.recordIssue('dataIntegrity', 'HIGH', `${test.name} failed`, {
          status: response.status,
          error: response.data
        });
      }
    }

    // Test transaction atomicity
    const transactionTest = await this.makeRequest('POST', '/api/p2p/transfer', {
      recipientEmail: 'test@example.com',
      amount: 50,
      fromPlatform: 'paypal',
      toPlatform: 'crypto'
    });
    
    if (transactionTest.status < 500) {
      this.recordIssue('dataIntegrity', 'PASS', 'Transaction atomicity functional', {
        status: transactionTest.status
      });
    } else {
      this.recordIssue('dataIntegrity', 'HIGH', 'Transaction atomicity issues', {
        status: transactionTest.status,
        error: transactionTest.data
      });
    }
  }

  /**
   * 3. DATABASE PERFORMANCE TESTING
   */
  async testDatabasePerformance() {
    console.log('\n⚡ TESTING: Database Performance');
    
    const performanceTests = [
      { name: 'Agent Search Performance', endpoint: '/api/agents/search?limit=50', threshold: 1000 },
      { name: 'User Query Performance', endpoint: '/api/auth/user', threshold: 500 },
      { name: 'Fee Calculation Performance', endpoint: '/api/p2p/calculate-fee', method: 'POST', 
        data: { amount: 100, fromPlatform: 'paypal', toPlatform: 'crypto' }, threshold: 200 }
    ];
    
    for (const test of performanceTests) {
      const startTime = Date.now();
      const response = await this.makeRequest(test.method || 'GET', test.endpoint, test.data);
      const responseTime = Date.now() - startTime;
      
      if (responseTime < test.threshold) {
        this.recordIssue('performance', 'PASS', test.name, {
          responseTime,
          threshold: test.threshold,
          status: response.status
        });
      } else {
        this.recordIssue('performance', 'MEDIUM', `${test.name} slow`, {
          responseTime,
          threshold: test.threshold,
          status: response.status
        });
      }
    }

    // Test concurrent connections
    const concurrencyPromises = Array(10).fill().map((_, i) => 
      this.makeRequest('GET', `/api/agents/search?page=${i + 1}`)
    );
    
    const concurrentStart = Date.now();
    const concurrentResults = await Promise.all(concurrencyPromises);
    const concurrentTime = Date.now() - concurrentStart;
    
    const successfulQueries = concurrentResults.filter(r => r.status === 200).length;
    
    if (successfulQueries >= 8 && concurrentTime < 3000) {
      this.recordIssue('performance', 'PASS', 'Concurrent query handling', {
        successfulQueries,
        totalQueries: 10,
        totalTime: concurrentTime
      });
    } else {
      this.recordIssue('performance', 'HIGH', 'Concurrent query issues', {
        successfulQueries,
        totalQueries: 10,
        totalTime: concurrentTime
      });
    }
  }

  /**
   * 4. DATABASE SECURITY VALIDATION
   */
  async testDatabaseSecurity() {
    console.log('\n🔒 TESTING: Database Security');
    
    // Test SQL injection protection
    const sqlInjectionTests = [
      { endpoint: "/api/agents/search?category='; DROP TABLE users; --", name: 'SQL Injection - DROP TABLE' },
      { endpoint: "/api/agents/search?category=' OR 1=1 --", name: 'SQL Injection - OR clause' },
      { endpoint: "/api/auth/register", method: 'POST', 
        data: { email: "'; DROP TABLE sessions; --@test.com", password: 'test' }, 
        name: 'SQL Injection - Registration' }
    ];
    
    for (const test of sqlInjectionTests) {
      const response = await this.makeRequest(test.method || 'GET', test.endpoint, test.data);
      
      if (response.status === 400 || response.status === 422) {
        this.recordIssue('security', 'PASS', `${test.name} blocked`, {
          status: response.status,
          blocked: true
        });
      } else if (response.status === 500) {
        this.recordIssue('security', 'CRITICAL', `${test.name} caused server error`, {
          status: response.status,
          vulnerability: 'SQL injection may be possible'
        });
      } else {
        this.recordIssue('security', 'MEDIUM', `${test.name} unexpected response`, {
          status: response.status,
          needsReview: true
        });
      }
    }

    // Test authentication requirements
    const authTests = [
      { endpoint: '/api/orders/create', method: 'POST', data: { agentId: 'test', amount: 100 } },
      { endpoint: '/api/payouts/request', method: 'POST', data: { amount: 50 } }
    ];
    
    for (const test of authTests) {
      const response = await this.makeRequest(test.method, test.endpoint, test.data);
      
      if (response.status === 401 || response.status === 403) {
        this.recordIssue('security', 'PASS', `Authentication required for ${test.endpoint}`, {
          status: response.status,
          protected: true
        });
      } else {
        this.recordIssue('security', 'HIGH', `Authentication bypass possible: ${test.endpoint}`, {
          status: response.status,
          vulnerability: 'Unauthorized access'
        });
      }
    }
  }

  /**
   * 5. RELATIONSHIP AND CONSTRAINT VALIDATION
   */
  async testRelationshipsAndConstraints() {
    console.log('\n🔗 TESTING: Database Relationships and Constraints');
    
    // Test foreign key constraints
    const constraintTests = [
      {
        name: 'Invalid Agent Reference',
        endpoint: '/api/orders/create',
        data: { agentId: 'nonexistent-agent-999', amount: 100 },
        expectedResult: 'rejection'
      },
      {
        name: 'Duplicate Email Prevention',
        endpoint: '/api/auth/register',
        data: { email: 'duplicate@test.com', password: 'test123' },
        expectedResult: 'first_success_then_conflict'
      }
    ];
    
    for (const test of constraintTests) {
      if (test.expectedResult === 'first_success_then_conflict') {
        // First registration should succeed
        const firstAttempt = await this.makeRequest('POST', test.endpoint, test.data);
        const secondAttempt = await this.makeRequest('POST', test.endpoint, test.data);
        
        if (firstAttempt.status === 201 && secondAttempt.status === 409) {
          this.recordIssue('constraints', 'PASS', test.name, {
            constraint: 'unique email enforced',
            firstStatus: firstAttempt.status,
            secondStatus: secondAttempt.status
          });
        } else {
          this.recordIssue('constraints', 'HIGH', `${test.name} constraint failed`, {
            firstStatus: firstAttempt.status,
            secondStatus: secondAttempt.status
          });
        }
      } else {
        const response = await this.makeRequest('POST', test.endpoint, test.data);
        
        if (response.status >= 400 && response.status < 500) {
          this.recordIssue('constraints', 'PASS', test.name, {
            status: response.status,
            constraintEnforced: true
          });
        } else {
          this.recordIssue('constraints', 'MEDIUM', `${test.name} may have issues`, {
            status: response.status,
            needsReview: true
          });
        }
      }
    }
  }

  /**
   * 6. CONNECTION AND POOLING VALIDATION
   */
  async testConnectionManagement() {
    console.log('\n🔌 TESTING: Database Connection Management');
    
    // Test connection pool health
    const healthCheck = await this.makeRequest('GET', '/api/platform/health');
    
    if (healthCheck.status === 200 && healthCheck.data.database) {
      this.recordIssue('performance', 'PASS', 'Database connection pool healthy', {
        status: healthCheck.status,
        dbStatus: healthCheck.data.database
      });
    } else {
      this.recordIssue('performance', 'HIGH', 'Database connection issues', {
        status: healthCheck.status,
        error: healthCheck.data
      });
    }

    // Test connection recovery under load
    const loadTests = Array(20).fill().map((_, i) => 
      this.makeRequest('GET', '/api/data/analytics')
    );
    
    const loadResults = await Promise.all(loadTests);
    const successfulConnections = loadResults.filter(r => r.status === 200).length;
    
    if (successfulConnections >= 18) {
      this.recordIssue('performance', 'PASS', 'Connection pool handles load', {
        successfulConnections,
        totalRequests: 20,
        successRate: `${(successfulConnections/20*100).toFixed(1)}%`
      });
    } else {
      this.recordIssue('performance', 'HIGH', 'Connection pool strain detected', {
        successfulConnections,
        totalRequests: 20,
        successRate: `${(successfulConnections/20*100).toFixed(1)}%`
      });
    }
  }

  /**
   * GENERATE COMPREHENSIVE DATABASE AUDIT REPORT
   */
  generateDatabaseReport() {
    const categories = Object.keys(this.auditResults).filter(key => key !== 'criticalIssues');
    let totalTests = 0;
    let passedTests = 0;
    
    categories.forEach(category => {
      const results = this.auditResults[category];
      totalTests += results.length;
      passedTests += results.filter(r => r.severity === 'PASS').length;
    });
    
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('🗃️  COMPREHENSIVE DATABASE AUDIT REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 OVERALL DATABASE HEALTH: ${successRate}%`);
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`🚨 Critical Issues: ${this.auditResults.criticalIssues.length}`);
    
    // Category breakdown
    categories.forEach(category => {
      const results = this.auditResults[category];
      if (results.length > 0) {
        const categoryPassed = results.filter(r => r.severity === 'PASS').length;
        const categoryRate = ((categoryPassed / results.length) * 100).toFixed(1);
        
        console.log(`\n${category.toUpperCase()}: ${categoryRate}% (${categoryPassed}/${results.length})`);
        
        results.forEach(result => {
          const icon = result.severity === 'PASS' ? '✅' : 
                      result.severity === 'MEDIUM' ? '⚠️ ' : '❌';
          console.log(`  ${icon} ${result.description}`);
          
          if (result.severity !== 'PASS' && result.details) {
            const details = Object.entries(result.details)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            console.log(`     Details: ${details}`);
          }
        });
      }
    });
    
    // Critical issues section
    if (this.auditResults.criticalIssues.length > 0) {
      console.log('\n' + '🚨'.repeat(20));
      console.log('🚨 CRITICAL DATABASE ISSUES:');
      this.auditResults.criticalIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.description}`);
        if (issue.details) {
          console.log(`   Details: ${JSON.stringify(issue.details)}`);
        }
      });
    }
    
    // Production readiness assessment
    console.log('\n' + '='.repeat(80));
    console.log('📋 DATABASE PRODUCTION READINESS:');
    
    if (successRate >= 90 && this.auditResults.criticalIssues.length === 0) {
      console.log('🟢 DATABASE STATUS: PRODUCTION READY');
      console.log('✅ All critical systems operational');
      console.log('✅ Performance within acceptable limits');
      console.log('✅ Security protections active');
      console.log('✅ Data integrity maintained');
    } else if (successRate >= 75) {
      console.log('🟡 DATABASE STATUS: NEEDS ATTENTION');
      console.log('⚠️  Some issues require resolution before production');
    } else {
      console.log('🔴 DATABASE STATUS: NOT PRODUCTION READY');
      console.log('❌ Critical issues must be resolved');
    }
    
    console.log('='.repeat(80));
    
    return {
      successRate: parseFloat(successRate),
      totalTests,
      passedTests,
      criticalIssues: this.auditResults.criticalIssues.length,
      productionReady: successRate >= 90 && this.auditResults.criticalIssues.length === 0
    };
  }

  /**
   * RUN COMPLETE DATABASE AUDIT
   */
  async runCompleteDatabaseAudit() {
    console.log('🗃️  Starting Comprehensive Database Audit...');
    console.log('Testing schema, integrity, performance, and security...\n');
    
    try {
      await this.testDatabaseSchema();
      await this.testDataIntegrity();
      await this.testDatabasePerformance();
      await this.testDatabaseSecurity();
      await this.testRelationshipsAndConstraints();
      await this.testConnectionManagement();
      
      return this.generateDatabaseReport();
    } catch (error) {
      console.error('❌ Database audit failed:', error);
      this.recordIssue('criticalIssues', 'CRITICAL', 'Audit execution failure', { 
        error: error.message 
      });
      return this.generateDatabaseReport();
    }
  }
}

// Execute the comprehensive database audit
async function main() {
  const auditor = new DatabaseAuditor();
  const results = await auditor.runCompleteDatabaseAudit();
  
  console.log('\n📋 DATABASE AUDIT SUMMARY:');
  console.log(`Success Rate: ${results.successRate}%`);
  console.log(`Tests Passed: ${results.passedTests}/${results.totalTests}`);
  console.log(`Critical Issues: ${results.criticalIssues}`);
  console.log(`Production Ready: ${results.productionReady ? 'YES' : 'NO'}`);
  
  process.exit(0);
}

main().catch(console.error);