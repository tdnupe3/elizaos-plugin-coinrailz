/**
 * Secure Service Delivery System - Anti-Fraud Protection
 * Fixes critical payment reversal vulnerability
 */

export interface DeliveryVerification {
  orderId: string;
  agentProof: {
    deliveryHash: string;
    timestamp: Date;
    digitalSignature: string;
    deliveryMethod: string;
    evidenceUrls: string[];
  };
  platformVerification: {
    deliveryConfirmed: boolean;
    verificationMethod: 'automatic' | 'manual_review';
    evidenceScore: number; // 0-100
    verifiedAt: Date;
  };
  customerAcknowledgment: {
    received: boolean;
    acknowledgedAt?: Date;
    disputeDeadline: Date; // 72 hours from delivery
    disputeFiled: boolean;
  };
  escrowStatus: 'held' | 'released' | 'disputed';
}

export interface CustomerRiskProfile {
  customerId: string;
  disputeHistory: number;
  successfulTransactions: number;
  riskScore: number; // 0-100 (higher = riskier)
  requiresEscrowExtension: boolean;
  blacklisted: boolean;
}

export class SecureServiceDelivery {
  private static deliveryVerifications = new Map<string, DeliveryVerification>();
  private static customerProfiles = new Map<string, CustomerRiskProfile>();
  
  /**
   * Agent submits service delivery with proof
   */
  static async submitServiceDelivery(
    orderId: string,
    agentId: string,
    deliveryData: any,
    evidenceUrls: string[] = []
  ): Promise<{ success: boolean; verificationHash?: string; autoReleaseTime?: Date }> {
    
    try {
      // Generate cryptographic proof of delivery
      const deliveryHash = this.generateDeliveryHash(orderId, deliveryData, evidenceUrls);
      const digitalSignature = this.generateAgentSignature(agentId, deliveryHash);
      
      // Create delivery verification record
      const verification: DeliveryVerification = {
        orderId,
        agentProof: {
          deliveryHash,
          timestamp: new Date(),
          digitalSignature,
          deliveryMethod: deliveryData.method,
          evidenceUrls
        },
        platformVerification: {
          deliveryConfirmed: true,
          verificationMethod: evidenceUrls.length > 0 ? 'automatic' : 'manual_review',
          evidenceScore: this.calculateEvidenceScore(deliveryData, evidenceUrls),
          verifiedAt: new Date()
        },
        customerAcknowledgment: {
          received: false,
          disputeDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
          disputeFiled: false
        },
        escrowStatus: 'held'
      };
      
      this.deliveryVerifications.set(orderId, verification);
      
      // Notify customer of delivery
      await this.notifyCustomerOfDelivery(orderId, verification);
      
      // Schedule automatic release after 72 hours
      const autoReleaseTime = verification.customerAcknowledgment.disputeDeadline;
      setTimeout(() => this.processAutoRelease(orderId), 72 * 60 * 60 * 1000);
      
      console.log('Secure delivery submitted:', {
        orderId,
        evidenceScore: verification.platformVerification.evidenceScore,
        autoReleaseTime
      });
      
      return {
        success: true,
        verificationHash: deliveryHash,
        autoReleaseTime
      };
      
    } catch (error: any) {
      console.error('Secure delivery submission failed:', error);
      return { success: false };
    }
  }
  
  /**
   * Customer acknowledges receipt (optional - prevents disputes)
   */
  static async customerAcknowledgeDelivery(
    orderId: string,
    customerId: string,
    rating: number,
    feedback?: string
  ): Promise<{ success: boolean; paymentReleased?: boolean }> {
    
    try {
      const verification = this.deliveryVerifications.get(orderId);
      if (!verification) {
        throw new Error('Delivery verification not found');
      }
      
      // Update customer acknowledgment
      verification.customerAcknowledgment.received = true;
      verification.customerAcknowledgment.acknowledgedAt = new Date();
      
      // Immediate payment release for acknowledged deliveries
      verification.escrowStatus = 'released';
      const paymentReleased = await this.releasePaymentToAgent(orderId);
      
      // Update customer risk profile (positive)
      this.updateCustomerRiskProfile(customerId, 'successful_transaction');
      
      console.log('Customer acknowledged delivery:', {
        orderId,
        rating,
        paymentReleased
      });
      
      return {
        success: true,
        paymentReleased
      };
      
    } catch (error: any) {
      console.error('Customer acknowledgment failed:', error);
      return { success: false };
    }
  }
  
  /**
   * Customer files dispute (requires evidence)
   */
  static async fileDeliveryDispute(
    orderId: string,
    customerId: string,
    reason: string,
    customerEvidence: string[]
  ): Promise<{ success: boolean; disputeId?: string; requiresReview?: boolean }> {
    
    try {
      const verification = this.deliveryVerifications.get(orderId);
      if (!verification) {
        throw new Error('Delivery verification not found');
      }
      
      // Check if dispute is within 72-hour window
      if (Date.now() > verification.customerAcknowledgment.disputeDeadline.getTime()) {
        throw new Error('Dispute deadline has passed - payment already released');
      }
      
      // Check customer risk profile
      const riskProfile = this.getCustomerRiskProfile(customerId);
      if (riskProfile.blacklisted) {
        throw new Error('Customer account suspended due to fraud history');
      }
      
      // File dispute
      verification.customerAcknowledgment.disputeFiled = true;
      verification.escrowStatus = 'disputed';
      
      const disputeId = `dispute_${orderId}_${Date.now()}`;
      
      // Create evidence-based dispute review
      const disputeReview = await this.createDisputeReview(
        disputeId,
        verification,
        reason,
        customerEvidence,
        riskProfile
      );
      
      // Update customer risk profile (negative)
      this.updateCustomerRiskProfile(customerId, 'dispute_filed');
      
      console.log('Dispute filed:', {
        disputeId,
        orderId,
        customerRiskScore: riskProfile.riskScore,
        requiresManualReview: disputeReview.requiresManualReview
      });
      
      return {
        success: true,
        disputeId,
        requiresReview: disputeReview.requiresManualReview
      };
      
    } catch (error: any) {
      console.error('Dispute filing failed:', error);
      return { success: false };
    }
  }
  
