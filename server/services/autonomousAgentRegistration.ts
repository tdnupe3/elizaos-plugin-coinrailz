/**
 * Autonomous AI Agent Registration Service
 * Enables instant self-registration for AI agents (<15 seconds)
 */

export interface InstantRegistrationRequest {
  agentName: string;
  walletAddress: string;
  capabilities: string[];
  description?: string;
  apiEndpoint?: string;
  publicKey?: string;
  signature?: string;
  walletNetwork?: string;
  serviceType?: string;
  referralCode?: string;
  preferredCurrencies?: string[];
}

export interface InstantRegistrationResponse {
  success: boolean;
  agentId: string;
  referralId: string;
  instantActivation: boolean;
  canEarnCommissions: boolean;
  agent: {
    id: string;
    name: string;
    status: 'active' | 'pending_review';
    listingStatus: 'live' | 'under_review';
    walletAddress: string;
    capabilities: string[];
    scores: {
      capability: number;
      compliance: number;
      overall: number;
    };
    commissionStructure: {
      agentReferrals: string;
      humanReferrals: string;
      transactionCommissions: string;
      bonusEligible: boolean;
    };
    referralCode: string;
    activationTime?: string;
  };
  nextSteps: string;
  message: string;
}

export class AutonomousAgentRegistration {
  
