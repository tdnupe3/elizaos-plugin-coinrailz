/**
 * Compliance and Terms Enforcement System
 * Handles user violations, enforcement actions, and compliance monitoring
 */

import { db } from "./db";
import { users, userViolations, agentRegistrations } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";

export enum ViolationType {
  MINOR_VIOLATION = 'minor',
  MODERATE_VIOLATION = 'moderate', 
  SEVERE_VIOLATION = 'severe',
  LEGAL_VIOLATION = 'legal'
}

export enum EnforcementAction {
  WARNING = 'warning',
  TEMPORARY_SUSPENSION = 'suspension',
  PERMANENT_TERMINATION = 'termination'
}

export interface ViolationRecord {
  userId: string;
  violationType: ViolationType;
  description: string;
  enforcementAction: EnforcementAction;
  suspensionEndDate?: Date;
  reportedBy?: string;
  evidence?: string;
}

export class ComplianceService {
  /**
   * Record a user violation and determine appropriate enforcement action
   */
  static async recordViolation(violation: ViolationRecord): Promise<void> {
    // Get user's violation history
    const violationHistory = await db
      .select()
      .from(userViolations)
      .where(eq(userViolations.userId, violation.userId))
      .orderBy(desc(userViolations.createdAt));

    // Determine enforcement action based on violation type and history
    const enforcementAction = this.determineEnforcementAction(
      violation.violationType,
      violationHistory.length
    );

    // Record the violation
    await db.insert(userViolations).values({
      userId: violation.userId,
      violationType: violation.violationType,
      description: violation.description,
      enforcementAction,
      suspensionEndDate: violation.suspensionEndDate,
      reportedBy: violation.reportedBy,
      evidence: violation.evidence,
      createdAt: new Date(),
    });

    // Apply enforcement action
    await this.applyEnforcementAction(violation.userId, enforcementAction, violation.suspensionEndDate);
  }

  /**
   * Determine appropriate enforcement action based on violation type and history
   */
  private static determineEnforcementAction(
    violationType: ViolationType,
    violationCount: number
  ): EnforcementAction {
    // Immediate termination for legal violations
    if (violationType === ViolationType.LEGAL_VIOLATION) {
      return EnforcementAction.PERMANENT_TERMINATION;
    }

    // Immediate termination for severe violations
    if (violationType === ViolationType.SEVERE_VIOLATION) {
      return EnforcementAction.PERMANENT_TERMINATION;
    }

    // Escalating enforcement for minor/moderate violations
    if (violationType === ViolationType.MINOR_VIOLATION) {
      if (violationCount === 0) return EnforcementAction.WARNING;
      if (violationCount === 1) return EnforcementAction.TEMPORARY_SUSPENSION;
      return EnforcementAction.PERMANENT_TERMINATION;
    }

    if (violationType === ViolationType.MODERATE_VIOLATION) {
      if (violationCount === 0) return EnforcementAction.TEMPORARY_SUSPENSION;
      return EnforcementAction.PERMANENT_TERMINATION;
    }

    return EnforcementAction.WARNING;
  }

  /**
   * Apply enforcement action to user account
   */
  private static async applyEnforcementAction(
    userId: string,
    action: EnforcementAction,
    suspensionEndDate?: Date
  ): Promise<void> {
    switch (action) {
      case EnforcementAction.WARNING:
        // Warning is recorded but no account changes needed
        break;

      case EnforcementAction.TEMPORARY_SUSPENSION:
        await db
          .update(users)
          .set({
            accountStatus: 'suspended',
            suspensionEndDate: suspensionEndDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
        break;

      case EnforcementAction.PERMANENT_TERMINATION:
        await db
          .update(users)
          .set({
            accountStatus: 'terminated',
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // Also terminate any AI agents registered by this user
        await db
          .update(agentRegistrations)
          .set({
            status: 'terminated',
            updatedAt: new Date(),
          })
          .where(eq(agentRegistrations.ownerId, userId));
        break;
    }
  }

  /**
   * Check if user account is in good standing
   */
  static async checkAccountStatus(userId: string): Promise<{
    isActive: boolean;
    status: string;
    suspensionEndDate?: Date;
    violationCount: number;
  }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return {
        isActive: false,
        status: 'not_found',
        violationCount: 0,
      };
    }

    const [violationCountResult] = await db
      .select({ count: count() })
      .from(userViolations)
      .where(eq(userViolations.userId, userId));

    const violationCount = violationCountResult?.count || 0;

    // Check if suspension has expired
    if (user.accountStatus === 'suspended' && user.suspensionEndDate && user.suspensionEndDate < new Date()) {
      await db
        .update(users)
        .set({
          accountStatus: 'active',
          suspensionEndDate: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        isActive: true,
        status: 'active',
        violationCount,
      };
    }

    return {
      isActive: user.accountStatus === 'active',
      status: user.accountStatus || 'active',
      suspensionEndDate: user.suspensionEndDate || undefined,
      violationCount,
    };
  }

  /**
   * Get user's violation history
   */
  static async getViolationHistory(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(userViolations)
      .where(eq(userViolations.userId, userId))
      .orderBy(desc(userViolations.createdAt));
  }

  /**
   * Report suspicious activity for compliance review
   */
  static async reportSuspiciousActivity(
    userId: string,
    activityType: string,
    description: string,
    evidence?: any
  ): Promise<void> {
    // In a production system, this would integrate with compliance monitoring tools
    console.log(`Suspicious activity reported for user ${userId}: ${activityType} - ${description}`);
    
    // Record as potential violation for review
    await this.recordViolation({
      userId,
      violationType: ViolationType.MINOR_VIOLATION,
      description: `Suspicious activity: ${activityType} - ${description}`,
      enforcementAction: EnforcementAction.WARNING,
      reportedBy: 'system',
      evidence: JSON.stringify(evidence),
    });
  }
}

/**
 * Middleware to check account status before processing requests
 */
export async function checkAccountStatusMiddleware(userId: string): Promise<boolean> {
  const accountStatus = await ComplianceService.checkAccountStatus(userId);
  return accountStatus.isActive;
}