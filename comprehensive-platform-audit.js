/**
 * COMPREHENSIVE PLATFORM AUDIT - CRASH DIAGNOSIS & ROUTE ANALYSIS
 * Identifies all potential error sources causing platform instability
 */

import fs from 'fs';
import path from 'path';

class PlatformAuditor {
  constructor() {
    this.results = {
      serverConfiguration: { status: 'unknown', issues: [], warnings: [] },
      databaseConfiguration: { status: 'unknown', issues: [], warnings: [] },
      apiRoutes: { working: [], failing: [], total: 0 },
      clientComponents: { working: [], failing: [], total: 0 },
      humanReferralDashboard: { status: 'unknown', issues: [] },
      lazyComponents: { loaded: [], failed: [], total: 0 },
      typeScriptErrors: [],
      dependencies: { missing: [], conflicts: [] }
    };
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  }

  addError(category, description, file = null, line = null) {
    this.errors.push({ category, description, file, line, timestamp: new Date().toISOString() });
    this.log(`ERROR in ${category}: ${description}${file ? ` (${file}${line ? `:${line}` : ''})` : ''}`, 'error');
  }

  addWarning(category, description, file = null) {
    this.warnings.push({ category, description, file, timestamp: new Date().toISOString() });
    this.log(`WARNING in ${category}: ${description}${file ? ` (${file})` : ''}`, 'warn');
  }

  async auditServerConfiguration() {
    this.log('Auditing server configuration...');
    
    try {
      // Check main server file
      const serverIndexPath = './server/index.ts';
      if (!fs.existsSync(serverIndexPath)) {
        this.addError('SERVER_CONFIG', 'Main server file missing', serverIndexPath);
        return;
      }

      const serverContent = fs.readFileSync(serverIndexPath, 'utf-8');
      
      // Check for essential imports
      const requiredImports = [
        'express',
        'setupVite',
        'setupSimpleRoutes',
        'registerDEXProductionRoutes'
      ];

      for (const importName of requiredImports) {
        if (!serverContent.includes(importName)) {
          this.addError('SERVER_CONFIG', `Missing essential import: ${importName}`, serverIndexPath);
        }
      }

      // Check for proper middleware setup
      const middlewareChecks = [
        { pattern: 'express.json', name: 'JSON parsing middleware' },
        { pattern: 'setupVite', name: 'Vite setup' },
        { pattern: 'app.listen', name: 'Server listening' }
      ];

      for (const check of middlewareChecks) {
        if (!serverContent.includes(check.pattern)) {
          this.addError('SERVER_CONFIG', `Missing ${check.name}`, serverIndexPath);
        }
      }

      this.results.serverConfiguration.status = 'checked';
      this.log('Server configuration audit completed');

    } catch (error) {
      this.addError('SERVER_CONFIG', `Audit failed: ${error.message}`);
    }
  }

  async auditDatabaseConfiguration() {
    this.log('Auditing database configuration...');
    
    try {
      // Check database files
      const dbFiles = [
        './server/db.ts',
        './shared/schema.ts',
        './drizzle.config.ts'
      ];

      for (const file of dbFiles) {
        if (!fs.existsSync(file)) {
          this.addError('DATABASE_CONFIG', `Missing database file`, file);
        } else {
          const content = fs.readFileSync(file, 'utf-8');
          if (file.includes('schema.ts') && !content.includes('pgTable')) {
            this.addWarning('DATABASE_CONFIG', 'Schema file may be incomplete', file);
          }
        }
      }

      // Check environment variables
      if (!process.env.DATABASE_URL) {
        this.addError('DATABASE_CONFIG', 'DATABASE_URL environment variable missing');
      }

      this.results.databaseConfiguration.status = 'checked';
      this.log('Database configuration audit completed');

    } catch (error) {
      this.addError('DATABASE_CONFIG', `Database audit failed: ${error.message}`);
    }
  }

  async auditAPIRoutes() {
    this.log('Auditing API routes...');
    
    const criticalEndpoints = [
      { method: 'GET', path: '/api/platform/health', description: 'Platform health check' },
      { method: 'POST', path: '/api/dex/quote', description: 'DEX aggregator quote' },
      { method: 'GET', path: '/api/ai-agents/list', description: 'AI agents listing' },
      { method: 'POST', path: '/api/auth/register', description: 'User registration' },
      { method: 'GET', path: '/api/referral/dashboard', description: 'Referral dashboard' }
    ];

    let workingCount = 0;
    let failingCount = 0;

    for (const endpoint of criticalEndpoints) {
      try {
        const testData = endpoint.method === 'POST' ? this.getTestData(endpoint.path) : null;
        const response = await this.makeRequest(endpoint.method, endpoint.path, testData);
        
        if (response && response.status >= 200 && response.status < 400) {
          this.results.apiRoutes.working.push(endpoint);
          workingCount++;
          this.log(`✅ ${endpoint.method} ${endpoint.path} - Working`);
        } else {
          this.results.apiRoutes.failing.push({ ...endpoint, error: `HTTP ${response?.status || 'No response'}` });
          failingCount++;
          this.addError('API_ROUTES', `${endpoint.method} ${endpoint.path} failed`, null, response?.status);
        }
      } catch (error) {
        this.results.apiRoutes.failing.push({ ...endpoint, error: error.message });
        failingCount++;
        this.addError('API_ROUTES', `${endpoint.method} ${endpoint.path} error: ${error.message}`);
      }
    }

    this.results.apiRoutes.total = criticalEndpoints.length;
    this.log(`API Routes Audit: ${workingCount}/${criticalEndpoints.length} working`);
  }

