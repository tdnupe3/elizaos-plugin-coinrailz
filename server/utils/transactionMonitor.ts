import { storage } from "../storage";

export interface TransactionRisk {
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  riskScore: number;
  flags: string[];
  requiresReview: boolean;
  blockedReason?: string;
}

export class TransactionMonitor {
  private static readonly RISK_THRESHOLDS = {
    HIGH_VELOCITY: 5, // transactions per hour
    DAILY_LIMIT: 10000, // USD
    LARGE_TRANSACTION: 5000, // USD
    SUSPICIOUS_PATTERN: 3 // rapid back-and-forth transfers
  };

  static async assessTransactionRisk(
    userId: string, 
    amount: number, 
    recipientEmail?: string
  ): Promise<TransactionRisk> {
    const flags: string[] = [];
    let riskScore = 0;
    
    try {
      // Get recent user transactions
      const recentTransactions = await storage.getUserTransactions(userId, 20);
      
      // Check velocity (transactions in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyTransactions = recentTransactions.filter(t => 
        new Date(t.createdAt!) > oneHourAgo
      );
      
      if (hourlyTransactions.length >= this.RISK_THRESHOLDS.HIGH_VELOCITY) {
        flags.push('HIGH_VELOCITY_TRANSACTIONS');
        riskScore += 30;
      }

      // Check daily aggregate
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailyTransactions = recentTransactions.filter(t => 
        new Date(t.createdAt!) > twentyFourHoursAgo
      );
      
      const dailyTotal = dailyTransactions.reduce((sum, t) => 
        sum + parseFloat(t.amount), 0
      );
      
      if (dailyTotal + amount > this.RISK_THRESHOLDS.DAILY_LIMIT) {
        flags.push('DAILY_LIMIT_EXCEEDED');
        riskScore += 40;
      }

      // Large transaction check
      if (amount >= this.RISK_THRESHOLDS.LARGE_TRANSACTION) {
        flags.push('LARGE_TRANSACTION');
        riskScore += 20;
      }

      // Pattern analysis - rapid back-and-forth with same recipient
      if (recipientEmail) {
        const recipientTransactions = recentTransactions.filter(t => 
          t.toEmail === recipientEmail && 
          new Date(t.createdAt!) > twentyFourHoursAgo
        );
        
        if (recipientTransactions.length >= this.RISK_THRESHOLDS.SUSPICIOUS_PATTERN) {
          flags.push('SUSPICIOUS_PATTERN');
          riskScore += 25;
        }
      }

      // First time user additional scrutiny
      if (recentTransactions.length === 0) {
        flags.push('NEW_USER');
        riskScore += 10;
      }

      // Round robin pattern detection (sending to multiple recipients rapidly)
      const uniqueRecipients = new Set(
        dailyTransactions.map(t => t.toEmail).filter(Boolean)
      );
      
      if (uniqueRecipients.size >= 5 && dailyTransactions.length >= 10) {
        flags.push('ROUND_ROBIN_PATTERN');
        riskScore += 35;
      }

      // Determine risk level and actions
      let riskLevel: TransactionRisk['riskLevel'];
      let requiresReview = false;
      let blockedReason: string | undefined;

      if (riskScore >= 80) {
        riskLevel = 'blocked';
        blockedReason = 'Transaction blocked due to high risk score';
      } else if (riskScore >= 50) {
        riskLevel = 'high';
        requiresReview = true;
      } else if (riskScore >= 25) {
        riskLevel = 'medium';
        requiresReview = amount >= 1000; // Review medium risk if >$1000
      } else {
        riskLevel = 'low';
      }

      return {
        riskLevel,
        riskScore: Math.min(riskScore, 100),
        flags,
        requiresReview,
        blockedReason
      };

    } catch (error) {
      console.error('Risk assessment failed:', error);
      // Fail secure - block transaction if we can't assess risk
      return {
        riskLevel: 'blocked',
        riskScore: 100,
        flags: ['RISK_ASSESSMENT_FAILED'],
        requiresReview: true,
        blockedReason: 'Unable to complete risk assessment'
      };
    }
  }

  static async logSuspiciousActivity(
    userId: string, 
    activityType: string, 
    details: any
  ): Promise<void> {
    try {
      await storage.createComplianceReport({
        userId,
        reportType: 'SUSPICIOUS_ACTIVITY',
        riskScore: 75,
        flaggedReasons: [activityType],
        iso20022MessageId: `SA-${Date.now()}`,
        filedWithAuthorities: false,
        details
      });
    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  static async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      return user?.complianceLevel === 'blocked' || false;
    } catch (error) {
      console.error('Failed to check user block status:', error);
      return false; // Fail open for user experience
    }
  }
}