  /**
   * Process instant AI agent registration
   * Target: <15 seconds total processing time
   */
  static async processInstantRegistration(data: InstantRegistrationRequest): Promise<InstantRegistrationResponse> {
    const startTime = Date.now();
    
    try {
      // Step 1: Generate IDs (<1 second)
      const agentId = `AGENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const referralId = `REF_${agentId}_${Math.random().toString(36).substr(2, 6)}`;
      
      // Step 2: Instant cryptographic verification (<3 seconds)
      const walletVerified = await this.verifyWalletOwnership(
        data.walletAddress, 
        data.signature, 
        data.publicKey
      );
      
      // Step 3: Automated capability scoring (<5 seconds)
      const capabilityScore = await this.scoreCapabilities(
        data.capabilities, 
        data.apiEndpoint
      );
      
      // Step 4: Algorithmic compliance assessment (<2 seconds)
      const complianceScore = await this.assessCompliance(
        data.agentName, 
        data.capabilities, 
        data.walletAddress
      );
      
      // Step 5: Instant activation decision (<1 second)
      const autoActivated = walletVerified && capabilityScore >= 0.6 && complianceScore >= 0.7;
      
      // Process referral if provided
      let referralBonus = 0;
      if (data.referralCode) {
        referralBonus = await this.processReferralRegistration(data.referralCode, agentId);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        agentId,
        referralId,
        instantActivation: autoActivated,
        canEarnCommissions: autoActivated,
        agent: {
          id: agentId,
          name: data.agentName,
          status: autoActivated ? 'active' : 'pending_review',
          listingStatus: autoActivated ? 'live' : 'under_review',
          walletAddress: data.walletAddress,
          capabilities: data.capabilities,
          scores: {
            capability: parseFloat(capabilityScore.toFixed(2)),
            compliance: parseFloat(complianceScore.toFixed(2)),
            overall: parseFloat(((capabilityScore + complianceScore) / 2).toFixed(2))
          },
          commissionStructure: {
            agentReferrals: '0.5%',
            humanReferrals: '0.5%',
            transactionCommissions: '1.0%',
            bonusEligible: autoActivated
          },
          referralCode: referralId,
          activationTime: autoActivated ? new Date().toISOString() : undefined
        },
        nextSteps: autoActivated ? 
          'Agent is live and can immediately start earning commissions by referring other agents and users' :
          'Agent under review - manual verification required for full activation',
        message: autoActivated ? 
          `AI agent registered and activated in ${processingTime}ms` : 
          `AI agent registered in ${processingTime}ms - pending verification`
      };
      
    } catch (error: any) {
      return {
        success: false,
        agentId: '',
        referralId: '',
        instantActivation: false,
        canEarnCommissions: false,
        agent: {} as any,
        nextSteps: 'Registration failed - retry with valid parameters',
        message: `Registration failed: ${error.message}`
      };
    }
  }
  
  /**
   * Verify wallet ownership through cryptographic signature
   * Target: <3 seconds
   */
  private static async verifyWalletOwnership(
    walletAddress: string, 
    signature?: string, 
    publicKey?: string
  ): Promise<boolean> {
    try {
      // Basic wallet format validation
      if (!walletAddress || walletAddress.length < 10) {
        return false;
      }
      
      // For now, accept valid wallet formats
      // In production, verify signature against wallet
      const validFormats = [
        /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/, // XRP
        /^0x[a-fA-F0-9]{40}$/, // Ethereum
        /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ // Solana
      ];
      
      return validFormats.some(format => format.test(walletAddress));
      
    } catch (error) {
      console.error('Wallet verification error:', error);
      return false;
    }
  }
  
  /**
   * Score agent capabilities automatically
   * Target: <5 seconds
   */
  private static async scoreCapabilities(
    capabilities: string[], 
    apiEndpoint?: string
  ): Promise<number> {
    try {
      let score = 0.5; // Base score
      
      // Score based on capability breadth
      const validCapabilities = [
        'trading', 'analysis', 'portfolio_management', 'risk_assessment',
        'market_data', 'arbitrage', 'signals', 'research', 'automation',
        'defi', 'yield_farming', 'staking', 'lending', 'borrowing'
      ];
      
      const validCount = capabilities.filter(cap => 
        validCapabilities.includes(cap.toLowerCase())
      ).length;
      
      score += Math.min(validCount * 0.1, 0.3); // Up to 0.3 bonus
      
      // Bonus for API endpoint
      if (apiEndpoint && this.isValidUrl(apiEndpoint)) {
        score += 0.2;
      }
      
      // Cap at 1.0
      return Math.min(score, 1.0);
      
    } catch (error) {
      console.error('Capability scoring error:', error);
      return 0.3; // Minimum score for errors
    }
  }
  
  /**
   * Assess compliance risk algorithmically
   * Target: <2 seconds
   */
  private static async assessCompliance(
    agentName: string, 
    capabilities: string[], 
    walletAddress: string
  ): Promise<number> {
    try {
      let score = 0.8; // Start with high compliance
      
      // Risk factors
      const riskKeywords = ['hack', 'exploit', 'drain', 'rug', 'scam'];
      const hasRiskKeywords = riskKeywords.some(keyword => 
        agentName.toLowerCase().includes(keyword)
      );
      
      if (hasRiskKeywords) {
        score -= 0.4;
      }
      
      // Suspicious capabilities
      const suspiciousCapabilities = ['wallet_access', 'private_keys', 'funds_transfer'];
      const hasSuspiciousCapabilities = capabilities.some(cap =>
        suspiciousCapabilities.includes(cap.toLowerCase())
      );
      
      if (hasSuspiciousCapabilities) {
        score -= 0.3;
      }
      
      // Validate wallet format for compliance
      if (!walletAddress || walletAddress.length < 10) {
        score -= 0.2;
      }
      
      return Math.max(score, 0.0);
      
    } catch (error) {
      console.error('Compliance assessment error:', error);
      return 0.5; // Neutral score for errors
    }
  }
  
  /**
   * Process referral registration
   */
  private static async processReferralRegistration(
    referralCode: string, 
    newAgentId: string
  ): Promise<number> {
    try {
      // Track referral relationship
      // In production, update referral tracking system
      const referralBonus = 10.00; // $10 bonus for successful referral
      
      console.log(`Referral processed: ${referralCode} -> ${newAgentId}, bonus: $${referralBonus}`);
      return referralBonus;
      
    } catch (error) {
      console.error('Referral processing error:', error);
      return 0;
    }
  }
  
  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get registration statistics
   */
  static async getRegistrationStats(): Promise<{
    totalRegistrations: number;
    instantActivations: number;
    averageProcessingTime: number;
    successRate: number;
  }> {
    // In production, fetch from database
    return {
      totalRegistrations: 127,
      instantActivations: 108,
      averageProcessingTime: 8.3, // seconds
      successRate: 0.95
    };
  }
}

export const autonomousAgentRegistration = AutonomousAgentRegistration;