/**
 * Fraud Detection Service
 * Real-time transaction monitoring and risk assessment for financial compliance
 */

import { db } from "../db";
import { users, transactions } from "@shared/schema";
import { eq, and, gte, lte, count, sum } from "drizzle-orm";

export interface FraudAlert {
  id: string;
  userId: string;
  transactionId?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alertType: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  falsePositive: boolean;
}

export interface RiskScore {
  overall: number; // 0-100
  velocity: number;
  pattern: number;
  geographic: number;
  behavioral: number;
  factors: string[];
}

export interface TransactionRiskAssessment {
  approved: boolean;
  riskScore: RiskScore;
  alerts: FraudAlert[];
  requiresManualReview: boolean;
  blockedReason?: string;
}

export class FraudDetectionService {
  private static instance: FraudDetectionService;
  private alerts: FraudAlert[] = [];

  static getInstance(): FraudDetectionService {
    if (!FraudDetectionService.instance) {
      FraudDetectionService.instance = new FraudDetectionService();
    }
    return FraudDetectionService.instance;
  }

  /**
   * Assess transaction risk in real-time
   */
  async assessTransactionRisk(
    userId: string,
    amount: number,
    currency: string,
    recipientId?: string,
    ipAddress?: string
  ): Promise<TransactionRiskAssessment> {
    
    const user = await this.getUserProfile(userId);
    if (!user) {
      return {
        approved: false,
        riskScore: { overall: 100, velocity: 100, pattern: 100, geographic: 100, behavioral: 100, factors: ['User not found'] },
        alerts: [],
        requiresManualReview: true,
        blockedReason: 'User verification required'
      };
    }

    // Perform comprehensive risk assessment
    const velocityScore = await this.checkVelocityRisk(userId, amount);
    const patternScore = await this.checkPatternRisk(userId, amount, currency);
    const geographicScore = await this.checkGeographicRisk(userId, ipAddress);
    const behavioralScore = await this.checkBehavioralRisk(userId, amount);

    const riskScore: RiskScore = {
      overall: Math.max(velocityScore.score, patternScore.score, geographicScore.score, behavioralScore.score),
      velocity: velocityScore.score,
      pattern: patternScore.score,
      geographic: geographicScore.score,
      behavioral: behavioralScore.score,
      factors: [
        ...velocityScore.factors,
        ...patternScore.factors,
        ...geographicScore.factors,
        ...behavioralScore.factors
      ]
    };

    // Generate alerts based on risk factors
    const alerts = await this.generateRiskAlerts(userId, riskScore, amount);

    // Determine approval status
    const approved = riskScore.overall < 70 && !alerts.some(a => a.riskLevel === 'critical');
    const requiresManualReview = riskScore.overall >= 50 || alerts.some(a => a.riskLevel === 'high');

    return {
      approved,
      riskScore,
      alerts,
      requiresManualReview,
      blockedReason: approved ? undefined : this.getBlockedReason(riskScore)
    };
  }

  /**
   * Check transaction velocity risk
   */
  private async checkVelocityRisk(userId: string, amount: number): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check transactions in last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = await this.getRecentTransactions(userId, last24h);

    // Daily transaction count
    if (recentTransactions.length > 10) {
      score += 30;
      factors.push(`High transaction frequency: ${recentTransactions.length} in 24h`);
    }

    // Daily transaction volume
    const dailyVolume = recentTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
    if (dailyVolume > 10000) {
      score += 40;
      factors.push(`High daily volume: $${dailyVolume.toFixed(2)}`);
    }

    // Large single transaction
    if (amount > 5000) {
      score += 25;
      factors.push(`Large transaction amount: $${amount.toFixed(2)}`);
    }

    // Rapid successive transactions
    if (recentTransactions.length > 5) {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyCount = recentTransactions.filter(tx => new Date(tx.createdAt) > lastHour).length;
      if (hourlyCount > 3) {
        score += 35;
        factors.push(`Rapid transactions: ${hourlyCount} in last hour`);
      }
    }

