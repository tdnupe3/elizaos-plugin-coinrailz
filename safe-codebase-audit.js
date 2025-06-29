/**
 * SAFE CODEBASE AUDIT SYSTEM
 * Comprehensive analysis to identify truly safe optimizations
 */

import fs from 'fs';
import path from 'path';

class SafeCodebaseAuditor {
  constructor() {
    this.serverDir = './server';
    this.clientDir = './client';
    this.results = {
      safeToRemove: [],
      potentialDuplicates: [],
      activeImports: new Map(),
      usageAnalysis: new Map(),
      riskAssessment: new Map(),
      recommendations: []
    };
  }

  async runComprehensiveAudit() {
    console.log('🔍 Starting Safe Codebase Audit...\n');
    
    await this.analyzeImportUsage();
    await this.identifyOrphanedFiles();
    await this.analyzeDuplicateServices();
    await this.assessRemovalRisk();
    await this.generateSafeRecommendations();
    
    return this.generateAuditReport();
  }

  async analyzeImportUsage() {
    console.log('📊 Analyzing import usage patterns...');
    
    const allFiles = this.getAllTypeScriptFiles();
    
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const imports = this.extractImports(content);
        
        // Track what each file imports
        this.results.activeImports.set(file, imports);
        
        // Track what files are being imported (usage count)
        imports.forEach(importPath => {
          const resolvedPath = this.resolveImportPath(file, importPath);
          if (resolvedPath) {
            const currentCount = this.results.usageAnalysis.get(resolvedPath) || 0;
            this.results.usageAnalysis.set(resolvedPath, currentCount + 1);
          }
        });
      } catch (error) {
        console.log(`  ⚠️  Could not analyze: ${file}`);
      }
    }
    
    console.log(`  ✅ Analyzed ${allFiles.length} files\n`);
  }

  async identifyOrphanedFiles() {
    console.log('🔍 Identifying orphaned files...');
    
    const allServerFiles = this.getAllTypeScriptFiles('./server');
    
    for (const file of allServerFiles) {
      const usageCount = this.results.usageAnalysis.get(file) || 0;
      
      // Files with zero imports (except entry points)
      if (usageCount === 0 && !this.isEntryPoint(file)) {
        this.results.safeToRemove.push({
          file,
          reason: 'No imports detected - potentially orphaned',
          risk: 'LOW',
          usageCount: 0
        });
      }
    }
    
    console.log(`  📋 Found ${this.results.safeToRemove.length} potentially orphaned files\n`);
  }

  async analyzeDuplicateServices() {
    console.log('🔄 Analyzing duplicate service patterns...');
    
    const serviceFiles = this.getAllTypeScriptFiles('./server/services');
    const duplicateGroups = new Map();
    
    // Group by service type patterns
    const patterns = {
      fee: /fee|commission|calculation/i,
      payment: /payment|paypal|stripe|nowpayments/i,
      referral: /referral|commission/i,
      database: /database|connection|pool|transaction/i,
      validation: /validation|validator|sanitiz/i,
      auth: /auth|login|oauth/i,
      monitoring: /monitor|health|performance/i
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      const matchingFiles = serviceFiles.filter(file => 
        pattern.test(path.basename(file))
      );
      
      if (matchingFiles.length > 1) {
        duplicateGroups.set(type, matchingFiles);
      }
    }
    
    // Analyze each duplicate group
    for (const [type, files] of duplicateGroups) {
      const analysis = await this.analyzeDuplicateGroup(type, files);
      this.results.potentialDuplicates.push(analysis);
    }
    
    console.log(`  🔍 Found ${duplicateGroups.size} duplicate service groups\n`);
  }

  async analyzeDuplicateGroup(type, files) {
    const analysis = {
      type,
      files: [],
      safeToMerge: [],
      keepSeparate: [],
      riskLevel: 'MEDIUM'
    };
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const usageCount = this.results.usageAnalysis.get(file) || 0;
        const exports = this.extractExports(content);
        const complexity = this.assessComplexity(content);
        
        const fileAnalysis = {
          file,
          usageCount,
          exports: exports.length,
          complexity,
          lastModified: fs.statSync(file).mtime,
          size: content.length
        };
        
        analysis.files.push(fileAnalysis);
        
        // Categorize based on usage and complexity
        if (usageCount === 0 && complexity < 100) {
          analysis.safeToMerge.push(file);
        } else if (usageCount > 5 || complexity > 500) {
          analysis.keepSeparate.push(file);
        }
      } catch (error) {
        console.log(`    ⚠️  Could not analyze: ${file}`);
      }
    }
    
    // Assess overall risk
    if (analysis.safeToMerge.length > 0 && analysis.keepSeparate.length > 0) {
      analysis.riskLevel = 'LOW';
    } else if (analysis.files.length > 3) {
      analysis.riskLevel = 'HIGH';
    }
    
    return analysis;
  }

  async assessRemovalRisk() {
    console.log('⚠️  Assessing removal risks...');
    
    for (const item of this.results.safeToRemove) {
      const risk = await this.calculateRemovalRisk(item.file);
      this.results.riskAssessment.set(item.file, risk);
      item.risk = risk.level;
      item.reasons = risk.reasons;
    }
    
    console.log(`  ✅ Risk assessment completed\n`);
  }

  async calculateRemovalRisk(filePath) {
    const risk = {
      level: 'LOW',
      reasons: [],
      blockers: []
    };
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check for critical patterns
      if (content.includes('export class') && content.includes('Service')) {
        risk.reasons.push('Contains service class - may be used via dependency injection');
        risk.level = 'MEDIUM';
      }
      
      if (content.includes('database') || content.includes('Database')) {
        risk.reasons.push('Database-related functionality - extra caution needed');
        risk.level = 'MEDIUM';
      }
      
      if (content.includes('payment') || content.includes('Payment')) {
        risk.reasons.push('Payment-related functionality - financial risk');
        risk.level = 'HIGH';
        risk.blockers.push('Financial logic requires careful validation');
      }
      
      if (content.includes('process.env') || content.includes('SECRET')) {
        risk.reasons.push('Contains environment variables - may affect configuration');
        risk.level = 'MEDIUM';
      }
      
      // Check file age (newer files more likely to be important)
      const stats = fs.statSync(filePath);
      const daysOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysOld < 7) {
        risk.reasons.push('Recently modified - may be actively used');
        risk.level = 'HIGH';
      }
      
    } catch (error) {
      risk.level = 'HIGH';
      risk.blockers.push('Could not analyze file content');
    }
    
    return risk;
  }

  async generateSafeRecommendations() {
    console.log('💡 Generating safe optimization recommendations...');
    
    // Ultra-safe removals
    const ultraSafe = this.results.safeToRemove.filter(item => 
      item.risk === 'LOW' && 
      item.usageCount === 0 &&
      !this.results.riskAssessment.get(item.file)?.blockers.length
    );
    
    if (ultraSafe.length > 0) {
      this.results.recommendations.push({
        type: 'SAFE_REMOVAL',
        priority: 'HIGH',
        action: `Remove ${ultraSafe.length} truly orphaned files`,
        files: ultraSafe.map(item => item.file),
        risk: 'NONE',
        benefit: 'Reduced codebase size, cleaner structure'
      });
    }
    
    // Safe duplicate consolidation
    const safeDuplicates = this.results.potentialDuplicates.filter(group => 
      group.riskLevel === 'LOW' && group.safeToMerge.length > 0
    );
    
    if (safeDuplicates.length > 0) {
      this.results.recommendations.push({
        type: 'SAFE_CONSOLIDATION',
        priority: 'MEDIUM',
        action: 'Consolidate low-risk duplicate services',
        groups: safeDuplicates,
        risk: 'LOW',
        benefit: 'Reduced complexity, easier maintenance'
      });
    }
    
    // Import cleanup
    this.results.recommendations.push({
      type: 'IMPORT_CLEANUP',
      priority: 'HIGH',
      action: 'Remove unused import statements',
      risk: 'NONE',
      benefit: 'Faster build times, cleaner code'
    });
    
    console.log(`  ✅ Generated ${this.results.recommendations.length} recommendations\n`);
  }

  // Helper methods
  getAllTypeScriptFiles(dir = this.serverDir) {
    const files = [];
    
    function scanDirectory(currentDir) {
      try {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          
          if (item.isDirectory() && item.name !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    scanDirectory(dir);
    return files;
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)?\s*from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  extractExports(content) {
    const exports = [];
    const exportRegex = /export\s+(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }

  resolveImportPath(fromFile, importPath) {
    // Simple resolution for relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);
      
      // Try common extensions
      for (const ext of ['.ts', '.tsx', '.js']) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }
    }
    return null;
  }

  isEntryPoint(filePath) {
    const entryPoints = [
      'index.ts',
      'server.ts',
      'app.ts',
      'main.ts'
    ];
    
    return entryPoints.some(entry => filePath.endsWith(entry));
  }

  assessComplexity(content) {
    // Simple complexity assessment
    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    
    return lines + (functions * 5) + (classes * 10);
  }

  generateAuditReport() {
    const report = {
      summary: {
        totalFiles: this.getAllTypeScriptFiles().length,
        orphanedFiles: this.results.safeToRemove.length,
        duplicateGroups: this.results.potentialDuplicates.length,
        recommendations: this.results.recommendations.length
      },
      safeToRemove: this.results.safeToRemove,
      duplicateAnalysis: this.results.potentialDuplicates,
      recommendations: this.results.recommendations,
      riskAssessment: Object.fromEntries(this.results.riskAssessment)
    };
    
    console.log('📊 SAFE CODEBASE AUDIT COMPLETE');
    console.log('=====================================');
    console.log(`Total Files Analyzed: ${report.summary.totalFiles}`);
    console.log(`Orphaned Files Found: ${report.summary.orphanedFiles}`);
    console.log(`Duplicate Groups: ${report.summary.duplicateGroups}`);
    console.log(`Safe Recommendations: ${report.summary.recommendations}`);
    console.log('=====================================\n');
    
    return report;
  }
}

// Run the audit
async function main() {
  const auditor = new SafeCodebaseAuditor();
  const report = await auditor.runComprehensiveAudit();
  
  // Save detailed report
  fs.writeFileSync('./SAFE_AUDIT_REPORT.json', JSON.stringify(report, null, 2));
  console.log('📄 Detailed report saved to: SAFE_AUDIT_REPORT.json');
  
  return report;
}

export { SafeCodebaseAuditor };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}