/**
 * SAFE OPTIMIZATION EXECUTOR
 * Implements ultra-conservative optimization with comprehensive safety checks
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class SafeOptimizationExecutor {
  constructor() {
    this.backupDir = './optimization-backup';
    this.safelyRemoved = [];
    this.errors = [];
    this.testEndpoints = [
      'http://localhost:5000/api/platform/health',
      'http://localhost:5000/api/dex/quote'
    ];
  }

  async executeUltraSafeOptimization() {
    console.log('🔒 Starting Ultra-Safe Optimization...\n');
    
    // Create backup directory
    this.ensureBackupDirectory();
    
    // Phase 1: Identify truly safe files
    const safeFiles = await this.identifyUltraSafeFiles();
    console.log(`📋 Identified ${safeFiles.length} potentially safe files\n`);
    
    // Phase 2: Remove files one by one with testing
    for (const file of safeFiles) {
      await this.safelyRemoveFile(file);
    }
    
    // Phase 3: Clean unused imports
    await this.cleanUnusedImports();
    
    return this.generateOptimizationReport();
  }

  async identifyUltraSafeFiles() {
    console.log('🔍 Identifying ultra-safe files for removal...');
    
    const potentiallySafe = [
      // Legacy backup files (already safe)
      'server/broken-index.ts',
      'server/routes.ts.backup',
      'server/routes_broken.ts',
      'server/routes_clean.ts',
      'server/dev-server.ts',
      'server/clean-index.ts',
      
      // Development-only files
      'server/simple-server.ts',
      
      // Potential orphaned services (need verification)
      'server/services/coinflipService.ts',
      'server/services/isolatedStressTester.ts',
      'server/services/loadTester.ts'
    ];
    
    const safeFiles = [];
    
    for (const file of potentiallySafe) {
      if (fs.existsSync(file)) {
        const isReferenced = await this.checkFileReferences(file);
        if (!isReferenced) {
          const riskLevel = await this.assessFileRisk(file);
          if (riskLevel === 'ULTRA_LOW') {
            safeFiles.push(file);
          }
        }
      }
    }
    
    return safeFiles;
  }

  async checkFileReferences(filePath) {
    try {
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Search for imports of this file
      const searchResult = execSync(
        `grep -r "import.*${fileName}" server/ --include="*.ts" | wc -l`,
        { encoding: 'utf-8' }
      ).trim();
      
      const referenceCount = parseInt(searchResult);
      
      // Also check for dynamic imports or requires
      const dynamicResult = execSync(
        `grep -r "${fileName}" server/ --include="*.ts" | grep -v "${filePath}" | wc -l`,
        { encoding: 'utf-8' }
      ).trim();
      
      const dynamicCount = parseInt(dynamicResult);
      
      console.log(`  📊 ${fileName}: ${referenceCount} imports, ${dynamicCount} other references`);
      
      return referenceCount > 0 || dynamicCount > 2; // Allow some margin for false positives
    } catch (error) {
      console.log(`  ⚠️  Could not check references for ${filePath}`);
      return true; // Assume referenced if we can't check
    }
  }

  async assessFileRisk(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // High-risk patterns
      if (content.includes('payment') || content.includes('Payment')) {
        return 'HIGH';
      }
      
      if (content.includes('database') || content.includes('Database')) {
        return 'HIGH';
      }
      
      if (content.includes('auth') || content.includes('Auth')) {
        return 'MEDIUM';
      }
      
      // Development/test files are usually safe
      if (filePath.includes('test') || filePath.includes('dev') || filePath.includes('backup')) {
        return 'ULTRA_LOW';
      }
      
      // Small files with simple exports
      if (content.length < 500 && !content.includes('export class')) {
        return 'LOW';
      }
      
      return 'MEDIUM';
    } catch (error) {
      return 'HIGH'; // Assume high risk if we can't read
    }
  }

  async safelyRemoveFile(filePath) {
    console.log(`🗑️  Attempting to safely remove: ${filePath}`);
    
    try {
      // Step 1: Backup the file
      const backupPath = path.join(this.backupDir, path.basename(filePath));
      fs.copyFileSync(filePath, backupPath);
      console.log(`  📦 Backed up to: ${backupPath}`);
      
      // Step 2: Remove the file
      fs.unlinkSync(filePath);
      console.log(`  ✅ Removed: ${filePath}`);
      
      // Step 3: Test platform functionality
      const testsPassed = await this.runSafetyTests();
      
      if (testsPassed) {
        this.safelyRemoved.push(filePath);
        console.log(`  ✅ Safety tests passed - removal confirmed\n`);
      } else {
        // Restore file immediately
        fs.copyFileSync(backupPath, filePath);
        this.errors.push(`Failed safety tests for ${filePath} - restored`);
        console.log(`  ❌ Safety tests failed - file restored\n`);
      }
      
    } catch (error) {
      this.errors.push(`Error removing ${filePath}: ${error.message}`);
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }

  async runSafetyTests() {
    console.log('  🧪 Running safety tests...');
    
    try {
      // Wait for server to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test critical endpoints
      for (const endpoint of this.testEndpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) {
            console.log(`    ❌ Test failed: ${endpoint} returned ${response.status}`);
            return false;
          }
          console.log(`    ✅ Test passed: ${endpoint}`);
        } catch (error) {
          console.log(`    ❌ Test error: ${endpoint} - ${error.message}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.log(`    ❌ Safety test error: ${error.message}`);
      return false;
    }
  }

  async cleanUnusedImports() {
    console.log('🧹 Cleaning unused imports...');
    
    const files = this.getAllTypeScriptFiles();
    let cleanedCount = 0;
    
    for (const file of files) {
      try {
        const originalContent = fs.readFileSync(file, 'utf-8');
        const cleanedContent = this.removeUnusedImports(originalContent);
        
        if (originalContent !== cleanedContent) {
          fs.writeFileSync(file, cleanedContent);
          cleanedCount++;
          console.log(`  ✅ Cleaned imports in: ${file}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not clean: ${file}`);
      }
    }
    
    console.log(`  📊 Cleaned imports in ${cleanedCount} files\n`);
  }

  removeUnusedImports(content) {
    // This is a simplified implementation
    // In a real scenario, you'd use a proper AST parser
    const lines = content.split('\n');
    const usedImports = new Set();
    
    // Find all identifiers used in the code (excluding import lines)
    const codeLines = lines.filter(line => !line.trim().startsWith('import'));
    const codeContent = codeLines.join(' ');
    
    // Extract imported identifiers
    const importLines = lines.filter(line => line.trim().startsWith('import'));
    
    return lines.join('\n'); // For now, return unchanged to be safe
  }

  getAllTypeScriptFiles() {
    const files = [];
    
    function scanDir(dir) {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory() && item.name !== 'node_modules') {
            scanDir(fullPath);
          } else if (item.isFile() && fullPath.endsWith('.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }
    
    scanDir('./server');
    return files;
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}\n`);
    }
  }

  generateOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      safelyRemoved: this.safelyRemoved,
      errors: this.errors,
      summary: {
        filesRemoved: this.safelyRemoved.length,
        errorsEncountered: this.errors.length,
        backupLocation: this.backupDir
      }
    };
    
    console.log('📊 SAFE OPTIMIZATION COMPLETE');
    console.log('===============================');
    console.log(`Files Safely Removed: ${report.summary.filesRemoved}`);
    console.log(`Errors Encountered: ${report.summary.errorsEncountered}`);
    console.log(`Backup Location: ${report.summary.backupLocation}`);
    console.log('===============================\n');
    
    return report;
  }
}

// Export for use in other modules
export { SafeOptimizationExecutor };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const executor = new SafeOptimizationExecutor();
  executor.executeUltraSafeOptimization()
    .then(report => {
      fs.writeFileSync('./OPTIMIZATION_REPORT.json', JSON.stringify(report, null, 2));
      console.log('📄 Optimization report saved to: OPTIMIZATION_REPORT.json');
    })
    .catch(console.error);
}