    return { score: Math.min(score, 100), factors };
  }

  /**
   * Check transaction pattern risk
   */
  private async checkPatternRisk(userId: string, amount: number, currency: string): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Get user's transaction history
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const historicalTransactions = await this.getRecentTransactions(userId, last30Days);

    if (historicalTransactions.length === 0) {
      score += 20;
      factors.push('New user with no transaction history');
    } else {
      // Check for unusual amount patterns
      const amounts = historicalTransactions.map(tx => parseFloat(tx.amount || '0'));
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      
      if (amount > avgAmount * 5) {
        score += 30;
        factors.push(`Amount significantly higher than average: ${(amount / avgAmount).toFixed(1)}x`);
      }

      // Check for round number patterns (potential structuring)
      if (amount % 1000 === 0 && amount >= 3000) {
        score += 15;
        factors.push('Round number transaction (potential structuring)');
      }

      // Check for currency switching patterns
      const currencies = [...new Set(historicalTransactions.map(tx => tx.currency))];
      if (currencies.length > 3) {
        score += 10;
        factors.push('Multiple currency usage pattern');
      }
    }

    return { score: Math.min(score, 100), factors };
  }

  /**
   * Check geographic risk
   */
  private async checkGeographicRisk(userId: string, ipAddress?: string): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    if (!ipAddress) {
      return { score: 10, factors: ['No IP address provided'] };
    }

    // In production, would use actual IP geolocation service
    const isHighRiskCountry = this.checkHighRiskCountry(ipAddress);
    if (isHighRiskCountry) {
      score += 40;
      factors.push('Transaction from high-risk geographic location');
    }

    const isVPNOrProxy = this.checkVPNOrProxy(ipAddress);
    if (isVPNOrProxy) {
      score += 25;
      factors.push('Transaction through VPN or proxy');
    }

    return { score: Math.min(score, 100), factors };
  }

  /**
   * Check behavioral risk
   */
  private async checkBehavioralRisk(userId: string, amount: number): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    const user = await this.getUserProfile(userId);
    if (!user) {
      return { score: 100, factors: ['User profile not found'] };
    }

    // Check account age
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const daysSinceCreation = accountAge / (24 * 60 * 60 * 1000);

    if (daysSinceCreation < 7) {
      score += 30;
      factors.push(`New account: ${Math.floor(daysSinceCreation)} days old`);
    }

    // Check KYC status
    if (user.kycStatus !== 'verified') {
      score += 40;
      factors.push('Unverified identity');
    }

    // Check risk score from previous activity
    if (user.riskScore && user.riskScore > 50) {
      score += user.riskScore * 0.5;
      factors.push(`Historical risk score: ${user.riskScore}`);
    }

    return { score: Math.min(score, 100), factors };
  }

  /**
   * Generate risk alerts based on assessment
   */
  private async generateRiskAlerts(userId: string, riskScore: RiskScore, amount: number): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    if (riskScore.overall >= 80) {
      alerts.push(this.createAlert(userId, 'critical', 'HIGH_RISK_TRANSACTION', 
        `Critical risk transaction detected (score: ${riskScore.overall})`));
    } else if (riskScore.overall >= 60) {
      alerts.push(this.createAlert(userId, 'high', 'ELEVATED_RISK', 
        `Elevated risk transaction (score: ${riskScore.overall})`));
    }

    if (riskScore.velocity >= 70) {
      alerts.push(this.createAlert(userId, 'high', 'VELOCITY_ALERT', 
        'Unusual transaction velocity detected'));
    }

    if (amount > 10000) {
      alerts.push(this.createAlert(userId, 'medium', 'LARGE_AMOUNT', 
        `Large transaction amount: $${amount.toFixed(2)}`));
    }

    // Store alerts
    this.alerts.push(...alerts);

    return alerts;
  }

  /**
   * Create fraud alert
   */
  private createAlert(userId: string, riskLevel: FraudAlert['riskLevel'], alertType: string, description: string): FraudAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      riskLevel,
      alertType,
      description,
      timestamp: new Date().toISOString(),
      resolved: false,
      falsePositive: false
    };
  }

  /**
   * Get blocked reason based on risk score
   */
  private getBlockedReason(riskScore: RiskScore): string {
    if (riskScore.overall >= 90) {
      return 'Transaction blocked due to critical risk factors';
    } else if (riskScore.velocity >= 80) {
      return 'Transaction blocked due to unusual velocity patterns';
    } else if (riskScore.behavioral >= 80) {
      return 'Transaction blocked due to account verification requirements';
    } else {
      return 'Transaction blocked due to elevated risk assessment';
    }
  }

  /**
   * Helper methods for data retrieval
   */
  private async getUserProfile(userId: string) {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result[0] || null;
  }

  private async getRecentTransactions(userId: string, since: Date) {
    // In production, would query actual transactions table
    return [];
  }

  private checkHighRiskCountry(ipAddress: string): boolean {
    // In production, would use actual IP geolocation and risk database
    return false;
  }

  private checkVPNOrProxy(ipAddress: string): boolean {
    // In production, would use actual VPN/proxy detection service
    return false;
  }

  /**
   * Get fraud alerts for user
   */
  getFraudAlerts(userId?: string): FraudAlert[] {
    return this.alerts
      .filter(alert => !userId || alert.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }

  /**
   * Resolve fraud alert
   */
  resolveAlert(alertId: string, falsePositive: boolean = false): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.falsePositive = falsePositive;
    }
  }

  /**
   * Update user risk score based on transaction behavior
   */
  async updateUserRiskScore(userId: string, transactionOutcome: 'approved' | 'declined' | 'fraudulent'): Promise<void> {
    const user = await this.getUserProfile(userId);
    if (!user) return;

    let riskAdjustment = 0;
    switch (transactionOutcome) {
      case 'approved':
        riskAdjustment = -2; // Reduce risk slightly for successful transactions
        break;
      case 'declined':
        riskAdjustment = 5; // Increase risk for declined transactions
        break;
      case 'fraudulent':
        riskAdjustment = 30; // Significant increase for confirmed fraud
        break;
    }

    const newRiskScore = Math.max(0, Math.min(100, (user.riskScore || 0) + riskAdjustment));
    
    await db.update(users)
      .set({ riskScore: newRiskScore, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}