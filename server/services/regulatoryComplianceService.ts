/**
 * Regulatory Compliance Service
 * Automated compliance reporting and regulatory requirement management
 */

import { db } from "../db";
import { users, transactions } from "@shared/schema";
import { eq, gte, lte, sum, count } from "drizzle-orm";

export interface ComplianceReport {
  id: string;
  reportType: 'SAR' | 'CTR' | 'BSA' | 'AML' | 'KYC_SUMMARY' | 'TRANSACTION_VOLUME';
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
  status: 'draft' | 'pending_review' | 'submitted' | 'acknowledged';
  data: any;
  submittedTo?: string;
  acknowledgedAt?: string;
}

export interface SuspiciousActivityAlert {
  id: string;
  userId: string;
  alertType: 'STRUCTURING' | 'VELOCITY' | 'GEOGRAPHIC' | 'BEHAVIORAL' | 'ML_DETECTED';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  triggerAmount?: number;
  triggerCurrency?: string;
  investigationStatus: 'open' | 'investigating' | 'escalated' | 'resolved' | 'filed_sar';
  createdAt: string;
  resolvedAt?: string;
  notes: string[];
}

export interface RegulatoryThreshold {
  type: 'CTR' | 'SAR' | 'VELOCITY' | 'CUMULATIVE';
  amount: number;
  currency: string;
  timeframe: 'daily' | 'weekly' | 'monthly';
  jurisdiction: string;
}

export class RegulatoryComplianceService {
  private static instance: RegulatoryComplianceService;
  private reports: ComplianceReport[] = [];
  private alerts: SuspiciousActivityAlert[] = [];
  private thresholds: RegulatoryThreshold[] = [];

  constructor() {
    this.initializeRegulatoryThresholds();
  }

  static getInstance(): RegulatoryComplianceService {
    if (!RegulatoryComplianceService.instance) {
      RegulatoryComplianceService.instance = new RegulatoryComplianceService();
    }
    return RegulatoryComplianceService.instance;
  }

  /**
   * Initialize regulatory thresholds for different jurisdictions
   */
  private initializeRegulatoryThresholds(): void {
    this.thresholds = [
      // US FinCEN requirements
      { type: 'CTR', amount: 10000, currency: 'USD', timeframe: 'daily', jurisdiction: 'US' },
      { type: 'SAR', amount: 5000, currency: 'USD', timeframe: 'daily', jurisdiction: 'US' },
      { type: 'VELOCITY', amount: 3000, currency: 'USD', timeframe: 'daily', jurisdiction: 'US' },
      { type: 'CUMULATIVE', amount: 25000, currency: 'USD', timeframe: 'monthly', jurisdiction: 'US' },
      
      // EU AMLD requirements
      { type: 'CTR', amount: 15000, currency: 'EUR', timeframe: 'daily', jurisdiction: 'EU' },
      { type: 'SAR', amount: 15000, currency: 'EUR', timeframe: 'daily', jurisdiction: 'EU' },
      { type: 'VELOCITY', amount: 5000, currency: 'EUR', timeframe: 'daily', jurisdiction: 'EU' },
      
      // UK FCA requirements
      { type: 'CTR', amount: 10000, currency: 'GBP', timeframe: 'daily', jurisdiction: 'UK' },
      { type: 'SAR', amount: 1000, currency: 'GBP', timeframe: 'daily', jurisdiction: 'UK' },
      
      // Canada FINTRAC requirements
      { type: 'CTR', amount: 10000, currency: 'CAD', timeframe: 'daily', jurisdiction: 'CA' },
      { type: 'SAR', amount: 1000, currency: 'CAD', timeframe: 'daily', jurisdiction: 'CA' }
    ];
  }

  /**
   * Monitor transactions for regulatory threshold breaches
   */
  async monitorTransactionCompliance(
    userId: string,
    amount: number,
    currency: string,
    transactionType: string,
    jurisdiction: string = 'US'
  ): Promise<void> {
    
    const relevantThresholds = this.thresholds.filter(t => 
      t.jurisdiction === jurisdiction && t.currency === currency
    );

    for (const threshold of relevantThresholds) {
      const breached = await this.checkThresholdBreach(userId, amount, threshold);
      
      if (breached) {
        await this.handleThresholdBreach(userId, amount, currency, threshold, transactionType);
      }
    }

    // Check for suspicious patterns
    await this.detectSuspiciousPatterns(userId, amount, currency);
  }

  /**
   * Check if transaction breaches regulatory threshold
   */
  private async checkThresholdBreach(
    userId: string,
    amount: number,
    threshold: RegulatoryThreshold
  ): Promise<boolean> {
    
    if (threshold.type === 'CTR' || threshold.type === 'SAR') {
      return amount >= threshold.amount;
    }

    if (threshold.type === 'VELOCITY' || threshold.type === 'CUMULATIVE') {
      const timeframeDays = this.getTimeframeDays(threshold.timeframe);
      const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
      
      // Get user's transaction volume in timeframe
      const totalVolume = await this.getUserTransactionVolume(userId, startDate, new Date());
      
      return (totalVolume + amount) >= threshold.amount;
    }

    return false;
  }

  /**
   * Handle regulatory threshold breach
   */
  private async handleThresholdBreach(
    userId: string,
    amount: number,
    currency: string,
    threshold: RegulatoryThreshold,
    transactionType: string
  ): Promise<void> {
    
    if (threshold.type === 'CTR') {
      await this.generateCTR(userId, amount, currency, transactionType);
    } else if (threshold.type === 'SAR') {
      await this.createSuspiciousActivityAlert(
        userId,
        'VELOCITY',
        'high',
        `Transaction amount ${amount} ${currency} exceeds SAR threshold of ${threshold.amount}`,
        amount,
        currency
      );
    }

    console.log(`Regulatory threshold breach detected: ${threshold.type} for user ${userId}, amount: ${amount} ${currency}`);
  }

  /**
   * Generate Currency Transaction Report (CTR)
   */
  private async generateCTR(
    userId: string,
    amount: number,
    currency: string,
    transactionType: string
  ): Promise<ComplianceReport> {
    
    const user = await this.getUserDetails(userId);
    
    const reportId = `ctr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const ctrData = {
      reportingInstitution: {
        name: 'Coin Railz Global Payment Network',
        address: '123 Financial District, New York, NY 10001',
        ein: '12-3456789',
        filingDate: new Date().toISOString().split('T')[0]
      },
      transaction: {
        amount,
        currency,
        type: transactionType,
        date: new Date().toISOString(),
        method: 'Electronic Transfer'
      },
      customer: {
        name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown',
        address: user?.address || 'Address on file',
        identification: {
          type: 'Government ID',
          number: '[REDACTED]',
          issuingAuthority: 'Various'
        },
        accountNumber: userId,
        kycStatus: user?.kycStatus || 'pending'
      },
      compliance: {
        thresholdType: 'CTR',
        thresholdAmount: 10000,
        actualAmount: amount,
        reportRequired: true
      }
    };

    const report: ComplianceReport = {
      id: reportId,
      reportType: 'CTR',
      period: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      generatedAt: new Date().toISOString(),
      status: 'pending_review',
      data: ctrData
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousPatterns(
    userId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    
    // Structuring detection (multiple transactions just below reporting threshold)
    if (amount >= 3000 && amount < 10000) {
      const recentTransactions = await this.getRecentUserTransactions(userId, 24); // Last 24 hours
      const similarAmounts = recentTransactions.filter(tx => 
        Math.abs(parseFloat(tx.amount || '0') - amount) < 1000
      );
      
      if (similarAmounts.length >= 2) {
        await this.createSuspiciousActivityAlert(
          userId,
          'STRUCTURING',
          'high',
          `Potential structuring detected: ${similarAmounts.length + 1} transactions around $${amount} in 24 hours`,
          amount,
          currency
        );
      }
    }

    // Geographic anomaly detection
    await this.checkGeographicAnomalies(userId);

    // Velocity pattern detection
    await this.checkVelocityPatterns(userId, amount);
  }

  /**
   * Create suspicious activity alert
   */
  private async createSuspiciousActivityAlert(
    userId: string,
    alertType: SuspiciousActivityAlert['alertType'],
    severity: SuspiciousActivityAlert['severity'],
    description: string,
    triggerAmount?: number,
    triggerCurrency?: string
  ): Promise<SuspiciousActivityAlert> {
    
    const alertId = `sar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: SuspiciousActivityAlert = {
      id: alertId,
      userId,
      alertType,
      severity,
      description,
      triggerAmount,
      triggerCurrency,
      investigationStatus: 'open',
      createdAt: new Date().toISOString(),
      notes: []
    };

    this.alerts.push(alert);

    // Auto-escalate critical alerts
    if (severity === 'critical') {
      alert.investigationStatus = 'escalated';
      alert.notes.push('Auto-escalated due to critical severity level');
    }

    console.log(`Suspicious activity alert created: ${alertId} for user ${userId}`);
    return alert;
  }

  /**
   * Generate periodic compliance reports
   */
  async generatePeriodicReports(reportType: ComplianceReport['reportType']): Promise<ComplianceReport> {
    const reportId = `${reportType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const endDate = new Date();
    const startDate = new Date();
    
    // Set period based on report type
    switch (reportType) {
      case 'KYC_SUMMARY':
        startDate.setMonth(startDate.getMonth() - 1); // Monthly
        break;
      case 'TRANSACTION_VOLUME':
        startDate.setDate(startDate.getDate() - 7); // Weekly
        break;
      case 'AML':
        startDate.setMonth(startDate.getMonth() - 3); // Quarterly
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const reportData = await this.generateReportData(reportType, startDate, endDate);
    
    const report: ComplianceReport = {
      id: reportId,
      reportType,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      generatedAt: new Date().toISOString(),
      status: 'draft',
      data: reportData
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Generate report data based on type
   */
  private async generateReportData(
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    
    switch (reportType) {
      case 'KYC_SUMMARY':
        return {
          totalUsers: await this.getTotalUsers(),
          verifiedUsers: await this.getVerifiedUsers(),
          pendingVerifications: await this.getPendingVerifications(),
          rejectedVerifications: await this.getRejectedVerifications(),
          complianceRate: await this.calculateKYCComplianceRate()
        };
        
      case 'TRANSACTION_VOLUME':
        return {
          totalTransactions: await this.getTransactionCount(startDate, endDate),
          totalVolume: await this.getTransactionVolume(startDate, endDate),
          averageTransactionSize: await this.getAverageTransactionSize(startDate, endDate),
          flaggedTransactions: this.alerts.filter(a => 
            new Date(a.createdAt) >= startDate && new Date(a.createdAt) <= endDate
          ).length
        };
        
      case 'AML':
        return {
          suspiciousActivityAlerts: this.alerts.filter(a => 
            new Date(a.createdAt) >= startDate && new Date(a.createdAt) <= endDate
          ),
          ctrsGenerated: this.reports.filter(r => 
            r.reportType === 'CTR' && 
            new Date(r.generatedAt) >= startDate && 
            new Date(r.generatedAt) <= endDate
          ).length,
          investigationsCompleted: this.alerts.filter(a => 
            a.investigationStatus === 'resolved' &&
            a.resolvedAt &&
            new Date(a.resolvedAt) >= startDate && 
            new Date(a.resolvedAt) <= endDate
          ).length
        };
        
      default:
        return {};
    }
  }

  /**
   * Helper methods for compliance calculations
   */
  private async getTotalUsers(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count || 0;
  }

  private async getVerifiedUsers(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(users)
      .where(eq(users.kycStatus, 'verified'));
    return result[0]?.count || 0;
  }

  private async getPendingVerifications(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(users)
      .where(eq(users.kycStatus, 'pending'));
    return result[0]?.count || 0;
  }

  private async getRejectedVerifications(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(users)
      .where(eq(users.kycStatus, 'rejected'));
    return result[0]?.count || 0;
  }

  private async calculateKYCComplianceRate(): Promise<number> {
    const total = await this.getTotalUsers();
    const verified = await this.getVerifiedUsers();
    return total > 0 ? Math.round((verified / total) * 100) : 0;
  }

  private async getTransactionCount(startDate: Date, endDate: Date): Promise<number> {
    // In production, would query actual transactions table
    return 0;
  }

  private async getTransactionVolume(startDate: Date, endDate: Date): Promise<number> {
    // In production, would query actual transactions table
    return 0;
  }

  private async getAverageTransactionSize(startDate: Date, endDate: Date): Promise<number> {
    // In production, would calculate from actual transactions
    return 0;
  }

  private async getUserTransactionVolume(userId: string, startDate: Date, endDate: Date): Promise<number> {
    // In production, would query user's transactions in date range
    return 0;
  }

  private async getRecentUserTransactions(userId: string, hours: number): Promise<any[]> {
    // In production, would query user's recent transactions
    return [];
  }

  private async getUserDetails(userId: string): Promise<any> {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result[0] || null;
  }

  private async checkGeographicAnomalies(userId: string): Promise<void> {
    // In production, would check for unusual geographic patterns
  }

  private async checkVelocityPatterns(userId: string, amount: number): Promise<void> {
    // In production, would analyze velocity patterns
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'monthly': return 30;
      default: return 1;
    }
  }

  /**
   * Get compliance dashboard data
   */
  getComplianceDashboard(): any {
    const openAlerts = this.alerts.filter(a => a.investigationStatus === 'open').length;
    const pendingReports = this.reports.filter(r => r.status === 'pending_review').length;
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;

    return {
      openAlerts,
      pendingReports,
      criticalAlerts,
      recentAlerts: this.alerts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
      recentReports: this.reports
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, 5)
    };
  }

  /**
   * Submit report to regulatory authority
   */
  async submitReport(reportId: string, authority: string): Promise<void> {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    report.status = 'submitted';
    report.submittedTo = authority;
    console.log(`Report ${reportId} submitted to ${authority}`);
  }

  /**
   * Get all compliance reports
   */
  getAllReports(): ComplianceReport[] {
    return this.reports.sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  }

  /**
   * Get all suspicious activity alerts
   */
  getAllAlerts(): SuspiciousActivityAlert[] {
    return this.alerts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}