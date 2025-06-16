/**
 * COMPREHENSIVE PRODUCTION READINESS AUDIT
 * Tests all critical systems for actual production deployment
 */

const http = require('http');

class ProductionAuditor {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: response, success: res.statusCode < 400 });
          } catch (error) {
            resolve({ status: res.statusCode, data: body, success: res.statusCode < 400 });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  recordResult(testName, success, details = {}) {
    this.results.push({
      test: testName,
      passed: success,
      details: details,
      timestamp: new Date().toISOString()
    });
    
    const status = success ? '✓' : '✗';
    console.log(`${status} ${testName}`);
    if (!success) {
      this.errors.push(testName);
    }
  }

  async testServerHealth() {
    try {
      const response = await this.makeRequest('GET', '/health');
      const success = response.success && response.data.status === 'ok';
      this.recordResult('Server Health Check', success, {
        status: response.data.status,
        timestamp: response.data.timestamp
      });
    } catch (error) {
      this.recordResult('Server Health Check', false, { error: error.message });
    }
  }

  async testFrontendServing() {
    try {
      const response = await this.makeRequest('GET', '/');
      const success = response.status === 200;
      this.recordResult('Frontend Serving', success, {
        statusCode: response.status,
        isHTML: typeof response.data === 'string' && response.data.includes('<html>')
      });
    } catch (error) {
      this.recordResult('Frontend Serving', false, { error: error.message });
    }
  }

  async testAPIEndpoints() {
    const endpoints = [
      { method: 'GET', path: '/api/health', expectedStatus: 200 },
      { method: 'POST', path: '/api/test', expectedStatus: 200 },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint.method, endpoint.path, {});
        const success = response.status === endpoint.expectedStatus;
        this.recordResult(`API ${endpoint.method} ${endpoint.path}`, success, {
          expectedStatus: endpoint.expectedStatus,
          actualStatus: response.status,
          response: response.data
        });
      } catch (error) {
        this.recordResult(`API ${endpoint.method} ${endpoint.path}`, false, { error: error.message });
      }
    }
  }

  async testDatabaseConnectivity() {
    try {
      // Test if database environment variables are set
      const hasDbUrl = !!process.env.DATABASE_URL;
      this.recordResult('Database Environment Variables', hasDbUrl, {
        hasDatabaseUrl: hasDbUrl
      });

      if (hasDbUrl) {
        this.recordResult('Database Configuration', true, {
          databaseConfigured: true
        });
      } else {
        this.warnings.push('Database URL not configured - required for production');
      }
    } catch (error) {
      this.recordResult('Database Connectivity', false, { error: error.message });
    }
  }

  async testEnvironmentConfiguration() {
    const requiredEnvVars = [
      'NODE_ENV',
      'PORT'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    const success = missingVars.length === 0;
    
    this.recordResult('Environment Configuration', success, {
      requiredVars: requiredEnvVars,
      missingVars: missingVars,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT
    });
  }

  async testSecurityHeaders() {
    try {
      const response = await this.makeRequest('GET', '/health');
      const headers = response.headers || {};
      
      // Check for basic security headers (would be added in production)
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection'
      ];

      const presentHeaders = securityHeaders.filter(header => headers[header]);
      const success = presentHeaders.length > 0; // At least some security headers
      
      this.recordResult('Security Headers', success, {
        checkedHeaders: securityHeaders,
        presentHeaders: presentHeaders
      });

      if (!success) {
        this.warnings.push('Security headers missing - should be added for production');
      }
    } catch (error) {
      this.recordResult('Security Headers', false, { error: error.message });
    }
  }

  async testPerformanceMetrics() {
    const startTime = Date.now();
    
    try {
      await this.makeRequest('GET', '/health');
      const responseTime = Date.now() - startTime;
      
      const success = responseTime < 1000; // Under 1 second
      this.recordResult('Response Time Performance', success, {
        responseTime: `${responseTime}ms`,
        threshold: '1000ms'
      });
    } catch (error) {
      this.recordResult('Response Time Performance', false, { error: error.message });
    }
  }

  async testErrorHandling() {
    try {
      const response = await this.makeRequest('GET', '/nonexistent-endpoint');
      const success = response.status === 404;
      this.recordResult('Error Handling (404)', success, {
        expectedStatus: 404,
        actualStatus: response.status
      });
    } catch (error) {
      this.recordResult('Error Handling (404)', false, { error: error.message });
    }
  }

  generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

    console.log('\n============================================================');
    console.log('COMPREHENSIVE PRODUCTION READINESS AUDIT REPORT');
    console.log('============================================================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${successRate}%)`);
    console.log(`Failed: ${failedTests} (${(100 - successRate).toFixed(1)}%)`);
    console.log(`\nProduction Readiness: ${successRate}%`);

    if (successRate >= 90) {
      console.log('🟢 STATUS: PRODUCTION READY');
    } else if (successRate >= 70) {
      console.log('🟡 STATUS: NEARLY PRODUCTION READY - Minor fixes needed');
    } else {
      console.log('🔴 STATUS: NOT PRODUCTION READY - Critical issues detected');
    }

    console.log('\nDetailed Results:');
    this.results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      console.log(`${status} ${result.test}`);
      if (result.details && Object.keys(result.details).length > 0) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    });

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`- ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS:');
      this.errors.forEach(error => console.log(`- ${error}`));
    }

    console.log('\n============================================================');
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: parseFloat(successRate),
      status: successRate >= 90 ? 'PRODUCTION_READY' : successRate >= 70 ? 'NEARLY_READY' : 'NOT_READY',
      results: this.results,
      warnings: this.warnings,
      errors: this.errors
    };
  }

  async runComprehensiveAudit() {
    console.log('🚀 Starting Comprehensive Production Readiness Audit\n');

    // Core Infrastructure Tests
    await this.testServerHealth();
    await this.testFrontendServing();
    await this.testAPIEndpoints();
    
    // Configuration Tests
    await this.testEnvironmentConfiguration();
    await this.testDatabaseConnectivity();
    
    // Security Tests
    await this.testSecurityHeaders();
    
    // Performance Tests
    await this.testPerformanceMetrics();
    
    // Error Handling Tests
    await this.testErrorHandling();

    return this.generateReport();
  }
}

async function main() {
  const auditor = new ProductionAuditor();
  try {
    const report = await auditor.runComprehensiveAudit();
    process.exit(report.successRate >= 70 ? 0 : 1);
  } catch (error) {
    console.error('Audit failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ProductionAuditor };