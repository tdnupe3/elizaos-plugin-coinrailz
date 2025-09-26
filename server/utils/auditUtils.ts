/**
 * Audit Utility Functions
 * Helper functions for smart contract audit operations
 */

import { nanoid } from 'nanoid';

/**
 * Generate unique audit certificate ID
 */
export function generateAuditCertificateId(): string {
  const timestamp = Date.now().toString(36);
  const randomId = nanoid(8).toUpperCase();
  return `AUDIT-${timestamp}-${randomId}`;
}

/**
 * Generate audit ID
 */
export function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const randomId = nanoid(6);
  return `audit_${timestamp}_${randomId}`;
}

/**
 * Calculate audit grade based on score
 */
export function calculateAuditGrade(score: number): 'A' | 'B' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  return 'F';
}

/**
 * Validate contract address format
 */
export function isValidContractAddress(address: string): boolean {
  // Basic Ethereum address validation
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Sanitize project name for display
 */
export function sanitizeProjectName(name: string): string {
  return name.trim().replace(/[<>\"'&]/g, '');
}

/**
 * Generate audit report summary
 */
export function generateAuditSummary(vulnerabilities: number, gasOptimizations: number, recommendations: number): string {
  const total = vulnerabilities + gasOptimizations + recommendations;
  
  if (total === 0) {
    return "Excellent contract with no issues identified.";
  } else if (vulnerabilities === 0 && total <= 3) {
    return "Good contract with minor optimizations suggested.";
  } else if (vulnerabilities <= 2 && total <= 8) {
    return "Contract needs attention with several issues to address.";
  } else {
    return "Contract requires significant improvements before deployment.";
  }
}