  async auditClientComponents() {
    this.log('Auditing client components...');
    
    try {
      const criticalComponents = [
        './client/src/App.tsx',
        './client/src/pages/swap.tsx',
        './client/src/components/wallet-connect.tsx',
        './client/src/components/real-swap-interface.tsx',
        './client/src/pages/human-referral-dashboard.tsx'
      ];

      let workingCount = 0;
      let failingCount = 0;

      for (const component of criticalComponents) {
        try {
          if (fs.existsSync(component)) {
            const content = fs.readFileSync(component, 'utf-8');
            
            // Check for basic React structure
            if (content.includes('export') && (content.includes('function') || content.includes('const'))) {
              this.results.clientComponents.working.push(component);
              workingCount++;
              this.log(`✅ ${component} - Structure OK`);
            } else {
              this.results.clientComponents.failing.push({ component, error: 'Invalid React component structure' });
              failingCount++;
              this.addError('CLIENT_COMPONENTS', `Invalid structure in ${component}`);
            }
          } else {
            this.results.clientComponents.failing.push({ component, error: 'File missing' });
            failingCount++;
            this.addError('CLIENT_COMPONENTS', `Missing component: ${component}`);
          }
        } catch (error) {
          this.results.clientComponents.failing.push({ component, error: error.message });
          failingCount++;
          this.addError('CLIENT_COMPONENTS', `Error reading ${component}: ${error.message}`);
        }
      }

      this.results.clientComponents.total = criticalComponents.length;
      this.log(`Client Components Audit: ${workingCount}/${criticalComponents.length} working`);

    } catch (error) {
      this.addError('CLIENT_COMPONENTS', `Component audit failed: ${error.message}`);
    }
  }

  async auditHumanReferralDashboard() {
    this.log('Auditing Human Referral Dashboard...');
    
    try {
      const dashboardFile = './client/src/pages/human-referral-dashboard.tsx';
      
      if (!fs.existsSync(dashboardFile)) {
        this.addError('REFERRAL_DASHBOARD', 'Human referral dashboard file missing', dashboardFile);
        this.results.humanReferralDashboard.status = 'missing';
        return;
      }

      const content = fs.readFileSync(dashboardFile, 'utf-8');
      
      // Check for essential referral features
      const requiredFeatures = [
        { pattern: 'referralCode', name: 'Referral code generation' },
        { pattern: 'commission', name: 'Commission tracking' },
        { pattern: 'earnings', name: 'Earnings display' },
        { pattern: 'dashboard', name: 'Dashboard structure' }
      ];

      for (const feature of requiredFeatures) {
        if (!content.includes(feature.pattern)) {
          this.results.humanReferralDashboard.issues.push(`Missing ${feature.name}`);
          this.addWarning('REFERRAL_DASHBOARD', `Missing ${feature.name}`, dashboardFile);
        }
      }

      this.results.humanReferralDashboard.status = 'checked';
      this.log('Human Referral Dashboard audit completed');

    } catch (error) {
      this.addError('REFERRAL_DASHBOARD', `Dashboard audit failed: ${error.message}`);
    }
  }

