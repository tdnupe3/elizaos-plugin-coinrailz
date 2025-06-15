/**
 * COMPREHENSIVE PLATFORM AUDIT - CRASH DIAGNOSIS & ROUTE ANALYSIS
 * Identifies all potential error sources causing platform instability
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

class PlatformAuditor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.results = {};
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  }

  addError(category, description, file = null, line = null) {
    this.errors.push({ category, description, file, line, timestamp: new Date() });
  }

  addWarning(category, description, file = null) {
    this.warnings.push({ category, description, file, timestamp: new Date() });
  }

  async auditServerConfiguration() {
    this.log('Auditing server configuration...');
    
    try {
      // Check if server responds to health checks
      const healthCheck = await this.makeRequest('GET', '/');
      if (healthCheck.status !== 200) {
        this.addError('Server', `Health check failed: ${healthCheck.status}`, 'server/index.ts');
      }

      // Test CORS headers
      const corsTest = await this.makeRequest('OPTIONS', '/api/demo/user');
      if (!corsTest.headers['access-control-allow-origin']) {
        this.addWarning('Security', 'CORS headers may not be properly configured');
      }

      // Test rate limiting
      const rateLimitTests = [];
      for (let i = 0; i < 3; i++) {
        rateLimitTests.push(this.makeRequest('GET', '/api/demo/user'));
      }
      const rateLimitResults = await Promise.all(rateLimitTests);
      
      if (rateLimitResults.some(r => r.status === 429)) {
        this.addWarning('Performance', 'Rate limiting may be too aggressive for normal use');
      }

    } catch (error) {
      this.addError('Server', `Server configuration audit failed: ${error.message}`);
    }
  }

  async auditDatabaseConfiguration() {
    this.log('Auditing database configuration...');
    
    try {
      // Test database connection through API endpoints
      const dbTests = [
        { endpoint: '/api/demo/user', description: 'User data retrieval' },
        { endpoint: '/api/demo/balances', description: 'Balance queries' },
        { endpoint: '/api/demo/transactions', description: 'Transaction history' }
      ];

      for (const test of dbTests) {
        const result = await this.makeRequest('GET', test.endpoint);
        if (result.status >= 500) {
          this.addError('Database', `${test.description} failed with ${result.status}`, test.endpoint);
        }
      }

      // Test concurrent database operations
      const concurrentTests = Array(5).fill().map(() => 
        this.makeRequest('POST', '/api/demo/update-balance', { userId: 'test', amount: 1 })
      );
      
      const concurrentResults = await Promise.all(concurrentTests);
      const failures = concurrentResults.filter(r => r.status >= 500).length;
      
      if (failures > 2) {
        this.addError('Database', `High concurrent operation failure rate: ${failures}/5`);
      }

    } catch (error) {
      this.addError('Database', `Database audit failed: ${error.message}`);
    }
  }

  async auditAPIRoutes() {
    this.log('Auditing API route completeness...');
    
    const criticalRoutes = [
      // Authentication
      { method: 'GET', path: '/api/login', expectedStatus: 302, critical: true },
      { method: 'GET', path: '/api/auth/callback', expectedStatus: 200, critical: true },
      { method: 'GET', path: '/api/user', expectedStatus: [200, 401], critical: true },
      { method: 'POST', path: '/api/logout', expectedStatus: 200, critical: true },
      
      // Financial Core
      { method: 'POST', path: '/api/demo/calculate-fee', data: { amount: 100, type: 'send_money' }, expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/demo/send-money', data: { amount: 100, recipient: 'test@test.com' }, expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/p2p/transfer', data: { fromCurrency: 'USD', toCurrency: 'BTC', amount: 100, recipient: 'test@test.com' }, expectedStatus: 200, critical: true },
      
      // Multi-blockchain
      { method: 'GET', path: '/api/xrp/balance', expectedStatus: 200, critical: true },
      { method: 'GET', path: '/api/xrp/network-status', expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/ethereum/create-wallet', data: { userId: 'test' }, expectedStatus: 201, critical: true },
      { method: 'GET', path: '/api/ethereum/gas-price', expectedStatus: 200, critical: true },
      
      // DEX & Trading
      { method: 'GET', path: '/api/dex/quotes?from=ETH&to=USDC&amount=1', expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/dex/swap', data: { fromToken: 'ETH', toToken: 'USDC', amount: 1 }, expectedStatus: 200, critical: true },
      
      // AI Marketplace
      { method: 'GET', path: '/api/ai-agents/marketplace', expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/ai-agents/register', data: { name: 'TestAgent', capabilities: ['test'] }, expectedStatus: 201, critical: true },
      
      // Revenue Systems
      { method: 'GET', path: '/api/revenue/stats', expectedStatus: 200, critical: true },
      { method: 'GET', path: '/api/analytics/dashboard', expectedStatus: 200, critical: true },
      
      // Exchange
      { method: 'GET', path: '/api/ramp/rates', expectedStatus: 200, critical: true },
      { method: 'POST', path: '/api/ramp/buy', data: { amount: 100, currency: 'USD', cryptoCurrency: 'BTC' }, expectedStatus: 200, critical: true }
    ];

    let routeFailures = 0;
    let criticalFailures = 0;

    for (const route of criticalRoutes) {
      try {
        const result = await this.makeRequest(route.method, route.path, route.data);
        const expectedStatuses = Array.isArray(route.expectedStatus) ? route.expectedStatus : [route.expectedStatus];
        
        if (!expectedStatuses.includes(result.status)) {
          routeFailures++;
          if (route.critical) {
            criticalFailures++;
            this.addError('API Routes', `Critical route ${route.method} ${route.path} failed: ${result.status}`, route.path);
          } else {
            this.addWarning('API Routes', `Route ${route.method} ${route.path} unexpected status: ${result.status}`);
          }
        }
      } catch (error) {
        routeFailures++;
        if (route.critical) {
          criticalFailures++;
          this.addError('API Routes', `Critical route ${route.method} ${route.path} error: ${error.message}`, route.path);
        }
      }
    }

    this.results.apiRoutes = {
      totalTested: criticalRoutes.length,
      failures: routeFailures,
      criticalFailures,
      successRate: ((criticalRoutes.length - routeFailures) / criticalRoutes.length * 100).toFixed(1)
    };
  }

  async auditClientComponents() {
    this.log('Auditing client-side functionality...');
    
    try {
      // Check if client can load
      const clientResult = await this.makeRequest('GET', '/');
      if (clientResult.status !== 200) {
        this.addError('Client', `Client application failed to load: ${clientResult.status}`);
      }

      // Check for critical client assets
      const assetChecks = [
        '/assets/index.css',
        '/assets/index.js'
      ];

      for (const asset of assetChecks) {
        try {
          const assetResult = await this.makeRequest('GET', asset);
          if (assetResult.status === 404) {
            this.addWarning('Client', `Asset not found: ${asset}`);
          }
        } catch (error) {
          // Assets might have different names in production, this is just a warning
          this.addWarning('Client', `Could not verify asset: ${asset}`);
        }
      }

    } catch (error) {
      this.addError('Client', `Client audit failed: ${error.message}`);
    }
  }

  async auditHumanReferralDashboard() {
    this.log('Auditing human referral system...');
    
    try {
      // Test referral commission calculation
      const commissionTest = await this.makeRequest('POST', '/api/referrals/calculate-commission', {
        transactionAmount: 1000,
        referralTier: 'basic'
      });

      if (commissionTest.status !== 200) {
        this.addError('Referral System', 'Commission calculation failed');
      } else if (commissionTest.data.rate > 1) {
        this.addWarning('Referral System', 'Commission rate seems high - check profitability');
      }

      // Test for referral link generation endpoint
      const referralLinkTest = await this.makeRequest('POST', '/api/referrals/generate-link', {
        userId: 'test-user'
      });

      if (referralLinkTest.status === 404) {
        this.addWarning('Referral System', 'Referral link generation endpoint missing');
      }

    } catch (error) {
      this.addError('Referral System', `Referral system audit failed: ${error.message}`);
    }
  }

  async auditLazyComponents() {
    this.log('Auditing lazy-loaded components...');
    
    // Check if lazy components have proper error boundaries
    const lazyComponentTests = [
      '/dashboard',
      '/marketplace',
      '/analytics'
    ];

    for (const route of lazyComponentTests) {
      try {
        const result = await this.makeRequest('GET', route);
        if (result.status === 404) {
          this.addWarning('Client Routing', `Route ${route} may not be properly configured`);
        }
      } catch (error) {
        this.addWarning('Client Routing', `Could not test route ${route}: ${error.message}`);
      }
    }
  }

  async auditTypeScriptErrors() {
    this.log('Checking for TypeScript compilation issues...');
    
    try {
      // Check if TypeScript is properly compiled by testing type-sensitive endpoints
      const typeTests = [
        { 
          endpoint: '/api/demo/calculate-fee', 
          data: { amount: "invalid", type: 'send_money' },
          description: 'Type validation for numbers'
        },
        { 
          endpoint: '/api/ai-agents/register', 
          data: { invalidField: true },
          description: 'Type validation for objects'
        }
      ];

      for (const test of typeTests) {
        const result = await this.makeRequest('POST', test.endpoint, test.data);
        if (result.status >= 500) {
          this.addError('TypeScript', `${test.description} causing server errors`);
        } else if (result.status !== 400) {
          this.addWarning('TypeScript', `${test.description} not properly validated`);
        }
      }

    } catch (error) {
      this.addError('TypeScript', `TypeScript audit failed: ${error.message}`);
    }
  }

  async auditDependencies() {
    this.log('Auditing critical dependencies...');
    
    try {
      // Test XRP functionality
      const xrpTest = await this.makeRequest('GET', '/api/xrp/network-status');
      if (xrpTest.status !== 200 || !xrpTest.data.success) {
        this.addError('Dependencies', 'XRP integration not functional');
      }

      // Test Ethereum functionality
      const ethTest = await this.makeRequest('GET', '/api/ethereum/gas-price');
      if (ethTest.status !== 200 || !ethTest.data.success) {
        this.addError('Dependencies', 'Ethereum integration not functional');
      }

      // Test session management
      const sessionTest = await this.makeRequest('GET', '/api/user');
      if (sessionTest.status >= 500) {
        this.addError('Dependencies', 'Session management not functional');
      }

    } catch (error) {
      this.addError('Dependencies', `Dependency audit failed: ${error.message}`);
    }
  }

  async makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ 
              status: res.statusCode, 
              data: JSON.parse(body),
              headers: res.headers 
            });
          } catch {
            resolve({ 
              status: res.statusCode, 
              data: body,
              headers: res.headers 
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  generateReport() {
    this.log('Generating comprehensive audit report...');
    
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE PLATFORM AUDIT REPORT');
    console.log('='.repeat(80));
    
    // Critical Errors
    if (this.errors.length > 0) {
      console.log('\n🔴 CRITICAL ERRORS FOUND:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.category}] ${error.description}`);
        if (error.file) console.log(`   File: ${error.file}`);
        if (error.line) console.log(`   Line: ${error.line}`);
      });
    } else {
      console.log('\n✅ NO CRITICAL ERRORS FOUND');
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.category}] ${warning.description}`);
        if (warning.file) console.log(`   File: ${warning.file}`);
      });
    } else {
      console.log('\n✅ NO WARNINGS');
    }
    
    // API Routes Summary
    if (this.results.apiRoutes) {
      console.log('\n📊 API ROUTES ANALYSIS:');
      console.log(`Total Routes Tested: ${this.results.apiRoutes.totalTested}`);
      console.log(`Success Rate: ${this.results.apiRoutes.successRate}%`);
      console.log(`Critical Failures: ${this.results.apiRoutes.criticalFailures}`);
    }
    
    // Overall Assessment
    console.log('\n' + '='.repeat(80));
    console.log('DEPLOYMENT READINESS ASSESSMENT');
    console.log('='.repeat(80));
    
    const criticalErrorCount = this.errors.length;
    const warningCount = this.warnings.length;
    
    if (criticalErrorCount === 0 && warningCount === 0) {
      console.log('🟢 PLATFORM READY FOR PRODUCTION DEPLOYMENT');
      console.log('✓ All critical systems operational');
      console.log('✓ No blocking issues detected');
      console.log('✓ Security measures validated');
    } else if (criticalErrorCount === 0 && warningCount <= 3) {
      console.log('🟡 PLATFORM MOSTLY READY - MINOR OPTIMIZATIONS RECOMMENDED');
      console.log(`✓ No critical errors (${criticalErrorCount})`);
      console.log(`⚠ Minor warnings to address (${warningCount})`);
    } else if (criticalErrorCount <= 2) {
      console.log('🟠 PLATFORM NEEDS FIXES BEFORE DEPLOYMENT');
      console.log(`⚠ Critical errors to fix (${criticalErrorCount})`);
      console.log(`⚠ Warnings to review (${warningCount})`);
    } else {
      console.log('🔴 PLATFORM NOT READY FOR DEPLOYMENT');
      console.log(`❌ Multiple critical errors (${criticalErrorCount})`);
      console.log(`⚠ Additional warnings (${warningCount})`);
    }
    
    return {
      criticalErrors: criticalErrorCount,
      warnings: warningCount,
      apiRouteSuccessRate: this.results.apiRoutes?.successRate || 0,
      deploymentReady: criticalErrorCount === 0
    };
  }

  async runCompleteAudit() {
    this.log('Starting comprehensive platform audit...');
    
    try {
      await this.auditServerConfiguration();
      await this.auditDatabaseConfiguration();
      await this.auditAPIRoutes();
      await this.auditClientComponents();
      await this.auditHumanReferralDashboard();
      await this.auditLazyComponents();
      await this.auditTypeScriptErrors();
      await this.auditDependencies();
      
      return this.generateReport();
    } catch (error) {
      this.addError('Audit System', `Audit process failed: ${error.message}`);
      return this.generateReport();
    }
  }
}

async function main() {
  const auditor = new PlatformAuditor();
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = await auditor.runCompleteAudit();
  
  process.exit(results.deploymentReady ? 0 : 1);
}

main().catch(console.error);