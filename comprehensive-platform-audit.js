/**
 * COMPREHENSIVE PLATFORM AUDIT - CRASH DIAGNOSIS & ROUTE ANALYSIS
 * Identifies all potential error sources causing platform instability
 */

import fs from 'fs';
import path from 'path';

class PlatformAuditor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.routes = [];
    this.components = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  }

  addError(category, description, file = null, line = null) {
    this.errors.push({
      category,
      description,
      file,
      line,
      severity: 'HIGH'
    });
  }

  addWarning(category, description, file = null) {
    this.warnings.push({
      category,
      description,
      file,
      severity: 'MEDIUM'
    });
  }

  // Audit server configuration and entry points
  auditServerConfiguration() {
    this.log('Auditing server configuration...');
    
    try {
      // Check server/index.ts for port conflicts and initialization issues
      const serverIndex = fs.readFileSync('server/index.ts', 'utf8');
      
      // Look for port configuration
      if (serverIndex.includes('port 5000') || serverIndex.includes(':5000')) {
        this.addWarning('PORT_CONFIG', 'Hardcoded port 5000 may cause EADDRINUSE errors');
      }
      
      // Check for proper error handling
      if (!serverIndex.includes('process.on(\'uncaughtException\'')) {
        this.addError('ERROR_HANDLING', 'Missing uncaught exception handler', 'server/index.ts');
      }
      
      // Check for graceful shutdown
      if (!serverIndex.includes('SIGTERM') || !serverIndex.includes('SIGINT')) {
        this.addError('SHUTDOWN', 'Missing graceful shutdown handlers', 'server/index.ts');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read server/index.ts: ${error.message}`);
    }
  }

  // Audit database configuration
  auditDatabaseConfiguration() {
    this.log('Auditing database configuration...');
    
    try {
      const dbConfig = fs.readFileSync('server/db.ts', 'utf8');
      
      // Check for connection pooling issues
      if (dbConfig.includes('fetchConnectionCache')) {
        this.addWarning('DB_CONFIG', 'fetchConnectionCache deprecated - may cause connection errors');
      }
      
      // Check for proper error handling
      if (!dbConfig.includes('pool.on(\'error\'')) {
        this.addError('DB_ERROR_HANDLING', 'Missing database pool error handling', 'server/db.ts');
      }
      
      // Check for connection timeout configuration
      if (!dbConfig.includes('connectionTimeoutMillis')) {
        this.addWarning('DB_TIMEOUT', 'No connection timeout specified - may cause hanging connections');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read server/db.ts: ${error.message}`);
    }
  }

  // Audit all API routes for potential issues
  auditAPIRoutes() {
    this.log('Auditing API routes...');
    
    try {
      const routesFile = fs.readFileSync('server/routes.ts', 'utf8');
      
      // Extract route definitions
      const routeMatches = routesFile.match(/app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
      if (routeMatches) {
        routeMatches.forEach(match => {
          const [, method, path] = match.match(/app\.(\w+)\(['"`]([^'"`]+)['"`]/);
          this.routes.push({ method: method.toUpperCase(), path });
        });
      }
      
      // Check for missing error handling in routes
      const routeHandlers = routesFile.split('app.').slice(1);
      routeHandlers.forEach((handler, index) => {
        if (!handler.includes('try') && !handler.includes('catch')) {
          this.addWarning('ROUTE_ERROR', `Route handler ${index + 1} missing try/catch blocks`);
        }
        
        if (!handler.includes('res.status(500)')) {
          this.addWarning('ROUTE_ERROR', `Route handler ${index + 1} missing 500 error responses`);
        }
      });
      
      // Check for database operations without error handling
      if (routesFile.includes('await db.') && !routesFile.includes('DatabaseError')) {
        this.addError('DB_ERROR', 'Database operations without proper error handling', 'server/routes.ts');
      }
      
      // Check for missing authentication middleware
      const protectedRoutes = routesFile.match(/app\.(get|post|put|delete|patch)\(['"`][^'"`]*['"`][^,]*,\s*(?!isAuthenticated)/g);
      if (protectedRoutes && protectedRoutes.length > 10) {
        this.addWarning('AUTH', 'Many routes may be missing authentication middleware');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read server/routes.ts: ${error.message}`);
    }
  }

  // Audit React components and routing
  auditClientComponents() {
    this.log('Auditing client components...');
    
    try {
      // Check App.tsx for routing issues
      const appFile = fs.readFileSync('client/src/App.tsx', 'utf8');
      
      // Extract component routes
      const routeMatches = appFile.match(/<Route\s+path=['"`]([^'"`]+)['"`]/g);
      if (routeMatches) {
        routeMatches.forEach(match => {
          const path = match.match(/path=['"`]([^'"`]+)['"`]/)[1];
          this.components.push({ path, type: 'route' });
        });
      }
      
      // Check for lazy loading issues
      if (appFile.includes('LazyLoadWrapper') && !appFile.includes('Suspense')) {
        this.addError('LAZY_LOADING', 'LazyLoadWrapper used without Suspense boundary', 'client/src/App.tsx');
      }
      
      // Check for missing error boundaries
      if (!appFile.includes('ErrorBoundary')) {
        this.addError('ERROR_BOUNDARY', 'Missing error boundary for React components', 'client/src/App.tsx');
      }
      
      // Check for duplicate routes
      const paths = this.components.map(c => c.path);
      const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
      if (duplicates.length > 0) {
        this.addError('ROUTING', `Duplicate routes found: ${duplicates.join(', ')}`, 'client/src/App.tsx');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read client/src/App.tsx: ${error.message}`);
    }
  }

  // Check human referral dashboard specifically
  auditHumanReferralDashboard() {
    this.log('Auditing human referral dashboard...');
    
    try {
      const dashboardFile = fs.readFileSync('client/src/pages/human-referral-dashboard.tsx', 'utf8');
      
      // Check for proper imports
      if (!dashboardFile.includes('import { useQuery }')) {
        this.addError('MISSING_IMPORT', 'Missing useQuery import for data fetching', 'human-referral-dashboard.tsx');
      }
      
      // Check for error handling in queries
      if (dashboardFile.includes('useQuery') && !dashboardFile.includes('isError')) {
        this.addWarning('QUERY_ERROR', 'Query error states not handled', 'human-referral-dashboard.tsx');
      }
      
      // Check for loading states
      if (dashboardFile.includes('useQuery') && !dashboardFile.includes('isLoading')) {
        this.addWarning('LOADING_STATE', 'Query loading states not handled', 'human-referral-dashboard.tsx');
      }
      
      // Check for API endpoint consistency
      if (dashboardFile.includes('/api/') && !dashboardFile.includes('apiRequest')) {
        this.addWarning('API_CALL', 'Direct fetch calls instead of apiRequest utility', 'human-referral-dashboard.tsx');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read human-referral-dashboard.tsx: ${error.message}`);
    }
  }

  // Audit lazy component loading
  auditLazyComponents() {
    this.log('Auditing lazy component configuration...');
    
    try {
      const lazyFile = fs.readFileSync('client/src/lib/lazyComponents.ts', 'utf8');
      
      // Check if HumanReferralDashboard is properly exported
      if (!lazyFile.includes('HumanReferralDashboard')) {
        this.addError('LAZY_EXPORT', 'HumanReferralDashboard not found in lazy components', 'lazyComponents.ts');
      }
      
      // Check for proper lazy import syntax
      const lazyImports = lazyFile.match(/lazy\(\(\) => import\(['"`][^'"`]+['"`]\)/g);
      if (lazyImports) {
        lazyImports.forEach(importStmt => {
          if (!importStmt.includes('@/pages/')) {
            this.addWarning('IMPORT_PATH', `Inconsistent import path: ${importStmt}`);
          }
        });
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read lazyComponents.ts: ${error.message}`);
    }
  }

  // Check for TypeScript errors
  auditTypeScriptErrors() {
    this.log('Checking for TypeScript compilation issues...');
    
    const problemFiles = [
      'server/routes.ts',
      'server/storage.ts',
      'client/src/pages/human-referral-dashboard.tsx',
      'client/src/pages/ai-agent-marketplace.tsx'
    ];
    
    problemFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for common TypeScript issues
        if (content.includes('Property \'') && content.includes('\' does not exist on type')) {
          this.addError('TYPESCRIPT', `Type errors detected in ${file}`, file);
        }
        
        if (content.includes('any') && content.includes('type because expression')) {
          this.addError('TYPESCRIPT', `Implicit any types in ${file}`, file);
        }
        
      } catch (error) {
        this.addWarning('FILE_ACCESS', `Cannot analyze ${file}: ${error.message}`);
      }
    });
  }

  // Check package.json and dependencies
  auditDependencies() {
    this.log('Auditing dependencies and scripts...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check for dev script
      if (!packageJson.scripts || !packageJson.scripts.dev) {
        this.addError('SCRIPTS', 'Missing dev script in package.json');
      }
      
      // Check for critical dependencies
      const criticalDeps = ['express', 'react', 'wouter', '@tanstack/react-query'];
      criticalDeps.forEach(dep => {
        if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
          this.addError('DEPENDENCIES', `Missing critical dependency: ${dep}`);
        }
      });
      
      // Check for conflicting dependencies
      if (packageJson.dependencies && packageJson.dependencies['react-router-dom']) {
        this.addWarning('DEPENDENCIES', 'react-router-dom conflicts with wouter routing');
      }
      
    } catch (error) {
      this.addError('FILE_ACCESS', `Cannot read package.json: ${error.message}`);
    }
  }

  // Generate comprehensive audit report
  generateReport() {
    this.log('Generating comprehensive audit report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        routesFound: this.routes.length,
        componentsFound: this.components.length
      },
      criticalIssues: this.errors.filter(e => e.severity === 'HIGH'),
      warnings: this.warnings,
      routes: this.routes,
      components: this.components,
      recommendations: []
    };
    
    // Generate specific recommendations based on findings
    if (this.errors.some(e => e.category === 'PORT_CONFIG')) {
      report.recommendations.push('Implement dynamic port allocation to prevent EADDRINUSE errors');
    }
    
    if (this.errors.some(e => e.category === 'ERROR_HANDLING')) {
      report.recommendations.push('Add comprehensive error handling and graceful shutdown');
    }
    
    if (this.errors.some(e => e.category === 'TYPESCRIPT')) {
      report.recommendations.push('Fix TypeScript compilation errors before deployment');
    }
    
    if (this.errors.some(e => e.category === 'DB_ERROR_HANDLING')) {
      report.recommendations.push('Implement database connection error recovery');
    }
    
    return report;
  }

  // Run complete audit
  async runCompleteAudit() {
    this.log('Starting comprehensive platform audit...');
    
    // Run all audit functions
    this.auditServerConfiguration();
    this.auditDatabaseConfiguration();
    this.auditAPIRoutes();
    this.auditClientComponents();
    this.auditHumanReferralDashboard();
    this.auditLazyComponents();
    this.auditTypeScriptErrors();
    this.auditDependencies();
    
    const report = this.generateReport();
    
    // Output detailed findings
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE PLATFORM AUDIT REPORT');
    console.log('='.repeat(80));
    
    console.log(`\nSUMMARY:`);
    console.log(`• Critical Errors: ${report.summary.totalErrors}`);
    console.log(`• Warnings: ${report.summary.totalWarnings}`);
    console.log(`• Routes Analyzed: ${report.summary.routesFound}`);
    console.log(`• Components Analyzed: ${report.summary.componentsFound}`);
    
    if (report.criticalIssues.length > 0) {
      console.log(`\nCRITICAL ISSUES (BLOCKING):`);
      report.criticalIssues.forEach((error, index) => {
        console.log(`${index + 1}. ${error.category}: ${error.description}`);
        if (error.file) console.log(`   File: ${error.file}`);
      });
    }
    
    if (report.warnings.length > 0) {
      console.log(`\nWARNINGS:`);
      report.warnings.slice(0, 10).forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.category}: ${warning.description}`);
      });
      if (report.warnings.length > 10) {
        console.log(`   ... and ${report.warnings.length - 10} more warnings`);
      }
    }
    
    console.log(`\nRECOMMENDATIONS:`);
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    if (report.routes.length > 0) {
      console.log(`\nAPI ROUTES FOUND:`);
      report.routes.slice(0, 15).forEach(route => {
        console.log(`• ${route.method} ${route.path}`);
      });
      if (report.routes.length > 15) {
        console.log(`• ... and ${report.routes.length - 15} more routes`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    return report;
  }
}

// Run the audit
async function main() {
  const auditor = new PlatformAuditor();
  const report = await auditor.runCompleteAudit();
  
  // Save report to file
  fs.writeFileSync('audit-report.json', JSON.stringify(report, null, 2));
  console.log('\nDetailed report saved to: audit-report.json');
  
  // Exit with appropriate code
  process.exit(report.summary.totalErrors > 0 ? 1 : 0);
}

main().catch(console.error);