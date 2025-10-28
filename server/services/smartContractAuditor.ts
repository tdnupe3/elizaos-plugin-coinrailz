/**
 * Smart Contract Auditor Service
 * Uses Slither static analysis tool to audit Solidity contracts
 * Provides $1,000 professional audits for AI agents
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

export interface AuditRequest {
  contractCode: string;
  contractName: string;
  userId: string;
  orderId: string;
}

export interface AuditResult {
  orderId: string;
  contractName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'clean';
  issuesFound: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  optimizationIssues: number;
  informationalIssues: number;
  findings: AuditFinding[];
  rawOutput: string;
  recommendations: string[];
  auditScore: number; // 0-100
  timestamp: Date;
}

export interface AuditFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'optimization' | 'informational';
  title: string;
  description: string;
  location?: string;
  impact: string;
  recommendation: string;
}

/**
 * Run Slither analysis on a Solidity contract
 */
export async function auditSmartContract(request: AuditRequest): Promise<AuditResult> {
  const tempDir = join('/tmp', 'contract-audits');
  const auditId = randomBytes(16).toString('hex');
  const contractPath = join(tempDir, `${auditId}.sol`);
  
  try {
    // Create temp directory
    await mkdir(tempDir, { recursive: true });
    
    // Write contract to temp file
    await writeFile(contractPath, request.contractCode, 'utf-8');
    
    // Run Slither analysis - DO NOT mask errors with || true
    let stdout = '';
    let stderr = '';
    let slitherFailed = false;
    
    try {
      const result = await execAsync(
        `slither ${contractPath} --json -`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      // Slither exits with non-zero when it finds issues - this is EXPECTED
      // Only fail if Slither itself couldn't run
      if (error.stdout) {
        stdout = error.stdout;
        stderr = error.stderr || '';
      } else {
        throw new Error(`Slither execution failed: ${error.message}`);
      }
    }
    
    // Parse Slither output
    const findings = parseSlitherOutput(stdout, stderr);
    
    // Calculate metrics
    const criticalIssues = findings.filter(f => f.severity === 'critical').length;
    const highIssues = findings.filter(f => f.severity === 'high').length;
    const mediumIssues = findings.filter(f => f.severity === 'medium').length;
    const lowIssues = findings.filter(f => f.severity === 'low').length;
    const optimizationIssues = findings.filter(f => f.severity === 'optimization').length;
    const informationalIssues = findings.filter(f => f.severity === 'informational').length;
    
    const issuesFound = criticalIssues + highIssues + mediumIssues + lowIssues;
    
    // Determine overall severity
    let severity: 'critical' | 'high' | 'medium' | 'low' | 'clean' = 'clean';
    if (criticalIssues > 0) severity = 'critical';
    else if (highIssues > 0) severity = 'high';
    else if (mediumIssues > 0) severity = 'medium';
    else if (lowIssues > 0) severity = 'low';
    
    // Calculate audit score (100 = perfect, 0 = critical issues)
    const auditScore = calculateAuditScore(
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues
    );
    
    // Generate recommendations
    const recommendations = generateRecommendations(findings);
    
    // Cleanup
    await unlink(contractPath).catch(() => {});
    
    return {
      orderId: request.orderId,
      contractName: request.contractName,
      severity,
      issuesFound,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      optimizationIssues,
      informationalIssues,
      findings,
      rawOutput: stdout + stderr,
      recommendations,
      auditScore,
      timestamp: new Date()
    };
    
  } catch (error: any) {
    // Cleanup on error
    await unlink(contractPath).catch(() => {});
    
    throw new Error(`Audit failed: ${error.message}`);
  }
}

/**
 * Parse Slither JSON output into structured findings
 * CRITICAL FIX: Slither sets success=true even when findings exist
 */
function parseSlitherOutput(stdout: string, stderr: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  
  try {
    // Try to parse JSON output from stdout
    const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // CRITICAL FIX: Check for detectors regardless of success value
      // Slither sets success=true even when it finds vulnerabilities
      if (result.results?.detectors && Array.isArray(result.results.detectors)) {
        result.results.detectors.forEach((detector: any) => {
          findings.push({
            severity: mapSlitherImpact(detector.impact),
            title: detector.check || 'Unknown Issue',
            description: detector.description || 'No description provided',
            location: detector.elements?.[0]?.source_mapping?.filename_relative || undefined,
            impact: detector.impact || 'unknown',
            recommendation: detector.markdown || generateRecommendation(detector.check)
          });
        });
      }
    }
    
    // Also parse stderr and text output for additional findings
    const allOutput = stdout + '\n' + stderr;
    const lines = allOutput.split('\n');
    lines.forEach(line => {
      // Look for severity indicators in text output
      if (line.includes('High:') || line.includes('Medium:') || line.includes('Low:')) {
        const match = line.match(/(High|Medium|Low|Optimization|Informational):\s*(.+)/i);
        if (match) {
          const [, severity, description] = match;
          findings.push({
            severity: severity.toLowerCase() as any,
            title: description.trim().substring(0, 100),
            description: description.trim(),
            impact: severity,
            recommendation: generateRecommendation(description)
          });
        }
      }
    });
    
  } catch (error) {
    console.error('Error parsing Slither output:', error);
    throw new Error(`Failed to parse Slither output: ${error}`);
  }
  
  // If no findings parsed but also no errors, consider it clean
  if (findings.length === 0) {
    findings.push({
      severity: 'informational',
      title: 'Clean Audit',
      description: 'No security vulnerabilities detected by Slither static analysis',
      impact: 'None',
      recommendation: 'Contract appears secure from automated analysis. Manual review and comprehensive testing recommended before deployment.'
    });
  }
  
  return findings;
}