  async auditLazyComponents() {
    this.log('Auditing lazy-loaded components...');
    
    try {
      const appFile = './client/src/App.tsx';
      
      if (!fs.existsSync(appFile)) {
        this.addError('LAZY_COMPONENTS', 'App.tsx missing');
        return;
      }

      const content = fs.readFileSync(appFile, 'utf-8');
      
      // Look for lazy imports
      const lazyImports = content.match(/const\s+\w+\s+=\s+lazy\([^)]+\)/g) || [];
      
      for (const lazyImport of lazyImports) {
        try {
          // Extract component path (simplified)
          const match = lazyImport.match(/lazy\([^)]+["']([^"']+)["'][^)]*\)/);
          if (match) {
            const componentPath = `./client/src/${match[1]}.tsx`;
            if (fs.existsSync(componentPath)) {
              this.results.lazyComponents.loaded.push(componentPath);
              this.log(`✅ Lazy component loaded: ${componentPath}`);
            } else {
              this.results.lazyComponents.failed.push({ path: componentPath, error: 'File not found' });
              this.addError('LAZY_COMPONENTS', `Lazy component missing: ${componentPath}`);
            }
          }
        } catch (error) {
          this.addError('LAZY_COMPONENTS', `Error processing lazy import: ${error.message}`);
        }
      }

      this.results.lazyComponents.total = lazyImports.length;
      this.log(`Lazy Components Audit: ${this.results.lazyComponents.loaded.length}/${lazyImports.length} loaded`);

    } catch (error) {
      this.addError('LAZY_COMPONENTS', `Lazy components audit failed: ${error.message}`);
    }
  }

  async auditTypeScriptErrors() {
    this.log('Auditing TypeScript compilation...');
    
    try {
      // This is a simplified check - in production you'd run tsc --noEmit
      const criticalFiles = [
        './server/index.ts',
        './client/src/App.tsx',
        './shared/schema.ts'
      ];

      for (const file of criticalFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          // Simple syntax checks
          const openBraces = (content.match(/{/g) || []).length;
          const closeBraces = (content.match(/}/g) || []).length;
          
          if (openBraces !== closeBraces) {
            this.results.typeScriptErrors.push({ file, error: 'Unmatched braces' });
            this.addError('TYPESCRIPT', `Syntax error in ${file}: Unmatched braces`);
          }
        }
      }

      this.log('TypeScript audit completed');

    } catch (error) {
      this.addError('TYPESCRIPT', `TypeScript audit failed: ${error.message}`);
    }
  }

  async auditDependencies() {
    this.log('Auditing dependencies...');
    
    try {
      const packageJsonPath = './package.json';
      
      if (!fs.existsSync(packageJsonPath)) {
        this.addError('DEPENDENCIES', 'package.json missing');
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // Check for critical dependencies
      const criticalDeps = [
        'express',
        'react',
        'drizzle-orm',
        '@neondatabase/serverless',
        'zod'
      ];

      for (const dep of criticalDeps) {
        if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
          this.results.dependencies.missing.push(dep);
          this.addError('DEPENDENCIES', `Missing critical dependency: ${dep}`);
        }
      }

      this.log('Dependencies audit completed');

    } catch (error) {
      this.addError('DEPENDENCIES', `Dependencies audit failed: ${error.message}`);
    }
  }

  getTestData(endpoint) {
    const testDataMap = {
      '/api/dex/quote': {
        fromToken: 'ETH',
        toToken: 'USDC',
        amount: '1.0',
        chainId: 1,
        slippage: 5.0
      },
      '/api/auth/register': {
        email: 'test@example.com',
        name: 'Test User'
      }
    };
    
    return testDataMap[endpoint] || null;
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const baseUrl = 'http://localhost:5000';
      const url = `${baseUrl}${endpoint}`;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url);
      return { status: response.status, ok: response.ok };
    } catch (error) {
      return { status: 0, ok: false, error: error.message };
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        serverConfigStatus: this.results.serverConfiguration.status,
        databaseConfigStatus: this.results.databaseConfiguration.status,
        apiRoutesWorking: this.results.apiRoutes.working.length,
        apiRoutesTotal: this.results.apiRoutes.total,
        clientComponentsWorking: this.results.clientComponents.working.length,
        clientComponentsTotal: this.results.clientComponents.total,
        referralDashboardStatus: this.results.humanReferralDashboard.status
      },
      details: this.results,
      errors: this.errors,
      warnings: this.warnings
    };

    // Generate readable summary
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE PLATFORM AUDIT RESULTS');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Errors: ${report.summary.totalErrors}`);
    console.log(`Total Warnings: ${report.summary.totalWarnings}`);
    console.log(`API Routes: ${report.summary.apiRoutesWorking}/${report.summary.apiRoutesTotal} working`);
    console.log(`Client Components: ${report.summary.clientComponentsWorking}/${report.summary.clientComponentsTotal} working`);
    console.log(`Referral Dashboard: ${report.summary.referralDashboardStatus}`);
    console.log('='.repeat(60));

    if (this.errors.length > 0) {
      console.log('\nCRITICAL ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.category}] ${error.description}${error.file ? ` (${error.file})` : ''}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\nWARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.category}] ${warning.description}${warning.file ? ` (${warning.file})` : ''}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    return report;
  }

  async runCompleteAudit() {
    this.log('Starting comprehensive platform audit...', 'info');
    
    await this.auditServerConfiguration();
    await this.auditDatabaseConfiguration();
    await this.auditAPIRoutes();
    await this.auditClientComponents();
    await this.auditHumanReferralDashboard();
    await this.auditLazyComponents();
    await this.auditTypeScriptErrors();
    await this.auditDependencies();
    
    return this.generateReport();
  }
}

// Run the audit
async function main() {
  const auditor = new PlatformAuditor();
  const report = await auditor.runCompleteAudit();
  
  // Save detailed report
  fs.writeFileSync('./COMPREHENSIVE_PLATFORM_AUDIT.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed audit report saved to: COMPREHENSIVE_PLATFORM_AUDIT.json');
  
  return report;
}

export { PlatformAuditor };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}