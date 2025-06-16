#!/usr/bin/env node

/**
 * Batch replacement script to eliminate all lucide-react imports
 * This resolves the build timeout by replacing with lightweight simple-icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find all TypeScript/JavaScript files
function findFiles(dir, ext = ['.tsx', '.ts']) {
  let results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, ext));
    } else if (ext.some(e => file.endsWith(e))) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Replace lucide-react imports with @/lib/icons
function replaceLucideImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no lucide-react imports
    if (!content.includes('lucide-react')) {
      return false;
    }
    
    // Replace import statements
    const updatedContent = content.replace(
      /from\s+['"']lucide-react['"']/g,
      'from "@/lib/icons"'
    );
    
    if (updatedContent !== content) {
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  console.log('🔧 Fixing lucide-react imports to eliminate build timeout...\n');
  
  const clientDir = path.join(__dirname, 'client/src');
  const files = findFiles(clientDir);
  
  let fixedCount = 0;
  
  for (const file of files) {
    if (replaceLucideImports(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files`);
  console.log('🚀 Build optimization complete - lucide-react eliminated');
}

main();