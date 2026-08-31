/**
 * Referral Validation Service
 * Prevents phantom referral codes and commission liabilities
 */

import { storage } from '../storage';

export interface ReferralValidationResult {
  isValid: boolean;
  agentExists: boolean;
  agentActive: boolean;
  referralCode?: string;
  error?: string;
}

export class ReferralValidator {
  /**
   * Validate that agent exists and is active before generating referral code
   */
  static async validateAndGenerateReferralCode(agentId: string): Promise<ReferralValidationResult> {
    try {
      // First check if agent exists in global agents table
      const agent = await storage.getGlobalAIAgent(agentId);
      
      if (!agent) {
        console.warn(`Attempted to generate referral code for non-existent agent: ${agentId}`);
        return {
          isValid: false,
          agentExists: false,
          agentActive: false,
          error: 'Agent does not exist'
        };
      }

      // Check if agent is active
      if (!agent.isActive) {
        console.warn(`Attempted to generate referral code for inactive agent: ${agentId}`);
        return {
          isValid: false,
          agentExists: true,
          agentActive: false,
          error: 'Agent is not active'
        };
      }

      // Generate referral code using agent ID and timestamp
      const timestamp = Date.now();
      const referralCode = `REF_${agentId}_${timestamp}`;

      // Update agent with referral code
      await storage.updateAgentReferralCode(agentId, referralCode);

      return {
        isValid: true,
        agentExists: true,
        agentActive: true,
        referralCode
      };
    } catch (error) {
      console.error('Failed to validate agent for referral code generation:', error);
      return {
        isValid: false,
        agentExists: false,
        agentActive: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Validate referral code before processing commission
   */
  static async validateReferralCode(referralCode: string): Promise<ReferralValidationResult> {
    try {
      // Check if referral code exists and get associated agent
      const agent = await storage.getAgentByReferralCode(referralCode);

      if (!agent) {
        console.warn(`Invalid referral code used: ${referralCode}`);
        return {
          isValid: false,
          agentExists: false,
          agentActive: false,
          error: 'Referral code does not exist'
        };
      }

      // Verify agent is still active
      if (!agent.isActive) {
        console.warn(`Referral code used for inactive agent: ${referralCode}, Agent: ${agent.id}`);
        return {
          isValid: false,
          agentExists: true,
          agentActive: false,
          error: 'Agent is no longer active'
        };
      }

      return {
        isValid: true,
        agentExists: true,
        agentActive: true,
        referralCode
      };
    } catch (error) {
      console.error('Failed to validate referral code:', error);
      return {
        isValid: false,
        agentExists: false,
        agentActive: false,
        error: 'Referral code validation failed'
      };
    }
  }

  /**
   * Calculate commission with agent validation
   */
  static async calculateValidatedCommission(
    referralCode: string, 
    transactionAmount: number
  ): Promise<{ success: boolean; commission?: number; agentId?: string; error?: string }> {
    try {
      // First validate the referral code
      const validation = await this.validateReferralCode(referralCode);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Get agent details for commission calculation
      const agent = await storage.getAgentByReferralCode(referralCode);
      
      if (!agent) {
        return {
          success: false,
          error: 'Agent not found during commission calculation'
        };
      }

      // Calculate commission (1% for basic tier)
      const commissionRate = 0.01; // 1%
      const commission = transactionAmount * commissionRate;

      // Minimum commission threshold ($0.01)
      if (commission < 0.01) {
        return {
          success: false,
          error: 'Commission below minimum threshold'
        };
      }

      return {
        success: true,
        commission,
        agentId: agent.id
      };
    } catch (error) {
      console.error('Failed to calculate validated commission:', error);
      return {
        success: false,
        error: 'Commission calculation failed'
      };
    }
  }

  /**
   * Prevent duplicate referral processing
   */
  static async checkDuplicateReferral(userId: string, agentId: string): Promise<boolean> {
    try {
      // Check if user already has a referral relationship with this agent
      const existingReferrals = await storage.getUserReferrals(userId);
      
      return existingReferrals.some(referral => 
        referral.referrerId === agentId &&
        referral.status === 'active'
      );
    } catch (error) {
      console.error('Failed to check for duplicate referrals:', error);
      return false;
    }
  }

  /**
   * Validate user eligibility for referral program
   */
  static async validateUserEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return { eligible: false, reason: 'User not found' };
      }

      // Check if user is already referred by someone else
      if (user.referredBy) {
        return { eligible: false, reason: 'User already has a referrer' };
      }

      // Check account status
      if (user.accountStatus !== 'active') {
        return { eligible: false, reason: 'User account is not active' };
      }

      return { eligible: true };
    } catch (error) {
      console.error('Failed to validate user eligibility:', error);
      return { eligible: false, reason: 'Validation failed' };
    }
  }
}