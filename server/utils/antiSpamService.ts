/**
 * Anti-Spam Protection Service
 * Prevents micro-transaction attacks and suspicious patterns
 */

import { db } from '../db';
import { transactions, users } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

interface SpamDetectionResult {
  isSpam: boolean;
  reason?: string;
  riskScore: number;
  action: 'allow' | 'block' | 'review';
}

export class AntiSpamService {
  private static suspiciousPatterns = new Map<string, number>();
  
  /**
   * Detect micro-transaction spam attacks
   */
  static async detectMicroTransactionSpam(
    userId: string,
    amount: number,
    timeWindow: number = 3600000 // 1 hour
  ): Promise<SpamDetectionResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    // Count small transactions in the time window
    const recentSmallTransactions = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          gte(transactions.createdAt, windowStart),
          sql`amount < 1.00` // Transactions under $1
        )
      );
    
    const smallTxCount = recentSmallTransactions[0]?.count || 0;
    
    // Flag if more than 50 micro-transactions in an hour
    if (smallTxCount > 50) {
      return {
        isSpam: true,
        reason: 'Excessive micro-transactions detected',
        riskScore: 95,
        action: 'block'
      };
    }
    
    // Calculate risk score based on patterns
    let riskScore = this.calculateTransactionRiskScore(amount, smallTxCount);
    
    return {
      isSpam: riskScore > 80,
      riskScore,
      action: riskScore > 80 ? 'block' : riskScore > 60 ? 'review' : 'allow'
    };
  }
  
  /**
   * Detect transaction structuring (breaking large amounts into smaller ones)
   */
  static async detectStructuring(
    userId: string,
    amount: number,
    timeWindow: number = 86400000 // 24 hours
  ): Promise<SpamDetectionResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          gte(transactions.createdAt, windowStart)
        )
      );
    
    const totalAmount = recentTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount), amount
    );
    
    // Check for structuring patterns
    if (totalAmount >= 9500 && recentTransactions.length >= 5) {
      // Multiple transactions approaching CTR threshold
      const avgAmount = totalAmount / (recentTransactions.length + 1);
      
      if (avgAmount < 2000) { // Average under $2000 but total near $10k
        return {
          isSpam: true,
          reason: 'Potential transaction structuring detected',
          riskScore: 90,
          action: 'review'
        };
      }
    }
    
    return {
      isSpam: false,
      riskScore: 0,
      action: 'allow'
    };
  }
  
  /**
   * Detect rapid-fire transaction attempts
   */
  static async detectRapidFire(
    userId: string,
    timeWindow: number = 60000 // 1 minute
  ): Promise<SpamDetectionResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    const recentAttempts = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          gte(transactions.createdAt, windowStart)
        )
      );
    
    const attemptCount = recentAttempts[0]?.count || 0;
    
    // More than 10 transactions per minute is suspicious
    if (attemptCount > 10) {
      return {
        isSpam: true,
        reason: 'Rapid-fire transaction attempts',
        riskScore: 85,
        action: 'block'
      };
    }
    
    return {
      isSpam: false,
      riskScore: attemptCount * 5, // Gradual risk increase
      action: attemptCount > 5 ? 'review' : 'allow'
    };
  }
  
  /**
   * Calculate overall transaction risk score
   */
  private static calculateTransactionRiskScore(
    amount: number,
    recentSmallTxCount: number
  ): number {
    let score = 0;
    
    // Micro-transaction penalty
    if (amount < 0.10) score += 30;
    else if (amount < 1.00) score += 15;
    
    // Frequency penalty
    if (recentSmallTxCount > 20) score += 40;
    else if (recentSmallTxCount > 10) score += 20;
    
    // Round number penalty (often automated)
    if (amount === Math.round(amount)) score += 5;
    
    return Math.min(score, 100);
  }
  
  /**
   * Comprehensive spam check
   */
  static async performSpamCheck(
    userId: string,
    amount: number
  ): Promise<SpamDetectionResult> {
    // Run all spam detection checks
    const [microSpam, structuring, rapidFire] = await Promise.all([
      this.detectMicroTransactionSpam(userId, amount),
      this.detectStructuring(userId, amount),
      this.detectRapidFire(userId)
    ]);
    
    // Return the most severe result
    const results = [microSpam, structuring, rapidFire];
    const maxRiskResult = results.reduce((max, current) => 
      current.riskScore > max.riskScore ? current : max
    );
    
    // Log suspicious activity
    if (maxRiskResult.riskScore > 60) {
      console.warn(`Suspicious transaction activity detected for user ${userId}:`, {
        amount,
        riskScore: maxRiskResult.riskScore,
        reason: maxRiskResult.reason
      });
    }
    
    return maxRiskResult;
  }
}

export default AntiSpamService;