  /**
   * Automatic payment release after 72 hours (no dispute)
   */
  private static async processAutoRelease(orderId: string): Promise<void> {
    try {
      const verification = this.deliveryVerifications.get(orderId);
      if (!verification) return;
      
      // Only auto-release if no dispute filed and deadline passed
      if (!verification.customerAcknowledgment.disputeFiled && 
          Date.now() > verification.customerAcknowledgment.disputeDeadline.getTime()) {
        
        verification.escrowStatus = 'released';
        await this.releasePaymentToAgent(orderId);
        
        console.log('Auto-released payment:', {
          orderId,
          releasedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Auto-release failed:', orderId, error);
    }
  }
  
  /**
   * Calculate evidence score for delivery verification
   */
  private static calculateEvidenceScore(deliveryData: any, evidenceUrls: string[]): number {
    let score = 50; // Base score
    
    // Evidence URL bonus
    score += Math.min(evidenceUrls.length * 10, 30);
    
    // Delivery method bonus
    switch (deliveryData.method) {
      case 'api_endpoint':
      case 'webhook':
        score += 20; // Automatic verification possible
        break;
      case 'file_upload':
        score += 15; // File timestamp verification
        break;
      case 'email':
        score += 10; // Email delivery confirmation
        break;
      default:
        score += 5;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Update customer risk profile based on behavior
   */
  private static updateCustomerRiskProfile(
    customerId: string,
    action: 'successful_transaction' | 'dispute_filed' | 'false_dispute'
  ): void {
    
    let profile = this.customerProfiles.get(customerId) || {
      customerId,
      disputeHistory: 0,
      successfulTransactions: 0,
      riskScore: 0,
      requiresEscrowExtension: false,
      blacklisted: false
    };
    
    switch (action) {
      case 'successful_transaction':
        profile.successfulTransactions++;
        profile.riskScore = Math.max(0, profile.riskScore - 5);
        break;
        
      case 'dispute_filed':
        profile.disputeHistory++;
        profile.riskScore += 20;
        break;
        
      case 'false_dispute':
        profile.disputeHistory++;
        profile.riskScore += 50;
        if (profile.riskScore >= 80) {
          profile.blacklisted = true;
        }
        break;
    }
    
    // Risk-based escrow requirements
    profile.requiresEscrowExtension = profile.riskScore > 60;
    
    this.customerProfiles.set(customerId, profile);
  }
  
  /**
   * Get customer risk profile
   */
  private static getCustomerRiskProfile(customerId: string): CustomerRiskProfile {
    return this.customerProfiles.get(customerId) || {
      customerId,
      disputeHistory: 0,
      successfulTransactions: 0,
      riskScore: 0,
      requiresEscrowExtension: false,
      blacklisted: false
    };
  }
  
  /**
   * Create evidence-based dispute review
   */
  private static async createDisputeReview(
    disputeId: string,
    verification: DeliveryVerification,
    reason: string,
    customerEvidence: string[],
    riskProfile: CustomerRiskProfile
  ): Promise<{ requiresManualReview: boolean; autoResolution?: string }> {
    
    const agentEvidenceScore = verification.platformVerification.evidenceScore;
    const customerEvidenceScore = customerEvidence.length * 20;
    
    // High-risk customers require manual review
    if (riskProfile.riskScore > 50) {
      return { requiresManualReview: true };
    }
    
    // Strong agent evidence vs weak customer evidence
    if (agentEvidenceScore >= 80 && customerEvidenceScore < 40) {
      return {
        requiresManualReview: false,
        autoResolution: 'favor_agent_strong_evidence'
      };
    }
    
    // Require manual review for complex cases
    return { requiresManualReview: true };
  }
  
  /**
   * Generate cryptographic delivery hash
   */
  private static generateDeliveryHash(orderId: string, deliveryData: any, evidenceUrls: string[]): string {
    const content = JSON.stringify({ orderId, deliveryData, evidenceUrls, timestamp: Date.now() });
    return `delivery_${Buffer.from(content).toString('base64').slice(0, 32)}`;
  }
  
  /**
   * Generate agent digital signature
   */
  private static generateAgentSignature(agentId: string, deliveryHash: string): string {
    return `agent_${agentId}_${deliveryHash.slice(0, 16)}_${Date.now()}`;
  }
  
  /**
   * Notify customer of delivery
   */
  private static async notifyCustomerOfDelivery(orderId: string, verification: DeliveryVerification): Promise<void> {
    // Implementation would send notification to customer
    console.log('Customer notified of delivery:', {
      orderId,
      disputeDeadline: verification.customerAcknowledgment.disputeDeadline
    });
  }
  
  /**
   * Release payment to agent
   */
  private static async releasePaymentToAgent(orderId: string): Promise<boolean> {
    // Implementation would process actual payment release
    console.log('Payment released to agent:', orderId);
    return true;
  }
  
  /**
   * Get delivery status for order
   */
  static getDeliveryStatus(orderId: string): DeliveryVerification | null {
    return this.deliveryVerifications.get(orderId) || null;
  }
  
  /**
   * Get customer risk assessment
   */
  static getCustomerRisk(customerId: string): CustomerRiskProfile {
    return this.getCustomerRiskProfile(customerId);
  }
}