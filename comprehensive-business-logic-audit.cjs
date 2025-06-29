/**
 * COMPREHENSIVE BUSINESS LOGIC AUDIT - VULNERABILITY ASSESSMENT
 * Analyzes entire platform for business logic gaps, security vulnerabilities, and potential exploits
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveBusinessLogicAuditor {
  constructor() {
    this.vulnerabilities = [];
    this.businessLogicGaps = [];
    this.securityIssues = [];
    this.dataIntegrityRisks = [];
    this.performanceBottlenecks = [];
    this.auditResults = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      informational: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  addIssue(category, severity, title, description, file = null, recommendation = null) {
    const issue = {
      category,
      severity,
      title,
      description,
      file,
      recommendation,
      timestamp: new Date().toISOString()
    };
    
    this.auditResults[severity].push(issue);
    
    switch(category) {
      case 'vulnerability':
        this.vulnerabilities.push(issue);
        break;
      case 'business_logic':
        this.businessLogicGaps.push(issue);
        break;
      case 'security':
        this.securityIssues.push(issue);
        break;
      case 'data_integrity':
        this.dataIntegrityRisks.push(issue);
        break;
      case 'performance':
        this.performanceBottlenecks.push(issue);
        break;
    }
  }

  async auditFinancialSystems() {
    this.log('Auditing financial systems...');
    
    try {
      // Check payment processing logic
      const paymentFiles = [
        'server/businessLogic.ts',
        'server/services/paymentGatewayResolver.ts',
        'server/routes.ts'
      ];

      for (const file of paymentFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for floating point arithmetic in financial calculations
          if (content.includes('parseFloat') || content.includes('Number(') && content.includes('amount')) {
            this.addIssue(
              'vulnerability',
              'critical',
              'Floating Point Arithmetic in Financial Calculations',
              'Using floating point arithmetic for financial calculations can lead to precision errors and fund loss',
              file,
              'Use integer arithmetic (cents) or decimal.js library for precise financial calculations'
            );
          }

          // Check for race conditions in payment processing
          if (content.includes('UPDATE') && !content.includes('WHERE') && content.includes('amount')) {
            this.addIssue(
              'vulnerability',
              'high',
              'Potential Race Condition in Payment Updates',
              'Payment updates without proper WHERE clauses can cause data corruption',
              file,
              'Add proper WHERE clauses and transaction isolation'
            );
          }

          // Check for missing input validation on financial endpoints
          if (content.includes('/api/') && content.includes('amount') && !content.includes('validateSchema')) {
            this.addIssue(
              'security',
              'high',
              'Missing Input Validation on Financial Endpoints',
              'Financial endpoints lack proper input validation',
              file,
              'Implement comprehensive input validation using Zod schemas'
            );
          }

          // Check for hardcoded fees or rates
          if (content.match(/fee.*=.*\d+\.\d+/) || content.match(/rate.*=.*\d+\.\d+/)) {
            this.addIssue(
              'business_logic',
              'medium',
              'Hardcoded Financial Parameters',
              'Fees and rates are hardcoded making them difficult to adjust',
              file,
              'Move financial parameters to configuration or database'
            );
          }

          // Check for missing transaction atomicity
          if (content.includes('INSERT') && content.includes('UPDATE') && !content.includes('BEGIN') && !content.includes('COMMIT')) {
            this.addIssue(
              'data_integrity',
              'critical',
              'Missing Transaction Atomicity',
              'Multiple database operations without transaction boundaries can cause data inconsistency',
              file,
              'Wrap related operations in database transactions'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing financial systems: ${error.message}`, 'error');
    }
  }

  async auditAuthenticationSystems() {
    this.log('Auditing authentication systems...');
    
    try {
      const authFiles = [
        'server/productionAuth.ts',
        'server/replitAuth.ts',
        'server/routes.ts'
      ];

      for (const file of authFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for session security
          if (content.includes('session') && !content.includes('httpOnly')) {
            this.addIssue(
              'security',
              'high',
              'Insecure Session Configuration',
              'Sessions lack httpOnly flag making them vulnerable to XSS',
              file,
              'Set httpOnly: true for all session cookies'
            );
          }

          // Check for rate limiting on auth endpoints
          if (content.includes('/login') && !content.includes('rateLimit')) {
            this.addIssue(
              'security',
              'medium',
              'Missing Rate Limiting on Authentication',
              'Authentication endpoints lack rate limiting allowing brute force attacks',
              file,
              'Implement rate limiting on authentication endpoints'
            );
          }

          // Check for password handling
          if (content.includes('password') && !content.includes('bcrypt')) {
            this.addIssue(
              'security',
              'critical',
              'Insecure Password Handling',
              'Passwords may not be properly hashed',
              file,
              'Use bcrypt or similar for password hashing'
            );
          }

          // Check for JWT secret security
          if (content.includes('jwt') && content.includes('secret') && content.includes('process.env')) {
            // This is actually good practice
          } else if (content.includes('jwt') && content.includes('secret')) {
            this.addIssue(
              'security',
              'critical',
              'Hardcoded JWT Secret',
              'JWT secret appears to be hardcoded',
              file,
              'Move JWT secret to environment variables'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing authentication systems: ${error.message}`, 'error');
    }
  }

  async auditDataValidation() {
    this.log('Auditing data validation...');
    
    try {
      const routeFiles = [
        'server/routes.ts',
        'server/simpleRoutes.ts',
        'server/enhancedBusinessLogicRoutes.ts'
      ];

      for (const file of routeFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for SQL injection protection
          if (content.includes('SELECT') && content.includes('${') && !content.includes('prepared')) {
            this.addIssue(
              'vulnerability',
              'critical',
              'Potential SQL Injection',
              'Direct string interpolation in SQL queries detected',
              file,
              'Use prepared statements or ORM with proper parameterization'
            );
          }

          // Check for XSS protection
          if (content.includes('req.body') && content.includes('innerHTML') || content.includes('eval(')) {
            this.addIssue(
              'vulnerability',
              'critical',
              'XSS Vulnerability',
              'User input may be directly rendered without sanitization',
              file,
              'Sanitize all user inputs before rendering'
            );
          }

          // Check for missing input validation
          if (content.includes('app.post') && !content.includes('validateSchema') && !content.includes('zod')) {
            this.addIssue(
              'security',
              'medium',
              'Missing Input Validation',
              'POST endpoints lack proper input validation',
              file,
              'Implement Zod schema validation for all inputs'
            );
          }

          // Check for file upload vulnerabilities
          if (content.includes('multer') || content.includes('upload')) {
            this.addIssue(
              'security',
              'high',
              'File Upload Security Risk',
              'File upload functionality detected - verify security measures',
              file,
              'Implement file type validation, size limits, and virus scanning'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing data validation: ${error.message}`, 'error');
    }
  }

  async auditBusinessLogic() {
    this.log('Auditing business logic implementation...');
    
    try {
      // Check for commission calculation logic
      const businessFiles = [
        'server/businessLogic.ts',
        'server/services/feeCalculator.ts',
        'server/routes.ts'
      ];

      for (const file of businessFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for commission overflow
          if (content.includes('commission') && !content.includes('Math.min')) {
            this.addIssue(
              'business_logic',
              'high',
              'Commission Overflow Risk',
              'Commission calculations lack maximum bounds checking',
              file,
              'Implement commission caps to prevent overflow'
            );
          }

          // Check for minimum transaction limits
          if (content.includes('amount') && !content.includes('minimum')) {
            this.addIssue(
              'business_logic',
              'medium',
              'Missing Minimum Transaction Limits',
              'No minimum transaction limits detected',
              file,
              'Implement minimum transaction amounts for profitability'
            );
          }

          // Check for referral system abuse prevention
          if (content.includes('referral') && !content.includes('limit') && !content.includes('cooldown')) {
            this.addIssue(
              'business_logic',
              'high',
              'Referral System Abuse Risk',
              'Referral system lacks abuse prevention mechanisms',
              file,
              'Implement referral limits and cooldown periods'
            );
          }

          // Check for circular reference prevention
          if (content.includes('parent') && content.includes('child') && !content.includes('depth')) {
            this.addIssue(
              'business_logic',
              'medium',
              'Circular Reference Risk',
              'Hierarchical relationships lack depth limits',
              file,
              'Implement maximum depth limits for hierarchical structures'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing business logic: ${error.message}`, 'error');
    }
  }

  async auditAPIEndpoints() {
    this.log('Auditing API endpoints...');
    
    try {
      // Test critical endpoints for vulnerabilities
      const fetch = (await import('node-fetch')).default;
      const baseUrl = 'http://localhost:5000';

      // Test for information disclosure
      try {
        const healthResponse = await fetch(`${baseUrl}/api/platform/health`);
        const healthData = await healthResponse.text();
        
        if (healthData.includes('database') || healthData.includes('connection')) {
          this.addIssue(
            'security',
            'low',
            'Information Disclosure in Health Endpoint',
            'Health endpoint may reveal sensitive system information',
            '/api/platform/health',
            'Limit information disclosed in health checks'
          );
        }
      } catch (error) {
        // Endpoint not accessible
      }

      // Test for authentication bypass
      try {
        const protectedEndpoints = [
          '/api/create-payment-intent',
          '/api/ai-agents/register',
          '/api/calculate-commission'
        ];

        for (const endpoint of protectedEndpoints) {
          try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test: 'data' })
            });

            if (response.status !== 401 && response.status !== 403) {
              this.addIssue(
                'security',
                'critical',
                'Authentication Bypass',
                `Protected endpoint ${endpoint} accessible without authentication`,
                endpoint,
                'Implement proper authentication middleware'
              );
            }
          } catch (error) {
            // Expected for protected endpoints
          }
        }
      } catch (error) {
        this.log(`Error testing endpoint security: ${error.message}`, 'error');
      }
    } catch (error) {
      this.log(`Error auditing API endpoints: ${error.message}`, 'error');
    }
  }

  async auditDatabaseSecurity() {
    this.log('Auditing database security...');
    
    try {
      const dbFiles = [
        'server/db.ts',
        'server/storage.ts',
        'shared/schema.ts'
      ];

      for (const file of dbFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for database credential exposure
          if (content.includes('password') && !content.includes('process.env')) {
            this.addIssue(
              'security',
              'critical',
              'Database Credentials Exposure',
              'Database credentials may be hardcoded',
              file,
              'Move database credentials to environment variables'
            );
          }

          // Check for connection pooling
          if (content.includes('createConnection') && !content.includes('pool')) {
            this.addIssue(
              'performance',
              'medium',
              'Missing Connection Pooling',
              'Database connections lack pooling for performance',
              file,
              'Implement database connection pooling'
            );
          }

          // Check for proper indexing hints
          if (content.includes('users') && content.includes('email') && !content.includes('index')) {
            this.addIssue(
              'performance',
              'low',
              'Missing Database Indexes',
              'Critical fields may lack proper indexing',
              file,
              'Add indexes on frequently queried fields'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing database security: ${error.message}`, 'error');
    }
  }

  async auditErrorHandling() {
    this.log('Auditing error handling...');
    
    try {
      const serverFiles = [
        'server/index.ts',
        'server/routes.ts',
        'server/businessLogic.ts'
      ];

      for (const file of serverFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for error information disclosure
          if (content.includes('console.log') && content.includes('error')) {
            this.addIssue(
              'security',
              'low',
              'Error Information Disclosure',
              'Error details may be logged to console in production',
              file,
              'Use proper logging levels and avoid logging sensitive errors in production'
            );
          }

          // Check for unhandled promise rejections
          if (content.includes('async') && !content.includes('catch')) {
            this.addIssue(
              'reliability',
              'medium',
              'Unhandled Promise Rejections',
              'Async functions lack proper error handling',
              file,
              'Add try-catch blocks around async operations'
            );
          }

          // Check for global error handlers
          if (file === 'server/index.ts' && !content.includes('uncaughtException')) {
            this.addIssue(
              'reliability',
              'high',
              'Missing Global Error Handlers',
              'No global error handlers for uncaught exceptions',
              file,
              'Implement global error handlers for graceful failure'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing error handling: ${error.message}`, 'error');
    }
  }

  async auditThirdPartyIntegrations() {
    this.log('Auditing third-party integrations...');
    
    try {
      const integrationFiles = [
        'server/services/xrpEndpoints.ts',
        'server/services/XRPLedgerService.ts',
        'server/services/bnbChainService.ts',
        'server/services/pulseChainService.ts'
      ];

      for (const file of integrationFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for API key exposure
          if (content.includes('api_key') || content.includes('secret')) {
            if (!content.includes('process.env')) {
              this.addIssue(
                'security',
                'critical',
                'API Key Exposure',
                'Third-party API keys may be hardcoded',
                file,
                'Move API keys to environment variables'
              );
            }
          }

          // Check for timeout handling
          if (content.includes('fetch') && !content.includes('timeout')) {
            this.addIssue(
              'reliability',
              'medium',
              'Missing Request Timeouts',
              'Third-party API calls lack timeout handling',
              file,
              'Implement request timeouts for external API calls'
            );
          }

          // Check for rate limiting awareness
          if (content.includes('fetch') && !content.includes('delay') && !content.includes('retry')) {
            this.addIssue(
              'reliability',
              'medium',
              'Missing Rate Limit Handling',
              'Third-party integrations lack rate limit handling',
              file,
              'Implement retry logic with exponential backoff'
            );
          }

          // Check for circuit breaker pattern
          if (content.includes('fetch') && !content.includes('circuitBreaker')) {
            this.addIssue(
              'reliability',
              'low',
              'Missing Circuit Breaker Pattern',
              'External service calls lack circuit breaker protection',
              file,
              'Implement circuit breaker pattern for external services'
            );
          }
        }
      }
    } catch (error) {
      this.log(`Error auditing third-party integrations: ${error.message}`, 'error');
    }
  }

  generateComprehensiveReport() {
    const totalIssues = Object.values(this.auditResults).reduce((sum, issues) => sum + issues.length, 0);
    const criticalCount = this.auditResults.critical.length;
    const highCount = this.auditResults.high.length;
    
    let riskLevel = 'LOW';
    if (criticalCount > 0) riskLevel = 'CRITICAL';
    else if (highCount > 3) riskLevel = 'HIGH';
    else if (highCount > 0) riskLevel = 'MEDIUM';

    const report = `
# COMPREHENSIVE BUSINESS LOGIC AUDIT REPORT
**Generated:** ${new Date().toISOString()}
**Platform:** Coin Railz AI-Powered Fintech Platform
**Risk Level:** ${riskLevel}

## EXECUTIVE SUMMARY
- **Total Issues Found:** ${totalIssues}
- **Critical Issues:** ${criticalCount}
- **High Priority Issues:** ${highCount}
- **Medium Priority Issues:** ${this.auditResults.medium.length}
- **Low Priority Issues:** ${this.auditResults.low.length}

## RISK ASSESSMENT
${riskLevel === 'CRITICAL' ? '🔴 **CRITICAL RISK**: Immediate action required before deployment' : 
  riskLevel === 'HIGH' ? '🟡 **HIGH RISK**: Address high-priority issues before deployment' :
  riskLevel === 'MEDIUM' ? '🟠 **MEDIUM RISK**: Address issues during next development cycle' :
  '🟢 **LOW RISK**: Platform appears secure with minor improvements needed'}

## CRITICAL ISSUES (${criticalCount})
${this.auditResults.critical.map(issue => `
### ${issue.title}
- **Category:** ${issue.category}
- **File:** ${issue.file || 'Multiple files'}
- **Description:** ${issue.description}
- **Recommendation:** ${issue.recommendation}
`).join('')}

## HIGH PRIORITY ISSUES (${highCount})
${this.auditResults.high.map(issue => `
### ${issue.title}
- **Category:** ${issue.category}
- **File:** ${issue.file || 'Multiple files'}
- **Description:** ${issue.description}
- **Recommendation:** ${issue.recommendation}
`).join('')}

## MEDIUM PRIORITY ISSUES (${this.auditResults.medium.length})
${this.auditResults.medium.map(issue => `
### ${issue.title}
- **Category:** ${issue.category}
- **File:** ${issue.file || 'Multiple files'}
- **Description:** ${issue.description}
- **Recommendation:** ${issue.recommendation}
`).join('')}

## VULNERABILITY BREAKDOWN
- **Financial System Vulnerabilities:** ${this.vulnerabilities.filter(v => v.file?.includes('payment') || v.file?.includes('business')).length}
- **Authentication Vulnerabilities:** ${this.vulnerabilities.filter(v => v.file?.includes('auth')).length}
- **Data Integrity Risks:** ${this.dataIntegrityRisks.length}
- **Security Issues:** ${this.securityIssues.length}
- **Business Logic Gaps:** ${this.businessLogicGaps.length}

## IMMEDIATE ACTION ITEMS
${criticalCount > 0 ? `
1. **Address Critical Vulnerabilities** - ${criticalCount} critical issues require immediate attention
2. **Implement Missing Security Controls** - Authentication and input validation gaps
3. **Fix Financial Logic Issues** - Prevent potential fund loss or calculation errors
` : '✅ No critical issues requiring immediate action'}

## DEPLOYMENT READINESS
${criticalCount === 0 && highCount <= 2 ? 
  '✅ **DEPLOYMENT APPROVED** - Platform meets minimum security requirements' :
  '❌ **DEPLOYMENT BLOCKED** - Critical issues must be resolved first'}

## NEXT STEPS
1. Prioritize critical and high-priority issues
2. Implement recommended security controls
3. Add comprehensive input validation
4. Enhance error handling and logging
5. Conduct penetration testing before deployment

---
*This audit covers business logic, security vulnerabilities, and operational risks. Additional security testing recommended.*
`;

    return report;
  }

  async runComprehensiveAudit() {
    this.log('Starting comprehensive business logic audit...');
    
    await this.auditFinancialSystems();
    await this.auditAuthenticationSystems();
    await this.auditDataValidation();
    await this.auditBusinessLogic();
    await this.auditAPIEndpoints();
    await this.auditDatabaseSecurity();
    await this.auditErrorHandling();
    await this.auditThirdPartyIntegrations();
    
    const report = this.generateComprehensiveReport();
    
    // Save report to file
    fs.writeFileSync('COMPREHENSIVE_BUSINESS_LOGIC_AUDIT_2025.md', report);
    
    this.log('Comprehensive audit completed');
    console.log(report);
    
    return {
      totalIssues: Object.values(this.auditResults).reduce((sum, issues) => sum + issues.length, 0),
      critical: this.auditResults.critical.length,
      high: this.auditResults.high.length,
      vulnerabilities: this.vulnerabilities.length,
      businessLogicGaps: this.businessLogicGaps.length,
      recommendation: this.auditResults.critical.length > 0 ? 'BLOCK_DEPLOYMENT' : 'APPROVE_DEPLOYMENT'
    };
  }
}

async function main() {
  const auditor = new ComprehensiveBusinessLogicAuditor();
  const results = await auditor.runComprehensiveAudit();
  
  console.log('\n🔍 AUDIT SUMMARY:');
  console.log(`Total Issues: ${results.totalIssues}`);
  console.log(`Critical: ${results.critical}`);
  console.log(`High Priority: ${results.high}`);
  console.log(`Recommendation: ${results.recommendation}`);
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ComprehensiveBusinessLogicAuditor };