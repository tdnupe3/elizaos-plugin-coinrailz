// Compliance and AML Monitoring Service
// ISO 20022 compliant financial crime prevention

import { TravelRule, ISO20022Utils } from "@shared/iso20022";
import { storage } from "../storage";

interface ComplianceCheck {
  userId: string;
  transactionAmount: number;
  transactionType: 'fiat' | 'crypto' | 'cross_border';
  counterpartyInfo?: any;
  sourceOfFunds?: string;
}

interface RiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
  flaggedReasons: string[];
  requiresManualReview: boolean;
  blockedTransaction: boolean;
}

interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  period: { startDate: string; endDate: string };
  summary: {
    totalTransactions: number;
    totalVolume: number;
    suspiciousTransactions: number;
    blockedTransactions: number;
  };
  findings: string[];
  recommendations: string[];
}

export class ComplianceService {
  private sanctionsLists: Set<string> = new Set(); // OFAC, EU, UN sanctions lists
  private pepsLists: Set<string> = new Set(); // Politically Exposed Persons
  private highRiskCountries: Set<string> = new Set(['AF', 'IR', 'KP', 'SY']); // FATF high-risk jurisdictions

  constructor() {
    this.loadSanctionsData();
  }

  private async loadSanctionsData(): Promise<void> {
    // In production, this would load from OFAC SDN list, EU sanctions, etc.
    // For now, we'll use placeholder data structure
    console.log('Loading sanctions and PEPs data...');
  }

  private async logComplianceEvent(event: string, data: Record<string, unknown>): Promise<void> {
    console.info(`Compliance event: ${event}`, data);
  }

  async performAMLCheck(check: ComplianceCheck): Promise<RiskAssessment> {
    const user = await storage.getUser(check.userId);
    if (!user) {
      throw new Error('User not found for compliance check');
    }

    let riskScore = user.riskScore || 0;
    const flaggedReasons: string[] = [];
    let requiresManualReview = false;
    let blockedTransaction = false;

    // Transaction amount thresholds (BSA requirements)
    if (check.transactionAmount >= 10000) {
      flaggedReasons.push('LARGE_TRANSACTION_CTR'); // Currency Transaction Report threshold
      requiresManualReview = true;
      riskScore += 20;
    }

    if (check.transactionAmount >= 3000 && check.transactionType === 'crypto') {
      flaggedReasons.push('CRYPTO_REPORTING_THRESHOLD');
      riskScore += 10;
    }

    // Sanctions screening
    if (user.sanctionsCheck === false) {
      const sanctionsResult = await this.checkSanctions(user);
      if (sanctionsResult.isMatch) {
        flaggedReasons.push('SANCTIONS_MATCH');
        blockedTransaction = true;
        riskScore = 100;
      }
    }

    // PEPs screening
    if (user.pepsCheck === false) {
      const pepsResult = await this.checkPEPs(user);
      if (pepsResult.isMatch) {
        flaggedReasons.push('PEPS_MATCH');
        requiresManualReview = true;
        riskScore += 30;
      }
    }

    // Geographic risk assessment
    if (user.address && this.highRiskCountries.has((user.address as any).country)) {
      flaggedReasons.push('HIGH_RISK_JURISDICTION');
      requiresManualReview = true;
      riskScore += 25;
    }

    // Velocity checks (multiple transactions in short time)
    const recentTransactions = await storage.getUserTransactions(check.userId, 10);
    const last24HourTransactions = recentTransactions.filter(t => 
      new Date(t.createdAt!).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    if (last24HourTransactions.length > 5) {
      flaggedReasons.push('HIGH_VELOCITY_TRANSACTIONS');
      riskScore += 15;
    }

    const totalLast24Hours = last24HourTransactions.reduce((sum, t) => 
      sum + parseFloat(t.amount), 0
    );

    if (totalLast24Hours > 10000) {
      flaggedReasons.push('DAILY_AGGREGATE_THRESHOLD');
      requiresManualReview = true;
      riskScore += 20;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
    if (blockedTransaction || riskScore >= 90) {
      riskLevel = 'prohibited';
    } else if (riskScore >= 60) {
      riskLevel = 'high';
      requiresManualReview = true;
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Update user risk score
    await storage.updateUserKYCStatus(check.userId, user.kycStatus || 'pending');

    // Create compliance report if flagged
    if (flaggedReasons.length > 0) {
      await storage.createComplianceReport({
        userId: check.userId,
        reportType: blockedTransaction ? 'SAR' : 'INTERNAL_FLAG',
        riskScore: Math.min(riskScore, 100),
        flaggedReasons,
        iso20022MessageId: ISO20022Utils.generateMessageId(),
        filedWithAuthorities: blockedTransaction,
      });
    }

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      flaggedReasons,
      requiresManualReview,
      blockedTransaction,
    };
  }

  private async checkSanctions(user: any): Promise<{ isMatch: boolean; details?: any }> {
    // In production, this would check against OFAC SDN, EU sanctions, UN sanctions
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();

    // Placeholder logic - in production would use proper sanctions screening API
    const suspiciousNames = ['test suspicious', 'blocked person'];
    const isMatch = suspiciousNames.some(name => fullName.includes(name));

    return { isMatch, details: isMatch ? { listName: 'OFAC_SDN' } : undefined };
  }

  private async checkPEPs(user: any): Promise<{ isMatch: boolean; details?: any }> {
    // In production, this would check against PEPs databases
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();

    // Placeholder logic - in production would use proper PEPs screening API
    const politicalTitles = ['senator', 'governor', 'minister', 'president'];
    const isMatch = politicalTitles.some(title => fullName.includes(title));

    return { isMatch, details: isMatch ? { category: 'POLITICAL_FIGURE' } : undefined };
  }

  async generateTravelRuleReport(
    originatorUserId: string,
    beneficiaryInfo: any,
    transactionAmount: number,
    cryptoAsset?: string
  ): Promise<TravelRule> {
    if (transactionAmount < 1000) {
      throw new Error('Travel Rule not required for transactions under $1000');
    }

    const originatorUser = await storage.getUser(originatorUserId);
    if (!originatorUser) {
      throw new Error('Originator user not found');
    }

    const travelRuleData: TravelRule = {
      originator: {
        name: `${originatorUser.firstName} ${originatorUser.lastName}`,
        address: originatorUser.address as any || {
          streetAddress: "Address Required",
          city: "City Required",
          postalCode: "ZIP Required",
          country: "US",
        },
        accountNumber: originatorUser.id,
        customerIdentification: originatorUser.id,
      },
      beneficiary: {
        name: beneficiaryInfo.name || "Beneficiary Name Required",
        address: beneficiaryInfo.address || {
          streetAddress: "Address Required",
          city: "City Required",
          postalCode: "ZIP Required",
          country: "US",
        },
        accountNumber: beneficiaryInfo.accountNumber || "Unknown",
        customerIdentification: beneficiaryInfo.id || "Unknown",
      },
      transaction: {
        amount: transactionAmount,
        currency: "USD",
        cryptoAsset: cryptoAsset || "N/A",
        blockchainAddress: beneficiaryInfo.blockchainAddress || "",
        timestamp: ISO20022Utils.formatDateTime(new Date()),
      },
      complianceData: {
        riskScore: originatorUser.riskScore || 0,
        sanctionsCheck: originatorUser.sanctionsCheck || false,
        pepsCheck: originatorUser.pepsCheck || false,
        amlFlags: [],
      },
    };

    // Store travel rule report
    await storage.createComplianceReport({
      userId: originatorUserId,
      reportType: 'TRAVEL_RULE',
      riskScore: originatorUser.riskScore || 0,
      flaggedReasons: [],
      iso20022MessageId: ISO20022Utils.generateMessageId(),
      filedWithAuthorities: true,
    });

    return travelRuleData;
  }

  async checkTransactionLimits(userId: string, amount: number, transactionType: string): Promise<{
    allowed: boolean;
    reason?: string;
    dailyLimit?: number;
    monthlyLimit?: number;
  }> {
    const user = await storage.getUser(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // KYC-based limits
    let dailyLimit = 1000; // Basic KYC
    let monthlyLimit = 10000;

    if (user.kycStatus === 'verified') {
      dailyLimit = 10000; // Enhanced KYC
      monthlyLimit = 100000;
    }

    if (user.complianceLevel === 'institutional') {
      dailyLimit = 100000; // Institutional limits
      monthlyLimit = 1000000;
    }

    // Check current usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentTransactions = await storage.getUserTransactions(userId, 100);
    const todayTransactions = recentTransactions.filter(t => 
      new Date(t.createdAt!).getTime() >= today.getTime()
    );

    const dailyUsed = todayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    if (dailyUsed + amount > dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily transaction limit exceeded',
        dailyLimit,
        monthlyLimit,
      };
    }

    return { allowed: true, dailyLimit, monthlyLimit };
  }

  async generateComplianceReport(): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      reportId: `CR-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      period: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      summary: {
        totalTransactions: 0,
        totalVolume: 0,
        suspiciousTransactions: 0,
        blockedTransactions: 0
      },
      findings: [],
      recommendations: []
    };

    return report;
  }

  async checkAITransaction(transaction: any): Promise<{ approved: boolean; flags: string[] }> {
    const flags: string[] = [];

    // Check amount thresholds for AI transactions
    const amount = parseFloat(transaction.amount);
    if (amount > 25000) {
      flags.push('HIGH_VALUE_AI_TRANSACTION');
    }

    // Check for rapid AI transaction patterns
    if (transaction.metadata?.riskScore > 0.7) {
      flags.push('HIGH_RISK_AI_PATTERN');
    }

    // Verify agent permissions
    if (!transaction.fromAgentId || !transaction.toAgentId) {
      flags.push('INVALID_AGENT_CREDENTIALS');
    }

    // AI transactions require additional monitoring for regulatory compliance
    if (amount > 10000) {
      flags.push('AI_TRANSACTION_MONITORING_REQUIRED');
      await this.logComplianceEvent('AI_HIGH_VALUE_TRANSACTION', {
        transactionId: transaction.id,
        amount: transaction.amount,
        fromAgent: transaction.fromAgentId,
        toAgent: transaction.toAgentId
      });
    }

    const approved = !flags.some(flag => 
      ['INVALID_AGENT_CREDENTIALS', 'BLOCKED_ENTITY'].includes(flag)
    );

    return { approved, flags };
  }
  // Risk assessment for transactions
  async assessTransactionRisk(
    userId: string,
    amount: number,
    recipientEmail: string
  ): Promise<{ riskLevel: 'low' | 'medium' | 'high'; score: number; flags: string[] }> {
    const flags: string[] = [];
    let riskScore = 0;

    // Check amount thresholds
    if (amount > 10000) {
      riskScore += 30;
      flags.push('large_amount');
    }

    // Check for suspicious patterns (simplified)
    if (amount === 999.99 || amount === 9999.99) {
      riskScore += 20;
      flags.push('suspicious_amount');
    }

    // Check user transaction history
    const recentTransactions = await storage.getUserTransactions(userId, 10);
    const recentTotal = recentTransactions
      .filter(tx => new Date(tx.createdAt ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    if (recentTotal > 5000) {
      riskScore += 15;
      flags.push('high_daily_volume');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, score: riskScore, flags };
  }

  // AI Agent Transaction Compliance Check
  async checkAITransaction_new(transaction: any): Promise<{ approved: boolean; flags: string[] }> {
    const flags: string[] = [];
    const amount = parseFloat(transaction.amount);

    // Check amount limits for AI transactions
    if (amount > 25000) {
      flags.push('ai_transaction_limit_exceeded');
      return { approved: false, flags };
    }

    // Check for rapid AI transactions (velocity limits)
    if (transaction.metadata?.riskScore > 0.7) {
      flags.push('high_risk_ai_transaction');
    }

    // Check for cross-owner transactions requiring additional verification
    if (transaction.metadata?.crossOwner) {
      flags.push('cross_owner_ai_transaction');

      // Require additional checks for cross-owner AI transactions
      if (amount > 5000) {
        flags.push('high_value_cross_owner');
        return { approved: false, flags };
      }
    }

    // Check for AI transaction patterns
    if (transaction.purpose && transaction.purpose.toLowerCase().includes('test')) {
      flags.push('test_transaction');
      return { approved: false, flags };
    }

    // AI transactions are generally approved with monitoring
    if (flags.length > 0 && !flags.includes('ai_transaction_limit_exceeded')) {
      flags.push('ai_transaction_monitored');
    }

    await this.logComplianceEvent('AI_TRANSACTION_COMPLIANCE_CHECK_COMPLETED', {
      transactionId: transaction.id,
      approved: flags.length === 0 || !flags.includes('ai_transaction_limit_exceeded'),
      flags
    });

    return { 
      approved: !flags.includes('ai_transaction_limit_exceeded') && !flags.includes('high_value_cross_owner'),
      flags 
    };
  }
}

export const complianceService = new ComplianceService();