/**
 * Map Slither impact to severity levels
 */
function mapSlitherImpact(impact: string): AuditFinding['severity'] {
  const impactLower = impact?.toLowerCase() || '';
  
  if (impactLower.includes('critical')) return 'critical';
  if (impactLower.includes('high')) return 'high';
  if (impactLower.includes('medium')) return 'medium';
  if (impactLower.includes('low')) return 'low';
  if (impactLower.includes('optimization')) return 'optimization';
  return 'informational';
}

/**
 * Generate recommendation based on issue type
 */
function generateRecommendation(issueType: string): string {
  const recommendations: Record<string, string> = {
    'reentrancy': 'Use ReentrancyGuard from OpenZeppelin. Follow checks-effects-interactions pattern.',
    'unchecked-transfer': 'Always check return values from transfer() calls or use SafeERC20.',
    'uninitialized': 'Initialize all state variables. Use constructor or explicit initialization.',
    'tx-origin': 'Never use tx.origin for authorization. Use msg.sender instead.',
    'timestamp': 'Avoid using block.timestamp for critical logic. Consider block.number or oracles.',
    'low-level-calls': 'Avoid low-level calls when possible. Use high-level interfaces.',
    'delegatecall': 'Be extremely careful with delegatecall. Ensure storage layouts match.',
    'assembly': 'Minimize assembly usage. Document all assembly blocks thoroughly.',
    'external-function': 'Mark functions as external when not called internally to save gas.',
    'locked-ether': 'Add withdrawal function or mark contract as non-payable.',
  };
  
  const issueKey = Object.keys(recommendations).find(key => 
    issueType.toLowerCase().includes(key)
  );
  
  return issueKey 
    ? recommendations[issueKey]
    : 'Review this finding carefully and apply security best practices.';
}

/**
 * Generate overall recommendations based on all findings
 */
function generateRecommendations(findings: AuditFinding[]): string[] {
  const recommendations: string[] = [];
  
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  
  if (criticalCount > 0) {
    recommendations.push('🚨 CRITICAL: Fix all critical issues before deployment. These pose immediate security risks.');
  }
  
  if (highCount > 0) {
    recommendations.push('⚠️ HIGH: Address all high-severity issues. These could lead to significant losses.');
  }
  
  // Add general recommendations
  recommendations.push('✅ Run comprehensive test suite with 100% code coverage');
  recommendations.push('✅ Conduct manual security review by experienced auditor');
  recommendations.push('✅ Consider bug bounty program before mainnet deployment');
  recommendations.push('✅ Implement multi-sig for privileged functions');
  recommendations.push('✅ Add pause functionality for emergency situations');
  recommendations.push('✅ Deploy to testnet and monitor for at least 2 weeks');
  
  if (findings.some(f => f.description.includes('gas'))) {
    recommendations.push('⚡ Optimize gas usage in identified functions');
  }
  
  return recommendations;
}

/**
 * Calculate audit score (0-100)
 */
function calculateAuditScore(
  critical: number,
  high: number,
  medium: number,
  low: number
): number {
  let score = 100;
  
  score -= critical * 25; // -25 per critical
  score -= high * 15;     // -15 per high
  score -= medium * 8;    // -8 per medium
  score -= low * 3;       // -3 per low
  
  return Math.max(0, score);
}

/**
 * Test the auditor with a sample contract
 */
export async function testAuditor(): Promise<void> {
  const sampleContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableExample {
    mapping(address => uint256) public balances;
    
    // Reentrancy vulnerability
    function withdraw() external {
        uint256 balance = balances[msg.sender];
        (bool success,) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }
    
    // tx.origin vulnerability
    function transfer(address to, uint256 amount) external {
        require(tx.origin == msg.sender, "Not authorized");
        balances[to] += amount;
    }
}
  `;
  
  const result = await auditSmartContract({
    contractCode: sampleContract,
    contractName: 'VulnerableExample',
    userId: 'test',
    orderId: 'test-001'
  });
  
  console.log('🔍 Audit Test Results:');
  console.log(`Contract: ${result.contractName}`);
  console.log(`Severity: ${result.severity}`);
  console.log(`Issues Found: ${result.issuesFound}`);
  console.log(`Audit Score: ${result.auditScore}/100`);
  console.log('\nFindings:');
  result.findings.forEach((finding, i) => {
    console.log(`\n${i + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`   ${finding.description}`);
  });
}
